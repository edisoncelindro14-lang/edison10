// JoyTel NotifyBaseURL for RSP+ Endpoint
// URL: https://kabaroload.vercel.app/api/joytel/notify
// JoyTel sends RSP+ notifications here (e.g., data usage, bundle status, expiry alerts)

export default function handler(req, res) {
  // Accept POST for notifications, GET for health check
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", service: "joytel-notify" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body;

    // Log the notification for debugging
    console.log("JoyTel RSP+ Notification:", JSON.stringify(payload, null, 2));

    // Extract common RSP+ notification fields
    const {
      iccid,
      eventType,
      dataUsed,
      dataTotal,
      bundleStatus,
      expiryDate,
      ...rest
    } = payload || {};

    // TODO: Process the notification — update subscriber data in your database
    // Example: update Supabase with usage info, trigger alerts, etc.

    // Acknowledge receipt to JoyTel
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
