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
2. Run `supabase/migrations/005_roles_and_product_images.sql` through `008_staff_role.sql` (adds the `staff` role to the DB constraint — required for the staff promotion system).
3. Deploy Edge Functions: `redeem-maintenance-code` (in repo), plus `member-login` and `register-member` (referenced by the UI but not included in the repo).

## Staff Promotion System
- Admin/SuperAdmin can promote a user to the `staff` role via the Members tab role dropdown.
- The admin panel has a **Staff** tab (admin/super_admin only) with a special **Top Up Staff** button that credits a staff account's wallet upon admin approval.
- Staff members see a **Withdraw from Staff Account** section in the Wallet page; withdrawal requests create pending transactions that the admin approves in the Staff tab or the Orders tab.
- Requires migration `008_staff_role.sql` to be run in Supabase before the `staff` role can be assigned.
- Migration `008` also fixes the `is_admin()` RLS function to recognise `super_admin` (not just `admin`); without this fix, a super_admin cannot update any member's role because the RLS policy `admins manage members` calls `is_admin()` which previously only checked `role='admin'`.

## Supabase Egress Optimization
The app previously exhausted the Supabase free-tier egress quota (21GB / 5GB = 423%) due to:
1. **Realtime WebSocket subscriptions on every `useTable` call** — every page created persistent subscriptions for every table.
2. **`cache: "no-store"` on the Supabase client** — disabled browser caching, forcing every request to re-download data.
3. **Refetch-on-window-focus** — every tab switch re-fetched all tables.
4. **Multiple components fetching the same table simultaneously** — `members` was fetched by App.jsx, Layout.jsx, PublicShop.jsx, ShopHome.jsx, etc., each making a separate request.

Fixes applied:
- Realtime subscriptions are now opt-in (`realtime: true` option in `useTable`); disabled by default.
- Removed `cache: "no-store"` from supabase.js — browser now caches responses.
- Removed refetch-on-focus.
- `useTable` uses in-flight request deduplication — concurrent calls for the same table share one request.
- Public pages (shop, login, register) no longer fetch `members` or `transactions` — only `products` on the shop page.
- `Layout.jsx` skips fetching when on auth pages (login/register).

## PayMongo
`api/paymongo/create-link.js` creates a Checkout Session with `payment_method_types: ["qrph"]` so the QR shows at once (the Payment Links API always shows a method picker first). The PayMongo webhook needs the `checkout_session.payment.paid` event; `link.payment.paid` still works for older links. Needs `PAYMONGO_SECRET_KEY` (not set in the sandbox).

## Verify
`curl -sf -H "Host: external-preview.example.com" http://localhost:3000/` returns the landing page HTML.
