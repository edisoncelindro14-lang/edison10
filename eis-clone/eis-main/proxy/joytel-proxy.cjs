const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PROXY_PORT || 8000;
const PROXY_TOKEN = process.env.PROXY_TOKEN || 'kabaroload-proxy-2024';

// JoyTel API base URLs
const WAREHOUSE_BASE = 'https://api.joytelshop.com';
const RSP_BASE = 'https://esim.joytelecom.com/openapi';

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Proxy-Token, AppId, AppSecret, TransId, Timestamp, Ciphertext');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'joytel-proxy' }));
    return;
  }

  // Verify proxy token
  const proxyToken = req.headers['x-proxy-token'];
  if (proxyToken !== PROXY_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized - invalid proxy token' }));
    return;
  }

  // Route based on path prefix:
  // /warehouse/<endpoint> → https://api.joytelshop.com/<endpoint>
  // /rsp/<endpoint>       → https://esim.joytelecom.com/openapi/<endpoint>
  let apiPath = req.url;
  let targetBase;

  if (apiPath.startsWith('/warehouse/')) {
    apiPath = apiPath.replace('/warehouse', '');
    targetBase = WAREHOUSE_BASE;
  } else if (apiPath.startsWith('/rsp/')) {
    apiPath = apiPath.replace('/rsp', '');
    targetBase = RSP_BASE;
  } else if (apiPath.startsWith('/joytel')) {
    // Legacy: forward to warehouse
    apiPath = apiPath.replace('/joytel', '');
    targetBase = WAREHOUSE_BASE;
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown route prefix. Use /warehouse/ or /rsp/' }));
    return;
  }

  // Use string concatenation (not new URL) to preserve the base path (e.g. /openapi)
  const targetUrl = new URL(targetBase + apiPath);

  // Collect request body
  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    const bodyBuffer = Buffer.concat(body);

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

    // Forward auth headers
    const forwardHeaders = ['authorization', 'appid', 'appsecret', 'transid', 'timestamp', 'ciphertext'];
    for (const h of forwardHeaders) {
      if (req.headers[h]) {
        options.headers[h] = req.headers[h];
      }
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

// Root info route
  if (req.url === '/' || req.url === '') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'joytel-proxy', routes: ['/warehouse/*', '/rsp/*', '/health'] }));
    return;
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`JoyTel proxy server running on port ${PORT}`);
  console.log(`Warehouse API: ${WAREHOUSE_BASE}`);
  console.log(`RSP+ API: ${RSP_BASE}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});
