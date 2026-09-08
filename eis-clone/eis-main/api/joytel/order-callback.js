// JoyTel eSIM Order Callback Endpoint
// URL: https://kabaroload.vercel.app/api/joytel/order-callback
// JoyTel calls this when an eSIM order status changes (e.g., provisioned, activated, failed)

export default function handler(req, res) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body;

    // Log the callback for debugging
    console.log("JoyTel Order Callback:", JSON.stringify(payload, null, 2));

    // Extract common JoyTel callback fields
    const {
      orderId,
      status,
      iccid,
      qrCode,
      activationCode,
      error,
      ...rest
    } = payload || {};

    // TODO: Process the callback — update order status in your database
    // Example: update Supabase orders table with the new status

    // Acknowledge receipt to JoyTel
    return res.status(200).json({
      received: true,
      orderId: orderId || null,
      status: status || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("JoyTel Order Callback Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
