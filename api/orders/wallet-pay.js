import { randomUUID } from 'crypto';
import { supabase } from '../_lib/joytel-server.js';
import {
  isJoytelProduct, joytelPreflight, placeJoytelFulfilment, walletOrderTid,
} from '../_lib/joytel-fulfill.js';
import { getFinalPrice, calculateWalletBalance, FALLBACK_PRODUCTS } from '../../src/lib/helpers.js';

/**
 * POST /api/orders/wallet-pay
 * Pays a shop order from the member's wallet on the server (prices and balance are checked here,
 * never trusted from the browser), then places the JoyTel order for JoyTel products.
 *
 * Body: { member_id, items: [{ product_id, qty }], delivery }   (delivery = mobile number or address)
 * Response: { transactions: [...], orders: [{ orderTid, ok, refunded?, error? }] }
 */

async function walletBalance(memberId) {
  // PostgREST returns at most 1000 rows per request, so page through the member's transactions.
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('transactions')
      .select('member_id,type,status,amount')
      .eq('member_id', memberId)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return calculateWalletBalance(rows, memberId);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const { member_id, items, delivery = '' } = req.body || {};
    if (!member_id) return res.status(400).json({ error: 'member_id is required' });
    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return res.status(400).json({ error: 'items must contain 1 to 20 products' });
    }
    for (const i of items) {
      if (!i.product_id || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 50) {
        return res.status(400).json({ error: 'Each item needs a product_id and a quantity from 1 to 50' });
      }
    }

    const { data: member } = await supabase
      .from('members')
      .select('id,username,full_name,email,phone,status')
      .eq('id', member_id)
      .maybeSingle();
    if (!member) return res.status(404).json({ error: 'Member not found' });

    // Prices always come from the database (or the built-in catalogue the shop shows when the table is empty).
    const ids = [...new Set(items.map(i => String(i.product_id)))];
    const { data: dbProducts } = await supabase.from('products').select('*').in('id', ids);
    const byId = new Map((dbProducts || []).map(p => [String(p.id), p]));
    const lines = [];
    for (const i of items) {
      const product = byId.get(String(i.product_id)) || FALLBACK_PRODUCTS.find(p => String(p.id) === String(i.product_id));
      if (!product) return res.status(404).json({ error: 'A product in your cart no longer exists' });
      if (product.is_active === false) return res.status(400).json({ error: `${product.name} is not available` });
      if (isJoytelProduct(product)) {
        const problem = joytelPreflight(product, member, i.delivery ?? delivery);
        if (problem) return res.status(400).json({ error: problem });
      }
      lines.push({ product, qty: i.qty, delivery: i.delivery ?? delivery, total: getFinalPrice(product) * i.qty });
    }

    const total = lines.reduce((s, l) => s + l.total, 0);
    if ((await walletBalance(member.id)) < total) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please top up first.' });
    }

    const transactions = [];
    const orders = [];
    for (const { product, qty, delivery: lineDelivery, total: lineTotal } of lines) {
      const txId = randomUUID();
      const joytel = isJoytelProduct(product);
      const orderTid = joytel ? walletOrderTid(process.env.JOYTEL_CUSTOMER_CODE, txId) : null;
      const description = `${product.name} x${qty} → ${lineDelivery}${orderTid ? ` | JoyTel: ${orderTid}` : ''}`;

      const { data: tx, error } = await supabase
        .from('transactions')
        .insert({ id: txId, member_id: member.id, type: 'withdrawal', amount: -lineTotal, description, status: 'completed' })
        .select()
        .single();
      if (error) return res.status(500).json({ error: `Could not record payment: ${error.message}`, transactions, orders });

      // Two purchases sent at the same moment could both pass the first balance check, so check again.
      if ((await walletBalance(member.id)) < 0) {
        await supabase.from('transactions').update({ status: 'cancelled' }).eq('id', txId);
        return res.status(409).json({ error: 'Insufficient wallet balance. Please top up first.', transactions, orders });
      }
      transactions.push(tx);

      if (joytel) {
        try {
          const r = await placeJoytelFulfilment({
            product, qty, member, delivery: lineDelivery, orderTid,
            payment: { method: 'wallet', txId, amount: lineTotal },
          });
          orders.push({ orderTid, productName: product.name, ok: r.ok, refunded: !!r.refunded, error: r.error, needsCheck: !!r.needsCheck });
        } catch (e) {
          // Payment is recorded but the JoyTel step crashed (e.g. database error). Report it instead of failing
          // the whole request, so the customer is told to contact the shop and the other lines still go through.
          console.error('JoyTel fulfilment crashed:', orderTid, e.message);
          orders.push({ orderTid, productName: product.name, ok: false, refunded: false, error: e.message, needsCheck: true });
        }
      }
    }

    return res.status(200).json({ transactions, orders });
  } catch (err) {
    console.error('wallet-pay error:', err);
    return res.status(500).json({ error: 'Could not complete the order' });
  }
}
