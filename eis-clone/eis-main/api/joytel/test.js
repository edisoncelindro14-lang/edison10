import { createHash } from 'crypto';

/**
 * JoyTel API Connection Test Endpoint
 * GET /api/joytel/test
 * Tests both Warehouse and RSP+ API authentication through the joytel-proxy.
 */

const PROXY_BASE = process.env.JOYTEL_PROXY_URL || 'https://8000-6a9f6514819dc31adf1bfd4a--b-96e91f0-840f693635c5ca26.imported.base44-preview.app';
const PROXY_TOKEN = process.env.JOYTEL_PROXY_TOKEN || 'kabaroload-proxy-2024';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const customerCode = process.env.JOYTEL_CUSTOMER_CODE;
  const customerAuth = process.env.JOYTEL_CUSTOMER_AUTH;
  const appId = process.env.JOYTEL_APP_ID;
  const appSecret = process.env.JOYTEL_APP_SECRET;

  const results = {
    timestamp: new Date().toISOString(),
    proxy: PROXY_BASE,
    credentials: {
      warehouse: { configured: !!(customerCode && customerAuth) },
      rsp: { configured: !!(appId && appSecret) },
    },
    tests: {},
  };

  // Test 1: Warehouse API — order submit through proxy
  try {
    const timestamp = Date.now();
    const orderTid = `TEST-${timestamp}`;
    const type = 3;
    const receiveName = 'Test';
    const phone = '09000000000';
    const warehouse = '';
    const itemList = [{ productCode: 'TEST001', quantity: 1 }];
    const itemListStr = itemList.map(i => i.productCode + String(i.quantity)).join('');
    const raw = customerCode + customerAuth + warehouse + String(type) + orderTid + receiveName + phone + timestamp + itemListStr;
    const autoGraph = createHash('sha1').update(raw, 'utf8').digest('hex');

    const body = { customerCode, type, receiveName, phone, orderTid, timestamp, autoGraph, itemList };
    const response = await fetch(`${PROXY_BASE}/warehouse/customerApi/customerOrder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Proxy-Token': PROXY_TOKEN },
      body: JSON.stringify(body),
    });
    const data = await response.text();
    results.tests.warehouse_order = {
      url: `${PROXY_BASE}/warehouse/customerApi/customerOrder`,
      status: response.status,
      ok: response.ok,
      response: data.substring(0, 500),
    };
  } catch (err) {
    results.tests.warehouse_order = { error: err.message };
  }

  // Test 2: Warehouse API — order query through proxy
  try {
    const timestamp = Date.now();
    const orderCode = '';
    const orderTid = '';
    const raw = customerCode + customerAuth + orderCode + orderTid + timestamp;
    const autoGraph = createHash('sha1').update(raw, 'utf8').digest('hex');

    const response = await fetch(`${PROXY_BASE}/warehouse/customerApi/customerOrderQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Proxy-Token': PROXY_TOKEN },
      body: JSON.stringify({ customerCode, orderCode, orderTid, timestamp, autoGraph }),
    });
    const data = await response.text();
    results.tests.warehouse_query = {
      url: `${PROXY_BASE}/warehouse/customerApi/customerOrderQuery`,
      status: response.status,
      ok: response.ok,
      response: data.substring(0, 500),
    };
  } catch (err) {
    results.tests.warehouse_query = { error: err.message };
  }

  // Test 3: RSP+ API — coupon query through proxy
  try {
    const transId = `${appId}-${Date.now()}`;
    const timestamp = String(Date.now());
    const ciphertext = createHash('md5').update(appId + transId + timestamp + appSecret, 'utf8').digest('hex');
    const response = await fetch(`${PROXY_BASE}/rsp/coupon/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Token': PROXY_TOKEN,
        'AppId': appId,
        'AppSecret': appSecret,
        'TransId': transId,
        'Timestamp': timestamp,
        'Ciphertext': ciphertext,
      },
      body: JSON.stringify({ coupons: 'TEST001' }),
    });
    const data = await response.text();
    results.tests.rsp = {
      status: response.status,
      ok: response.ok,
      response: data.substring(0, 500),
    };
  } catch (err) {
    results.tests.rsp = { error: err.message };
  }

  return res.status(200).json(results);
}
