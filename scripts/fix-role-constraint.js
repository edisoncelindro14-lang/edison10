import pg from "pg";
const { Client } = pg;

const c = new Client({
  host: "aws-0-ap-southeast-1.pooler.supabase.com",
  port: 5432,
  user: "postgres.mwdqsplebodbcqywcjtq",
  password: "Heyheyhey2026@",
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

(async () => {
  try {
    await c.connect();
    await c.query("ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_role_check");
    await c.query("ALTER TABLE public.members ADD CONSTRAINT members_role_check CHECK (role IN ('member','sub_admin','admin','super_admin','reseller'))");
    const r = await c.query("UPDATE public.members SET role=$1 WHERE id=$2 RETURNING id, username, role", ["super_admin", "9caba983-12b9-4df9-a9da-689f0c5c11ec"]);
    console.log("SUCCESS:", JSON.stringify(r.rows));
    await c.end();
  } catch (e) {
    console.error("ERROR:", e.message, e.code);
  }
})();
