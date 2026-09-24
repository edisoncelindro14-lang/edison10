import { createClient } from "@supabase/supabase-js";

// Creates a PayMongo Payment Link for a wallet top-up and records a
// pending conversion_requests row. The wallet is only credited once
// PayMongo confirms payment via the webhook at /api/paymongo/webhook.

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Use the service_role key so the pending conversion_requests row can be
// written regardless of RLS policies (the anon key has no auth session, so
// RLS would reject the insert — breaking the webhook's ability to match it).
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", service: "paymongo-create-link" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!SECRET_KEY) {
    return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured" });
  }
  if (!supabase) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const { amount, member_id, purpose, tx_ids } = req.body || {};
  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || parsedAmount < 1) {
    return res.status(400).json({ error: "Amount must be at least ₱1" });
  }
  if (!member_id) {
    return res.status(400).json({ error: "member_id is required" });
  }
  const isPurchase = purpose === "purchase";
  if (isPurchase && (!Array.isArray(tx_ids) || tx_ids.length === 0)) {
    return res.status(400).json({ error: "tx_ids is required for purchase payments" });
  }

  const amountInCentavos = Math.round(parsedAmount * 100);
  const remarks = isPurchase
    ? `purpose:purchase|member_id:${member_id}|tx_ids:${tx_ids.join(",")}`
    : `member_id:${member_id}`;

  try {
    const response = await fetch("https://api.paymongo.com/v1/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(SECRET_KEY + ":").toString("base64")}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amountInCentavos,
            description: isPurchase ? `Kabaro order payment ₱${parsedAmount}` : `Wallet top-up ₱${parsedAmount}`,
            remarks,
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok || data.errors) {
      return res.status(400).json({ error: data.errors?.[0]?.detail || "Failed to create payment link" });
    }

    const link = data.data.attributes;
    const linkId = data.data.id;

    // Purchases already have their own pending `transactions` rows (created
    // client-side before this call) — only wallet top-ups need a
    // conversion_requests row for the webhook to find and approve.
    if (!isPurchase) {
      const { error: dbError } = await supabase.from("conversion_requests").insert({
        member_id,
        amount: parsedAmount,
        status: "pending",
        admin_note: JSON.stringify({
          payment_method: "paymongo",
          link_id: linkId,
          reference_number: link.reference_number,
          checkout_url: link.checkout_url,
        }),
      });
      if (dbError) console.error("conversion_requests insert error:", dbError.message);
    }

    return res.status(200).json({
      checkout_url: link.checkout_url,
      reference_number: link.reference_number,
      link_id: linkId,
    });
  } catch (err) {
    console.error("Create-link error:", err);
    return res.status(500).json({ error: "Failed to create payment link" });
  }
}
