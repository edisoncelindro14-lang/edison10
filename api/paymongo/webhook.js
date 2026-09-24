import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// PayMongo calls this endpoint when a payment link is paid.
// Register it in the PayMongo dashboard as:
//   https://<your-domain>/api/paymongo/webhook  (event: link.payment.paid)
//
// We read the raw request stream directly (rather than the req.body
// getter) because signature verification needs the exact raw bytes
// PayMongo signed — a JSON.parse/stringify round-trip of the body is
// not guaranteed to reproduce those bytes.

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Use the service_role key so the webhook can read conversion_requests and
// insert transactions regardless of RLS policies. The anon key has no auth
// session, so RLS blocks its reads/writes — which is why paid top-ups stopped
// reflecting in the wallet after the Supabase account change.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

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

    if (isPurchase) {
      // Shop checkout paid via PayMongo — create the completed transactions
      // now (no pending rows exist). Dedupe retried webhook deliveries by
      // the PayMongo reference number embedded in the description.
      const refTag = `Ref: ${referenceNumber || linkId}`;
      try {
        const { data: alreadyFulfilled } = await supabase
          .from("transactions")
          .select("id")
          .eq("member_id", memberId)
          .ilike("description", `%${refTag}%`)
          .limit(1);

        if (alreadyFulfilled && alreadyFulfilled[0]) {
          console.log(`Purchase ${refTag} already fulfilled — skipping duplicate delivery`);
        } else {
          const itemsMatch = remarks.match(/items:([^|]+)/);
          const deliveryMatch = remarks.match(/delivery:([^|]+)/);
          const items = itemsMatch ? JSON.parse(decodeURIComponent(itemsMatch[1])) : [];
          const delivery = deliveryMatch ? decodeURIComponent(deliveryMatch[1]) : "";
          let created = 0;
          for (const item of items) {
            const itemTotal = (item.price || 0) * (item.qty || 1);
            const details = `${item.name} x${item.qty || 1} → ${delivery || ""}`;
            const { error: txError } = await supabase.from("transactions").insert({
              member_id: memberId,
              type: "purchase",
              amount: -itemTotal,
              description: `${details} | Pay to Kabaro | ${refTag}`,
              status: "completed",
            });
            if (txError) console.error("Purchase transaction insert error:", txError.message);
            else created++;
          }
          console.log(`Purchase fulfilled: ${created} transaction(s) for link ${linkId} | ${refTag}`);
        }
      } catch (err) {
        console.error("Purchase fulfillment error:", err.message);
      }
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
