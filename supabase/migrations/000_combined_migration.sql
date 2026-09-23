-- ============================================================
-- COMBINED MIGRATION — Run this in your NEW Supabase project
-- SQL Editor → New query → Paste this entire file → Run
-- ============================================================
-- This creates ALL tables, RLS policies, functions, and seed data.
-- After running this, import your CSV data (see import order below).
-- ============================================================

-- ============================================================
-- 1. SCHEMA (from 001_initial_schema.sql)
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  username text not null unique,
  password text,
  role text not null default 'member' check (role in ('member','sub_admin','admin','super_admin','reseller','staff')),
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
  type text not null check (type in ('level_bonus','referral_bonus','withdrawal','adjustment','topup','purchase','refund')),
  amount numeric(14,2) not null,
  description text,
  status text not null default 'completed' check (status in ('pending','completed','cancelled')),
  from_member_id uuid references public.members(id) on delete set null,
  bonus_level integer check (bonus_level between 1 and 5),
  remarks text,
  created_at timestamptz not null default now()
);

create table if not exists public.conversion_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  amount numeric(14,2) not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reference_number text,
  processed_by text,
  processed_at timestamptz,
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

-- ============================================================
-- 2. PRODUCTS & ORDERS (from 004_kabaro_load_products_orders.sql)
-- ============================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'load',
  network text,
  price numeric not null default 0,
  load_amount numeric,
  description text,
  image_url text,
  is_active boolean default true,
  best_seller boolean default false,
  discount_percent numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  product_name text not null,
  product_category text,
  quantity int not null default 1,
  total_amount numeric not null default 0,
  mobile_number text,
  status text not null default 'pending',
  payment_method text default 'gcash',
  payment_reference text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. SEED DATA
-- ============================================================

-- Level bonuses
insert into public.level_bonuses(level,bonus_amount) values
(1,150),(2,100),(3,50),(4,20),(5,10)
on conflict(level) do update set bonus_amount=excluded.bonus_amount;

-- System settings
insert into public.system_settings(setting_key,setting_value,description) values
('tab_monitoring_visible','true','Monitoring tab visibility'),
('tab_subadmin_visible','true','Sub-admin tab visibility'),
('tab_terms_visible','true','Terms visibility'),
('tab_complan_visible','true','ComPlan visibility'),
('withdrawal_minimum_amount','300','Minimum withdrawal amount')
on conflict(setting_key) do nothing;

-- Default admin account (username/password login)
insert into public.members (username, password, full_name, referral_code, status, role, tree_level)
values ('admin', 'admin123', 'Administrator', 'ADMIN001', 'approved', 'super_admin', 0)
on conflict (username) do nothing;

