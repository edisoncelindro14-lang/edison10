// JoyTel eSIM catalog: product codes and names only (no wholesale prices, the file is public).
// Selling prices are typed by the admin. Loaded only when an admin opens the picker.
let cache = null;

export async function loadJoytelCatalog() {
  if (cache) return cache;
  const res = await fetch('/joytel-esim-catalog.json');
  if (!res.ok) throw new Error('Could not load the JoyTel catalog');
  const j = await res.json();
  cache = j.rows.map(([code, name, expires]) => ({ code, name, expires }));
  return cache;
}

/** Case-insensitive search over code and name. Every word must match. */
export function searchCatalog(rows, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter(r => {
    const hay = `${r.code} ${r.name}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

/** Product record for a catalog row. Imported products start hidden so prices can be reviewed. */
export function productFromCatalog(row, price, { active = false } = {}) {
  return {
    name: row.name.replace(/^eSIM\s*-\s*/i, '').trim() || row.name,
    price,
    description: `${row.name}. Delivered by email as an eSIM QR code.`,
    category: 'esim',
    network: 'JoyTel',
    is_active: active,
    best_seller: false,
    discount_percent: 0,
    joytel_enabled: true,
    joytel_product_code: row.code,
    joytel_type: 3,
    joytel_warehouse: null,
  };
}
