import { createHash } from 'crypto';

// Route through the sandbox proxy (IP whitelisted by JoyTel) instead of direct calls
const PROXY_BASE = process.env.JOYTEL_PROXY_URL || 'https://8000-6a9f6514819dc31adf1bfd4a--b-96e91f0-840f693635c5ca26.imported.base44-preview.app';
const PROXY_TOKEN = process.env.JOYTEL_PROXY_TOKEN || 'kabaroload-proxy-2024';
const WAREHOUSE_PATH = '/warehouse/customerApi';

function sha1(str) {
  return createHash('sha1').update(str, 'utf8').digest('hex');
}

/**
 * Compute autoGraph for JoyTel Warehouse API based on endpoint.
 * The autoGraph is a SHA-1 hash of concatenated request parameters.
 */
function computeAutoGraph(endpoint, params, customerCode, customerAuth) {
  const ts = String(params.timestamp);

  switch (endpoint) {
    case 'customerOrder': {
      // SHA-1(customerCode + customerAuth + warehouse + type + orderTid + receiveName + phone + timestamp + itemList)
      const warehouse = params.warehouse || '';
      const type = String(params.type ?? '');
      const orderTid = params.orderTid || '';
      const receiveName = params.receiveName || '';
      const phone = params.phone || '';
      const itemList = (params.itemList || [])
        .map(item => (item.productCode || '') + String(item.quantity ?? ''))
        .join('');
      return sha1(customerCode + customerAuth + warehouse + type + orderTid + receiveName + phone + ts + itemList);
    }
    case 'customerOrderQuery':
    case 'serviceOrderListQuery': {
      // SHA-1(customerCode + customerAuth + orderCode + orderTid + timestamp)
      const orderCode = params.orderCode || '';
      const orderTid = params.orderTid || '';
      return sha1(customerCode + customerAuth + orderCode + orderTid + ts);
    }
    case 'cardRecharge': {
      // SHA-1(customerCode + customerAuth + timestamp + itemList + orderTid)
      const itemList = (params.itemList || [])
        .map(item => (item.productCode || '') + String(item.quantity ?? ''))
        .join('');
      const orderTid = params.orderTid || '';
      return sha1(customerCode + customerAuth + ts + itemList + orderTid);
    }
    case 'cardRechargeQuery': {
      // SHA-1(customerCode + customerAuth + timestamp + rechargeCode + orderTid)
      const rechargeCode = params.rechargeCode || '';
      const orderTid = params.orderTid || '';
      return sha1(customerCode + customerAuth + ts + rechargeCode + orderTid);
    }
    default:
      // Default to order query format
      return sha1(customerCode + customerAuth + (params.orderCode || '') + (params.orderTid || '') + ts);
  }
}

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

  try {
    const { endpoint, ...params } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

    // Inject credentials
    params.customerCode = customerCode;
    if (!params.timestamp) params.timestamp = Date.now();

    // For order submissions, request async callback (JoyTel sends coupon/snPin via callback)
    if (endpoint === 'customerOrder') {
      params.replyType = 1;
    }

    // Compute autoGraph
    params.autoGraph = computeAutoGraph(endpoint, params, customerCode, customerAuth);

    // Forward through sandbox proxy (IP whitelisted by JoyTel)
    const response = await fetch(`${PROXY_BASE}${WAREHOUSE_PATH}/${endpoint}`, {
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
