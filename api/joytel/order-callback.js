import { extractSnPins, ORDER_STATUS } from '../_lib/joytel-sign.js';
import { getSetting, saveSetting, rspCall } from '../_lib/joytel-server.js';

/**
 * JoyTel eSIM order callback (webhook).
 * URL to give JoyTel: https://<your-domain>/api/joytel/order-callback
 *
 * JoyTel calls this when an order placed with replyType=1 finishes (within ~30 seconds).
 * Payload (JoyTel document, "Call Back (snPin)"):
 *   { orderCode, orderTid, phone, receiveName, email, outboundCode, status,
 *     itemList: [{ productCode, productName, quantity, snList: [{ snCode, snPin, productExpireDate }] }] }
 *   status: 1 submitted, 2 validated, 3 waiting delivery, 4 delivered, 0 issue, -1 cancelled, -2 merged
 *
 * What we do:
 *   1. store the order result under joytel_callback_<orderTid>
 *   2. for each snPin (= coupon) ask RSP+ to redeem it (coupon/redeem). The QR code is NOT in the response;
 *      RSP+ posts it to /notify/coupon/redeem (see notify-coupon-redeem.js).
 *
 * Retries: JoyTel resends this callback after 3, 10, 20 and 30 minutes unless we answer HTTP 200.
 * So we answer 200 once the data is saved and every redeem request was accepted, and 500 when
 * saving or a redeem request failed, so JoyTel retries. Already requested coupons are never redeemed twice.
 */

const QR_TYPE = 0; // 0 = QR image URL (what the Orders page renders), 1 = LPA text

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'joytel-order-callback' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};
    const { orderCode, orderTid } = payload;
    const status = payload.status != null ? Number(payload.status) : null;
    console.log('JoyTel Order Callback:', JSON.stringify(payload));

    const ref = orderTid || orderCode;
    if (!ref) return res.status(400).json({ error: 'orderTid or orderCode is required' });

    const key = `joytel_callback_${ref}`;
    const existing = (await getSetting(key)) || {};

    const snList = (payload.itemList || []).flatMap(i =>
      (i.snList || []).map(s => ({ ...s, productCode: i.productCode, productName: i.productName }))
    );
    const pins = extractSnPins(payload);
    const redeem = { ...(existing.redeem || {}) };

    // Save first so a failure below still leaves the order data on record.
    const record = {
      ...existing,
      type: 'order_callback',
      orderCode, orderTid,
      status,
      statusText: status != null ? ORDER_STATUS[status] || String(status) : null,
      email: payload.email, phone: payload.phone, receiveName: payload.receiveName,
      snList: snList.length ? snList : existing.snList,
      coupon: pins[0] || existing.coupon || null,
      coupons: pins.length ? pins : existing.coupons || [],
      redeem,
      raw: payload,
      received_at: new Date().toISOString(),
    };
    await saveSetting(key, record, `JoyTel order callback ${ref}`);

    // Request the QR code for each coupon that has not been requested yet.
    let redeemFailed = false;
    for (const coupon of pins) {
      if (redeem[coupon]?.accepted) continue; // retry of a callback we already handled
      const transId = `RDM${Date.now()}${Math.floor(Math.random() * 1000)}`;
      try {
        const r = await rspCall('coupon/redeem', { coupon, qrcodeType: QR_TYPE }, transId);
        const accepted = r.body?.code === '000';
        redeem[coupon] = { transId, accepted, code: r.body?.code, mesg: r.body?.mesg, requested_at: new Date().toISOString() };
        if (accepted) {
          // lets the QR notification (which only carries the coupon on success) be tied back to this order
          await saveSetting(`joytel_trans_${transId}`, { coupon, orderTid, orderCode }, `JoyTel redeem ${transId}`);
        } else {
          redeemFailed = true;
          console.error('coupon/redeem rejected:', coupon, JSON.stringify(r.body));
        }
      } catch (e) {
        redeemFailed = true;
        redeem[coupon] = { transId, accepted: false, error: e.message, requested_at: new Date().toISOString() };
        console.error('coupon/redeem failed:', coupon, e.message);
      }
    }
    await saveSetting(key, { ...record, redeem }, `JoyTel order callback ${ref}`);

    if (redeemFailed) {
      // Non-200 makes JoyTel resend the callback later, which retries the failed redeem.
      return res.status(500).json({ received: true, redeemRequested: false });
    }
    return res.status(200).json({ received: true, orderTid: orderTid || null, orderCode: orderCode || null, status });
  } catch (err) {
    console.error('JoyTel Order Callback Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
