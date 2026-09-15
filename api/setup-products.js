import { createClient } from "@supabase/supabase-js";

// One-time setup: creates products table + storage bucket
// Call: POST /api/setup-products with body { serviceRoleKey: "..." }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = "https://mwdqsplebodbcqywcjtq.supabase.co";
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  const serviceRoleKey = body?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return res.status(400).json({ error: "serviceRoleKey is required in request body" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const results = { table: null, seed: null, bucket: null, errors: [] };

  try {
    // Check if products table exists
    const { data: existing, error: checkErr } = await supabase.from("products").select("id").limit(1);

    if (checkErr && checkErr.message.includes("Could not find the table")) {
      results.errors.push("Table does not exist — cannot create via PostgREST. Need to run SQL manually.");
      results.table = "missing";
    } else if (checkErr) {
      results.errors.push("Check: " + checkErr.message);
      results.table = "error";
    } else {
      results.table = "exists";
    }

    // If table exists, seed products
    if (results.table === "exists") {
      const { count } = await supabase.from("products").select("id", { count: "exact", head: true });
      if (!count || count === 0) {
        const defaultProducts = [
          { name: "Globe Load 50", category: "load", network: "Globe", price: 52, load_amount: 50, description: "50 regular load for Globe", is_active: true },
          { name: "Globe Load 100", category: "load", network: "Globe", price: 102, load_amount: 100, description: "100 regular load for Globe", is_active: true },
          { name: "Globe Load 300", category: "load", network: "Globe", price: 302, load_amount: 300, description: "300 regular load for Globe", is_active: true },
          { name: "Globe Load 500", category: "load", network: "Globe", price: 502, load_amount: 500, description: "500 regular load for Globe", is_active: true },
          { name: "Smart Load 50", category: "load", network: "Smart", price: 52, load_amount: 50, description: "50 regular load for Smart", is_active: true },
          { name: "Smart Load 100", category: "load", network: "Smart", price: 102, load_amount: 100, description: "100 regular load for Smart", is_active: true },
          { name: "Smart Load 300", category: "load", network: "Smart", price: 302, load_amount: 300, description: "300 regular load for Smart", is_active: true },
          { name: "Smart Load 500", category: "load", network: "Smart", price: 502, load_amount: 500, description: "500 regular load for Smart", is_active: true },
          { name: "TM Load 50", category: "load", network: "TM", price: 52, load_amount: 50, description: "50 regular load for TM", is_active: true },
          { name: "TM Load 100", category: "load", network: "TM", price: 102, load_amount: 100, description: "100 regular load for TM", is_active: true },
          { name: "TM Load 300", category: "load", network: "TM", price: 302, load_amount: 300, description: "300 regular load for TM", is_active: true },
          { name: "TNT Load 50", category: "load", network: "TNT", price: 52, load_amount: 50, description: "50 regular load for TNT", is_active: true },
          { name: "TNT Load 100", category: "load", network: "TNT", price: 102, load_amount: 100, description: "100 regular load for TNT", is_active: true },
          { name: "TNT Load 300", category: "load", network: "TNT", price: 302, load_amount: 300, description: "300 regular load for TNT", is_active: true },
          { name: "Sun Load 50", category: "load", network: "Sun", price: 52, load_amount: 50, description: "50 regular load for Sun", is_active: true },
          { name: "Sun Load 100", category: "load", network: "Sun", price: 102, load_amount: 100, description: "100 regular load for Sun", is_active: true },
          { name: "DITO Load 50", category: "load", network: "DITO", price: 52, load_amount: 50, description: "50 regular load for DITO", is_active: true },
          { name: "DITO Load 100", category: "load", network: "DITO", price: 102, load_amount: 100, description: "100 regular load for DITO", is_active: true },
          { name: "Globe SIM Card", category: "sim", network: "Globe", price: 40, description: "Brand new Globe SIM card", is_active: true },
          { name: "Smart SIM Card", category: "sim", network: "Smart", price: 40, description: "Brand new Smart SIM card", is_active: true },
          { name: "TM SIM Card", category: "sim", network: "TM", price: 40, description: "Brand new TM SIM card", is_active: true },
          { name: "TNT SIM Card", category: "sim", network: "TNT", price: 40, description: "Brand new TNT SIM card", is_active: true },
          { name: "Sun SIM Card", category: "sim", network: "Sun", price: 40, description: "Brand new Sun SIM card", is_active: true },
          { name: "DITO SIM Card", category: "sim", network: "DITO", price: 50, description: "Brand new DITO SIM card", is_active: true },
        ];
        const { error: insertErr } = await supabase.from("products").insert(defaultProducts);
        if (insertErr) {
          results.errors.push("Seed: " + insertErr.message);
        } else {
          results.seed = "inserted " + defaultProducts.length + " products";
        }
      } else {
        results.seed = "already has " + count + " products";
      }
    }

    // Create storage bucket
    const { error: bucketErr } = await supabase.storage.createBucket("products", { public: true, fileSizeLimit: 5242880 });
    if (bucketErr && !bucketErr.message.includes("already exists")) {
      results.errors.push("Bucket: " + bucketErr.message);
    } else {
      results.bucket = "ok";
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    results.errors.push("Fatal: " + err.message);
    return res.status(500).json({ success: false, results });
  }
}
