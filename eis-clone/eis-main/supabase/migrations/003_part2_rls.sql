-- PART 2: Enable RLS and create policies
alter table public.members enable row level security;
alter table public.maintenance_codes enable row level security;
alter table public.transactions enable row level security;
alter table public.conversion_requests enable row level security;
alter table public.gcash_info enable row level security;
alter table public.system_settings enable row level security;
alter table public.gcash_receipts enable row level security;

create policy "allow_all_members" on public.members for all using (true) with check (true);
create policy "allow_all_maintenance_codes" on public.maintenance_codes for all using (true) with check (true);
create policy "allow_all_transactions" on public.transactions for all using (true) with check (true);
create policy "allow_all_conversion_requests" on public.conversion_requests for all using (true) with check (true);
create policy "allow_all_gcash_info" on public.gcash_info for all using (true) with check (true);
create policy "allow_all_system_settings" on public.system_settings for all using (true) with check (true);
create policy "allow_all_gcash_receipts" on public.gcash_receipts for all using (true) with check (true);
