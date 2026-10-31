import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, RefreshCw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember } from "../lib/useData";
import { money, formatDate } from "../lib/helpers";
import { checkRecharge } from "../lib/orders";
import { Button, Card, Badge } from "./ui";

const STATUS_STYLE = {
  delivered: "bg-green-100 text-green-700",
  submitted: "bg-blue-100 text-blue-700",
  submitting: "bg-blue-100 text-blue-700",
  unknown: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

function parse(row) {
  try { return typeof row.setting_value === "string" ? JSON.parse(row.setting_value) : row.setting_value; } catch { return null; }
}

/** Orders still waiting on JoyTel. A recharge can be checked with JoyTel; an eSIM waits for JoyTel's callback. */
const isOpen = d => !d.refunded && ["submitted", "submitting", "unknown"].includes(d.statusText);
const ageMin = d => (Date.now() - new Date(d.created_at || 0).getTime()) / 60000;
/** Needs a human look: unclear result, refund not finished, or waiting for JoyTel for too long. */
const needsAttention = d => d.statusText === "unknown" || (d.statusText === "failed" && !d.refunded) || (isOpen(d) && ageMin(d) > 15);

export default function JoytelOrders() {
  const { data: settings = [], refetch } = useTable("system_settings");
  const { data: members = [] } = useTable("members");
  const { currentMember } = useCurrentMember(members);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(null);
  const tries = useRef({});

  const orders = useMemo(() => settings
    .filter(s => s.setting_key?.startsWith("joytel_callback_"))
    .map(parse)
    .filter(d => d && d.orderTid)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)), [settings]);

  const nameOf = id => { const m = members.find(x => String(x.id) === String(id)); return m ? (m.full_name || m.username) : (id ? "—" : "Admin test"); };

  const counts = {
    all: orders.length,
    attention: orders.filter(needsAttention).length,
    open: orders.filter(isOpen).length,
    recharge: orders.filter(d => d.kind === "recharge").length,
    esim: orders.filter(d => d.kind !== "recharge").length,
  };
  const shown = orders.filter(d =>
    filter === "attention" ? needsAttention(d) :
    filter === "open" ? isOpen(d) :
    filter === "recharge" ? d.kind === "recharge" :
    filter === "esim" ? d.kind !== "recharge" : true);

  async function checkOne(d, quiet) {
    if (!currentMember) return false;
    setBusy(d.orderTid);
    try {
      const r = await checkRecharge(currentMember.id, d.orderTid);
      if (!quiet) {
        if (r.error && !r.statusText) toast.error(r.error);
        else if (r.statusText === "delivered") toast.success("Recharge confirmed by JoyTel");
        else if (r.statusText === "failed") toast.error("JoyTel failed this recharge. The customer was refunded.");
        else toast("Still recharging at JoyTel");
      }
      return !!r.statusText && r.statusText !== d.statusText;
    } finally { setBusy(null); }
  }

  const openRecharges = orders.filter(d => d.kind === "recharge" && isOpen(d) && d.statusText !== "submitting");

  async function checkAll() {
    let changed = false;
    for (const d of openRecharges) changed = (await checkOne(d, true)) || changed;
    if (changed) refetch?.();
    toast(`Checked ${openRecharges.length} recharge(s)`);
  }

  // While this page is open, keep asking JoyTel about open recharges (about 10 minutes per order).
  useEffect(() => {
    if (!currentMember || !openRecharges.length) return;
    const t = setInterval(async () => {
      let changed = false;
      for (const d of openRecharges) {
        tries.current[d.orderTid] = (tries.current[d.orderTid] || 0) + 1;
        if (tries.current[d.orderTid] > 40) continue;
        changed = (await checkOne(d, true)) || changed;
      }
      if (changed) refetch?.();
    }, 15000);
    return () => clearInterval(t);
  }, [orders, currentMember?.id]);

  const FILTERS = [
    ["all", "All"], ["attention", "Needs attention"], ["open", "Waiting for JoyTel"], ["recharge", "SIM recharges"], ["esim", "eSIMs"],
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2"><ClipboardList className="w-7 h-7 text-blue-600" /> JoyTel Orders</h1>
          <p className="text-gray-500 mt-1">Every order the shop sent to JoyTel, and how it ended. No need to ask the customer.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch?.()} className="border-gray-200"><RefreshCw className="w-4 h-4" /> Refresh</Button>
          <Button onClick={checkAll} disabled={!openRecharges.length || !!busy} className="bg-blue-600 hover:bg-blue-700 text-white">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check open recharges ({openRecharges.length})
          </Button>
        </div>
      </motion.div>

      <div className="flex gap-2 flex-wrap mb-4">
        {FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-full text-sm border ${filter === id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
            {label} ({counts[id]})
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        {shown.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No orders here yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 px-3">Time</th><th className="py-2 px-3">Customer</th><th className="py-2 px-3">Product</th>
                <th className="py-2 px-3">SIM / Order</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Result</th><th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(d => (
                <tr key={d.orderTid} className={`border-b border-gray-50 align-top ${needsAttention(d) ? "bg-amber-50" : ""}`}>
                  <td className="py-2 px-3 whitespace-nowrap text-gray-600">{d.created_at ? formatDate(d.created_at) : "—"}</td>
                  <td className="py-2 px-3">{nameOf(d.member_id)}</td>
                  <td className="py-2 px-3"><p className="text-gray-900">{d.productName || d.productCode || "—"}</p><p className="text-xs text-gray-400">{d.kind === "recharge" ? `Recharge · ${d.days || 1} day(s)` : `eSIM · x${d.qty || 1}`}{d.amount ? ` · ${money(d.amount)}` : ""}</p></td>
                  <td className="py-2 px-3 font-mono text-xs text-gray-600 break-all">
                    {d.kind === "recharge" && <p className="text-gray-900">{d.snCode}</p>}
                    <p>{d.orderTid}</p>
                    {(d.rechargeCode || d.orderCode) && <p className="text-gray-400">{d.rechargeCode || d.orderCode}</p>}
                  </td>
                  <td className="py-2 px-3">
                    <Badge className={STATUS_STYLE[d.statusText] || "bg-gray-100 text-gray-700"}>{d.statusText || "—"}</Badge>
                    {d.refunded && <Badge className="bg-purple-100 text-purple-700 ml-1">refunded</Badge>}
                  </td>
                  <td className="py-2 px-3 text-xs">
                    {d.statusText === "delivered" && <span className="text-green-700">{d.kind === "recharge" ? `Recharged${d.expireDate ? `, valid until ${d.expireDate}` : ""}` : "Delivered"}</span>}
                    {d.error && <span className="text-red-600">{d.error}</span>}
                    {isOpen(d) && !d.error && <span className="text-gray-500">{d.kind === "recharge" ? "Waiting for JoyTel" : "Waiting for JoyTel callback"}{ageMin(d) > 15 ? ` (${Math.round(ageMin(d))} min)` : ""}</span>}
                  </td>
                  <td className="py-2 px-3">
                    {d.kind === "recharge" && isOpen(d) && d.statusText !== "submitting" && (
                      <Button size="sm" variant="outline" disabled={busy === d.orderTid} onClick={async () => { if (await checkOne(d)) refetch?.(); }} className="border-gray-200">
                        {busy === d.orderTid ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check now"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-xs text-gray-400 mt-3">Recharges have no JoyTel callback, so this page asks JoyTel every 15 seconds while it is open. eSIM results arrive by callback. Rows in yellow need a look.</p>
    </div>
  );
}
