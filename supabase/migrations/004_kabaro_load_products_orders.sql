-- Kabaro Load — Products & Orders tables
-- Run this in Supabase Dashboard → SQL Editor → New query → Paste → Run

-- ========== PRODUCTS ==========
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
  created_at timestamptz default now()
);

-- ========== ORDERS ==========
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

-- Enable RLS
alter table public.products enable row level security;
alter table public.orders enable row level security;

-- RLS policies
create policy if not exists allow_all_products on public.products for all using (true) with check (true);
create policy if not exists allow_all_orders on public.orders for all using (true) with check (true);

-- Seed default products
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
