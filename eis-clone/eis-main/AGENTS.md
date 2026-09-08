# Base44 Dev Environment — Mamlakah

## Stack
React 18 + Vite 6 frontend. Backend is an external Supabase project (Postgres + Auth + Edge Functions). No backend runs in compose.

## Run
`docker compose -f docker-compose.base44.yml up -d` — Vite dev server on host port 3000 (container 5173), bind-mounted from source with live reload. `npm install` runs at container start.

## Secrets (required)
The app crashes on load without valid Supabase credentials because `src/lib/supabase.js` calls `createClient(...)` at import time.
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

Placeholder values in `.env.base44-defaults` let the landing page render before real credentials arrive; real values from `/run/base44/app.env` override them. Vite picks up `VITE_*`-prefixed process env vars into `import.meta.env`.

## Supabase backend setup (user does this in their own Supabase project)
1. Run `supabase/migrations/001_initial_schema.sql` then `002_redeem_function.sql`.
2. Deploy Edge Functions: `redeem-maintenance-code` (in repo), plus `member-login` and `register-member` (referenced by the UI but not included in the repo).

## Verify
`curl -sf -H "Host: external-preview.example.com" http://localhost:3000/` returns the landing page HTML.
