import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// PayMongo calls this endpoint when a payment link is paid.
// Register it in the PayMongo dashboard as:
//   https://<your-domain>/api/paymongo/webhook  (event: link.payment.paid)

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;

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

  const rawBody = JSON.stringify(req.body || {});
  const sigHeader = req.headers["paymongo-signature"] || "";
  if (!verifySignature(rawBody, sigHeader, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.body;
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

        await supabase.from("transactions").insert({
          member_id: memberId,
          amount: amountPaid,
          type: "adjustment",
          status: "completed",
          description: `PayMongo top-up | Ref: ${referenceNumber || "N/A"} | Auto-credited`,
        });

        console.log(`Wallet credited: ₱${amountPaid} for member ${memberId}`);
      } catch (err) {
        console.error("Wallet credit error:", err.message);
      }
    }
  }

  return res.status(200).json({ received: true, type: eventType });
}
