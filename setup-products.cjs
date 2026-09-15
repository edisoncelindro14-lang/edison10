const { Client } = require("pg");

const password = "Heyheyhey2026@";
const ref = "mwdqsplebodbcqywcjtq";
const host = "aws-0-ap-southeast-1.pooler.supabase.com";

const createSQL = `
  CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category text NOT NULL DEFAULT 'load',
    network text,
    price numeric NOT NULL DEFAULT 0,
    load_amount numeric,
    description text,
    image_url text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
  );
  ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS allow_all_products ON public.products;
  CREATE POLICY allow_all_products ON public.products FOR ALL USING (true) WITH CHECK (true);
`;

const products = [
  ['Globe Load 50','load','Globe',52,50,'50 regular load for Globe'],
  ['Globe Load 100','load','Globe',102,100,'100 regular load for Globe'],
  ['Globe Load 300','load','Globe',302,300,'300 regular load for Globe'],
  ['Globe Load 500','load','Globe',502,500,'500 regular load for Globe'],
  ['Smart Load 50','load','Smart',52,50,'50 regular load for Smart'],
  ['Smart Load 100','load','Smart',102,100,'100 regular load for Smart'],
  ['Smart Load 300','load','Smart',302,300,'300 regular load for Smart'],
  ['Smart Load 500','load','Smart',502,500,'500 regular load for Smart'],
  ['TM Load 50','load','TM',52,50,'50 regular load for TM'],
  ['TM Load 100','load','TM',102,100,'100 regular load for TM'],
  ['TM Load 300','load','TM',302,300,'300 regular load for TM'],
  ['TNT Load 50','load','TNT',52,50,'50 regular load for TNT'],
  ['TNT Load 100','load','TNT',102,100,'100 regular load for TNT'],
  ['TNT Load 300','load','TNT',302,300,'300 regular load for TNT'],
  ['Sun Load 50','load','Sun',52,50,'50 regular load for Sun'],
  ['Sun Load 100','load','Sun',102,100,'100 regular load for Sun'],
  ['DITO Load 50','load','DITO',52,50,'50 regular load for DITO'],
  ['DITO Load 100','load','DITO',102,100,'100 regular load for DITO'],
  ['Globe SIM Card','sim','Globe',40,null,'Brand new Globe SIM card'],
  ['Smart SIM Card','sim','Smart',40,null,'Brand new Smart SIM card'],
  ['TM SIM Card','sim','TM',40,null,'Brand new TM SIM card'],
  ['TNT SIM Card','sim','TNT',40,null,'Brand new TNT SIM card'],
  ['Sun SIM Card','sim','Sun',40,null,'Brand new Sun SIM card'],
  ['DITO SIM Card','sim','DITO',50,null,'Brand new DITO SIM card'],
];

async function tryConn(user, port) {
  const connStr = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
  console.log("Trying:", user, "on port", port);
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    console.log("Connected!");
    await client.query(createSQL);
    console.log("Table created!");
    const { rows } = await client.query("SELECT count(*)::int as cnt FROM public.products");
    if (rows[0].cnt === 0) {
      for (const [name, cat, net, price, load, desc] of products) {
        await client.query(
          "INSERT INTO public.products (name,category,network,price,load_amount,description,is_active) VALUES ($1,$2,$3,$4,$5,$6,true)",
          [name, cat, net, price, load, desc]
        );
      }
      console.log("Seeded " + products.length + " products");
    } else {
      console.log("Already has " + rows[0].cnt + " products");
    }
    await client.end();
    return true;
  } catch (e) {
    console.log("Failed:", e.message);
    try { await client.end(); } catch (_) {}
    return false;
  }
}

async function run() {
  // Try different user/port combinations
  const combos = [
    ["postgres." + ref, 5432],
    ["postgres." + ref, 6543],
    ["postgres", 5432],
    ["postgres", 6543],
  ];
  for (const [user, port] of combos) {
    if (await tryConn(user, port)) return;
  }
  console.error("All connection attempts failed");
}

run();
