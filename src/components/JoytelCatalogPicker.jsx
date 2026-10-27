import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Search, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { createRecord } from "../lib/useData";
import { loadJoytelCatalog, searchCatalog, productFromCatalog } from "../lib/joytelCatalog";
import { Button, Input, Label } from "./ui";

/**
 * Browse JoyTel's eSIM catalog.
 *  mode "pick":   click one row, onPick(row) fills code, type and name in the product form.
 *  mode "import": tick rows, type a selling price for each, create them as hidden products.
 */
export default function JoytelCatalogPicker({ mode = "pick", onClose, onPick, onImported }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(mode === "import" ? "philippines" : "");
  const [prices, setPrices] = useState({});          // code -> typed selling price
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadJoytelCatalog().then(setRows).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  const found = useMemo(() => searchCatalog(rows, query), [rows, query]);
  const shown = found.slice(0, 200);
  const chosen = rows.filter(r => selected.has(r.code));
  const priceOf = code => parseFloat(prices[code]);
  const ready = chosen.length > 0 && chosen.every(r => priceOf(r.code) > 0);

  function toggle(code) {
    setSelected(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  }

  async function importSelected() {
    if (!ready) return;
    setBusy(true);
    let ok = 0, failed = 0;
    for (const r of chosen) {
      try {
        await createRecord("products", productFromCatalog(r, priceOf(r.code)));
        ok++;
      } catch (e) { console.error("Import failed", r.code, e); failed++; }
    }
    setBusy(false);
    toast[failed ? "error" : "success"](`${ok} imported (hidden)${failed ? `, ${failed} failed` : ""}. Review the prices, then switch them on.`);
    onImported?.();
    onClose();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{mode === "import" ? "Import JoyTel eSIMs" : "Pick a JoyTel eSIM"}</h2>
            <p className="text-xs text-gray-500">{rows.length.toLocaleString()} eSIM products from JoyTel</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="px-6 py-4 space-y-3 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <Input className="pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or code, e.g. philippines 1GB" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> : (
            <table className="w-full text-sm">
              <tbody>
                {shown.map(r => (
                  <tr key={r.code} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => mode === "import" ? toggle(r.code) : onPick(r)}>
                    {mode === "import" && <td className="py-2 pr-2"><input type="checkbox" readOnly checked={selected.has(r.code)} /></td>}
                    <td className="py-2 pr-3"><p className="font-medium text-gray-900">{r.name}</p><p className="text-xs text-gray-400">{r.code} · until {r.expires || "—"}</p></td>
                    {mode === "import" && (
                      <td className="py-2 text-right w-28" onClick={e => e.stopPropagation()}>
                        {selected.has(r.code) && (
                          <Input type="number" min="0" value={prices[r.code] || ""} placeholder="₱ price"
                            onChange={e => setPrices(prev => ({ ...prev, [r.code]: e.target.value }))} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {found.length > shown.length && <p className="text-xs text-gray-400 py-3">Showing the first 200 of {found.length.toLocaleString()}. Narrow the search.</p>}
          {!loading && found.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">No match.</p>}
        </div>

        {mode === "import" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <div className="flex gap-3 text-sm">
                            <button className="text-gray-500" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
            <Button onClick={importSelected} disabled={busy || !ready || selected.size === 0} className="bg-orange-500 hover:bg-orange-600 text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Import {selected.size} as hidden{selected.size > 0 && !ready ? " (enter every price)" : ""}
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
