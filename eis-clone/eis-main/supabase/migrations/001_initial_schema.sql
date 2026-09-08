create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  username text not null unique,
  role text not null default 'member' check (role in ('member','sub_admin','admin')),
  referrer_id uuid references public.members(id) on delete set null,
  placement_id uuid references public.members(id) on delete set null,
  placement_order integer check (placement_order between 1 and 10),
  tree_level integer not null default 0,
  status text not null default 'approved' check (status in ('pending','approved','rejected','deleted')),
  full_name text not null,
  age integer,
  email text,
  phone text,
  address text,
  facebook_name text,
  backup_mobile text,
  referral_code text not null unique,
  direct_downlines_count integer not null default 0,
  level1_count integer not null default 0,
  level2_count integer not null default 0,
  level3_count integer not null default 0,
  total_earnings numeric(14,2) not null default 0,
  available_balance numeric(14,2) not null default 0,
  gcash_number text,
  gcash_name text,
  avatar_url text,
  approved_date timestamptz default now(),
  deleted_date timestamptz,
  is_restricted boolean not null default false,
  maintenance_override text not null default 'auto' check (maintenance_override in ('green','red','auto')),
  maintenance_timer_seconds integer,
  maintenance_timer_set_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  amount numeric(14,2) not null default 0,
  is_used boolean not null default false,
  used_by_member_id uuid references public.members(id) on delete set null,
  used_at timestamptz,
  description text,
  assigned_username text,
  assigned_sub_admin_id uuid references public.members(id) on delete set null,
  redeemed_by_sub_admin_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  type text not null check (type in ('level_bonus','referral_bonus','withdrawal','adjustment')),
  amount numeric(14,2) not null,
  description text,
  status text not null default 'completed' check (status in ('pending','completed','cancelled')),
  from_member_id uuid references public.members(id) on delete set null,
  bonus_level integer check (bonus_level between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.conversion_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  amount numeric(14,2) not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gcash_info (
  id uuid primary key default gen_random_uuid(),
  gcash_number text not null,
  gcash_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gcash_receipts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  member_name text,
  receipt_url text not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.level_bonuses (
  id uuid primary key default gen_random_uuid(),
  level integer not null unique check (level between 1 and 5),
  bonus_amount numeric(14,2) not null,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role text,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

insert into public.level_bonuses(level,bonus_amount) values
(1,150),(2,100),(3,50),(4,20),(5,10)
on conflict(level) do update set bonus_amount=excluded.bonus_amount;

insert into public.system_settings(setting_key,setting_value,description) values
('tab_monitoring_visible','true','Monitoring tab visibility'),
('tab_subadmin_visible','true','Sub-admin tab visibility'),
('tab_terms_visible','true','Terms visibility'),
('tab_complan_visible','true','ComPlan visibility'),
('withdrawal_minimum_amount','300','Minimum withdrawal amount')
on conflict(setting_key) do nothing;

create index if not exists idx_members_referrer on public.members(referrer_id);
create index if not exists idx_members_placement on public.members(placement_id);
create index if not exists idx_members_status on public.members(status);
create index if not exists idx_codes_username on public.maintenance_codes(assigned_username);
create index if not exists idx_codes_used on public.maintenance_codes(is_used);
create index if not exists idx_transactions_member on public.transactions(member_id);
create index if not exists idx_withdrawals_status on public.conversion_requests(status);

alter table public.members enable row level security;
alter table public.maintenance_codes enable row level security;
alter table public.transactions enable row level security;
alter table public.conversion_requests enable row level security;
alter table public.gcash_info enable row level security;
alter table public.gcash_receipts enable row level security;
alter table public.level_bonuses enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.members m where m.auth_user_id=auth.uid() and m.role='admin' and m.status='approved'); $$;

create or replace function public.current_member_id()
returns uuid language sql stable security definer set search_path=public
as $$ select id from public.members where auth_user_id=auth.uid() and status='approved' limit 1; $$;

create policy "members read self or admins" on public.members for select using (auth_user_id=auth.uid() or public.is_admin());
create policy "members update self" on public.members for update using (auth_user_id=auth.uid()) with check (auth_user_id=auth.uid());
create policy "admins manage members" on public.members for all using (public.is_admin()) with check (public.is_admin());

create policy "member sees assigned codes" on public.maintenance_codes for select using (assigned_username=(select username from public.members where auth_user_id=auth.uid()) or assigned_sub_admin_id=public.current_member_id() or public.is_admin());
create policy "admin manages codes" on public.maintenance_codes for all using (public.is_admin()) with check (public.is_admin());

create policy "member reads transactions" on public.transactions for select using (member_id=public.current_member_id() or public.is_admin());
create policy "admin manages transactions" on public.transactions for all using (public.is_admin()) with check (public.is_admin());

create policy "member reads own withdrawals" on public.conversion_requests for select using (member_id=public.current_member_id() or public.is_admin());
create policy "member creates own withdrawal" on public.conversion_requests for insert with check (member_id=public.current_member_id());
create policy "admin manages withdrawals" on public.conversion_requests for all using (public.is_admin()) with check (public.is_admin());

create policy "read active gcash" on public.gcash_info for select using (is_active or public.is_admin());
create policy "admin manages gcash" on public.gcash_info for all using (public.is_admin()) with check (public.is_admin());

create policy "member reads own receipts" on public.gcash_receipts for select using (member_id=public.current_member_id() or public.is_admin());
create policy "member creates receipt" on public.gcash_receipts for insert with check (member_id=public.current_member_id());
create policy "admin manages receipts" on public.gcash_receipts for all using (public.is_admin()) with check (public.is_admin());

create policy "read active bonus config" on public.level_bonuses for select using (is_active or public.is_admin());
create policy "admin manages bonuses" on public.level_bonuses for all using (public.is_admin()) with check (public.is_admin());

create policy "read settings" on public.system_settings for select using (true);
create policy "admin manages settings" on public.system_settings for all using (public.is_admin()) with check (public.is_admin());

create policy "admins read audit" on public.audit_logs for select using (public.is_admin());

create or replace function public.compute_maintenance_status(p_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare m public.members%rowtype; last_used timestamptz; seconds_left bigint;
begin
  select * into m from public.members where id=p_member_id;
  if m.maintenance_override='green' then return jsonb_build_object('isGreen',true,'secondsLeft',null,'neverRedeemed',false); end if;
  if m.maintenance_override='red' then return jsonb_build_object('isGreen',false,'secondsLeft',0,'neverRedeemed',false); end if;
  if m.maintenance_timer_seconds is not null and m.maintenance_timer_set_at is not null then
    seconds_left := greatest(0, m.maintenance_timer_seconds - extract(epoch from (now()-m.maintenance_timer_set_at))::bigint);
    return jsonb_build_object('isGreen',seconds_left>0,'secondsLeft',seconds_left,'neverRedeemed',false);
  end if;
  select max(used_at) into last_used from public.maintenance_codes where used_by_member_id=p_member_id and is_used=true;
  if last_used is not null then
    seconds_left := greatest(0, 2592000 - extract(epoch from (now()-last_used))::bigint);
    return jsonb_build_object('isGreen',seconds_left>0,'secondsLeft',seconds_left,'neverRedeemed',false);
  end if;
  seconds_left := greatest(0, 432000 - extract(epoch from (now()-coalesce(m.approved_date,m.created_at)))::bigint);
  return jsonb_build_object('isGreen',seconds_left>0,'secondsLeft',seconds_left,'neverRedeemed',true);
end $$;