-- Default products
insert into public.products (name, category, network, price, load_amount, description) values
  ('Globe Load ₱50', 'load', 'Globe', 52, 50, '₱50 regular load for Globe'),
  ('Globe Load ₱100', 'load', 'Globe', 102, 100, '₱100 regular load for Globe'),
  ('Globe Load ₱300', 'load', 'Globe', 302, 300, '₱300 regular load for Globe'),
  ('Globe Load ₱500', 'load', 'Globe', 502, 500, '₱500 regular load for Globe'),
  ('Smart Load ₱50', 'load', 'Smart', 52, 50, '₱50 regular load for Smart'),
  ('Smart Load ₱100', 'load', 'Smart', 102, 100, '₱100 regular load for Smart'),
  ('Smart Load ₱300', 'load', 'Smart', 302, 300, '₱300 regular load for Smart'),
  ('Smart Load ₱500', 'load', 'Smart', 502, 500, '₱500 regular load for Smart'),
  ('TM Load ₱50', 'load', 'TM', 52, 50, '₱50 regular load for TM'),
  ('TM Load ₱100', 'load', 'TM', 102, 100, '₱100 regular load for TM'),
  ('TM Load ₱300', 'load', 'TM', 302, 300, '₱300 regular load for TM'),
  ('TNT Load ₱50', 'load', 'TNT', 52, 50, '₱50 regular load for TNT'),
  ('TNT Load ₱100', 'load', 'TNT', 102, 100, '₱100 regular load for TNT'),
  ('TNT Load ₱300', 'load', 'TNT', 302, 300, '₱300 regular load for TNT'),
  ('Sun Load ₱50', 'load', 'Sun', 52, 50, '₱50 regular load for Sun'),
  ('Sun Load ₱100', 'load', 'Sun', 102, 100, '₱100 regular load for Sun'),
  ('DITO Load ₱50', 'load', 'DITO', 52, 50, '₱50 regular load for DITO'),
  ('DITO Load ₱100', 'load', 'DITO', 102, 100, '₱100 regular load for DITO'),
  ('Globe SIM Card', 'sim', 'Globe', 40, null, 'Brand new Globe SIM card'),
  ('Smart SIM Card', 'sim', 'Smart', 40, null, 'Brand new Smart SIM card'),
  ('TM SIM Card', 'sim', 'TM', 40, null, 'Brand new TM SIM card'),
  ('TNT SIM Card', 'sim', 'TNT', 40, null, 'Brand new TNT SIM card'),
  ('Sun SIM Card', 'sim', 'Sun', 40, null, 'Brand new Sun SIM card'),
  ('DITO SIM Card', 'sim', 'DITO', 50, null, 'Brand new DITO SIM card')
on conflict do nothing;

-- ============================================================
-- 4. INDEXES
-- ============================================================

create index if not exists idx_members_referrer on public.members(referrer_id);
create index if not exists idx_members_placement on public.members(placement_id);
create index if not exists idx_members_status on public.members(status);
create index if not exists idx_codes_username on public.maintenance_codes(assigned_username);
create index if not exists idx_codes_used on public.maintenance_codes(is_used);
create index if not exists idx_transactions_member on public.transactions(member_id);
create index if not exists idx_withdrawals_status on public.conversion_requests(status);

-- ============================================================
-- 5. RLS — ENABLE ON ALL TABLES
-- ============================================================

alter table public.members enable row level security;
alter table public.maintenance_codes enable row level security;
alter table public.transactions enable row level security;
alter table public.conversion_requests enable row level security;
alter table public.gcash_info enable row level security;
alter table public.gcash_receipts enable row level security;
alter table public.level_bonuses enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

-- ============================================================
-- 6. FUNCTIONS
-- ============================================================

-- is_admin() — recognises both admin and super_admin
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.members m
    where m.auth_user_id = auth.uid()
      and m.role in ('admin','super_admin')
      and m.status = 'approved'
  );
$$;

create or replace function public.current_member_id()
returns uuid language sql stable security definer set search_path=public
as $$ select id from public.members where auth_user_id=auth.uid() and status='approved' limit 1; $$;

-- compute_maintenance_status()
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

