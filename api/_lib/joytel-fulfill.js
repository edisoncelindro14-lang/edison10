import { createHash } from 'crypto';
import { supabase, getSetting, saveSetting, warehouseCall } from './joytel-server.js';

/**
 * Turns a paid shop order into a JoyTel order, and refunds the customer if JoyTel cannot deliver.
 *
 * One record per JoyTel order lives in system_settings under joytel_callback_<orderTid>.
 * The order callback and QR notification (order-callback.js / joytel-qr-notify.js) add the snPin
 * and QR code to the same record, and the Orders page reads it.
 *
 * orderTid is derived from the payment, so replaying the same payment (webhook retry) never
 * creates a second JoyTel order.
 */

export const orderKey = tid => `joytel_callback_${tid}`;

/**
 * orderTid = customerCode + 20 digits, the same shape JoyTel's own example uses
 * (customerCode + yyyyMMddHHmmss + 6 digits). Digits only, at most 32 characters.
 * The digits come from a hash of the payment, so the same payment always gives the same orderTid
 * (replays cannot create a second order) and different payments never share one.
 */
function paymentDigits(seed) {
  const n = BigInt('0x' + createHash('sha1').update(String(seed), 'utf8').digest('hex')) % 10n ** 20n;
  return n.toString().padStart(20, '0');
}
const code = c => String(c || '').trim();

/** orderTid for a wallet payment (from the withdrawal transaction id). */
export function walletOrderTid(customerCode, txId) {
  return `${code(customerCode)}${paymentDigits(`wallet:${txId}`)}`.slice(0, 32);
}

/** orderTid for a PayMongo payment (from the payment reference and the cart line index). */
export function paymongoOrderTid(customerCode, reference, index) {
  return `${code(customerCode)}${paymentDigits(`paymongo:${reference}:${index}`)}`.slice(0, 32);
}

export const isJoytelProduct = p => !!(p && p.joytel_enabled && p.joytel_product_code);

/** eSIM orders (JoyTel type 3) are delivered by email, so the customer does not have to give a mobile number. */
export const isJoytelEsim = p => Number(p?.joytel_type || 3) === 3;

/** JoyTel still requires a phone field. Used only when an eSIM customer has no number on file. */
export const FALLBACK_PHONE = '09000000000';

/** Phone to send to JoyTel: a number typed at checkout, else the member's profile phone, else (eSIM only) a placeholder. */
export function pickPhone(delivery, member, product) {
  const d = String(delivery || '').trim();
  if (/^\+?[0-9][0-9\s-]{6,}$/.test(d)) return d.replace(/[\s-]/g, '');
  const profile = String(member?.phone || '').trim();
  if (profile) return profile;
  return isJoytelEsim(product) ? FALLBACK_PHONE : '';
}

/** joytel_type 9 = JOY SIM recharge (Card Recharge API): adds a data plan to a JOY SIM card identified by its serial number. */
export const JOYTEL_RECHARGE_TYPE = 9;
export const isJoytelRecharge = p => Number(p?.joytel_type) === JOYTEL_RECHARGE_TYPE;
/** Daily plans ("500MB/day"): days = quantity. Total plans: always 1 day (JoyTel rule). */
export const isDailyPlan = p => /\/\s*day/i.test(p?.name || '');
/** Serial number printed on the JOY card board. */
export const cleanSerial = v => String(v || '').replace(/\s+/g, '');
export const validSerial = v => /^[A-Za-z0-9-]{6,32}$/.test(cleanSerial(v));

/** Checks that a JoyTel purchase can be placed. Returns an error message or null. Call BEFORE taking payment. */
export function joytelPreflight(product, member, delivery, qty = 1) {
  if (!process.env.JOYTEL_CUSTOMER_CODE || !process.env.JOYTEL_CUSTOMER_AUTH || !process.env.JOYTEL_PROXY_URL) {
    return 'JoyTel ordering is not configured yet. Please contact the shop.';
  }
  if (isJoytelRecharge(product)) {
    if (!validSerial(delivery)) return 'Please enter the serial number printed on your JOY SIM card.';
    if (!isDailyPlan(product) && qty > 1) return 'This plan can only be bought one at a time.';
    return null;
  }
  if (!member?.email) return 'Please add your email address to your profile first. JoyTel sends your eSIM to it.';
  if (!pickPhone(delivery, member, product)) return 'Please enter a mobile number for this order.';
  return null;
}

/**
 * Place the JoyTel order for one paid cart line and keep the record up to date.
 * payment: { method: 'wallet' | 'paymongo', txId?, ref?, amount }
 * Returns { ok, skipped?, refunded?, orderTid, error? }.
 */
