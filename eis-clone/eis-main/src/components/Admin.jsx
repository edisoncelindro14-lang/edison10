import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, ShoppingBag, Wallet, Smartphone, Settings, Check, X, Plus,
  Search, Download, Copy, Trash2, RotateCcw, UserCog, Upload, Crown, Store, Zap, Camera, Maximize2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTable, updateRecord, createRecord, deleteRecord } from "../lib/useData";
import { supabase } from "../lib/supabase";
import { getSessionMemberId } from "../lib/auth";
import { money, formatDate, TRANSACTION_TYPES, FALLBACK_PRODUCTS, NETWORK_COLORS, NETWORKS, formatOrderNumber } from "../lib/helpers";
import { Button, Input, Label, Badge } from "./ui";

export default function Admin({ panelRole } = {}) {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || (panelRole === "reseller" ? "members" : "orders");
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [editMember, setEditMember] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: "", category: "load", network: "Globe", price: "", description: "" });
  const [productImage, setProductImage] = useState(null);
  const [gcash, setGcash] = useState({ gcash_number: "", gcash_name: "" });
  const [lightboxImage, setLightboxImage] = useState(null);

  const { data: members = [] } = useTable("members");
  const memberId = getSessionMemberId();
  const currentMember = memberId ? members.find(m => m.id === memberId) : null;
  const currentUserRole = panelRole || currentMember?.role;
  const isSuperAdmin = currentUserRole === "super_admin";
  const isAdminRole = currentUserRole === "admin";
  const isReseller = currentUserRole === "reseller";
  const canManageProducts = ["super_admin", "admin", "reseller"].includes(currentUserRole);
  const { data: transactions = [], addLocalRecord: addLocalTx, updateLocalRecord: updateLocalTx } = useTable("transactions");
  const { data: topupReqs = [], updateLocalRecord: updateLocalTopup } = useTable("conversion_requests");
  const { data: products = [] } = useTable("products");
  const { data: gcashInfo = [] } = useTable("gcash_info");
  const { data: allSettings = [] } = useTable("system_settings");
  const joytelScreenshots = allSettings.filter(s => s.setting_key?.startsWith("joytel_screenshot_"));

  const activeMembers = members.filter(m => m.status !== "deleted" && m.username !== "dok");
  const pendingMembers = activeMembers.filter(m => m.status === "pending");
  const approvedMembers = activeMembers.filter(m => m.status === "approved");

  const allProducts = products.length > 0 ? products : FALLBACK_PRODUCTS;
  const purchaseOrders = transactions.filter(t => t.type === "withdrawal" || t.type === "purchase").sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const pendingTopups = topupReqs.filter(r => r.status === "pending").sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const filteredMembers = activeMembers.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q);
  });

  const showOrders = isSuperAdmin || isAdminRole;
  const showTopups = isSuperAdmin || isAdminRole || isReseller;
  const showMembers = isSuperAdmin || isAdminRole || isReseller;
  const showGcash = isSuperAdmin || isAdminRole;

  const tabs = [
    ...(showOrders ? [{ id: "orders", label: `Orders${purchaseOrders.filter(o => o.status === "pending").length > 0 ? ` (${purchaseOrders.filter(o => o.status === "pending").length})` : ""}`, icon: ShoppingBag }] : []),
    ...(showTopups ? [{ id: "topups", label: `Top-ups${pendingTopups.length > 0 ? ` (${pendingTopups.length})` : ""}`, icon: Wallet }] : []),
    ...(showMembers ? [{ id: "members", label: `Members (${activeMembers.length})`, icon: Users }] : []),
    { id: "products", label: "Products", icon: Store },
    ...(showGcash ? [{ id: "gcash", label: "GCash", icon: Smartphone }] : []),
    { id: "joytel_screenshots", label: `JoyTel Screenshots${joytelScreenshots.length > 0 ? ` (${joytelScreenshots.length})` : ""}`, icon: Camera },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  async function approveOrder(id) {
    try { await updateRecord("transactions", id, { status: "completed" }); updateLocalTx(id, { status: "completed" }); toast.success("Order approved"); }
    catch { toast.error("Failed to approve"); }
  }
  async function rejectOrder(id) {
    try { await updateRecord("transactions", id, { status: "cancelled" }); updateLocalTx(id, { status: "cancelled" }); toast.success("Order cancelled"); }
    catch { toast.error("Failed to cancel"); }
  }

  function generateRefNumber() {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TU-${dateStr}-${rand}`;
  }

  async function approveTopup(id) {
    try {
      const req = topupReqs.find(r => r.id === id);
      if (!req) { toast.error("Top-up request not found"); return; }
      const refNum = generateRefNumber();
      const processedBy = currentMember?.username || "unknown";
      const adminNote = JSON.stringify({ reference_number: refNum, processed_by: processedBy, processed_at: new Date().toISOString() });
      await updateRecord("conversion_requests", id, { status: "approved", admin_note: adminNote });
      const newTx = await createRecord("transactions", { member_id: req.member_id, type: "adjustment", amount: req.amount, description: `Wallet top-up approved | Ref: ${refNum} | By: @${processedBy}`, status: "completed" });
      updateLocalTopup(id, { status: "approved", admin_note: adminNote });
      addLocalTx(newTx);
      toast.success(`Top-up approved & wallet credited | Ref: ${refNum}`);
    } catch (err) {
      console.error("Approve top-up error:", err);
      toast.error("Failed to approve top-up: " + (err?.message || "Unknown error"));
    }
  }
  async function rejectTopup(id) {
    try {
      const processedBy = currentMember?.username || "unknown";
      const adminNote = JSON.stringify({ processed_by: processedBy, processed_at: new Date().toISOString() });
      await updateRecord("conversion_requests", id, { status: "rejected", admin_note: adminNote });
      updateLocalTopup(id, { status: "rejected", admin_note: adminNote });
      toast.success("Top-up rejected");
    } catch (err) {
      console.error("Reject top-up error:", err);
      toast.error("Failed to reject: " + (err?.message || "Unknown error"));
    }
  }

  function parseAdminNote(note) {
    try { return note ? JSON.parse(note) : {}; } catch { return {}; }
  }

  async function approveMember(id) {
    try { await updateRecord("members", id, { status: "approved", approved_date: new Date().toISOString() }); toast.success("Member approved"); window.location.reload(); }
    catch { toast.error("Failed to approve"); }
  }
  async function deleteMember(id) {
    if (!confirm("Delete this account?")) return;
    try { await updateRecord("members", id, { status: "deleted", deleted_date: new Date().toISOString() }); toast.success("Account deleted"); window.location.reload(); }
    catch { toast.error("Failed to delete"); }
  }

  async function promoteToAdmin(id) {
    if (!confirm("Promote this user to Admin?")) return;
    try { await updateRecord("members", id, { role: "admin" }); toast.success("User promoted to Admin"); window.location.reload(); }
    catch { toast.error("Failed to promote user"); }
  }

  async function promoteToReseller(id) {
    if (!confirm("Promote this user to Reseller?")) return;
    try { await updateRecord("members", id, { role: "reseller" }); toast.success("User promoted to Reseller"); window.location.reload(); }
    catch { toast.error("Failed to promote user"); }
  }

  async function demoteToMember(id) {
    if (!confirm("Demote this user back to Member?")) return;
    try { await updateRecord("members", id, { role: "member" }); toast.success("User demoted to Member"); window.location.reload(); }
    catch { toast.error("Failed to demote user"); }
  }

  async function changeRole(id, role) {
    const labels = { super_admin: "SuperAdmin", admin: "Admin", reseller: "Reseller", member: "User" };
    try { await updateRecord("members", id, { role }); toast.success(`Role set to ${labels[role]}`); window.location.reload(); }
    catch { toast.error("Failed to update role"); }
  }

  async function uploadProductImage(file) {
    if (!file) return null;
    const fileName = `product_${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("products").upload(fileName, file);
    if (error) {
      // Fallback: use a data URL for preview if storage fails
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }
    const { data: url } = supabase.storage.from("products").getPublicUrl(fileName);
    return url?.publicUrl || null;
  }

  async function saveGcash() {
    if (!gcash.gcash_number.trim() || !gcash.gcash_name.trim()) { toast.error("Please fill in both fields"); return; }
    try {
      for (const g of gcashInfo) await updateRecord("gcash_info", g.id, { is_active: false });
      await createRecord("gcash_info", { ...gcash, is_active: true });
      toast.success("GCash info saved!");
      setGcash({ gcash_number: "", gcash_name: "" });
      window.location.reload();
    } catch { toast.error("Failed to save GCash info"); }
  }

  function exportCSV() {
    const headers = ["Full Name", "Username", "Email", "Phone", "Role", "Status", "Balance", "Joined"];
    const rows = activeMembers.map(m => [m.full_name, m.username, m.email || "", m.phone || "", m.role, m.status, m.available_balance || 0, m.created_date ? formatDate(m.created_date, "MMM d, yyyy") : ""]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kabaro-load-members-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Spreadsheet exported!");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isSuperAdmin ? "Super Admin Panel" : isAdminRole ? "Admin Panel" : "Reseller Panel"}
            </h1>
            <p className="text-gray-500">
              {isSuperAdmin ? "Full system control — manage everything" : isAdminRole ? "Manage orders, top-ups, members, and products" : "Manage your product catalog"}
            </p>
          </div>
        </div>
        <Button onClick={exportCSV} className="bg-teal-600 hover:bg-teal-700 text-white">
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Products", value: allProducts.length, icon: Smartphone, color: "from-purple-500 to-pink-600" },
          { label: "Total Orders", value: purchaseOrders.length, icon: ShoppingBag, color: "from-blue-500 to-indigo-600" },
          { label: "Pending Orders", value: purchaseOrders.filter(o => o.status === "pending").length, icon: Wallet, color: "from-amber-500 to-orange-600" },
          { label: "Total Revenue", value: money(purchaseOrders.filter(o => o.status === "completed").reduce((sum, o) => sum + Math.abs(Number(o.amount || 0)), 0)), icon: Check, color: "from-emerald-500 to-teal-600" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <div className={`w-10 h-10 bg-gradient-to-br ${s.color} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${tab === t.id ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Orders Tab */}
      {tab === "orders" && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Search order # or customer..." className="pl-10" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {["Order #", "Customer", "Details", "Amount", "Status", "Date", "Actions"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {purchaseOrders.length === 0 ? <tr><td colSpan="7" className="text-center py-12 text-gray-400">No orders yet</td></tr> :
                purchaseOrders.filter(o => {
                  if (!orderSearch) return true;
                  const q = orderSearch.toLowerCase();
                  const member = members.find(m => m.id === o.member_id);
                  const orderNum = formatOrderNumber(o, purchaseOrders.indexOf(o));
                  return orderNum.toLowerCase().includes(q) || (member?.full_name || "").toLowerCase().includes(q) || (member?.username || "").toLowerCase().includes(q) || (o.description || "").toLowerCase().includes(q);
                }).slice(0, 100).map((o, idx) => {
                  const member = members.find(m => m.id === o.member_id);
                  const orderNum = formatOrderNumber(o, purchaseOrders.indexOf(o));
                  return (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">#{orderNum}</td>
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium text-gray-900">{member?.full_name || "Guest"}</p>
                        {member?.phone && <p className="text-xs text-gray-400">{member.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">{o.description || "—"}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{money(Math.abs(o.amount))}</td>
                      <td className="px-4 py-3">
                        <div className="relative inline-flex items-center">
                          <select
                            value={o.status}
                            onChange={async (e) => {
                              try { await updateRecord("transactions", o.id, { status: e.target.value }); updateLocalTx(o.id, { status: e.target.value }); toast.success(`Order ${e.target.value}`); }
                              catch { toast.error("Failed to update status"); }
                            }}
                            className={`appearance-none rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium border cursor-pointer
                              ${o.status === "completed" ? "bg-green-50 text-green-700 border-green-200" : o.status === "cancelled" ? "bg-red-50 text-red-700 border-red-200" : o.status === "shipped" ? "bg-blue-50 text-blue-700 border-blue-200" : o.status === "processing" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}
                          >
                            <option value="pending">pending</option>
                            <option value="processing">processing</option>
                            <option value="shipped">shipped</option>
                            <option value="completed">delivered</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                          <svg className="absolute right-1.5 pointer-events-none w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{formatDate(o.created_at || o.created_date, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        {o.status === "pending" && (
                          <div className="flex gap-2">
                            <button onClick={() => approveOrder(o.id)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Approve"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => rejectOrder(o.id)} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top-ups Tab */}
      {tab === "topups" && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {["Member", "Amount", "Ref #", "Status", "Processed By", "Date", "Actions"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr></thead>
              <tbody>
                {topupReqs.length === 0 ? <tr><td colSpan="7" className="text-center py-12 text-gray-400">No top-up requests</td></tr> :
                topupReqs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(r => {
                  const member = members.find(m => m.id === r.member_id);
                  const note = parseAdminNote(r.admin_note);
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{member?.full_name || "—"} <span className="text-gray-400 text-xs">@{member?.username || ""}</span></td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{money(r.amount)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{note.reference_number || "—"}</td>
                      <td className="px-6 py-4"><Badge className={r.status === "approved" ? "bg-green-100 text-green-700" : r.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}>{r.status}</Badge></td>
                      <td className="px-6 py-4 text-sm text-gray-600">{note.processed_by ? `@${note.processed_by}` : "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{formatDate(r.created_at || r.created_date, "MMM d, yyyy")}</td>
                      <td className="px-6 py-4">
                        {r.status === "pending" && (
                          <div className="flex gap-2">
                            <button onClick={() => approveTopup(r.id)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Approve"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => rejectTopup(r.id)} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Reject"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {tab === "members" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="pl-10" />
            </div>
          </div>

          {pendingMembers.length > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <h3 className="font-bold text-amber-900 mb-3">Pending Approvals ({pendingMembers.length})</h3>
              <div className="space-y-2">
                {pendingMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-amber-100">
                    <div>
                      <p className="font-medium text-gray-900">{m.full_name} <span className="text-gray-400 text-sm">@{m.username}</span></p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => approveMember(m.id)} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 px-3 text-xs"><Check className="w-3 h-3 mr-1" /> Approve</Button>
                      <Button onClick={() => deleteMember(m.id)} size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-3 text-xs"><X className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  {["Name", "Username", "Role", "Status", "Set Role", "Actions"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredMembers.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{m.full_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">@{m.username}</td>
                      <td className="px-4 py-3">
                        <Badge className={m.role === "super_admin" ? "bg-purple-100 text-purple-700" : m.role === "admin" ? "bg-blue-100 text-blue-700" : m.role === "reseller" ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-600"}>
                          {m.role === "super_admin" && <Crown className="w-3 h-3 inline mr-1" />}
                          <span className="capitalize">{m.role}</span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3"><Badge className={m.status === "approved" ? "bg-green-100 text-green-700" : m.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>{m.status}</Badge></td>
                      <td className="px-4 py-3">
                        {m.status !== "deleted" ? (
                          <div className="relative inline-flex items-center">
                            <select
                              value={m.role}
                              onChange={e => changeRole(m.id, e.target.value)}
                              disabled={!isSuperAdmin && !isAdminRole && !isReseller}
                              className="appearance-none bg-[#F5F5F5] border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-gray-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-w-[120px]"
                            >
                              {(isSuperAdmin || isAdminRole) && <option value="admin">Admin</option>}
                              <option value="reseller">Reseller</option>
                              <option value="member">User</option>
                            </select>
                            <svg className="absolute right-2 pointer-events-none w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {m.status !== "deleted" && m.role !== "super_admin" && (
                          <button onClick={() => deleteMember(m.id)} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Products Tab */}
      {tab === "products" && (
        <div className="space-y-6">
          {canManageProducts && (
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-amber-500" /> Add Product</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div><Label>Product Name</Label><Input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="e.g. Globe Load ₱50" /></div>
              <div>
                <Label>Category</Label>
                <select value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500">
                  <option value="load">E-Load</option>
                  <option value="sim">SIM Card</option>
                </select>
              </div>
              <div>
                <Label>Network</Label>
                <select value={newProduct.network} onChange={e => setNewProduct({ ...newProduct, network: e.target.value })}
                  className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500">
                  {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div><Label>Price (₱)</Label><Input type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} /></div>
            </div>
            <div className="mt-4"><Label>Description</Label><Input value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="optional" /></div>
            {/* Product Image Upload */}
            <div className="mt-4">
              <Label>Product Image</Label>
              <div className="flex items-center gap-4">
                {productImage ? (
                  <img src={URL.createObjectURL(productImage)} alt="Preview" className="w-24 h-24 rounded-xl object-cover border border-gray-200" />
                ) : (
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400">
                    <Smartphone className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer text-sm font-medium text-gray-700">
                    <Upload className="w-4 h-4" /> Upload Image
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files[0];
                      if (file) { setProductImage(file); toast.success("Image selected"); }
                    }} />
                  </label>
                  {productImage && <button onClick={() => setProductImage(null)} className="ml-2 text-sm text-red-500 hover:text-red-700">Remove</button>}
                </div>
              </div>
            </div>
            <Button
              onClick={async () => {
                if (!newProduct.name || !newProduct.price) { toast.error("Name and price required"); return; }
                try {
                  let imageUrl = null;
                  if (productImage) {
                    imageUrl = await uploadProductImage(productImage);
                  }
                  await createRecord("products", { ...newProduct, price: parseFloat(newProduct.price), is_active: true, image_url: imageUrl });
                  toast.success("Product added!");
                  setNewProduct({ name: "", category: "load", network: "Globe", price: "", description: "" });
                  setProductImage(null);
                  window.location.reload();
                } catch { toast.error("Failed to add product (run SQL migration first)"); }
              }}
              className="mt-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white"><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
            <p className="text-xs text-gray-400 mt-2">Upload an image, set the price and details. Products appear in the online shop immediately.</p>
          </div>
          )}

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Product Catalog</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  {["Image", "Name", "Category", "Network", "Price", "Status", canManageProducts ? "Actions" : ""].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr></thead>
                <tbody>
                  {allProducts.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${NETWORK_COLORS[p.network] || "from-gray-400 to-gray-600"} flex items-center justify-center`}>
                            {p.category === "sim" ? <Smartphone className="w-5 h-5 text-white" /> : <Zap className="w-5 h-5 text-white" />}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{p.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.network || "—"}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{money(p.price)}</td>
                      <td className="px-6 py-4"><Badge className={p.is_active !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>{p.is_active !== false ? "Active" : "Inactive"}</Badge></td>
                      {canManageProducts && (
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <button onClick={async () => { try { await updateRecord("products", p.id, { is_active: p.is_active === false }); toast.success("Product updated"); window.location.reload(); } catch { toast.error("Failed to update"); } }}
                              className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200" title="Toggle active">
                              {p.is_active !== false ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={async () => { if (confirm("Delete this product?")) { try { await deleteRecord("products", p.id); toast.success("Product deleted"); window.location.reload(); } catch { toast.error("Failed to delete"); } } }}
                              className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* GCash Tab */}
      {tab === "gcash" && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Smartphone className="w-5 h-5 text-blue-500" /> GCash Payment Info</h2>
          {gcashInfo.find(g => g.is_active) && (
            <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-sm text-gray-600">Current active GCash:</p>
              <p className="font-bold text-gray-900 text-lg">{gcashInfo.find(g => g.is_active).gcash_number}</p>
              <p className="text-sm text-gray-600">{gcashInfo.find(g => g.is_active).gcash_name}</p>
            </div>
          )}
          <div className="space-y-4">
            <div><Label>GCash Number</Label><Input value={gcash.gcash_number} onChange={e => setGcash({ ...gcash, gcash_number: e.target.value })} placeholder="09XX XXX XXXX" /></div>
            <div><Label>GCash Name</Label><Input value={gcash.gcash_name} onChange={e => setGcash({ ...gcash, gcash_name: e.target.value })} placeholder="Registered name" /></div>
            <Button onClick={saveGcash} className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white"><Smartphone className="w-4 h-4 mr-2" /> Save GCash Info</Button>
          </div>
        </div>
      )}

      {/* JoyTel Screenshots Tab */}
      {tab === "joytel_screenshots" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-500" /> JoyTel Dealer Portal Screenshots
            </h2>
            <Button onClick={() => window.location.href = "/JoytelDealerLogin"} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
              <Camera className="w-4 h-4" /> Take Screenshot
            </Button>
          </div>
          {joytelScreenshots.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">No screenshots yet</p>
              <p className="text-gray-400 text-sm mt-1">Go to JoyTel Login page and click "Screenshot" to capture the JoyTel portal.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {joytelScreenshots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(s => {
                let imageData = null;
                let capturedBy = "Unknown";
                let title = "JoyTel Screenshot";
                try {
                  const parsed = JSON.parse(s.setting_value);
                  imageData = parsed.image;
                  capturedBy = parsed.captured_by || "Unknown";
                  title = parsed.title || "JoyTel Screenshot";
                } catch {}
                return (
                  <div key={s.id} className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden group">
                    {imageData && (
                      <div className="relative cursor-pointer" onClick={() => setLightboxImage({ src: imageData, title, capturedBy, date: s.created_at })}>
                        <img src={imageData} alt={title} className="w-full h-48 object-cover group-hover:opacity-90 transition" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition bg-white/90 rounded-full p-2">
                            <Maximize2 className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="p-4">
                      <p className="font-medium text-gray-900 text-sm truncate">{title}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">by {capturedBy}</span>
                        <span className="text-xs text-gray-400">{formatDate(s.created_at, "MMM d, yyyy h:mm a")}</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {imageData && (
                          <a href={imageData} download={`joytel_screenshot_${s.id}.jpg`}>
                            <button className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Download">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </a>
                        )}
                        <button
                          onClick={async () => {
                            if (!confirm("Delete this screenshot?")) return;
                            try { await deleteRecord("system_settings", s.id); toast.success("Screenshot deleted"); window.location.reload(); }
                            catch { toast.error("Failed to delete"); }
                          }}
                          className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-500" /> System Information</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p><strong>Total Members:</strong> {activeMembers.length}</p>
            <p><strong>Approved Members:</strong> {approvedMembers.length}</p>
            <p><strong>Pending Members:</strong> {pendingMembers.length}</p>
            <p><strong>Total Products:</strong> {allProducts.length}</p>
            <p><strong>Total Orders:</strong> {purchaseOrders.length}</p>
            <p><strong>Pending Top-ups:</strong> {pendingTopups.length}</p>
          </div>
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative max-w-5xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-medium text-sm">{lightboxImage.title}</p>
                <p className="text-white/60 text-xs">by {lightboxImage.capturedBy} · {formatDate(lightboxImage.date, "MMM d, yyyy h:mm a")}</p>
              </div>
              <div className="flex gap-2">
                <a href={lightboxImage.src} download={`joytel_screenshot.jpg`}>
                  <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white" title="Download">
                    <Download className="w-5 h-5" />
                  </button>
                </a>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.title}
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
