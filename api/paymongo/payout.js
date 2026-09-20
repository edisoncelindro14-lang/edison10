import { createClient } from "@supabase/supabase-js";

// PayMongo Payout (Disbursement) endpoint.
// Sends money from the merchant's PayMongo Wallet directly to a
// staff member's GCash number via InstaPay.
//
// Called by the Admin panel when approving a staff withdrawal.

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

// Default GCash BIC for InstaPay — looked up dynamically as a fallback
const GCASH_BIC = "GCSVPHMM";

const PAYMONGO_API = "https://api.paymongo.com";
const AUTH_HEADERS = (key) => ({
  Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}`,
  Accept: "application/json",
  "Content-Type": "application/json",
});

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", service: "paymongo-payout" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!SECRET_KEY) {
    return res.status(500).json({ error: "PAYMONGO_SECRET_KEY not configured" });
  }

  const { amount, gcash_number, gcash_name, transaction_id, member_id } = req.body || {};

  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || parsedAmount < 1) {
    return res.status(400).json({ error: "Amount must be at least ₱1" });
  }
  if (!gcash_number) {
    return res.status(400).json({ error: "GCash number is required" });
  }
  if (!gcash_name) {
    return res.status(400).json({ error: "GCash account name is required" });
  }

  const amountInCentavos = Math.round(parsedAmount * 100);
  const headers = AUTH_HEADERS(SECRET_KEY);

  try {
    // Step 1: Retrieve the merchant wallet to get source_account details
    const walletRes = await fetch(`${PAYMONGO_API}/v2/wallets`, { headers });
    const walletData = await walletRes.json();

    if (!walletRes.ok || !walletData.data || walletData.data.length === 0) {
      return res.status(400).json({
        error: "No PayMongo wallet found. Ensure your wallet is activated and funded.",
      });
    }

    const wallet = walletData.data[0];
    const sourceAccount = wallet.attributes?.source_account || wallet.source_account;

    if (!sourceAccount || !sourceAccount.number) {
      return res.status(400).json({ error: "Wallet source account not found" });
    }

    // Step 2: Look up GCash BIC from receiving institutions (fallback to default)
    let gcashBic = GCASH_BIC;
    try {
      const instRes = await fetch(
        `${PAYMONGO_API}/v2/transfers/receiving_institutions?provider=instapay`,
        { headers }
      );
      const instData = await instRes.json();
      const institutions = instData.data || [];
      const gcash = institutions.find(
        (i) => (i.attributes?.name || "").toLowerCase().includes("gcash")
      );
      if (gcash?.attributes?.bic) {
        gcashBic = gcash.attributes.bic;
      }
    } catch (e) {
      console.error("Failed to fetch receiving institutions, using default GCash BIC:", e.message);
    }

    // Step 3: Create the batch transfer (disbursement)
    const transferRes = await fetch(`${PAYMONGO_API}/v2/batch_transfers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        transfers: [
          {
            provider: "instapay",
            amount: amountInCentavos,
            currency: "PHP",
            purpose: "Staff withdrawal payout",
            description: `Staff withdrawal - ${gcash_name} - ${gcash_number}`,
            source_account: {
              number: sourceAccount.number,
              name: sourceAccount.name,
              bic: sourceAccount.bic,
            },
            destination_account: {
              number: gcash_number,
              name: gcash_name,
              bic: gcashBic,
            },
            ...(transaction_id || member_id
              ? { metadata: { transaction_id: transaction_id || null, member_id: member_id || null } }
              : {}),
          },
        ],
      }),
    });

    const transferData = await transferRes.json();

    if (!transferRes.ok || transferData.errors) {
      const errMsg =
        transferData.errors?.[0]?.detail ||
        transferData.errors?.[0]?.meta?.message ||
        "Payout failed";
      console.error("PayMongo payout error:", errMsg);
      return res.status(400).json({ error: errMsg });
    }

    const transfer = transferData.data?.transfers?.[0];

    // Step 4: Update the transaction record with payout details
    if (supabase && transaction_id) {
      const payoutNote = JSON.stringify({
        payout_id: transfer?.id || null,
        batch_transfer_id: transferData.data?.id || null,
        provider_reference_number: transfer?.provider_reference_number || null,
        reference_number: transfer?.reference_number || null,
        payout_status: transfer?.status || "pending",
        paid_to: `GCash ${gcash_number} (${gcash_name})`,
        paid_at: new Date().toISOString(),
      });

      await supabase
        .from("transactions")
        .update({
          status: transfer?.status === "succeeded" ? "completed" : "pending",
          description: `Staff withdrawal payout to GCash ${gcash_number} | Ref: ${transfer?.reference_number || "N/A"}`,
        })
        .eq("id", transaction_id);
    }

    return res.status(200).json({
      status: transfer?.status || "pending",
      transfer_id: transfer?.id,
      batch_transfer_id: transferData.data?.id,
      reference_number: transfer?.reference_number,
      provider_reference_number: transfer?.provider_reference_number,
    });
  } catch (err) {
    console.error("Payout error:", err);
    return res.status(500).json({ error: "Failed to process payout: " + (err.message || "Unknown error") });
  }
}
