// JoyTel API Proxy Route for Vercel
// This route forwards JoyTel API calls through the static IP proxy server
// Usage from frontend: fetch('/api/joytel-proxy/api/v1/orders', { headers: { 'Authorization': 'Bearer JOYTEL_KEY' } })

const PROXY_BASE = process.env.JOYTEL_PROXY_URL || 'https://8000-6a9f6514819dc31adf1bfd4a--b-96e91f0-840f693635c5ca26.imported.base44-preview.app';
const PROXY_TOKEN = process.env.JOYTEL_PROXY_TOKEN || 'kabaroload-proxy-2024';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  try {
    // Build the target URL on the proxy
    const path = req.url || '';
    const targetUrl = `${PROXY_BASE}/joytel${path}`;

    // Forward headers
    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'X-Proxy-Token': PROXY_TOKEN,
    };
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'];
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    res.status(response.status).setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.send(data);
  } catch (err) {
    console.error('JoyTel proxy route error:', err);
    res.status(502).json({ error: 'Proxy error', details: err.message });
  }
}
