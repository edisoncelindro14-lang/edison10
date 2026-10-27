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

/** Phone to send to JoyTel: the delivery number when it looks like one, otherwise the member's phone. */
export function pickPhone(delivery, member) {
  const d = String(delivery || '').trim();
  if (/^\+?[0-9][0-9\s-]{6,}$/.test(d)) return d.replace(/[\s-]/g, '');
  return String(member?.phone || '').trim();
}

/** Checks that a JoyTel purchase can be placed. Returns an error message or null. Call BEFORE taking payment. */
export function joytelPreflight(product, member, delivery) {
  if (!process.env.JOYTEL_CUSTOMER_CODE || !process.env.JOYTEL_CUSTOMER_AUTH || !process.env.JOYTEL_PROXY_URL) {
    return 'JoyTel ordering is not configured yet. Please contact the shop.';
  }
  if (!member?.email) return 'Please add your email address to your profile first. JoyTel sends your eSIM to it.';
  if (!pickPhone(delivery, member)) return 'Please enter a mobile number for this order.';
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
    payment: { method: payment.method, txId: payment.txId || null, ref: payment.ref || null },
    statusText: 'submitting',
    refunded: false,
    created_at: new Date().toISOString(),
  };
  await saveSetting(key, record, `JoyTel order ${orderTid}`);

  let error = null;
  try {
    const params = {
      type: product.joytel_type || 3,
      receiveName: member.full_name || member.username || 'Customer',
      phone: pickPhone(delivery, member),
      email: member.email,
      orderTid,
      replyType: 1,
      itemList: [{ productCode: product.joytel_product_code, quantity: qty }],
    };
    if (product.joytel_warehouse) params.warehouse = product.joytel_warehouse;

    const r = await warehouseCall('customerOrder', params);
    const code = r.body?.code;

    if (code === 0) {
      await saveSetting(key, { ...record, statusText: 'submitted', orderCode: r.body?.data?.orderCode || null }, `JoyTel order ${orderTid}`);
      return { ok: true, orderTid };
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
