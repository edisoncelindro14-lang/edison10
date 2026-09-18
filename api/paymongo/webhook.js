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
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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

  {
    const parts = Object.fromEntries((sigHeader || "").split(",").map(p => p.split("=")));
    const target = parts.li || parts.te;
    const candidates = {
      "t.rawBody": `${parts.t}.${rawBody}`,
      "rawBody only": rawBody,
      "t+rawBody (no dot)": `${parts.t}${rawBody}`,
      "rawBody.t": `${rawBody}.${parts.t}`,
    };
    console.log("DEBUG target(li):", target);
    console.log("DEBUG rawBody length:", rawBody.length, "first 80:", rawBody.slice(0, 80));
    console.log("DEBUG rawBody last 80:", rawBody.slice(-80));
    for (const [name, payload] of Object.entries(candidates)) {
      const digestHex = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
      const digestB64 = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("base64");
      console.log(`DEBUG [${name}] hex=${digestHex} MATCH_HEX=${digestHex === target}`);
      console.log(`DEBUG [${name}] b64=${digestB64} MATCH_B64=${digestB64 === target}`);
    }
  }

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

    if (memberId && amountPaid > 0) {
      try {
        // Only credit if a matching pending request is still pending — this
        // keeps retried/duplicate webhook deliveries for the same payment
        // from crediting the wallet more than once.
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

          await supabase.from("transactions").insert({
            member_id: memberId,
            amount: amountPaid,
            type: "adjustment",
            status: "completed",
            description: `PayMongo top-up | Ref: ${referenceNumber || "N/A"} | Auto-credited`,
          });

          console.log(`Wallet credited: ₱${amountPaid} for member ${memberId}`);
        } else {
          console.log(`No matching pending request for link ${linkId} — skipping (already processed or not found)`);
        }
      } catch (err) {
        console.error("Wallet credit error:", err.message);
      }
    }
  }

  return res.status(200).json({ received: true, type: eventType });
}
