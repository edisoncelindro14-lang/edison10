const { Client } = require("pg");

const client = new Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.udjwsubrslleotlhrwek",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const statements = [
  `create extension if not exists "pgcrypto"`,

  `create table if not exists public.members (
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
  )`,

  `create table if not exists public.maintenance_codes (
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
  )`,

  `create table if not exists public.transactions (
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
  )`,

  `create table if not exists public.conversion_requests (
    id uuid primary key default gen_random_uuid(),
    member_id uuid references public.members(id),
    amount numeric default 0,
    status text default 'pending',
    created_date timestamptz default now(),
    created_at timestamptz default now()
  )`,

  `create table if not exists public.gcash_info (
    id uuid primary key default gen_random_uuid(),
    gcash_number text,
    gcash_name text,
    is_active boolean default true,
    created_at timestamptz default now()
  )`,

  `create table if not exists public.system_settings (
    id uuid primary key default gen_random_uuid(),
    setting_key text unique,
    setting_value text,
    created_at timestamptz default now()
  )`,

  `create table if not exists public.gcash_receipts (
    id uuid primary key default gen_random_uuid(),
    member_id uuid references public.members(id),
    member_name text,
    receipt_url text,
    status text default 'pending',
    created_at timestamptz default now()
  )`,

  `alter table public.members enable row level security`,
  `alter table public.maintenance_codes enable row level security`,
  `alter table public.transactions enable row level security`,
  `alter table public.conversion_requests enable row level security`,
  `alter table public.gcash_info enable row level security`,
  `alter table public.system_settings enable row level security`,
  `alter table public.gcash_receipts enable row level security`,

  `create policy "allow_all_members" on public.members for all using (true) with check (true)`,
  `create policy "allow_all_maintenance_codes" on public.maintenance_codes for all using (true) with check (true)`,
  `create policy "allow_all_transactions" on public.transactions for all using (true) with check (true)`,
  `create policy "allow_all_conversion_requests" on public.conversion_requests for all using (true) with check (true)`,
  `create policy "allow_all_gcash_info" on public.gcash_info for all using (true) with check (true)`,
  `create policy "allow_all_system_settings" on public.system_settings for all using (true) with check (true)`,
  `create policy "allow_all_gcash_receipts" on public.gcash_receipts for all using (true) with check (true)`,

  `insert into public.system_settings (setting_key, setting_value) values
    ('withdrawal_minimum_amount', '300'),
    ('tab_monitoring_visible', 'true'),
    ('tab_subadmin_visible', 'true'),
    ('tab_terms_visible', 'true'),
    ('tab_complan_visible', 'true')
  on conflict (setting_key) do nothing`,

  `insert into public.members (username, password, full_name, referral_code, status, role, tree_level)
    values ('admin', 'admin123', 'Administrator', 'ADMIN001', 'approved', 'admin', 0)
  on conflict (username) do nothing`,
];

async function run() {
  try {
    await client.connect();
    console.log("Connected to database!");
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        console.log(`  [${i + 1}/${statements.length}] OK`);
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log(`  [${i + 1}/${statements.length}] SKIPPED (already exists)`);
        } else {
          console.error(`  [${i + 1}/${statements.length}] ERROR: ${e.message}`);
        }
      }
    }
    console.log("\nALL TABLES CREATED SUCCESSFULLY!");
    await client.end();
  } catch (e) {
    console.error("FATAL:", e.message);
    process.exit(1);
  }
}

run();
