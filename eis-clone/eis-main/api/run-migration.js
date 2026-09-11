import { Pool } from "pg";

export default async function handler(req, res) {
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  if (!dbPassword) {
    return res.status(500).json({ error: "No DB password configured" });
  }
  const connStr = `postgresql://postgres.mwdqsplebodbcqywcjtq:${encodeURIComponent(dbPassword)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`;
  try {
    const pool = new Pool({ connectionString: connStr });
    const client = await pool.connect();
    await client.query("alter table public.members drop constraint if exists members_role_check;");
    await client.query("alter table public.members add constraint members_role_check check (role in ('member','sub_admin','admin','super_admin','reseller'));");
    client.release();
    await pool.end();
    res.status(200).json({ success: true, message: "Role constraint updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
