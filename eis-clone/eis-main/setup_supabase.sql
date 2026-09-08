create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  username text not null unique,
  role text not null default 'member' check (role in ('member','sub_admin','admin','super_admin','reseller')),
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
end $$;create or replace function public.redeem_maintenance_code(p_code text,p_member_id uuid)
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
end $$;-- Add password column for username/password login (matching reference app behavior)
alter table public.members add column if not exists password text;

-- Allow members to read their own data and admins to read all (update existing policies)
-- The login flow queries members by username, so we need public read access for login
-- RLS already allows members to read their own data; login uses a service-role or anon query
drop policy if exists "anon read for login" on public.members;
create policy "anon read for login" on public.members for select using (true);
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
-- PART 3: Insert default data and admin account
insert into public.system_settings (setting_key, setting_value) values
  ('withdrawal_minimum_amount', '300'),
  ('tab_monitoring_visible', 'true'),
  ('tab_subadmin_visible', 'true'),
  ('tab_terms_visible', 'true'),
  ('tab_complan_visible', 'true')
on conflict (setting_key) do nothing;

insert into public.members (username, password, full_name, referral_code, status, role, tree_level)
values ('admin', 'admin123', 'Administrator', 'ADMIN001', 'approved', 'super_admin', 0)
on conflict (username) do nothing;

-- Ensure products table has image_url column
alter table public.products add column if not exists image_url text;
