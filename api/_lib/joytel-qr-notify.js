import { getSetting, saveSetting } from './joytel-server.js';

/**
 * RSP+ "Coupon Redeem Result Notification".
 * JoyTel posts the eSIM QR code here after we call coupon/redeem.
 * Public URL (NotifyBaseUrl + path) must be exactly: https://<your-domain>/notify/coupon/redeem
 * (vercel.json rewrites that path to /api/joytel/notify?type=coupon-redeem, which calls this handler;
 * it lives in _lib so it does not count as a separate Vercel serverless function).
 *
 * Body: { transId, resultCode, resultMesg, finishTime,
 *         data: { coupon, qrcodeType, qrcode, qrcodeContent, cid, salePlanName, salePlanDays, pin1, pin2, puk1, puk2, cfCode, ... } }
 * resultCode "000" = success. On failure `data` is absent, so we find the coupon through the transId.
 *
 * Must answer {"code":"000","mesg":"Success"}, otherwise JoyTel keeps resending.
 */

const ACK = { code: '000', mesg: 'Success' };

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'joytel-notify-coupon-redeem' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ code: '405', mesg: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const { transId, resultCode, resultMesg, finishTime } = body;
    const data = body.data || {};
    console.log('JoyTel coupon redeem notification:', JSON.stringify({ ...body, data: { ...data, qrcode: '[redacted]' } }));

    // Which order is this for? Success carries the coupon; failures only carry the transId.
    const trans = transId ? await getSetting(`joytel_trans_${transId}`) : null;
    const coupon = data.coupon || trans?.coupon || null;
    const orderTid = trans?.orderTid || null;
    const success = resultCode === '000';

    const qr = {
      transId, resultCode, resultMesg, finishTime,
      coupon,
      qrCode: success ? data.qrcode || null : null,           // image URL when qrcodeType = 0, LPA text when 1
      qrcodeType: data.qrcodeType,
      qrcodeContent: data.qrcodeContent || null,
      cid: data.cid || null,
      salePlanName: data.salePlanName || null,
      salePlanDays: data.salePlanDays || null,
      pin1: data.pin1 || null, pin2: data.pin2 || null,
      puk1: data.puk1 || null, puk2: data.puk2 || null,
      cfCode: data.cfCode || null,
      apnExplain: data.apnExplain || null,
      received_at: new Date().toISOString(),
    };

    if (coupon) await saveSetting(`joytel_qr_${coupon}`, qr, `JoyTel QR for coupon ${coupon}`);

    // Merge into the order record that the Orders page reads.
    if (orderTid) {
      const key = `joytel_callback_${orderTid}`;
      const order = (await getSetting(key)) || { type: 'order_callback', orderTid };
      await saveSetting(key, {
        ...order,
        coupon: order.coupon || coupon,
        qrCode: qr.qrCode || order.qrCode || null,
        qrcodeContent: qr.qrcodeContent || order.qrcodeContent || null,
        cid: qr.cid || order.cid || null,
        salePlanName: qr.salePlanName || order.salePlanName || null,
        salePlanDays: qr.salePlanDays || order.salePlanDays || null,
        qrStatus: success ? 'delivered' : 'failed',
        qrError: success ? null : resultMesg || resultCode,
        qr_received_at: qr.received_at,
      }, `JoyTel order callback ${orderTid}`);
    }

    return res.status(200).json(ACK);
  } catch (err) {
    console.error('JoyTel coupon redeem notify error:', err);
    // Non-success makes JoyTel resend, which is what we want if the save failed.
    return res.status(500).json({ code: '999', mesg: 'System Error' });
  }
}