-- redeem_maintenance_code()
create or replace function public.redeem_maintenance_code(p_code text,p_member_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare c public.maintenance_codes%rowtype; m public.members%rowtype; u public.members%rowtype; lvl integer; bonus numeric;
begin
  select * into m from public.members where id=p_member_id and status='approved' for update;
  if not found then raise exception 'Member not found'; end if;

  select * into c from public.maintenance_codes where code=p_code for update;
  if not found then raise exception 'Maintenance code not found'; end if;
  if c.is_used then raise exception 'Maintenance code has already been used'; end if;
  if c.assigned_username is not null and c.assigned_username <> m.username then raise exception 'This code is locked to another username'; end if;
  if c.assigned_sub_admin_id is not null and c.assigned_sub_admin_id <> p_member_id and m.role <> 'admin' then raise exception 'Code is assigned to another sub-admin'; end if;

  update public.maintenance_codes
  set is_used=true,used_by_member_id=p_member_id,used_at=now()
  where id=c.id;

  update public.members
  set maintenance_timer_seconds=null,maintenance_timer_set_at=null,updated_at=now()
  where id=p_member_id;

  for lvl in 1..5 loop
    if lvl=1 then
      select * into u from public.members where id=m.referrer_id and status='approved';
    else
      select * into u from public.members where id=(select placement_id from public.members where id=u.id) and status='approved';
    end if;
    exit when not found;
    if u.id=p_member_id then continue; end if;
    if (public.compute_maintenance_status(u.id)->>'isGreen')::boolean then
      select bonus_amount into bonus from public.level_bonuses where level=lvl and is_active=true;
      if bonus is not null then
        insert into public.transactions(member_id,type,amount,description,status,from_member_id,bonus_level)
        values(u.id,'level_bonus',bonus,'Level '||lvl||' bonus from maintenance redemption','completed',p_member_id,lvl);
        update public.members set total_earnings=total_earnings+bonus,available_balance=available_balance+bonus,updated_at=now() where id=u.id;
      end if;
    end if;
  end loop;

  return jsonb_build_object('success',true,'code',c.code,'member_id',p_member_id);
end $$;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- Members
create policy "members read self or admins" on public.members for select using (auth_user_id=auth.uid() or public.is_admin());
create policy "members update self" on public.members for update using (auth_user_id=auth.uid()) with check (auth_user_id=auth.uid());
create policy "admins manage members" on public.members for all using (public.is_admin()) with check (public.is_admin());
create policy "anon read for login" on public.members for select using (true);

-- Maintenance codes
create policy "member sees assigned codes" on public.maintenance_codes for select using (assigned_username=(select username from public.members where auth_user_id=auth.uid()) or assigned_sub_admin_id=public.current_member_id() or public.is_admin());
create policy "admin manages codes" on public.maintenance_codes for all using (public.is_admin()) with check (public.is_admin());

-- Transactions
create policy "member reads transactions" on public.transactions for select using (member_id=public.current_member_id() or public.is_admin());
create policy "admin manages transactions" on public.transactions for all using (public.is_admin()) with check (public.is_admin());

-- Conversion requests
create policy "member reads own withdrawals" on public.conversion_requests for select using (member_id=public.current_member_id() or public.is_admin());
create policy "member creates own withdrawal" on public.conversion_requests for insert with check (member_id=public.current_member_id());
create policy "admin manages withdrawals" on public.conversion_requests for all using (public.is_admin()) with check (public.is_admin());

-- GCash info
create policy "read active gcash" on public.gcash_info for select using (is_active or public.is_admin());
create policy "admin manages gcash" on public.gcash_info for all using (public.is_admin()) with check (public.is_admin());

-- GCash receipts
create policy "member reads own receipts" on public.gcash_receipts for select using (member_id=public.current_member_id() or public.is_admin());
create policy "member creates receipt" on public.gcash_receipts for insert with check (member_id=public.current_member_id());
create policy "admin manages receipts" on public.gcash_receipts for all using (public.is_admin()) with check (public.is_admin());

-- Level bonuses
create policy "read active bonus config" on public.level_bonuses for select using (is_active or public.is_admin());
create policy "admin manages bonuses" on public.level_bonuses for all using (public.is_admin()) with check (public.is_admin());

-- System settings
create policy "read settings" on public.system_settings for select using (true);
create policy "admin manages settings" on public.system_settings for all using (public.is_admin()) with check (public.is_admin());

-- Audit logs
create policy "admins read audit" on public.audit_logs for select using (public.is_admin());

-- Products & Orders (public read for shop, admin manages)
create policy "allow_all_products" on public.products for all using (true) with check (true);
create policy "allow_all_orders" on public.orders for all using (true) with check (true);

-- ============================================================
-- DONE! Now import your CSV data in this order:
-- 1. members (import CSV, or skip if using the default admin)
-- 2. products (import CSV, or skip if using the default seed products)
-- 3. orders
-- 4. transactions
-- 5. system_settings
-- 6. maintenance_codes
-- 7. conversion_requests
-- 8. gcash_info
-- 9. gcash_receipts
-- 10. level_bonuses
-- ============================================================
