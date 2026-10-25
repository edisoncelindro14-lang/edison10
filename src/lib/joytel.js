/**
 * JoyTel API integration service.
 * All calls go through server-side Vercel API routes to keep credentials secure.
 * Reference: JoyTel API document R.20260113.01.
 */

const WAREHOUSE_API = '/api/joytel/warehouse';
const RSP_API = '/api/joytel/rsp';

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

const warehouse = (endpoint, body) => post(WAREHOUSE_API, { endpoint, ...body });
const rsp = (endpoint, body) => post(RSP_API, { endpoint, ...body });

// ---------------------------------------------------------------------------
// Warehouse system: eSIM orders and OTA card recharge
// ---------------------------------------------------------------------------

/**
 * Submit an eSIM order. JoyTel answers with orderCode; the snPin (coupon) arrives
 * on our order callback within ~30 seconds (replyType is forced to 1 server-side).
 * @param {Object} order - { receiveName, phone, email, orderTid?, type?, itemList: [{productCode, quantity}] }
 *   email, receiveName and phone are mandatory. orderTid is generated when omitted and must be unique.
 */
export async function submitJoytelOrder(order) {
  return warehouse('customerOrder', order);
}

/**
 * Query an order by orderCode or orderTid. status: 1 submitted, 2 validated,
 * 3 waiting delivery, 4 delivered, 0 issue, -1 cancelled, -2 merged.
 * Use this when the order callback has not arrived after ~1 minute.
 */
export async function queryJoytelOrder(query) {
  return warehouse('customerOrderQuery', query);
}

/**
 * List the service orders of a SIM (RSP+ system, by CID or coupon).
 * @param {Object} query - { cid, coupon?, atCode? }
 */
export async function queryServiceOrderList(query = {}) {
  return rsp('sim/subscription/query', query);
}

/**
 * Submit an OTA card recharge. There is no callback; poll queryCardRecharge.
 * @param {Object} order - { orderTid?, itemList: [{ productCode, snCode, days }] }
 */
export async function submitCardRecharge(order) {
  return warehouse('cardRecharge', order);
}

/**
 * Query a recharge order. Needs orderTid or rechargeCode.
 */
export async function queryCardRecharge(query) {
  return warehouse('cardRechargeQuery', query);
}

// ---------------------------------------------------------------------------
// RSP+ system: QR codes, eSIM status and usage
// ---------------------------------------------------------------------------

/**
 * Check coupon status (0 not activated, 1 unused, 2 used, 3 occupied, 4 invalidated, 5 expired, 6 invalid).
 * This does NOT return a QR code. Use redeemCoupon for that.
 * @param {string} coupons - snPin values separated by commas (max 20)
 */
export async function queryCoupon(coupons) {
  return rsp('coupon/query', { coupons });
}

/**
 * Redeem a coupon (snPin) to get the eSIM QR code. The request is acknowledged
 * immediately; the QR code is delivered to /notify/coupon/redeem on our server.
 * @param {string} coupon
 * @param {0|1} qrcodeType - 0 = QR image URL, 1 = QR content text (LPA string)
 */
export async function redeemCoupon(coupon, qrcodeType = 1) {
  return rsp('coupon/redeem', { coupon, qrcodeType });
}

/**
 * Fallback when the QR notification does not arrive: look the redemption up by its transId.
 */
export async function getTransactionStatus(qTransId) {
  return rsp('getTransactionStatus', { qTransId });
}

/** eSIM status (status 0/1/2 plus profile state). Provide a coupon, cid or atCode. */
export async function queryEsimStatus(ids) {
  return rsp('esim/status/query', typeof ids === 'string' ? { cid: ids } : ids);
}

/** eSIM profile details. Provide a coupon, cid or atCode. */
export async function queryEsimProfile(ids) {
  return rsp('esim/profile/query', typeof ids === 'string' ? { cid: ids } : ids);
}

/** eSIM data usage by coupon. */
export async function queryEsimUsage(coupon) {
  return rsp('esim/usage/query', { coupon });
}
