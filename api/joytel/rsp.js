import { createHash } from 'crypto';

// Route through the sandbox proxy (IP whitelisted by JoyTel)
const PROXY_BASE = process.env.JOYTEL_PROXY_URL;
const PROXY_TOKEN = process.env.JOYTEL_PROXY_TOKEN || 'kabaroload-proxy-2024';
const RSP_PATH = '/rsp';

/**
 * JoyTel RSP+ API handler.
 * Auth headers: AppId, AppSecret, TransId, Timestamp, Ciphertext
 * where Ciphertext = MD5(AppId + TransId + Timestamp + AppSecret)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const appId = process.env.JOYTEL_APP_ID;
  const appSecret = process.env.JOYTEL_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).json({ error: 'JoyTel RSP+ credentials not configured' });
  }

  try {
    const { endpoint, ...params } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

    // Generate auth headers
    const transId = `${appId}-${Date.now()}`;
    const timestamp = String(Date.now());
    const ciphertext = createHash('md5').update(appId + transId + timestamp + appSecret, 'utf8').digest('hex');

    // Forward through sandbox proxy (IP whitelisted by JoyTel)
    const response = await fetch(`${PROXY_BASE}${RSP_PATH}/${endpoint}`, {
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
      body: JSON.stringify(params),
    });

    const data = await response.text();
    res.status(response.status).setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.send(data);
  } catch (err) {
    console.error('JoyTel RSP+ API error:', err);
    res.status(502).json({ error: 'RSP+ API error', details: err.message });
  }
}
