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
3. Run `supabase/migrations/011_product_sort_order.sql` (adds the `products.sort_order` column — required for the drag-and-drop product layout to sync across devices/deployments instead of per-browser localStorage).
4. Run `supabase/migrations/012_fix_rls_allow_all.sql` (restores anon-key write access for `members`, `system_settings`, `gcash_info`, `gcash_receipts` — without it, role changes, member approve/delete, the Settings tab and the GCash tab all fail; see "RLS and the anon key" below).
3. Deploy Edge Functions: `redeem-maintenance-code` (in repo), plus `member-login` and `register-member` (referenced by the UI but not included in the repo).

## Staff Promotion System
- Admin/SuperAdmin can promote a user to the `staff` role via the Members tab role dropdown.
- The admin panel has a **Staff** tab (admin/super_admin only) with a special **Top Up Staff** button that credits a staff account's wallet upon admin approval.
- Staff members see a **Withdraw from Staff Account** section in the Wallet page; withdrawal requests create pending transactions that the admin approves in the Staff tab or the Orders tab.
- Requires migration `008_staff_role.sql` to be run in Supabase before the `staff` role can be assigned.
- Migration `008` also fixes the `is_admin()` RLS function to recognise `super_admin` (not just `admin`); without this fix, a super_admin cannot update any member's role because the RLS policy `admins manage members` calls `is_admin()` which previously only checked `role='admin'`.

## RLS and the anon key (why admin writes fail with "Cannot coerce the result to a single JSON object")
The client never creates a Supabase Auth session — login is a custom localStorage session (`src/lib/auth.js`) — so every request runs as `anon` and `auth.uid()` is NULL. Any RLS policy keyed on `auth.uid()` / `is_admin()` therefore denies every write, and the table silently updates 0 rows. `updateRecord` (`src/lib/useData.js`) then calls `.single()`, and PostgREST answers `PGRST116 "Cannot coerce the result to a single JSON object"`. `012_fix_rls_allow_all.sql` fixes this; `010_fix_rls_allow_all.sql` did the same for `transactions` and `conversion_requests` earlier.

Probe it from here with the app's own anon key (the policy is table-level, so one no-op probe per table is enough; send the row's current value so nothing changes):
```sh
set -a; . /run/base44/app.env; set +a
# <id> and <current role> come from the row you are probing, e.g.
# curl -s "$VITE_SUPABASE_URL/rest/v1/members?select=id,role&limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY"
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH \
  "$VITE_SUPABASE_URL/rest/v1/members?id=eq.<id>" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -H "Accept: application/vnd.pgrst.object+json" \
  -d '{"role":"<current role>"}'
```
`406` + `"The result contains 0 rows"` = the table's write policy blocks anon; `200` = writes work.

The sandbox cannot apply migrations itself: the DB credentials committed in `scripts/fix-role-constraint.js` / `api/run-migration.js` are stale (`tenant/user ... not found`) and no service-role key is available, so migrations are applied by pasting the file into Supabase → SQL Editor.

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

## Verify
`curl -sf -H "Host: external-preview.example.com" http://localhost:3000/` returns the landing page HTML.
