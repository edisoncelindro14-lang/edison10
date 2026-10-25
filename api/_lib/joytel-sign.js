import { createHash, randomInt } from 'crypto';

/**
 * Shared helpers for the JoyTel Warehouse API.
 * Source of truth: JoyTel API document R.20260113.01.
 * Kept in api/_lib so Vercel does not expose it as a route (underscore folders are ignored).
 */

export function sha1(str) {
  return createHash('sha1').update(str, 'utf8').digest('hex');
}

export function md5(str) {
  return createHash('md5').update(str, 'utf8').digest('hex');
}

/**
 * Logical endpoint name -> path on the Warehouse host (api.joytelshop.com).
 * The proxy strips the "/warehouse" prefix and forwards the rest.
 */
export const WAREHOUSE_PATHS = {
  customerOrder: '/customerApi/customerOrder',
  customerOrderQuery: '/customerApi/customerOrder/query',
  cardRecharge: '/joyRechargeApi/rechargeOrder',
  cardRechargeQuery: '/joyRechargeApi/rechargeOrder/query',
};

/** itemList string for customerOrder: productCode + quantity, concatenated. */
function orderItems(itemList = []) {
  return itemList.map(i => (i.productCode || '') + String(i.quantity ?? '')).join('');
}

/** itemList string for cardRecharge: productCode + snCode + days, concatenated. */
function rechargeItems(itemList = []) {
  return itemList
    .map(i => (i.productCode || '') + (i.snCode || '') + String(i.days ?? ''))
    .join('');
}

/**
 * autoGraph = SHA-1 of the concatenated fields, in the exact order given by the JoyTel document.
 * Empty / missing values are replaced by "".
 */
export function computeAutoGraph(endpoint, p, customerCode, customerAuth) {
  const ts = String(p.timestamp);
  const orderTid = p.orderTid || '';

  switch (endpoint) {
    case 'customerOrder':
      // customerCode+customerAuth+warehouse+type+orderTid+receiveName+phone+timestamp+itemList
      return sha1(
        customerCode + customerAuth +
        (p.warehouse || '') + String(p.type ?? '') + orderTid +
        (p.receiveName || '') + (p.phone || '') + ts + orderItems(p.itemList)
      );
    case 'customerOrderQuery':
      // customerCode+customerAuth+orderCode+orderTid+timestamp
      return sha1(customerCode + customerAuth + (p.orderCode || '') + orderTid + ts);
    case 'cardRecharge':
      // customerCode+customerAuth+timestamp+itemList(productCode+snCode+days)+orderTid
      return sha1(customerCode + customerAuth + ts + rechargeItems(p.itemList) + orderTid);
    case 'cardRechargeQuery':
      // customerCode+customerAuth+timestamp+rechargeCode+orderTid
      return sha1(customerCode + customerAuth + ts + (p.rechargeCode || '') + orderTid);
    default:
      throw new Error(`Unknown Warehouse endpoint: ${endpoint}`);
  }
}

/**
 * Unique order id: customerCode + yyyyMMddHHmmss + 6 random digits (the format JoyTel suggests).
 * Recharge orders must stay within 32 characters.
 */
export function newOrderTid(customerCode, now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const stamp =
    now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) +
    pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds());
  const rand = String(randomInt(0, 1000000)).padStart(6, '0');
  return `${customerCode}${stamp}${rand}`;
}

/** JoyTel order status codes (customerOrder/query and order callback). */
export const ORDER_STATUS = {
  1: 'submitted',
  2: 'validated',
  3: 'waiting_delivery',
  4: 'delivered',
  0: 'issue',
  '-1': 'cancelled',
  '-2': 'merged',
};

/**
 * Collect every snPin (= coupon) from an order callback / order query payload.
 * Shape: itemList[].snList[].{snCode, snPin, productExpireDate}. A top-level snPin/coupon is also honoured.
 */
export function extractSnPins(payload = {}) {
  const pins = [];
  const add = v => { if (v && !pins.includes(v)) pins.push(String(v)); };
  add(payload.snPin);
  add(payload.coupon);
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  for (const item of data.itemList || []) {
    for (const sn of item.snList || []) add(sn.snPin);
  }
  return pins;
}
