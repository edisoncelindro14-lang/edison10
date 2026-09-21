import { createHash } from 'crypto';

/**
 * JoyTel Connection Health Check
 * GET /api/joytel/health
 *
 * Safely verifies the integration WITHOUT placing a real (or test) eSIM order:
 *   1. Credentials exist
 *   2. Required configuration exists (proxy URL)
 *   3. Authentication signatures can be generated
 *   4. JOYTEL endpoint is reachable (via the whitelisted proxy)
 *   5. Authentication is accepted (call a read-only query endpoint, not an order-submit endpoint)
 *   6. Response is valid JSON
 *
 * Never returns AppSecret, customerAuth, signatures, or any private token.
 */

const PROXY_BASE = process.env.JOYTEL_PROXY_URL;
const PROXY_TOKEN = process.env.JOYTEL_PROXY_TOKEN || 'kabaroload-proxy-2024';

function mask(value) {
  if (!value) return null;
  return '*'.repeat(Math.min(8, value.length));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const customerCode = process.env.JOYTEL_CUSTOMER_CODE;
  const customerAuth = process.env.JOYTEL_CUSTOMER_AUTH;
  const appId = process.env.JOYTEL_APP_ID;
  const appSecret = process.env.JOYTEL_APP_SECRET;
  const environment = process.env.JOYTEL_ENVIRONMENT || 'sandbox';

  const checks = {
    credentialsConfigured: {
      warehouse: !!(customerCode && customerAuth),
      rsp: !!(appId && appSecret),
    },
    proxyConfigured: !!PROXY_BASE,
    // Masked, safe-to-display diagnostic values only — never raw secrets.
    diagnostics: {
      customerCode: customerCode || null, // not secret per JoyTel docs (used as public identifier)
      customerAuth: mask(customerAuth),
      appId: mask(appId),
      appSecret: mask(appSecret),
    },
  };

  if (!checks.credentialsConfigured.warehouse || !checks.credentialsConfigured.rsp) {
    return res.status(200).json({
      success: false,
      provider: 'JOYTEL',
      authenticated: false,
      environment,
      reason: 'Missing JOYTEL_CUSTOMER_CODE / JOYTEL_CUSTOMER_AUTH / JOYTEL_APP_ID / JOYTEL_APP_SECRET',
      checks,
    });
  }

  if (!checks.proxyConfigured) {
    return res.status(200).json({
      success: false,
      provider: 'JOYTEL',
      authenticated: false,
      environment,
      reason: 'JOYTEL_PROXY_URL not configured (requests must go through the IP-whitelisted proxy)',
      checks,
    });
  }

  const results = { warehouse: null, rsp: null };

  // Warehouse API reachability + auth check: use the read-only Order Query endpoint
  // (never customerOrder/submit — that would create a real order).
  try {
    const timestamp = Date.now();
    const raw = customerCode + customerAuth + '' + '' + timestamp; // orderCode + orderTid both empty
    const autoGraph = createHash('sha1').update(raw, 'utf8').digest('hex');
    const response = await fetch(`${PROXY_BASE}/warehouse/customerApi/customerOrder/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Proxy-Token': PROXY_TOKEN },
      body: JSON.stringify({ customerCode, timestamp, autoGraph }),
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON */ }
    results.warehouse = {
      reachable: true,
      httpStatus: response.status,
      // code 2 ("Mandatory Parameter Missing") is EXPECTED here since we omitted orderCode/orderTid on
      // purpose — it still proves the endpoint is reachable and the signature was accepted for parsing.
      // code 1 or 403-style auth codes indicate a real auth problem.
      responseCode: parsed?.code ?? null,
      authenticationAccepted: parsed != null && parsed.code !== 1,
    };
  } catch (err) {
    results.warehouse = { reachable: false, error: err.message };
  }

  // RSP+ API reachability + auth check via a read-only coupon query.
  try {
    const transId = `health-${Date.now()}`;
    const timestamp = String(Date.now());
    const ciphertext = createHash('md5').update(appId + transId + timestamp + appSecret, 'utf8').digest('hex');
    const response = await fetch(`${PROXY_BASE}/rsp/coupon/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Token': PROXY_TOKEN,
        'AppId': appId,
        'TransId': transId,
        'Timestamp': timestamp,
        'Ciphertext': ciphertext,
      },
      body: JSON.stringify({ coupons: 'health-check-nonexistent-coupon' }),
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON */ }
    results.rsp = {
      reachable: true,
      httpStatus: response.status,
      responseCode: parsed?.code ?? null,
      // 403 = "Encryption message verification failed" -> real auth failure.
      authenticationAccepted: parsed != null && parsed.code !== '403',
    };
  } catch (err) {
    results.rsp = { reachable: false, error: err.message };
  }

  const authenticated =
    !!results.warehouse?.authenticationAccepted && !!results.rsp?.authenticationAccepted;
  const reachable = !!results.warehouse?.reachable && !!results.rsp?.reachable;

  return res.status(200).json({
    success: reachable && authenticated,
    provider: 'JOYTEL',
    authenticated,
    environment,
    checks,
    results,
  });
}
