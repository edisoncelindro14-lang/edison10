// Run: node --experimental-test-module-mocks --test scripts/test-joytel.mjs
// Checks the JoyTel integration against the examples in the JoyTel API document (R.20260113.01).
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeAutoGraph, newOrderTid, extractSnPins, WAREHOUSE_PATHS,
} from '../api/_lib/joytel-sign.js';

// ---- minimal req/res helpers --------------------------------------------------
function makeRes() {
  const res = {
    statusCode: 200, headers: {}, body: undefined,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    json(b) { this.body = b; return this; },
    send(b) { this.body = b; return this; },
    end() { return this; },
  };
  return res;
}

// ---- signing: examples printed in the JoyTel document -------------------------
test('customerOrder autoGraph matches the document example', () => {
  const ag = computeAutoGraph('customerOrder', {
    type: 3, receiveName: 'test', phone: '15666666666', timestamp: 1667807404146,
    itemList: [{ productCode: 'esim615xxxx1', quantity: 1 }, { productCode: 'esim615xxxx2', quantity: 1 }],
  }, 'test001', 'abcdefj');
  assert.equal(ag, 'ae09d951095d44faabf3c91a9879afdc477dd630');
});

test('customerOrderQuery autoGraph matches the document example', () => {
  const ag = computeAutoGraph('customerOrderQuery', {
    orderCode: 'DD-230304-xxxxxx', timestamp: 1667807404146,
  }, 'test001', 'abcdefj');
  assert.equal(ag, 'cc348f99b331dc43154203ef3026c99d0a75ea54');
});

test('recharge signing order is timestamp + itemList(productCode+snCode+days) + orderTid', async () => {
  const { sha1 } = await import('../api/_lib/joytel-sign.js');
  const p = { timestamp: 1, orderTid: 'T1', itemList: [{ productCode: 'CZ-test', snCode: '8985x', days: 1 }] };
  assert.equal(computeAutoGraph('cardRecharge', p, 'C', 'A'), sha1('CA' + '1' + 'CZ-test8985x1' + 'T1'));
  const q = { timestamp: 1, orderTid: 'T1', rechargeCode: 'CZ-1' };
  assert.equal(computeAutoGraph('cardRechargeQuery', q, 'C', 'A'), sha1('CA' + '1' + 'CZ-1' + 'T1'));
});

test('endpoint paths follow the document', () => {
  assert.deepEqual(WAREHOUSE_PATHS, {
    customerOrder: '/customerApi/customerOrder',
    customerOrderQuery: '/customerApi/customerOrder/query',
    cardRecharge: '/joyRechargeApi/rechargeOrder',
    cardRechargeQuery: '/joyRechargeApi/rechargeOrder/query',
  });
});

test('newOrderTid is unique and starts with the customer code', () => {
  const a = newOrderTid('CUST'), b = newOrderTid('CUST');
  assert.match(a, /^CUST\d{14}\d{6}$/);
  assert.notEqual(a, b);
});

test('extractSnPins reads itemList[].snList[].snPin and de-duplicates', () => {
  const payload = {
    orderCode: 'DD-1', orderTid: 'T',
    itemList: [{ productCode: 'p', snList: [{ snCode: '8986', snPin: 'PIN1' }, { snCode: '8987', snPin: 'PIN2' }] },
               { productCode: 'q', snList: [{ snCode: '8988', snPin: 'PIN1' }] }],
  };
  assert.deepEqual(extractSnPins(payload), ['PIN1', 'PIN2']);
  assert.deepEqual(extractSnPins({ snPin: 'X' }), ['X']);
  assert.deepEqual(extractSnPins({}), []);
});

// ---- warehouse handler --------------------------------------------------------
process.env.JOYTEL_CUSTOMER_CODE = 'test001';
process.env.JOYTEL_CUSTOMER_AUTH = 'abcdefj';
process.env.JOYTEL_PROXY_URL = 'http://proxy.test:8000';
process.env.JOYTEL_PROXY_TOKEN = 'tok';
process.env.JOYTEL_APP_ID = 'app1';
process.env.JOYTEL_APP_SECRET = 'sec';

