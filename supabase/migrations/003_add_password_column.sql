-- Add password column for username/password login (matching reference app behavior)
alter table public.members add column if not exists password text;

-- Allow members to read their own data and admins to read all (update existing policies)
-- The login flow queries members by username, so we need public read access for login
-- RLS already allows members to read their own data; login uses a service-role or anon query
drop policy if exists "anon read for login" on public.members;
create policy "anon read for login" on public.members for select using (true);
