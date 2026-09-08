const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PROXY_PORT || 8000;
const JOYTEL_API_BASE = process.env.JOYTEL_API_BASE || 'https://api.joytel.com';
const PROXY_TOKEN = process.env.PROXY_TOKEN || 'kabaroload-proxy-2024';

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Proxy-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'joytel-proxy', ip: '34.11.209.212' }));
    return;
  }

  // Verify proxy token
  const proxyToken = req.headers['x-proxy-token'];
  if (proxyToken !== PROXY_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized - invalid proxy token' }));
    return;
  }

  // Extract JoyTel API path from the URL
  // Expected format: /joytel/api/v1/orders → forwards to JOYTEL_API_BASE/api/v1/orders
  let apiPath = req.url;
  if (apiPath.startsWith('/joytel')) {
    apiPath = apiPath.replace('/joytel', '');
  }

  const targetUrl = new URL(apiPath, JOYTEL_API_BASE);

  // Collect request body
  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    const bodyBuffer = Buffer.concat(body);
    const isJsonBody = req.headers['content-type']?.includes('application/json');

    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || 443,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': req.headers['accept'] || 'application/json',
        'Content-Length': bodyBuffer.length,
      },
    };

    // Forward Authorization header if present
    if (req.headers['authorization']) {
      options.headers['Authorization'] = req.headers['authorization'];
    }

    const proxyReq = https.request(options, (proxyRes) => {
      let responseData = [];
      proxyRes.on('data', chunk => responseData.push(chunk));
      proxyRes.on('end', () => {
        const responseBuffer = Buffer.concat(responseData);
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        });
        res.end(responseBuffer);
      });
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', details: err.message }));
    });

    if (bodyBuffer.length > 0) {
      proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`JoyTel proxy server running on port ${PORT}`);
  console.log(`Forwarding to: ${JOYTEL_API_BASE}`);
  console.log(`Outbound IP: 34.11.209.212`);
});
