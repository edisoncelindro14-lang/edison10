-- PART 1: Create all tables
create extension if not exists "pgcrypto";

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  full_name text default '',
  referral_code text,
  referrer_id uuid references public.members(id),
  status text default 'pending',
  role text default 'member',
  tree_level int default 0,
  gcash_number text,
  gcash_name text,
  phone text,
  address text,
  email text,
  age int,
  facebook_name text,
  backup_mobile text,
  approved_date timestamptz,
  created_date timestamptz default now(),
  created_at timestamptz default now(),
  direct_downlines_count int default 0,
  maintenance_override text,
  maintenance_timer_seconds int default 0,
  maintenance_timer_set_at timestamptz
);

create table if not exists public.maintenance_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  amount numeric default 0,
  is_used boolean default false,
  description text,
  assigned_username text,
  assigned_sub_admin_id uuid references public.members(id),
  used_by_member_id uuid references public.members(id),
  used_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  type text not null,
  amount numeric default 0,
  description text,
  status text default 'completed',
  bonus_level int,
  from_member_id uuid references public.members(id),
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.conversion_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  amount numeric default 0,
  status text default 'pending',
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.gcash_info (
  id uuid primary key default gen_random_uuid(),
  gcash_number text,
  gcash_name text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text unique,
  setting_value text,
  created_at timestamptz default now()
);

create table if not exists public.gcash_receipts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  member_name text,
  receipt_url text,
  status text default 'pending',
  created_at timestamptz default now()
);
