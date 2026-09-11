/**
 * JoyTel Static IP Proxy — Cloudflare Worker
 * 
 * Deploy this to Cloudflare Workers for a production static IP solution.
 * Cloudflare's outbound IPs are well-known and many services whitelist them.
 * 
 * HOW TO DEPLOY:
 * 1. Go to https://dash.cloudflare.com → Workers & Pages
 * 2. Click "Create Application" → "Create Worker"
 * 3. Name it "joytel-proxy"
 * 4. Paste this code into the editor
 * 5. Click "Deploy"
 * 6. Copy the Worker URL (e.g., https://joytel-proxy.your-account.workers.dev)
 * 7. Give JoyTel the Cloudflare IP ranges (https://www.cloudflare.com/ips/)
 * 8. Set JOYTEL_API_BASE and PROXY_TOKEN as Worker environment variables
 * 
 * USAGE FROM YOUR VERCEL APP:
 *   fetch('https://joytel-proxy.your-account.workers.dev/joytel/api/v1/orders', {
 *     headers: {
 *       'X-Proxy-Token': 'kabaroload-proxy-2024',
 *       'Authorization': 'Bearer YOUR_JOYTEL_API_KEY',
 *     }
 *   })
 */

const JOYTEL_API_BASE = 'https://api.joytel.com'; // ← Replace with JoyTel's actual API base URL
const PROXY_TOKEN = 'kabaroload-proxy-2024';      // ← Replace with your secret token

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Token',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'joytel-proxy', provider: 'cloudflare' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Verify proxy token
    const proxyToken = request.headers.get('X-Proxy-Token');
    if (proxyToken !== PROXY_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Build target URL — strip /joytel prefix
    let apiPath = url.pathname;
    if (apiPath.startsWith('/joytel')) {
      apiPath = apiPath.replace('/joytel', '');
    }
    const targetUrl = JOYTEL_API_BASE + apiPath + (url.search || '');

    // Forward the request
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.delete('X-Proxy-Token');
    proxyHeaders.delete('Host');
    proxyHeaders.set('Host', new URL(JOYTEL_API_BASE).hostname);

    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    // Return response with CORS headers
    const responseHeaders = new Headers(proxyResponse.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v));

    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      headers: responseHeaders,
    });
  },
};
