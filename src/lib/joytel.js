/**
 * JoyTel API integration service.
 * All calls go through server-side Vercel API routes to keep credentials secure.
 */

const WAREHOUSE_API = '/api/joytel/warehouse';
const RSP_API = '/api/joytel/rsp';

/**
 * Submit an eSIM or OTA SIM order to JoyTel.
 * @param {Object} order - { type, receiveName, phone, orderTid, warehouse, itemList: [{productCode, quantity}] }
 * @returns {Promise<Object>} JoyTel API response
 */
export async function submitJoytelOrder(order) {
  const res = await fetch(WAREHOUSE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: 'customerOrder', replyType: 1, ...order }),
  });
  return res.json();
}

/**
 * Query a JoyTel order status by orderCode or orderTid.
 * @param {Object} query - { orderCode?, orderTid? }
 * @returns {Promise<Object>} JoyTel API response with order details
 */
export async function queryJoytelOrder(query) {
  const res = await fetch(WAREHOUSE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: 'customerOrderQuery', ...query }),
  });
  return res.json();
}

/**
 * Query the service order list from JoyTel.
 * @param {Object} query - { orderCode?, orderTid? }
 * @returns {Promise<Object>} JoyTel API response
 */
export async function queryServiceOrderList(query = {}) {
  const res = await fetch(WAREHOUSE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: 'serviceOrderListQuery', ...query }),
  });
  return res.json();
}

/**
 * Submit an OTA card recharge order to JoyTel.
 * @param {Object} order - { orderTid, itemList: [{productCode, quantity}] }
 * @returns {Promise<Object>} JoyTel API response
 */
export async function submitCardRecharge(order) {
  const res = await fetch(WAREHOUSE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: 'cardRecharge', ...order }),
  });
  return res.json();
}

/**
 * Query an OTA card recharge status.
 * @param {Object} query - { orderTid?, rechargeCode? }
 * @returns {Promise<Object>} JoyTel API response
 */
export async function queryCardRecharge(query) {
  const res = await fetch(WAREHOUSE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: 'cardRechargeQuery', ...query }),
  });
  return res.json();
}

/**
 * Query eSIM coupon/QR code information from JoyTel RSP+ API.
 * @param {string} coupons - Coupon codes (snPin), separated by commas. Max 20 per batch.
 * @returns {Promise<Object>} JoyTel RSP+ API response with QR code and profile info
 */
export async function queryCoupon(coupons) {
  const res = await fetch(RSP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: 'coupon/query', coupons }),
  });
  return res.json();
}

/**
 * Query eSIM status and usage from JoyTel RSP+ API.
 * @param {string} cid - eSIM profile CID (898620003xxxxxxx format)
 * @returns {Promise<Object>} JoyTel RSP+ API response with status and usage data
 */
export async function queryEsimStatus(cid) {
  const res = await fetch(RSP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: 'esim/status/query', cid }),
  });
  return res.json();
}

/**
 * Query eSIM profile information from JoyTel RSP+ API.
 * @param {string} cid - eSIM profile CID
 * @returns {Promise<Object>} JoyTel RSP+ API response with profile details
 */
export async function queryEsimProfile(cid) {
  const res = await fetch(RSP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: 'esim/profile/query', cid }),
  });
  return res.json();
}