export async function placeJoytelFulfilment({ product, qty, member, delivery, orderTid, payment }) {
  const key = orderKey(orderTid);

  // Idempotency: a record means this payment was already handled (or is being handled).
  const existing = await getSetting(key);
  if (existing) {
    // A previous attempt was rejected by JoyTel but its refund did not go through: finish the refund now.
    if (existing.statusText === 'failed' && !existing.refunded) await refundOrder(orderTid);
    return { ok: existing.statusText !== 'failed', skipped: true, refunded: existing.statusText === 'failed', orderTid };
  }

  const record = {
    type: 'order_callback',
    orderTid,
    member_id: member.id,
    product_id: product.id,
    productName: product.name,
    productCode: product.joytel_product_code,
    qty,
    amount: payment.amount,
    ...(isJoytelRecharge(product) ? { kind: 'recharge', snCode: cleanSerial(delivery), days: isDailyPlan(product) ? qty : 1 } : {}),
    payment: { method: payment.method, txId: payment.txId || null, ref: payment.ref || null },
    statusText: 'submitting',
    refunded: false,
    created_at: new Date().toISOString(),
  };
  await saveSetting(key, record, `JoyTel order ${orderTid}`);

  let error = null;
  try {
    let r, code;
    if (record.kind === 'recharge') {
      r = await warehouseCall('cardRecharge', {
        orderTid,
        itemList: [{ productCode: product.joytel_product_code, snCode: record.snCode, days: record.days }],
      });
      code = r.body?.code;
      if (code === 0) {
        await saveSetting(key, { ...record, statusText: 'submitted', rechargeCode: r.body?.data?.rechargeCode || null }, `JoyTel order ${orderTid}`);
        return { ok: true, orderTid };
      }
    } else {
      const params = {
        type: product.joytel_type || 3,
        receiveName: member.full_name || member.username || 'Customer',
        phone: pickPhone(delivery, member, product),
        email: member.email,
        orderTid,
        replyType: 1,
        itemList: [{ productCode: product.joytel_product_code, quantity: qty }],
      };
      if (product.joytel_warehouse) params.warehouse = product.joytel_warehouse;

      r = await warehouseCall('customerOrder', params);
      code = r.body?.code;

      if (code === 0) {
        await saveSetting(key, { ...record, statusText: 'submitted', orderCode: r.body?.data?.orderCode || null }, `JoyTel order ${orderTid}`);
        return { ok: true, orderTid };
      }
    }

    // JoyTel says this orderTid already exists (5 / 501): it WAS placed, so never refund here.
    if (code === 5 || code === 501) {
      await saveSetting(key, { ...record, statusText: 'submitted', note: 'JoyTel reported a duplicate orderTid' }, `JoyTel order ${orderTid}`);
      return { ok: true, orderTid };
    }

    // Anything else: JoyTel refused the order.
    error = `JoyTel ${code ?? r.status}: ${r.body?.message || r.body?.mesg || r.body?.error || 'order rejected'}`;
    await saveSetting(key, { ...record, statusText: 'failed', error }, `JoyTel order ${orderTid}`);
  } catch (e) {
    // Network failure: we cannot tell whether JoyTel received the order. Do NOT refund automatically;
    // an admin can check customerOrder/query with this orderTid, and the callback may still arrive.
    await saveSetting(key, { ...record, statusText: 'unknown', error: e.message }, `JoyTel order ${orderTid}`);
    return { ok: false, refunded: false, orderTid, error: e.message, needsCheck: true };
  }

  // Refund outside the try block above: if the refund itself fails the error must reach the caller
  // (the PayMongo webhook then answers 500 and PayMongo redelivers), and the record stays "failed"
  // so the retry finishes the refund.
  await refundOrder(orderTid);
  return { ok: false, refunded: true, orderTid, error };
}

/**
 * Give the customer their money back for a JoyTel order. Safe to call more than once.
 * wallet:   the withdrawal is marked "cancelled" (the wallet balance ignores cancelled withdrawals)
 * paymongo: the payment came from outside the wallet, so a positive "adjustment" credits the wallet
 */
export async function refundOrder(orderTid) {
  const key = orderKey(orderTid);
  const record = await getSetting(key);
  // Only orders we placed for a paid customer carry payment details (admin test orders do not).
  if (!record || record.refunded || !record.payment?.method) return { refunded: false };

  if (record.payment?.method === 'wallet') {
    if (!record.payment.txId) throw new Error('Wallet refund needs the transaction id');
    const { error } = await supabase.from('transactions').update({ status: 'cancelled' }).eq('id', record.payment.txId);
    if (error) throw new Error(`Refund failed: ${error.message}`);
  } else {
    const { error } = await supabase.from('transactions').insert({
      member_id: record.member_id,
      type: 'adjustment',
      amount: Math.abs(Number(record.amount) || 0),
      status: 'completed',
      description: `Refund: ${record.productName} x${record.qty} | JoyTel ${orderTid} | Ref: ${record.payment?.ref || orderTid}-refund`,
    });
    if (error) throw new Error(`Refund failed: ${error.message}`);
  }

  await saveSetting(key, { ...record, refunded: true, refunded_at: new Date().toISOString() }, `JoyTel order ${orderTid}`);
  return { refunded: true };
}

/**
 * Ask JoyTel how a JOY SIM recharge ended (there is no callback for recharges) and update the record.
 * status 1 = success, 2 = failed (refund), 0 / 3 / 4 = still going. Safe to call repeatedly.
 */
export async function checkRecharge(orderTid) {
  const key = orderKey(orderTid);
  const record = await getSetting(key);
  if (!record || record.kind !== 'recharge') return { found: false };
  if (!['submitted', 'unknown'].includes(record.statusText) || record.refunded) return { found: true, statusText: record.statusText, refunded: !!record.refunded };

  const r = await warehouseCall('cardRechargeQuery', { orderTid, rechargeCode: record.rechargeCode || '' });
  if (r.body?.code !== 0) return { found: true, statusText: record.statusText, pending: true, message: r.body?.message };

  const item = r.body?.data?.itemList?.[0];
  if (!item) return { found: true, statusText: record.statusText, pending: true };

  if (item.status === 1) {
    await saveSetting(key, { ...record, statusText: 'delivered', rechargeStatus: 1, expireDate: item.productExpireDate || item.productExpireData || null, error: undefined }, `JoyTel order ${orderTid}`);
    return { found: true, statusText: 'delivered' };
  }
  if (item.status === 2) {
    const error = `JoyTel recharge failed: ${item.statusDesc || 'rejected'}`;
    await saveSetting(key, { ...record, statusText: 'failed', rechargeStatus: 2, error }, `JoyTel order ${orderTid}`);
    await refundOrder(orderTid);
    return { found: true, statusText: 'failed', refunded: true, error };
  }
  return { found: true, statusText: record.statusText, pending: true, rechargeStatus: item.status };
}
