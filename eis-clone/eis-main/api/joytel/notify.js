import { createClient } from "@supabase/supabase-js";

// JoyTel NotifyBaseURL for RSP+ Endpoint
// URL: https://kabaroload.vercel.app/api/joytel/notify
// JoyTel sends RSP+ notifications here (e.g., data usage, bundle status, expiry alerts)

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", service: "joytel-notify" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body || {};
    console.log("JoyTel RSP+ Notification:", JSON.stringify(payload, null, 2));

    const { iccid, eventType, dataUsed, dataTotal, bundleStatus, expiryDate, ...rest } = payload;

    // Save notification to Supabase for audit trail + future processing
    if (supabase) {
      try {
        await supabase.from("system_settings").insert({
          setting_key: `joytel_notify_${Date.now()}`,
          setting_value: JSON.stringify({
            type: "rsp_notification",
            iccid, eventType, dataUsed, dataTotal, bundleStatus, expiryDate,
            raw: rest,
            received_at: new Date().toISOString(),
          }),
          description: `JoyTel RSP+ notification — ${eventType || "event"} for ${iccid || "unknown"}`,
        });
      } catch (dbErr) {
        console.error("Failed to save notification to DB:", dbErr.message);
      }
    }

    return res.status(200).json({
      received: true,
      iccid: iccid || null,
      eventType: eventType || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("JoyTel Notify Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
