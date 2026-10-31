// Run: node --experimental-test-module-mocks --test scripts/test-joytel-orders.mjs
// Wallet / PayMongo purchase -> JoyTel order -> refund, with Supabase and JoyTel mocked.
import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.JOYTEL_CUSTOMER_CODE = 'KAB1';
process.env.JOYTEL_CUSTOMER_AUTH = 'auth';
process.env.JOYTEL_PROXY_URL = 'http://proxy.test';

// ---- tiny in-memory Supabase ---------------------------------------------------
let db;
class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; }
  select() { return this; }
  insert(row) { this.op = 'insert'; this.payload = row; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  eq(c, v) { this.f.push(r => r[c] === v); return this; }
  in(c, vs) { this.f.push(r => vs.map(String).includes(String(r[c]))); return this; }
  range() { return this; }
  limit() { return this; }
  ilike(c, pat) { const re = new RegExp(pat.split('%').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i'); this.f.push(r => re.test(r[c] || '')); return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; this.maybe = true; return this; }
  then(res, rej) { return Promise.resolve(this.exec()).then(res, rej); }
  exec() {
    const rows = (db[this.t] ||= []);
    const match = rows.filter(r => this.f.every(fn => fn(r)));
    if (this.op === 'insert') { const row = { ...this.payload }; rows.push(row); return this.one ? { data: row, error: null } : { data: [row], error: null }; }
    if (this.op === 'update') { match.forEach(r => Object.assign(r, this.payload)); return { data: match, error: null }; }
    if (this.one) return { data: match[0] || null, error: null };
    return { data: match, error: null };
  }
}
let warehouse;      // function(endpoint, params) => { status, body }
const warehouseLog = [];

mock.module('../api/_lib/joytel-server.js', {
  namedExports: {
    supabase: { from: t => new Q(t) },
    getSetting: async k => { const r = (db.system_settings || []).find(x => x.setting_key === k); return r ? JSON.parse(r.setting_value) : null; },
    saveSetting: async (k, v) => {
      db.system_settings ||= [];
      const row = db.system_settings.find(x => x.setting_key === k);
      if (row) row.setting_value = JSON.stringify(v); else db.system_settings.push({ setting_key: k, setting_value: JSON.stringify(v) });
    },
    rspCall: async () => ({ transId: 'x', status: 200, body: { code: '000' } }),
    warehouseCall: async (endpoint, params) => { warehouseLog.push({ endpoint, params }); return warehouse(endpoint, params); },
  },
});

const { default: walletPay } = await import('../api/orders/wallet-pay.js');
const { default: orderCallback } = await import('../api/joytel/order-callback.js');
const { placeJoytelFulfilment, refundOrder, paymongoOrderTid, walletOrderTid, orderKey } = await import('../api/_lib/joytel-fulfill.js');
const { calculateWalletBalance } = await import('../src/lib/helpers.js');

const res = () => ({ statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const call = async body => { const r = res(); await walletPay({ method: 'POST', body }, r); return r; };
const record = k => JSON.parse(db.system_settings.find(s => s.setting_key === k).setting_value);
const balance = id => calculateWalletBalance(db.transactions, id);

beforeEach(() => {
  warehouseLog.length = 0;
  warehouse = () => ({ status: 200, body: { code: 0, data: { orderCode: 'DD-1' } } });
  db = {
    members: [
      { id: 'm1', username: 'juan', full_name: 'Juan', email: 'j@x.com', phone: '09170000000' },
      { id: 'm2', username: 'noemail', full_name: 'No Email', email: '', phone: '09170000001' },
    ],
    products: [
      { id: 'p-esim', name: 'eSIM Japan 5GB', price: 500, discount_percent: 10, category: 'sim', is_active: true, joytel_enabled: true, joytel_product_code: 'eSIM-test', joytel_type: 3 },
      { id: 'p-load', name: 'Globe 100', price: 100, category: 'load', is_active: true },
    ],
    transactions: [
      { id: 't0', member_id: 'm1', type: 'adjustment', amount: 1000, status: 'completed' },
      { id: 't1', member_id: 'm2', type: 'adjustment', amount: 1000, status: 'completed' },
    ],
    system_settings: [],
  };
});

test('wallet: JoyTel product is charged at the database price and ordered from JoyTel', async () => {
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-esim', qty: 2 }], delivery: '09171234567' });
  assert.equal(r.statusCode, 200);
  assert.equal(balance('m1'), 1000 - 900);                 // 500 less 10% = 450, x2
  const tx = r.body.transactions[0];
  assert.equal(tx.amount, -900);
  assert.match(tx.description, /\| JoyTel: KAB1[0-9]{20}$/);
  assert.equal(warehouseLog.length, 1);
  assert.equal(warehouseLog[0].endpoint, 'customerOrder');
  assert.deepEqual(warehouseLog[0].params.itemList, [{ productCode: 'eSIM-test', quantity: 2 }]);
  assert.equal(warehouseLog[0].params.email, 'j@x.com');
  assert.equal(warehouseLog[0].params.phone, '09171234567');
  const rec = record(`joytel_callback_${r.body.orders[0].orderTid}`);
  assert.equal(rec.statusText, 'submitted');
  assert.equal(rec.orderCode, 'DD-1');
  assert.equal(rec.payment.txId, tx.id);
});

test('wallet: insufficient balance changes nothing', async () => {
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-esim', qty: 3 }], delivery: '09171234567' });
  assert.equal(r.statusCode, 400);
  assert.match(r.body.error, /Insufficient/);
  assert.equal(balance('m1'), 1000);
  assert.equal(warehouseLog.length, 0);
});

test('wallet: a member without an email is stopped BEFORE paying', async () => {
  const r = await call({ member_id: 'm2', items: [{ product_id: 'p-esim', qty: 1 }], delivery: '09171234567' });
  assert.equal(r.statusCode, 400);
  assert.match(r.body.error, /email/i);
  assert.equal(balance('m2'), 1000);
});

test('wallet: when JoyTel rejects the order the wallet is refunded', async () => {
  warehouse = () => ({ status: 200, body: { code: 3, message: 'Insufficient Balance' } });
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-esim', qty: 1 }], delivery: '09171234567' });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.orders[0].ok, false);
  assert.equal(r.body.orders[0].refunded, true);
  assert.equal(balance('m1'), 1000);
  const rec = record(`joytel_callback_${r.body.orders[0].orderTid}`);
  assert.equal(rec.statusText, 'failed');
  assert.match(rec.error, /Insufficient Balance/);
  assert.equal(rec.refunded, true);
});

test('wallet: if JoyTel cannot be reached we do NOT refund automatically', async () => {
  warehouse = () => { throw new Error('socket hang up'); };
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-esim', qty: 1 }], delivery: '09171234567' });
  assert.equal(r.body.orders[0].needsCheck, true);
  assert.equal(r.body.orders[0].refunded, false);
  assert.equal(balance('m1'), 1000 - 450);
  assert.equal(record(`joytel_callback_${r.body.orders[0].orderTid}`).statusText, 'unknown');
});

test('wallet: ordinary products never call JoyTel', async () => {
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-load', qty: 1, delivery: '09175550000' }] });
  assert.equal(r.statusCode, 200);
  assert.equal(warehouseLog.length, 0);
  assert.equal(r.body.orders.length, 0);
  assert.equal(balance('m1'), 900);
  assert.equal(r.body.transactions[0].description, 'Globe 100 x1 → 09175550000');
});

test('wallet: bad input is rejected', async () => {
  assert.equal((await call({ member_id: 'm1', items: [] })).statusCode, 400);
  assert.equal((await call({ member_id: 'm1', items: [{ product_id: 'p-load', qty: 0 }] })).statusCode, 400);
  assert.equal((await call({ member_id: 'zzz', items: [{ product_id: 'p-load', qty: 1 }] })).statusCode, 404);
  assert.equal((await call({ member_id: 'm1', items: [{ product_id: 'nope', qty: 1 }] })).statusCode, 404);
});

const TID0 = paymongoOrderTid('KAB1', 'AbC123', 0);
const product = () => db.products[0];
const member = () => db.members[0];

test('PayMongo: a rejected JoyTel order credits the wallet, and replaying the payment is a no-op', async () => {
  warehouse = () => ({ status: 200, body: { code: 603, message: 'Insufficient resource inventory' } });
  const orderTid = paymongoOrderTid('KAB1', 'AbC123', 0);
  const args = { product: product(), qty: 1, member: member(), delivery: '09171234567', orderTid, payment: { method: 'paymongo', ref: 'AbC123', amount: 450 } };
  const first = await placeJoytelFulfilment(args);
  assert.equal(first.refunded, true);
  const credit = db.transactions.find(t => /Refund/.test(t.description || ''));
  assert.equal(credit.amount, 450);
  assert.equal(credit.type, 'adjustment');
  const second = await placeJoytelFulfilment(args);       // webhook delivered twice
  assert.equal(second.skipped, true);
  assert.equal(warehouseLog.length, 1);
  assert.equal(db.transactions.filter(t => /Refund/.test(t.description || '')).length, 1);
  await refundOrder(orderTid);                              // and a second refund attempt does nothing
  assert.equal(db.transactions.filter(t => /Refund/.test(t.description || '')).length, 1);
});

test('PayMongo: JoyTel duplicate-order code (5) is treated as already placed, not refunded', async () => {
  warehouse = () => ({ status: 200, body: { code: 5, message: 'Order Already Exists' } });
  const r = await placeJoytelFulfilment({ product: product(), qty: 1, member: member(), delivery: '09171234567', orderTid: 'KAB1PX0', payment: { method: 'paymongo', ref: 'X', amount: 450 } });
  assert.equal(r.ok, true);
  assert.equal(db.transactions.filter(t => /Refund/.test(t.description || '')).length, 0);
});

test('callback: JoyTel cancelling a paid wallet order refunds it, once', async () => {
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-esim', qty: 1 }], delivery: '09171234567' });
  const { orderTid } = r.body.orders[0];
  assert.equal(balance('m1'), 550);
  for (let i = 0; i < 2; i++) {                             // JoyTel may resend
    const cb = res();
    await orderCallback({ method: 'POST', body: { orderTid, orderCode: 'DD-1', status: -1 } }, cb);
    assert.equal(cb.statusCode, 200);
  }
  assert.equal(balance('m1'), 1000);
  assert.equal(record(orderKey(orderTid)).refunded, true);
  assert.equal(record(orderKey(orderTid)).statusText, 'cancelled');
});

test('callback: a delivered order is not refunded, and admin test orders are never refunded', async () => {
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-esim', qty: 1 }], delivery: '09171234567' });
  const { orderTid } = r.body.orders[0];
  const cb = res();
  await orderCallback({ method: 'POST', body: { orderTid, orderCode: 'DD-1', status: 4, itemList: [{ snList: [{ snCode: '8986', snPin: 'PIN1' }] }] } }, cb);
  assert.equal(cb.statusCode, 200);
  assert.equal(balance('m1'), 550);
  // admin test order: no payment info on the record
  const cb2 = res();
  await orderCallback({ method: 'POST', body: { orderTid: 'TEST-1', orderCode: 'DD-9', status: -1 } }, cb2);
  assert.equal(cb2.statusCode, 200);
  assert.equal(db.transactions.filter(t => /Refund/.test(t.description || '')).length, 0);
});

// ---- PayMongo webhook end to end ---------------------------------------------
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
process.env.PAYMONGO_WEBHOOK_SECRET = 'whsec';
const { default: webhook } = await import('../api/paymongo/webhook.js');

async function pay({ linkId = 'link_1', reference = 'AbC123', member_id = 'm1', amount = 45000 } = {}) {
  const raw = JSON.stringify({ data: { attributes: { type: 'link.payment.paid', data: { id: linkId, attributes: {
    amount, reference_number: reference,
    remarks: `purpose:purchase|member_id:${member_id}|items:${encodeURIComponent(JSON.stringify([{ name: 'eSIM Japan 5GB', price: 450, qty: 1, category: 'sim' }]))}|delivery:09171234567`,
  } } } } });
  const t = String(Date.now());
  const te = crypto.createHmac('sha256', 'whsec').update(`${t}.${raw}`).digest('hex');
  const req = new EventEmitter(); req.method = 'POST'; req.headers = { 'paymongo-signature': `t=${t},te=${te},li=` };
  const r = res();
  const done = webhook(req, r);
  req.emit('data', raw); req.emit('end');
  await done;
  return r;
}
const seedIntent = () => db.system_settings.push({
  setting_key: 'purchase_intent_link_1',
  setting_value: JSON.stringify({ member_id: 'm1', delivery: '09171234567', items: [{ product_id: 'p-esim', name: 'eSIM Japan 5GB', price: 450, qty: 1, category: 'sim' }] }),
});

test('webhook: a paid PayMongo purchase records the payment and places the JoyTel order', async () => {
  seedIntent();
  const r = await pay();
  assert.equal(r.statusCode, 200);
  const tx = db.transactions.find(t => t.type === 'purchase');
  assert.equal(tx.amount, -450);
  assert.match(tx.description, /Pay to Kabaro \| JoyTel: KAB1[0-9]{20} \| Ref: AbC123/);
  assert.equal(warehouseLog.length, 1);
  assert.equal(warehouseLog[0].params.orderTid, TID0);
  assert.equal(record(`joytel_callback_${TID0}`).statusText, 'submitted');
});

test('webhook: PayMongo retrying the same payment never creates a second JoyTel order', async () => {
  seedIntent();
  await pay(); await pay(); await pay();
  assert.equal(db.transactions.filter(t => t.type === 'purchase').length, 1);
  assert.equal(warehouseLog.length, 1);
});

test('webhook: if JoyTel refuses, the customer is credited back in the wallet', async () => {
  seedIntent();
  warehouse = () => ({ status: 200, body: { code: 4, message: 'Service not supported' } });
  await pay();
  assert.equal(balance('m1'), 1000 + 450);                   // purchase rows are not wallet money; the refund credit is
  assert.equal(record(`joytel_callback_${TID0}`).refunded, true);
});

test('webhook: without a saved intent (old payment link) the purchase is still recorded, with no JoyTel call', async () => {
  const r = await pay({ linkId: 'link_old', reference: 'OLD1' });
  assert.equal(r.statusCode, 200);
  assert.equal(db.transactions.filter(t => t.type === 'purchase').length, 1);
  assert.equal(warehouseLog.length, 0);
});

test('replay: a JoyTel rejection whose refund failed the first time is refunded on the retry', async () => {
  warehouse = () => ({ status: 200, body: { code: 4, message: 'Service not supported' } });
  seedIntent();
  // first delivery: the refund insert blows up
  const realFrom = (await import('../api/_lib/joytel-server.js')).supabase.from;
  const sb = (await import('../api/_lib/joytel-server.js')).supabase;
  sb.from = t => { const q = realFrom(t); if (t === 'transactions') { const ins = q.insert.bind(q); q.insert = row => /Refund/.test(row.description || '') ? { then: (_, rej) => rej(new Error('db down')) } : ins(row); } return q; };
  const first = await pay();
  sb.from = realFrom;
  assert.equal(first.statusCode, 500);                      // PayMongo will redeliver
  assert.equal(balance('m1'), 1000);
  assert.equal(record(`joytel_callback_${TID0}`).refunded, false);
  const second = await pay();                               // redelivery
  assert.equal(second.statusCode, 200);
  assert.equal(balance('m1'), 1450);
  assert.equal(warehouseLog.length, 1);                     // still only one JoyTel order
});

test('orderTid is customerCode + digits only, stable per payment, at most 32 characters', () => {
  const a = walletOrderTid('10502', '3f2c8a1e-7b0d-4c11-9a55-0e6f1d2b3c4d');
  assert.match(a, /^10502[0-9]{20}$/);
  assert.equal(a, walletOrderTid('10502', '3f2c8a1e-7b0d-4c11-9a55-0e6f1d2b3c4d'));
  assert.notEqual(a, walletOrderTid('10502', '3f2c8a1e-7b0d-4c11-9a55-0e6f1d2b3c4e'));
  const p0 = paymongoOrderTid('10502', 'AbC123', 0);
  assert.match(p0, /^10502[0-9]{20}$/);
  assert.notEqual(p0, paymongoOrderTid('10502', 'AbC123', 1));
  assert.ok(paymongoOrderTid('KAB1234567890', 'x', 0).length <= 32);
});

test('wallet: an eSIM needs no mobile number (profile phone, then a placeholder, is sent to JoyTel)', async () => {
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-esim', qty: 1 }], delivery: '' });
  assert.equal(r.statusCode, 200);
  assert.equal(warehouseLog.at(-1).params.phone, '09170000000');      // member's profile phone
  assert.match(r.body.transactions[0].description, /→ email \| JoyTel:/);

  db.members.push({ id: 'm3', username: 'nophone', full_name: 'No Phone', email: 'n@x.com', phone: '' });
  db.transactions.push({ id: 't3', member_id: 'm3', type: 'adjustment', amount: 1000, status: 'completed' });
  const r2 = await call({ member_id: 'm3', items: [{ product_id: 'p-esim', qty: 1 }], delivery: '' });
  assert.equal(r2.statusCode, 200);
  assert.equal(warehouseLog.at(-1).params.phone, '09000000000');      // placeholder, only because it is an eSIM
});

test('wallet: a JoyTel product that is not an eSIM still needs a phone number', async () => {
  db.products.push({ id: 'p-sim', name: 'Physical SIM', price: 100, category: 'sim', is_active: true, joytel_enabled: true, joytel_product_code: 'SIM-V1W', joytel_type: 1 });
  db.members.push({ id: 'm4', username: 'x', full_name: 'X', email: 'x@x.com', phone: '' });
  db.transactions.push({ id: 't4', member_id: 'm4', type: 'adjustment', amount: 1000, status: 'completed' });
  const r = await call({ member_id: 'm4', items: [{ product_id: 'p-sim', qty: 1 }], delivery: '' });
  assert.equal(r.statusCode, 400);
  assert.match(r.body.error, /mobile number/i);
});

// ---- JOY SIM recharge (Card Recharge API) --------------------------------------
const rechargeProduct = (over = {}) => ({ id: 'p-rech', name: '[Recharge] JOY Philippines - 1GB/day', price: 100, category: 'load', is_active: true, joytel_enabled: true, joytel_product_code: 'PH_1GB', joytel_type: 9, ...over });

test('recharge: a daily plan sends the serial and days (= quantity) to cardRecharge, no email or phone needed', async () => {
  db.products.push(rechargeProduct());
  db.members.push({ id: 'm5', username: 'r', full_name: 'R', email: '', phone: '' });
  db.transactions.push({ id: 't5', member_id: 'm5', type: 'adjustment', amount: 1000, status: 'completed' });
  warehouse = () => ({ status: 200, body: { code: 0, data: { rechargeCode: 'CZ-1', orderTid: 'x' } } });
  const r = await call({ member_id: 'm5', items: [{ product_id: 'p-rech', qty: 3, delivery: 'ab 12 3456' }] });
  assert.equal(r.statusCode, 200);
  const sent = warehouseLog.at(-1);
  assert.equal(sent.endpoint, 'cardRecharge');
  assert.deepEqual(sent.params.itemList, [{ productCode: 'PH_1GB', snCode: 'ab123456', days: 3 }]);
  assert.match(sent.params.orderTid, /^KAB1[0-9]{20}$/);
  assert.equal(balance('m5'), 1000 - 300);
  const rec = record(`joytel_callback_${r.body.orders[0].orderTid}`);
  assert.equal(rec.kind, 'recharge');
  assert.equal(rec.statusText, 'submitted');
  assert.equal(rec.rechargeCode, 'CZ-1');
  assert.match(r.body.transactions[0].description, /→ ab123456 \| JoyTel:/);
});

test('recharge: bad serial or a total plan with quantity 2 is stopped before paying', async () => {
  db.products.push(rechargeProduct(), rechargeProduct({ id: 'p-total', name: '[Recharge] JOY Philippines - Total 3GB - 05days', joytel_product_code: 'PH-05-3GB' }));
  const bad = await call({ member_id: 'm1', items: [{ product_id: 'p-rech', qty: 1, delivery: '' }] });
  assert.equal(bad.statusCode, 400);
  assert.match(bad.body.error, /serial/i);
  const two = await call({ member_id: 'm1', items: [{ product_id: 'p-total', qty: 2, delivery: 'ABCDEF12' }] });
  assert.equal(two.statusCode, 400);
  assert.match(two.body.error, /one at a time/i);
  assert.equal(balance('m1'), 1000);
  assert.equal(warehouseLog.length, 0);
});

test('recharge: a total plan always sends days = 1', async () => {
  db.products.push(rechargeProduct({ id: 'p-total', name: '[Recharge] JOY Philippines - Total 3GB - 05days', joytel_product_code: 'PH-05-3GB' }));
  warehouse = () => ({ status: 200, body: { code: 0, data: { rechargeCode: 'CZ-2' } } });
  await call({ member_id: 'm1', items: [{ product_id: 'p-total', qty: 1, delivery: 'ABCDEF12' }] });
  assert.equal(warehouseLog.at(-1).params.itemList[0].days, 1);
});

test('recharge: JoyTel rejecting the order refunds the wallet', async () => {
  db.products.push(rechargeProduct());
  warehouse = () => ({ status: 200, body: { code: 4, message: 'Card not found' } });
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-rech', qty: 1, delivery: 'ABCDEF12' }] });
  assert.equal(r.body.orders[0].refunded, true);
  assert.equal(balance('m1'), 1000);
});

test('recharge: status check marks success, keeps waiting while recharging, refunds on failure', async () => {
  const { checkRecharge } = await import('../api/_lib/joytel-fulfill.js');
  db.products.push(rechargeProduct());
  warehouse = () => ({ status: 200, body: { code: 0, data: { rechargeCode: 'CZ-9' } } });
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-rech', qty: 1, delivery: 'ABCDEF12' }] });
  const tid = r.body.orders[0].orderTid;

  warehouse = () => ({ status: 200, body: { code: 0, data: { orderTid: tid, itemList: [{ status: 0, statusDesc: 'Recharging' }] } } });
  assert.equal((await checkRecharge(tid)).pending, true);
  assert.equal(record(orderKey(tid)).statusText, 'submitted');
  assert.equal(warehouseLog.at(-1).endpoint, 'cardRechargeQuery');
  assert.equal(warehouseLog.at(-1).params.rechargeCode, 'CZ-9');

  warehouse = () => ({ status: 200, body: { code: 0, data: { orderTid: tid, itemList: [{ status: 1, productExpireDate: '2026-12-01' }] } } });
  assert.equal((await checkRecharge(tid)).statusText, 'delivered');
  assert.equal(record(orderKey(tid)).expireDate, '2026-12-01');
  assert.equal(balance('m1'), 1000 - 100);                  // delivered: money stays spent

  // second order that fails at JoyTel
  warehouse = () => ({ status: 200, body: { code: 0, data: { rechargeCode: 'CZ-10' } } });
  const r2 = await call({ member_id: 'm1', items: [{ product_id: 'p-rech', qty: 1, delivery: 'ABCDEF12' }] });
  const tid2 = r2.body.orders[0].orderTid;
  warehouse = () => ({ status: 200, body: { code: 0, data: { itemList: [{ status: 2, statusDesc: 'Card expired' }] } } });
  const out = await checkRecharge(tid2);
  assert.equal(out.refunded, true);
  assert.equal(balance('m1'), 1000 - 100);                  // second order refunded
  assert.equal((await checkRecharge(tid2)).statusText, 'failed');   // repeating is harmless
});

test('recharge: the check endpoint only answers for the order owner', async () => {
  db.products.push(rechargeProduct());
  warehouse = () => ({ status: 200, body: { code: 0, data: { rechargeCode: 'CZ-3' } } });
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-rech', qty: 1, delivery: 'ABCDEF12' }] });
  const tid = r.body.orders[0].orderTid;
  warehouse = () => ({ status: 200, body: { code: 0, data: { itemList: [{ status: 1 }] } } });
  const other = await call({ action: 'check-recharge', member_id: 'm2', orderTid: tid });
  assert.equal(other.statusCode, 404);
  const mine = await call({ action: 'check-recharge', member_id: 'm1', orderTid: tid });
  assert.equal(mine.statusCode, 200);
  assert.equal(mine.body.statusText, 'delivered');
});

test('recharge: shop staff (admin) can check any order, a normal member cannot', async () => {
  db.products.push(rechargeProduct());
  db.members.push({ id: 'adm', username: 'boss', role: 'admin' }, { id: 'usr', username: 'u', role: 'member' });
  warehouse = () => ({ status: 200, body: { code: 0, data: { rechargeCode: 'CZ-7' } } });
  const r = await call({ member_id: 'm1', items: [{ product_id: 'p-rech', qty: 1, delivery: 'ABCDEF12' }] });
  const tid = r.body.orders[0].orderTid;
  warehouse = () => ({ status: 200, body: { code: 0, data: { itemList: [{ status: 1, productExpireDate: '2027-01-01' }] } } });
  assert.equal((await call({ action: 'check-recharge', member_id: 'usr', orderTid: tid })).statusCode, 404);
  const staff = await call({ action: 'check-recharge', member_id: 'adm', orderTid: tid });
  assert.equal(staff.statusCode, 200);
  assert.equal(staff.body.statusText, 'delivered');
});