const { default: warehouse } = await import('../api/joytel/warehouse.js');

function stubFetch(responder) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return responder(String(url), opts);
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}
const okJson = body => ({ status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) });

test('warehouse: customerOrder requires email, name and phone', async () => {
  const res = makeRes();
  await warehouse({ method: 'POST', body: { endpoint: 'customerOrder', receiveName: 'a', phone: '1', itemList: [{ productCode: 'eSIM-test', quantity: 1 }] } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /email/);
});

test('warehouse: customerOrder goes to the right path with replyType 1, a signature and an orderTid', async () => {
  const f = stubFetch(() => okJson({ code: 0, data: { orderCode: 'DD-1' } }));
  try {
    const res = makeRes();
    await warehouse({ method: 'POST', body: {
      endpoint: 'customerOrder', receiveName: 'Juan', phone: '09171234567', email: 'j@x.com',
      itemList: [{ productCode: 'eSIM-test', quantity: 1 }], replyType: 0,
    } }, res);
    assert.equal(res.statusCode, 200);
    const { url, opts } = f.calls[0];
    assert.equal(url, 'http://proxy.test:8000/warehouse/customerApi/customerOrder');
    const sent = JSON.parse(opts.body);
    assert.equal(sent.replyType, 1);
    assert.equal(sent.type, 3);
    assert.equal(sent.customerCode, 'test001');
    assert.equal(sent.email, 'j@x.com');
    assert.match(sent.orderTid, /^test001\d{20}$/);
    assert.match(sent.autoGraph, /^[0-9a-f]{40}$/);
    assert.equal(opts.headers['X-Proxy-Token'], 'tok');
  } finally { f.restore(); }
});

test('warehouse: order query and recharge use the documented paths', async () => {
  const f = stubFetch(() => okJson({ code: 0 }));
  try {
    await warehouse({ method: 'POST', body: { endpoint: 'customerOrderQuery', orderCode: 'DD-1' } }, makeRes());
    await warehouse({ method: 'POST', body: { endpoint: 'cardRecharge', itemList: [{ productCode: 'CZ-test', snCode: '8985x', days: 1 }] } }, makeRes());
    await warehouse({ method: 'POST', body: { endpoint: 'cardRechargeQuery', rechargeCode: 'CZ-1' } }, makeRes());
    assert.deepEqual(f.calls.map(c => c.url), [
      'http://proxy.test:8000/warehouse/customerApi/customerOrder/query',
      'http://proxy.test:8000/warehouse/joyRechargeApi/rechargeOrder',
      'http://proxy.test:8000/warehouse/joyRechargeApi/rechargeOrder/query',
    ]);
  } finally { f.restore(); }
});

test('warehouse: recharge items need snCode and days; service list is rejected', async () => {
  let res = makeRes();
  await warehouse({ method: 'POST', body: { endpoint: 'cardRecharge', itemList: [{ productCode: 'CZ-test', quantity: 1 }] } }, res);
  assert.equal(res.statusCode, 400);
  res = makeRes();
  await warehouse({ method: 'POST', body: { endpoint: 'serviceOrderListQuery' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /RSP/);
});

// ---- callbacks (system_settings and RSP+ mocked) ------------------------------
const store = new Map();
const rspCalls = [];
let rspResponder = () => ({ code: '000', mesg: 'success' });

mock.module('../api/_lib/joytel-server.js', {
  namedExports: {
    supabase: null,
    getSetting: async k => (store.has(k) ? JSON.parse(store.get(k)) : null),
    saveSetting: async (k, v) => { store.set(k, JSON.stringify(v)); },
    warehouseCall: async () => { throw new Error('not used in these tests'); },
    rspCall: async (endpoint, payload, transId) => {
      rspCalls.push({ endpoint, payload, transId });
      return { transId, status: 200, body: rspResponder(endpoint, payload) };
    },
  },
});

const { default: orderCallback } = await import('../api/joytel/order-callback.js');
const { default: qrNotify } = await import('../api/_lib/joytel-qr-notify.js');

const callbackBody = {
  orderCode: 'DD-230311-1', orderTid: 'test0012026102612000000001', status: 4,
  phone: '09171234567', receiveName: 'Juan', email: 'j@x.com',
  itemList: [{ productCode: 'eSIM-test', productName: 'eSIM', quantity: 1,
    snList: [{ snCode: '898620003000001', snPin: 'j6TR54H1', productExpireDate: '2026-12-30' }] }],
};

test('order callback: stores the order, redeems the coupon, answers 200', async () => {
  const res = makeRes();
  await orderCallback({ method: 'POST', body: callbackBody }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(rspCalls.length, 1);
  assert.equal(rspCalls[0].endpoint, 'coupon/redeem');
  assert.deepEqual(rspCalls[0].payload, { coupon: 'j6TR54H1', qrcodeType: 0 });
  const rec = JSON.parse(store.get('joytel_callback_test0012026102612000000001'));
  assert.equal(rec.statusText, 'delivered');
  assert.equal(rec.coupon, 'j6TR54H1');
  assert.equal(rec.snList[0].snCode, '898620003000001');
  assert.equal(rec.redeem.j6TR54H1.accepted, true);
  assert.ok(store.has(`joytel_trans_${rspCalls[0].transId}`));
});

test('order callback: a JoyTel retry does not redeem the coupon twice', async () => {
  const res = makeRes();
  await orderCallback({ method: 'POST', body: callbackBody }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(rspCalls.length, 1);
});

test('order callback: rejected redeem returns 500 so JoyTel retries, then succeeds', async () => {
  rspCalls.length = 0;
  rspResponder = () => ({ code: '999', mesg: 'System Error' });
  const body = { ...callbackBody, orderTid: 'T-RETRY', itemList: [{ productCode: 'p', snList: [{ snCode: 's', snPin: 'PINZ' }] }] };
  let res = makeRes();
  await orderCallback({ method: 'POST', body }, res);
  assert.equal(res.statusCode, 500);
  rspResponder = () => ({ code: '000', mesg: 'success' });
  res = makeRes();
  await orderCallback({ method: 'POST', body }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(rspCalls.length, 2); // second attempt redeemed it
});

test('QR notification: saves the QR code on the order and answers 000/Success', async () => {
  const transId = rspCalls.find(c => c.payload.coupon === 'j6TR54H1')?.transId;
  const [first] = [...store.keys()].filter(k => k.startsWith('joytel_trans_'));
  const tid = transId || first.replace('joytel_trans_', '');
  const res = makeRes();
  await qrNotify({ method: 'POST', body: {
    transId: tid, resultCode: '000', resultMesg: 'success', finishTime: '1653546537101',
    data: { coupon: 'j6TR54H1', qrcodeType: 0, qrcode: 'https://xxx.xxx/qrcode.jpg', cid: '89852000010000000001', salePlanName: 'Plan', salePlanDays: 90, pin1: '8568', puk1: '49065521' },
  } }, res);
  assert.deepEqual(res.body, { code: '000', mesg: 'Success' });
  const order = JSON.parse(store.get('joytel_callback_test0012026102612000000001'));
  assert.equal(order.qrCode, 'https://xxx.xxx/qrcode.jpg');
  assert.equal(order.qrStatus, 'delivered');
  assert.equal(order.cid, '89852000010000000001');
  assert.equal(JSON.parse(store.get('joytel_qr_j6TR54H1')).pin1, '8568');
});

test('notify.js routes ?type=coupon-redeem to the QR handler', async () => {
  const { default: notify } = await import('../api/joytel/notify.js');
  const res = makeRes();
  await notify({ method: 'POST', query: { type: 'coupon-redeem' }, body: { transId: 'nope', resultCode: '600' } }, res);
  assert.deepEqual(res.body, { code: '000', mesg: 'Success' });
});

test('QR notification: a failure is matched through the transId', async () => {
  const [tk] = [...store.keys()].filter(k => k.startsWith('joytel_trans_'));
  const transId = tk.replace('joytel_trans_', '');
  const res = makeRes();
  await qrNotify({ method: 'POST', body: { transId, resultCode: '600', resultMesg: 'fail', finishTime: '1' } }, res);
  assert.deepEqual(res.body, { code: '000', mesg: 'Success' });
});
