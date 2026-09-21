import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// JoyTel eSIM Order Callback Endpoint
// URL: https://kabaroload.vercel.app/api/joytel/order-callback
// JoyTel calls this when an eSIM order status changes (e.g., provisioned, activated, failed)
// When replyType=1, JoyTel sends the coupon/snPin here for auto QR code delivery.

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const PROXY_BASE = process.env.JOYTEL_PROXY_URL;
const PROXY_TOKEN = process.env.JOYTEL_PROXY_TOKEN || 'kabaroload-proxy-2024';
const RSP_PATH = '/rsp';

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", service: "joytel-order-callback" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body || {};
    console.log("JoyTel Order Callback:", JSON.stringify(payload, null, 2));

    const {
      orderId, orderCode, status, orderTid,
      snPin, coupon, // eSIM: coupon/snPin for QR code
      iccid, qrCode, activationCode, error,
      ...rest
    } = payload;

    const couponCode = snPin || coupon;
    let qrData = null;

    // If JoyTel sent a coupon/snPin, auto-fetch the QR code from RSP+ API
    if (couponCode) {
      const appId = process.env.JOYTEL_APP_ID;
      const appSecret = process.env.JOYTEL_APP_SECRET;

      if (appId && appSecret) {
        try {
          const transId = `${appId}-${Date.now()}`;
          const timestamp = String(Date.now());
          const ciphertext = createHash('md5').update(appId + transId + timestamp + appSecret, 'utf8').digest('hex');

          const rspResponse = await fetch(`${PROXY_BASE}${RSP_PATH}/coupon/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Proxy-Token': PROXY_TOKEN,
              'AppId': appId,
              'AppSecret': appSecret,
              'TransId': transId,
              'Timestamp': timestamp,
              'Ciphertext': ciphertext,
            },
            body: JSON.stringify({ coupons: couponCode }),
          });
          qrData = await rspResponse.json();
          console.log("Auto-fetched QR code for coupon:", couponCode);
        } catch (qrErr) {
          console.error("Failed to auto-fetch QR code:", qrErr.message);
        }
      }
    }

    // Save callback + QR data to Supabase
    if (supabase) {
      try {
        await supabase.from("system_settings").insert({
          setting_key: `joytel_callback_${Date.now()}`,
          setting_value: JSON.stringify({
            type: "order_callback",
            orderId, orderCode, orderTid, status,
            coupon: couponCode,
            iccid, error,
            qrCode: qrData?.data?.[0]?.qrCode || qrData?.data?.qrCode || qrCode,
            activationCode: qrData?.data?.[0]?.activationCode || qrData?.data?.activationCode || activationCode,
            qrResponse: qrData,
            raw: rest,
            received_at: new Date().toISOString(),
          }),
          description: `JoyTel order callback — ${couponCode ? "eSIM QR delivered" : "status update"} — ${orderTid || orderCode || "unknown"}`,
        });

        // Try to update the matching transaction if orderTid matches
        if (orderTid) {
          const { data: txns } = await supabase
            .from("transactions")
            .select("*")
            .ilike("description", `%${orderTid}%`)
            .limit(1);

          if (txns && txns.length > 0) {
            const updateData = { status: status === "success" || status === "completed" ? "completed" : status || "completed" };
            if (qrData?.data?.[0]?.qrCode || qrData?.data?.qrCode) {
              updateData.description = txns[0].description + ` | QR: ${couponCode}`;
            }
            await supabase.from("transactions").update(updateData).eq("id", txns[0].id);
          }
        }
      } catch (dbErr) {
        console.error("Failed to save callback to DB:", dbErr.message);
      }
    }

    // Acknowledge receipt to JoyTel
    return res.status(200).json({
      received: true,
      orderId: orderId || null,
      orderCode: orderCode || null,
      status: status || null,
      coupon: couponCode,
      qrCodeFetched: !!qrData,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("JoyTel Order Callback Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
