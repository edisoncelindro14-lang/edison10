import { computeAutoGraph, newOrderTid, WAREHOUSE_PATHS } from '../_lib/joytel-sign.js';

// Route through the proxy (fixed IP whitelisted by JoyTel) instead of direct calls
const PROXY_BASE = process.env.JOYTEL_PROXY_URL;
const PROXY_TOKEN = process.env.JOYTEL_PROXY_TOKEN || 'kabaroload-proxy-2024';

/**
 * JoyTel Warehouse API (orders and OTA card recharge).
 * Endpoints (JoyTel document R.20260113.01):
 *   customerOrder       POST /customerApi/customerOrder
 *   customerOrderQuery  POST /customerApi/customerOrder/query
 *   cardRecharge        POST /joyRechargeApi/rechargeOrder
 *   cardRechargeQuery   POST /joyRechargeApi/rechargeOrder/query
 * The "service order list" is an RSP+ call (sim/subscription/query), see /api/joytel/rsp.
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const customerCode = process.env.JOYTEL_CUSTOMER_CODE;
  const customerAuth = process.env.JOYTEL_CUSTOMER_AUTH;

  if (!customerCode || !customerAuth) {
    return res.status(500).json({ error: 'JoyTel Warehouse credentials not configured' });
  }
  if (!PROXY_BASE) {
    return res.status(500).json({ error: 'JOYTEL_PROXY_URL not configured' });
  }

  try {
    const { endpoint, ...params } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

    if (endpoint === 'serviceOrderListQuery') {
      return res.status(400).json({
        error: 'serviceOrderListQuery is an RSP+ call. Use /api/joytel/rsp with endpoint "sim/subscription/query" and a cid.',
      });
    }

    const path = WAREHOUSE_PATHS[endpoint];
    if (!path) return res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });

    // Inject credentials and timestamp
    params.customerCode = customerCode;
    if (!params.timestamp) params.timestamp = Date.now();

    if (endpoint === 'customerOrder') {
      // Mandatory fields per the JoyTel document
      const missing = ['receiveName', 'phone', 'email'].filter(k => !params[k]);
      if (missing.length) return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
      if (!Array.isArray(params.itemList) || params.itemList.length === 0) {
        return res.status(400).json({ error: 'itemList is required' });
      }
      if (params.itemList.length > 50) return res.status(400).json({ error: 'itemList is limited to 50 items' });
      if (!params.type) params.type = 3; // 3 = eSIM order with snPin
      // replyType 1: JoyTel sends the snPin to our order callback instead of e-mailing it
      params.replyType = 1;
    }

    if (endpoint === 'cardRecharge') {
      const bad = (params.itemList || []).some(i => !i.productCode || !i.snCode || !i.days);
      if (!Array.isArray(params.itemList) || params.itemList.length === 0 || bad) {
        return res.status(400).json({ error: 'Each recharge item needs productCode, snCode and days' });
      }
    }

    // orderTid must be unique. Generate one when the caller did not provide it.
    if ((endpoint === 'customerOrder' || endpoint === 'cardRecharge') && !params.orderTid) {
      params.orderTid = newOrderTid(customerCode);
    }

    params.autoGraph = computeAutoGraph(endpoint, params, customerCode, customerAuth);

    const response = await fetch(`${PROXY_BASE}/warehouse${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Token': PROXY_TOKEN,
      },
      body: JSON.stringify(params),
    });

    const data = await response.text();
    res.status(response.status).setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.send(data);
  } catch (err) {
    console.error('JoyTel Warehouse API error:', err);
    res.status(502).json({ error: 'Warehouse API error', details: err.message });
  }
}
