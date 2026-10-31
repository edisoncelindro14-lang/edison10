import crypto from "crypto";
import { supabase, getSetting } from "../_lib/joytel-server.js";
import { isJoytelProduct, isJoytelRecharge, cleanSerial, paymongoOrderTid, placeJoytelFulfilment } from "../_lib/joytel-fulfill.js";

// PayMongo calls this endpoint when a payment link is paid.
// Register it in the PayMongo dashboard as:
//   https://<your-domain>/api/paymongo/webhook  (event: link.payment.paid)
//
// We read the raw request stream directly (rather than the req.body
// getter) because signature verification needs the exact raw bytes
// PayMongo signed — a JSON.parse/stringify round-trip of the body is
// not guaranteed to reproduce those bytes.

// The shared server client (service role key when available, so RLS cannot block the webhook).

const WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function verifySignature(rawBody, signatureHeader, secret) {
  const parts = Object.fromEntries((signatureHeader || "").split(",").map(p => p.split("=")));
  const signedPayload = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return parts.te ? parts.te === expected : parts.li === expected;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", service: "paymongo-webhook" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!WEBHOOK_SECRET) {
    return res.status(500).json({ error: "PAYMONGO_WEBHOOK_SECRET not configured" });
  }

  const rawBody = await getRawBody(req);
  const sigHeader = req.headers["paymongo-signature"] || "";

  if (!verifySignature(rawBody, sigHeader, WEBHOOK_SECRET)) {
    console.error("PayMongo webhook: invalid signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(rawBody);
  const eventType = event?.data?.attributes?.type;
  const eventData = event?.data?.attributes?.data;
  console.log(`PayMongo webhook: ${eventType}`);

  if (eventType === "link.payment.paid" && supabase) {
    const attrs = eventData?.attributes || {};
    const amountPaid = attrs.amount ? attrs.amount / 100 : 0;
    const referenceNumber = attrs.reference_number;
    const remarks = attrs.remarks || "";
    const memberIdMatch = remarks.match(/member_id:([a-zA-Z0-9-]+)/);
    const memberId = memberIdMatch ? memberIdMatch[1] : null;
    const linkId = eventData?.id;
    const isPurchase = remarks.startsWith("purpose:purchase");
    let retryLater = false;

    if (isPurchase) {
      // Shop checkout paid via PayMongo — create the completed transactions
      // now (no pending rows exist). Dedupe retried webhook deliveries by
      // the PayMongo reference number embedded in the description.
      const refTag = `Ref: ${referenceNumber || linkId}`;
      try {
        // create-link saved the cart (with product ids) under the link id; the remarks only carry names and prices.
        const intent = await getSetting(`purchase_intent_${linkId}`);
        const itemsMatch = remarks.match(/items:([^|]+)/);
        const deliveryMatch = remarks.match(/delivery:([^|]+)/);
        const items = intent?.items || (itemsMatch ? JSON.parse(decodeURIComponent(itemsMatch[1])) : []);
        const delivery = intent?.delivery ?? (deliveryMatch ? decodeURIComponent(deliveryMatch[1]) : "");

        // Work out which lines are JoyTel products and their (deterministic) JoyTel order ids.
        const ids = [...new Set(items.map(i => i.product_id).filter(Boolean))];
        const { data: dbProducts } = ids.length ? await supabase.from("products").select("*").in("id", ids) : { data: [] };
        const productById = new Map((dbProducts || []).map(p => [String(p.id), p]));
        const lines = items.map((item, idx) => {
          const product = item.product_id ? productById.get(String(item.product_id)) : null;
          const joytel = isJoytelProduct(product);
          return { item, idx, product, joytel, orderTid: joytel ? paymongoOrderTid(process.env.JOYTEL_CUSTOMER_CODE, referenceNumber || linkId, idx) : null };
        });

        const { data: alreadyFulfilled } = await supabase
          .from("transactions")
          .select("id")
          .eq("member_id", memberId)
          .ilike("description", `%${refTag}%`)
          .limit(1);

        if (alreadyFulfilled && alreadyFulfilled[0]) {
          console.log(`Purchase ${refTag} already fulfilled — skipping duplicate delivery`);
        } else {
          let created = 0;
          for (const { item, orderTid, joytel, product } of lines) {
            const itemTotal = (item.price || 0) * (item.qty || 1);
            const details = `${item.name} x${item.qty || 1} → ${isJoytelRecharge(product) ? cleanSerial(item.delivery || delivery) : (item.delivery || delivery || (joytel ? "email" : ""))}`;
            const { error: txError } = await supabase.from("transactions").insert({
              member_id: memberId,
              type: "purchase",
              amount: -itemTotal,
              description: `${details} | Pay to Kabaro${orderTid ? ` | JoyTel: ${orderTid}` : ""} | ${refTag}`,
              status: "completed",
            });
            if (txError) console.error("Purchase transaction insert error:", txError.message);
            else created++;
          }
          console.log(`Purchase fulfilled: ${created} transaction(s) for link ${linkId} | ${refTag}`);
        }

        // Place the JoyTel orders. Runs on every delivery of this webhook: the orderTid is derived from the
        // payment, so a retry cannot create a second order, and a crash before this point is healed by the retry.
        const joytelLines = lines.filter(l => l.joytel);
        if (joytelLines.length) {
          const { data: member } = await supabase.from("members").select("id,username,full_name,email,phone").eq("id", memberId).maybeSingle();
          for (const l of joytelLines) {
            const qty = l.item.qty || 1;
            try {
              const r = await placeJoytelFulfilment({
                product: l.product, qty, member: member || { id: memberId }, delivery: l.item.delivery ?? delivery, orderTid: l.orderTid,
                payment: { method: "paymongo", ref: referenceNumber || linkId, amount: (l.item.price || 0) * qty },
              });
              console.log(`JoyTel order ${l.orderTid}: ${r.ok ? "ok" : `failed (${r.error})`}${r.refunded ? " — refunded to wallet" : ""}`);
            } catch (e) {
              console.error(`JoyTel step crashed for ${l.orderTid}:`, e.message);
              retryLater = true;
            }
          }
        }
      } catch (err) {
        console.error("Purchase fulfillment error:", err.message);
      }
      // 500 makes PayMongo deliver the event again; everything above is idempotent, so a retry is safe.
      if (retryLater) return res.status(500).json({ error: "JoyTel step failed, retry" });
      return res.status(200).json({ received: true, type: eventType });
    }

    if (memberId && amountPaid > 0) {
      try {
        // Credit the wallet from the paid link itself (member_id comes from
        // the PayMongo-signed remarks), like the original flow did — don't
        // depend on the pending conversion_requests row existing. Dedupe
        // retried webhook deliveries by the payment reference number.
        const creditDescription = `PayMongo top-up | Ref: ${referenceNumber || linkId} | Auto-credited`;
        const { data: alreadyCredited } = await supabase
          .from("transactions")
          .select("id")
          .eq("member_id", memberId)
          .eq("description", creditDescription)
          .limit(1);

        if (alreadyCredited && alreadyCredited[0]) {
          console.log(`Top-up ${referenceNumber || linkId} already credited — skipping duplicate delivery`);
        } else {
          const { error: txError } = await supabase.from("transactions").insert({
            member_id: memberId,
            amount: amountPaid,
            type: "adjustment",
            status: "completed",
            description: creditDescription,
          });
          if (txError) throw new Error(txError.message);
          console.log(`Wallet credited: ₱${amountPaid} for member ${memberId}`);
        }

        // Mark the matching pending request (if one was recorded) as approved.
        const { data: pending } = await supabase
          .from("conversion_requests")
          .select("*")
          .eq("member_id", memberId)
          .eq("status", "pending")
          .ilike("admin_note", `%${linkId}%`)
          .limit(1);

        if (pending && pending[0]) {
          const existing = pending[0].admin_note ? JSON.parse(pending[0].admin_note) : {};
          await supabase
            .from("conversion_requests")
            .update({
              status: "approved",
              admin_note: JSON.stringify({ ...existing, reference_number: referenceNumber, paid_at: new Date().toISOString(), auto_approved: true }),
            })
            .eq("id", pending[0].id);
        }
      } catch (err) {
        console.error("Wallet credit error:", err.message);
      }
    }
  }

  return res.status(200).json({ received: true, type: eventType });
}
