# JoyTel Proxy — Independent Deployment Guide

This proxy server forwards JoyTel API calls from your Vercel site to JoyTel's servers. JoyTel requires IP whitelisting, so the proxy must run on a server with a **fixed outbound IP**.

## Why You Need This

Your Vercel site calls JoyTel's API through a proxy (not directly) because JoyTel whitelists specific IPs. Currently the proxy runs on the Base44 sandbox — if Base44 is deleted, the proxy stops and JoyTel API calls break.

Deploying your own proxy makes your site fully independent of Base44.

## Quick Deploy — Render.com (recommended)

Render's Starter plan ($7/month) provides a fixed outbound IP.

1. Go to [render.com](https://render.com) and sign up / log in
2. Click **New → Web Service**
3. Connect your GitHub repo (`kabaroload`)
4. Settings:
   - **Name**: `joytel-proxy`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile.proxy`
   - **Plan**: Starter ($7/month — required for fixed IP)
5. Add environment variable:
   - `PROXY_TOKEN` = `kabaroload-proxy-2024` (or set your own)
6. Click **Create Web Service**
7. Wait for deployment to complete — note the URL (e.g., `https://joytel-proxy-xxxx.onrender.com`)

## Get Your Proxy IP Whitelisted by JoyTel

1. After deploying, find your proxy's outbound IP:
   - Open Render dashboard → your service → Settings → Outbound IP
2. Contact JoyTel support and ask them to whitelist this IP for:
   - Warehouse API: `api.joytelshop.com`
   - RSP+ API: `esim.joytelecom.com`

## Connect Your Vercel Site to the New Proxy

1. Go to [Vercel dashboard](https://vercel.com/dashboard) → your project (`kabaroload`)
2. Settings → Environment Variables
3. Add or update:
   - `JOYTEL_PROXY_URL` = `https://joytel-proxy-xxxx.onrender.com` (your Render URL, no trailing slash)
   - `JOYTEL_PROXY_TOKEN` = `kabaroload-proxy-2024` (must match what you set on Render)
4. Redeploy your Vercel site (Deployments → Redeploy)

## Test the Proxy

```bash
# Health check
curl https://joytel-proxy-xxxx.onrender.com/health
# Should return: {"status":"ok","service":"joytel-proxy"}

# Test Warehouse API (should reach JoyTel)
curl -X POST https://joytel-proxy-xxxx.onrender.com/warehouse/customerOrderQuery \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Token: kabaroload-proxy-2024" \
  -d '{"orderCode":"test"}'
```

## Alternative: Deploy on a VPS

If you prefer a VPS (DigitalOcean, Linode, etc.):

```bash
# On the VPS:
docker run -d --name joytel-proxy \
  -p 8000:8000 \
  -e PROXY_TOKEN=kabaroload-proxy-2024 \
  -e PROXY_PORT=8000 \
  --restart unless-stopped \
  your-registry/joytel-proxy:latest
```

Then set up a reverse proxy (nginx/caddy) with SSL, and point `JOYTEL_PROXY_URL` to it.

## Files

- `proxy/joytel-proxy.cjs` — the proxy server code
- `Dockerfile.proxy` — Docker build file for the proxy
- `render.yaml` — Render.com deployment config
