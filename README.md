# Mamlakah

GitHub/Vercel/Supabase rebuild of the Mamlakah Network System.

## Stack

- React + Vite
- Supabase PostgreSQL/Auth/Realtime/Storage
- Vercel
- Tailwind-style responsive CSS
- Lucide React

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql`.
3. Run `supabase/migrations/002_redeem_function.sql`.
4. Deploy the `redeem-maintenance-code` Edge Function.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel.
6. Run `npm install`.
7. Run `npm run dev`.
8. Push to GitHub and connect the repository to Vercel.

## Security

Never commit `.env` files or the Supabase service-role key.

The included frontend is a functional foundation. Admin CRUD, complete five-level recursive genealogy UI, withdrawal approval UI, CSV import/export, receipt upload UI, and role-management screens should be completed against the protected database functions before production launch.

## Important

The original Base44 specification described plaintext passwords. This rebuild deliberately does not store plaintext passwords. Use Supabase Auth and server-side Edge Functions for authentication and sensitive operations.
