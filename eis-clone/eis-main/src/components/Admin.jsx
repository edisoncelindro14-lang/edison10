import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, Ticket, Wallet, Smartphone, Settings, Check, X, Plus,
  Eye, EyeOff, DollarSign, Trash2, RotateCcw, UserCog, GitBranch, Search,
  Download, Copy, Crown, ArrowRight, ChevronDown, X as XIcon, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTable, updateRecord, createRecord, deleteRecord } from "../lib/useData";
import { supabase } from "../lib/supabase";
import { money, formatDate, generateReferralCode, maintenanceStatus, formatTime, LEVEL_CONFIG } from "../lib/helpers";
import { Button, Input, Label, Badge } from "./ui";
import Genealogy from "./Genealogy";

export default function Admin() {
  const [tab, setTab] = useState("members");
  const [search, setSearch] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [sponsorModal, setSponsorModal] = useState(null);
  const [newCode, setNewCode] = useState({ count: "1", description: "", assignedUsername: "" });
  const [gcash, setGcash] = useState({ gcash_number: "", gcash_name: "" });
  const [minAmount, setMinAmount] = useState("300");
  const [savingMin, setSavingMin] = useState(false);
  const [txSearch, setTxSearch] = useState("");
  const [tabVisibility, setTabVisibility] = useState({ monitoring: true, subadmin: true, terms: true, complan: true });

  const { data: members = [] } = useTable("members");
  const { data: codes = [] } = useTable("maintenance_codes");
  const { data: withdrawals = [] } = useTable("conversion_requests");
  const { data: gcashInfo = [] } = useTable("gcash_info");
  const { data: settings = [] } = useTable("system_settings");
  const { data: transactions = [] } = useTable("transactions");

  useEffect(() => {
    const map = {};
    settings.forEach(s => { map[s.setting_key] = s.setting_value; });
    setTabVisibility({
      monitoring: map.tab_monitoring_visible !== "false",
      subadmin: map.tab_subadmin_visible !== "false",
      terms: map.tab_terms_visible !== "false",
      complan: map.tab_complan_visible !== "false",
    });
    const minSetting = settings.find(s => s.setting_key === "withdrawal_minimum_amount");
    if (minSetting) setMinAmount(minSetting.setting_value);
  }, [settings]);

  const activeGcash = gcashInfo.find(g => g.is_active) || gcashInfo[0];
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending");
  const activeMembers = members.filter(m => m.status !== "deleted");
  const deletedMembers = members.filter(m => m.status === "deleted");
  const pendingMembers = activeMembers.filter(m => m.status === "pending");
  const approvedMembers = activeMembers.filter(m => m.status === "approved");
  const adminMembers = activeMembers.filter(m => m.role === "admin");
  const subAdminMembers = activeMembers.filter(m => m.role === "sub_admin");

  const filteredMembers = activeMembers.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q) || (m.referral_code || "").toLowerCase().includes(q);
  });

  const filteredTransactions = [...transactions]
    .sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at))
    .filter(t => {
      if (!txSearch) return true;
      const q = txSearch.toLowerCase();
      const member = members.find(m => m.id === t.member_id);
      return (member?.full_name || "").toLowerCase().includes(q) || (member?.username || "").toLowerCase().includes(q) || (t.type || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
    });

  const tabs = [
    { id: "members", label: `Members (${activeMembers.length})`, icon: Users },
    { id: "codes", label: "Codes", icon: Ticket },
    { id: "withdrawals", label: `Withdrawals${pendingWithdrawals.length > 0 ? ` (${pendingWithdrawals.length})` : ""}`, icon: Wallet },
    { id: "history", label: "Transaction History", icon: FileText },
    { id: "genealogy", label: "Genealogy", icon: GitBranch },
    ...(tabVisibility.monitoring ? [{ id: "monitoring", label: "Monitoring", icon: Eye }] : []),
    { id: "gcash", label: "GCash", icon: Smartphone },
    ...(deletedMembers.length > 0 ? [{ id: "deleted", label: `Deleted (${deletedMembers.length})`, icon: Trash2 }] : []),
    { id: "roles", label: "Roles", icon: UserCog },
    ...(tabVisibility.subadmin ? [{ id: "subadmins", label: "Sub-Admins", icon: Shield }] : []),
    { id: "settings", label: "Settings", icon: Settings },
  ];

  function getMemberEarnings(memberId) {
    const txns = transactions.filter(t => t.member_id === memberId);
    const l1 = txns.filter(t => t.type === "level_bonus" && t.bonus_level === 1).reduce((s, t) => s + (t.amount || 0), 0);
    const l2 = txns.filter(t => t.type === "level_bonus" && t.bonus_level === 2).reduce((s, t) => s + (t.amount || 0), 0);
    const l3 = txns.filter(t => t.type === "level_bonus" && t.bonus_level === 3).reduce((s, t) => s + (t.amount || 0), 0);
    const total = txns.reduce((s, t) => s + (t.amount || 0), 0);
    return { l1, l2, l3, total };
  }

  async function generateCodes() {
    const count = parseInt(newCode.count) || 1;
    try {
      const records = [];
      for (let i = 0; i < count; i++) {
        records.push({
          code: "MAINT-" + generateReferralCode(),
          is_used: false,
          description: newCode.description || null,
          assigned_username: newCode.assignedUsername || null,
        });
      }
      await supabase.from("maintenance_codes").insert(records);
      toast.success(`${count} code(s) generated!`);
      setNewCode({ ...newCode, description: "", assignedUsername: "" });
    } catch { toast.error("Failed to generate codes"); }
  }

  async function deleteCode(id) {
    try { await deleteRecord("maintenance_codes", id); toast.success("Code deleted"); window.location.reload(); }
    catch { toast.error("Failed to delete code"); }
  }

  async function copyCode(code) {
    try { await navigator.clipboard.writeText(code); toast.success("Code copied!"); }
    catch { toast.error("Failed to copy"); }
  }

  async function approveWithdrawal(id) {
    try {
      const req = withdrawals.find(w => w.id === id);
      await updateRecord("conversion_requests", id, { status: "approved" });
      await createRecord("transactions", {
        member_id: req.member_id,
        type: "withdrawal",
        amount: -(req.amount || 0),
        status: "completed",
        description: "Withdrawal approved by admin",
      });
      toast.success("Withdrawal approved & balance deducted");
      window.location.reload();
    } catch { toast.error("Failed to approve"); }
  }

  async function rejectWithdrawal(id) {
    try { await updateRecord("conversion_requests", id, { status: "rejected" }); toast.success("Withdrawal rejected"); window.location.reload(); }
    catch { toast.error("Failed to reject"); }
  }

  async function approveMember(id) {
    try {
      const member = members.find(m => m.id === id);
      const referrer = members.find(m => m.id === member.referrer_id);
      let placementId = null;
      if (referrer) {
        const available = [referrer, ...findDownline(referrer.id)].find(m => (m.direct_downlines_count || 0) < 10);
        placementId = available?.id || null;
      }
      const treeLevel = placementId ? (members.find(m => m.id === placementId)?.tree_level || 0) + 1 : 1;
      await updateRecord("members", id, {
        status: "approved",
        approved_date: new Date().toISOString(),
        placement_id: placementId,
        tree_level: treeLevel,
      });
      if (placementId) {
        const p = members.find(m => m.id === placementId);
        if (p) await updateRecord("members", p.id, { direct_downlines_count: (p.direct_downlines_count || 0) + 1 });
      }
      toast.success("Member approved & placed");
      window.location.reload();
    } catch { toast.error("Failed to approve member"); }
  }

  function findDownline(memberId, visited = new Set()) {
    if (visited.has(memberId)) return [];
    visited.add(memberId);
    const direct = members.filter(m => m.placement_id === memberId && m.status === "approved");
    return [...direct, ...direct.flatMap(d => findDownline(d.id, visited))];
  }

  async function rejectMember(id) {
    try { await updateRecord("members", id, { status: "rejected" }); toast.success("Member rejected"); window.location.reload(); }
    catch { toast.error("Failed to reject"); }
  }

  async function deleteMember(id) {
    if (!confirm("Delete this account? They can be restored later.")) return;
    try { await updateRecord("members", id, { status: "deleted", deleted_date: new Date().toISOString() }); toast.success("Account deleted"); window.location.reload(); }
    catch { toast.error("Failed to delete"); }
  }

  async function restoreMember(id) {
    try { await updateRecord("members", id, { status: "approved", deleted_date: null }); toast.success("Account restored"); window.location.reload(); }
    catch { toast.error("Failed to restore"); }
  }

  async function saveEditMember() {
    try {
      await updateRecord("members", editMember.id, {
        full_name: editMember.full_name,
        username: editMember.username,
        password: editMember.password,
        email: editMember.email,
        phone: editMember.phone,
        referral_code: editMember.referral_code,
        available_balance: parseFloat(editMember.available_balance) || 0,
        total_earnings: parseFloat(editMember.total_earnings) || 0,
        maintenance_override: editMember.maintenance_override || null,
      });
      toast.success("Member updated");
      setEditMember(null);
      window.location.reload();
    } catch { toast.error("Failed to update member"); }
  }

  async function changeSponsor(memberId, newSponsorId) {
    try {
      const member = members.find(m => m.id === memberId);
      const oldSponsor = members.find(m => m.id === member.referrer_id);
      const newSponsor = newSponsorId ? members.find(m => m.id === newSponsorId) : null;
      await updateRecord("members", memberId, { referrer_id: newSponsorId || null });
      if (oldSponsor) await updateRecord("members", oldSponsor.id, { direct_downlines_count: Math.max(0, (oldSponsor.direct_downlines_count || 0) - 1) });
      if (newSponsor) await updateRecord("members", newSponsor.id, { direct_downlines_count: (newSponsor.direct_downlines_count || 0) + 1 });
      toast.success("Sponsor updated");
      setSponsorModal(null);
      window.location.reload();
    } catch { toast.error("Failed to change sponsor"); }
  }

  async function setRole(id, role) {
    try { await updateRecord("members", id, { role }); toast.success(role === "member" ? "Role removed" : `Promoted to ${role}`); window.location.reload(); }
    catch { toast.error("Failed to update role"); }
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

  async function saveMinAmount() {
    const val = parseFloat(minAmount);
    if (isNaN(val) || val < 0) { toast.error("Enter a valid amount"); return; }
    setSavingMin(true);
    try {
      const existing = settings.find(s => s.setting_key === "withdrawal_minimum_amount");
      if (existing) await updateRecord("system_settings", existing.id, { setting_value: String(val) });
      else await createRecord("system_settings", { setting_key: "withdrawal_minimum_amount", setting_value: String(val) });
      toast.success(`Minimum withdrawal set to ₱${val.toLocaleString()}`);
    } catch { toast.error("Failed to update"); }
    setSavingMin(false);
  }

  async function toggleTab(key) {
    const settingKey = `tab_${key}_visible`;
    const newVal = !tabVisibility[key];
    setTabVisibility(v => ({ ...v, [key]: newVal }));
    try {
      const existing = settings.find(s => s.setting_key === settingKey);
      if (existing) await updateRecord("system_settings", existing.id, { setting_value: String(newVal) });
      else await createRecord("system_settings", { setting_key: settingKey, setting_value: String(newVal) });
      toast.success(`Tab ${newVal ? "shown" : "hidden"}`);
    } catch { toast.error("Failed to update"); }
  }

  function exportCSV() {
    const headers = ["Full Name", "Username", "Password", "Email", "Phone", "Role", "Status", "Referral Code", "Referrer", "Direct Downlines", "Tree Level", "Balance", "Total Earnings", "Approved Date"];
    const rows = activeMembers.map(m => {
      const referrer = members.find(r => r.id === m.referrer_id);
      return [m.full_name, m.username, m.password, m.email || "", m.phone || "", m.role, m.status, m.referral_code || "", referrer?.username || "", m.direct_downlines_count || 0, m.tree_level || 0, m.available_balance || 0, m.total_earnings || 0, m.approved_date ? formatDate(m.approved_date, "MMM d, yyyy") : ""];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mamlakah-members-${new Date().toISOString().split("T")[0]}.csv`;
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
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-500">Manage mamlakah members and maintenance codes</p>
          </div>
        </div>
        <Button onClick={exportCSV} className="bg-teal-600 hover:bg-teal-700 text-white">
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Members", value: activeMembers.length, icon: Users, color: "from-amber-500 to-orange-600" },
          { label: "Pending Approvals", value: pendingMembers.length, icon: Users, color: "from-yellow-500 to-amber-600" },
          { label: "Unused Codes", value: codes.filter(c => !c.is_used).length, icon: Ticket, color: "from-teal-500 to-emerald-600" },
          { label: "Pending Withdrawals", value: pendingWithdrawals.length, icon: Wallet, color: "from-blue-500 to-indigo-600" },
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

      {/* Members Tab */}
      {tab === "members" && (
        <div className="space-y-6">
          {/* Search & Password Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="pl-10" />
            </div>
            <Button onClick={() => setShowPasswords(s => !s)} size="sm" variant="outline" className="flex items-center gap-1.5 whitespace-nowrap">
              {showPasswords ? <><EyeOff className="w-3.5 h-3.5" /> Hide Passwords</> : <><Eye className="w-3.5 h-3.5" /> Show Passwords</>}
            </Button>
          </div>

          {/* Pending Members */}
          {pendingMembers.length > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Pending Approvals ({pendingMembers.length})</h3>
              <div className="space-y-2">
                {pendingMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-amber-100">
                    <div>
                      <p className="font-medium text-gray-900">{m.full_name} <span className="text-gray-400 text-sm">@{m.username}</span></p>
                      <p className="text-xs text-gray-500">Referral: {m.referral_code || "—"} • Referred by: {members.find(r => r.id === m.referrer_id)?.username || "Direct"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => approveMember(m.id)} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 px-3 text-xs"><Check className="w-3 h-3 mr-1" /> Approve & Place</Button>
                      <Button onClick={() => rejectMember(m.id)} size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-3 text-xs"><X className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members Table */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  {["Name", "Username", "Password", "Role", "Status", "Referral", "Downlines", "Balance", "Actions"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredMembers.map(m => {
                    const earnings = getMemberEarnings(m.id);
                    return (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{m.full_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">@{m.username}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{showPasswords ? (m.password || "—") : "••••••"}</td>
                        <td className="px-4 py-3"><Badge className="bg-gray-100 text-gray-600 capitalize">{m.role}</Badge></td>
                        <td className="px-4 py-3"><Badge className={m.status === "approved" ? "bg-green-100 text-green-700" : m.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>{m.status}</Badge></td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600 whitespace-nowrap">{m.referral_code || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{m.direct_downlines_count || 0}/10</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">{money(m.available_balance || 0)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditMember({ ...m })} className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Edit Member"><UserCog className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setSponsorModal({ member: m, newSponsorId: "" })} className="p-1.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200" title="Change Sponsor"><GitBranch className="w-3.5 h-3.5" /></button>
                            {m.status === "approved" && (
                              <button onClick={() => deleteMember(m.id)} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Delete Account"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Codes Tab */}
      {tab === "codes" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-amber-500" /> Generate Maintenance Codes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><Label>Count</Label><Input type="number" value={newCode.count} onChange={e => setNewCode({ ...newCode, count: e.target.value })} /></div>
              <div>
                <Label>Assign To (optional — locks code to this user)</Label>
                <select value={newCode.assignedUsername} onChange={e => setNewCode({ ...newCode, assignedUsername: e.target.value })}
                  className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20">
                  <option value="">Anyone (no lock)</option>
                  {activeMembers.map(m => <option key={m.id} value={m.username}>{m.full_name} (@{m.username})</option>)}
                </select>
              </div>
              <div><Label>Description</Label><Input value={newCode.description} onChange={e => setNewCode({ ...newCode, description: e.target.value })} placeholder="optional" /></div>
            </div>
            <Button onClick={generateCodes} className="mt-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white"><Plus className="w-4 h-4 mr-2" /> Generate Codes</Button>
          </div>
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  {["Code", "Assigned To", "Status", "Used By", "Date", "Actions"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr></thead>
                <tbody>
                  {codes.slice(0, 100).map(c => {
                    const usedBy = members.find(m => m.id === c.used_by_member_id);
                    return (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900">{c.code}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{c.assigned_username ? `@${c.assigned_username}` : "—"}</td>
                        <td className="px-6 py-4"><Badge className={c.is_used ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}>{c.is_used ? "Used" : "Available"}</Badge></td>
                        <td className="px-6 py-4 text-sm text-gray-600">{usedBy?.username || "—"}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">{c.used_at ? formatDate(c.used_at, "MMM d, yyyy") : "—"}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <button onClick={() => copyCode(c.code)} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200" title="Copy"><Copy className="w-3.5 h-3.5" /></button>
                            {c.is_used && <button onClick={() => deleteCode(c.id)} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawals Tab */}
      {tab === "withdrawals" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-500" /> Minimum Withdrawal Amount</h2>
            <div className="flex gap-3 items-end">
              <div className="flex-1"><Label>Amount (₱)</Label><Input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} /></div>
              <Button onClick={saveMinAmount} disabled={savingMin} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">Save</Button>
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  {["Member", "Amount", "Status", "Date", "Actions"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr></thead>
                <tbody>
                  {withdrawals.length === 0 ? <tr><td colSpan="5" className="text-center py-12 text-gray-400">No withdrawal requests</td></tr> :
                  withdrawals.map(w => {
                    const member = members.find(m => m.id === w.member_id);
                    return (
                      <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{member?.full_name || "—"}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{money(w.amount)}</td>
                        <td className="px-6 py-4"><Badge className={w.status === "pending" ? "bg-yellow-100 text-yellow-700" : w.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{w.status}</Badge></td>
                        <td className="px-6 py-4 text-sm text-gray-400">{formatDate(w.created_date || w.created_at, "MMM d, yyyy")}</td>
                        <td className="px-6 py-4">
                          {w.status === "pending" && (
                            <div className="flex gap-2">
                              <Button onClick={() => approveWithdrawal(w.id)} size="sm" className="bg-green-600 text-white h-8 px-3 text-xs"><Check className="w-3 h-3" /></Button>
                              <Button onClick={() => rejectWithdrawal(w.id)} size="sm" className="bg-red-600 text-white h-8 px-3 text-xs"><X className="w-3 h-3" /></Button>
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
        </div>
      )}

      {/* Transaction History Tab */}
      {tab === "history" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><FileText className="w-5 h-5 text-amber-500" /> All User Transaction History</h2>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search by member or type..." className="pl-10" />
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  {["Member", "Type", "Amount", "Description", "Status", "Date"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-12 text-gray-400">No transactions found</td></tr>
                  ) : filteredTransactions.slice(0, 200).map(t => {
                    const member = members.find(m => m.id === t.member_id);
                    const isWithdrawal = t.type === "withdrawal";
                    return (
                      <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{member?.full_name || "—"} <span className="text-gray-400 text-xs">@{member?.username || ""}</span></td>
                        <td className="px-4 py-3"><Badge className="bg-gray-100 text-gray-600 capitalize">{t.type?.replace(/_/g, " ")}</Badge></td>
                        <td className={`px-4 py-3 text-sm font-bold whitespace-nowrap ${isWithdrawal ? "text-red-600" : "text-emerald-600"}`}>{isWithdrawal ? "" : "+"}{money(Math.abs(t.amount || 0))}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{t.description || "—"}</td>
                        <td className="px-4 py-3"><Badge className={t.status === "completed" ? "bg-green-100 text-green-700" : t.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>{t.status}</Badge></td>
                        <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{formatDate(t.created_date || t.created_at, "MMM d, yyyy")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Genealogy Tab */}
      {tab === "genealogy" && <Genealogy />}

      {/* Monitoring Tab */}
      {tab === "monitoring" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Downline Monitoring</h2>
          <p className="text-gray-500 text-sm">Track each 1st-level downline's maintenance-code redemptions, cycle by cycle.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedMembers.map(m => {
              const status = maintenanceStatus(m, codes);
              const memberCodes = codes.filter(c => c.is_used && c.used_by_member_id === m.id).sort((a, b) => new Date(b.used_at) - new Date(a.used_at));
              const downlines = approvedMembers.filter(d => d.referrer_id === m.id);
              if (downlines.length === 0) return null;
              return (
                <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow overflow-hidden">
                  <div className={`p-4 ${status.isGreen ? "bg-green-50" : "bg-red-50"} border-b border-gray-100`}>
                    <p className="font-bold text-gray-900">{m.full_name}</p>
                    <p className="text-xs text-gray-500">{downlines.length} direct downlines</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {downlines.map(d => {
                      const ds = maintenanceStatus(d, codes);
                      return (
                        <div key={d.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                          <span className="text-gray-700 truncate">{d.full_name}</span>
                          <Badge className={ds.isGreen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{ds.isGreen ? "Active" : "Inactive"}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GCash Tab */}
      {tab === "gcash" && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Smartphone className="w-5 h-5 text-blue-500" /> GCash Payment Info</h2>
          {activeGcash && (
            <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-sm text-gray-600">Current active GCash:</p>
              <p className="font-bold text-gray-900 text-lg">{activeGcash.gcash_number}</p>
              <p className="text-sm text-gray-600">{activeGcash.gcash_name}</p>
            </div>
          )}
          <div className="space-y-4">
            <div><Label>GCash Number</Label><Input value={gcash.gcash_number} onChange={e => setGcash({ ...gcash, gcash_number: e.target.value })} placeholder="09XX XXX XXXX" /></div>
            <div><Label>GCash Name</Label><Input value={gcash.gcash_name} onChange={e => setGcash({ ...gcash, gcash_name: e.target.value })} placeholder="Registered name" /></div>
            <Button onClick={saveGcash} className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white"><Smartphone className="w-4 h-4 mr-2" /> Save GCash Info</Button>
          </div>
        </div>
      )}

      {/* Deleted Accounts Tab */}
      {tab === "deleted" && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-red-50">
            <h2 className="font-semibold text-red-900 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Deleted Accounts</h2>
            <p className="text-sm text-red-600 mt-1">These accounts have been deleted. You can restore them at any time.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {["Name", "Username", "Deleted On", "Actions"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr></thead>
              <tbody>
                {deletedMembers.length === 0 ? <tr><td colSpan="4" className="text-center py-12 text-gray-400">No deleted accounts</td></tr> :
                deletedMembers.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.full_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">@{m.username}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{m.deleted_date ? formatDate(m.deleted_date, "MMM d, yyyy") : "—"}</td>
                    <td className="px-6 py-4">
                      <Button onClick={() => restoreMember(m.id)} size="sm" className="bg-teal-600 text-white h-8 px-3 text-xs"><RotateCcw className="w-3 h-3 mr-1" /> Restore</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {tab === "roles" && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-indigo-50">
            <h2 className="font-semibold text-indigo-900 flex items-center gap-2"><UserCog className="w-4 h-4" /> Admin Role Management</h2>
            <p className="text-sm text-indigo-600 mt-1">Promote approved members to admin or sub-admin so they can manage the system.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {["Name", "Username", "Current Role", "Actions"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr></thead>
              <tbody>
                {approvedMembers.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.full_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">@{m.username}</td>
                    <td className="px-6 py-4"><Badge className="bg-gray-100 text-gray-600 capitalize">{m.role}</Badge></td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {m.role !== "admin" && <Button onClick={() => setRole(m.id, "admin")} size="sm" className="bg-purple-600 text-white h-8 px-3 text-xs"><Crown className="w-3 h-3 mr-1" /> Make Admin</Button>}
                        {m.role === "admin" && <Button onClick={() => setRole(m.id, "member")} size="sm" variant="outline" className="border-purple-200 text-purple-600 hover:bg-purple-50 h-8 px-3 text-xs">Remove Admin</Button>}
                        {m.role !== "sub_admin" && m.role !== "admin" && <Button onClick={() => setRole(m.id, "sub_admin")} size="sm" className="bg-amber-500 text-white h-8 px-3 text-xs"><Shield className="w-3 h-3 mr-1" /> Make Sub-Admin</Button>}
                        {m.role === "sub_admin" && <Button onClick={() => setRole(m.id, "member")} size="sm" variant="outline" className="border-amber-200 text-amber-600 hover:bg-amber-50 h-8 px-3 text-xs">Remove Sub-Admin</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Admins Tab */}
      {tab === "subadmins" && (
        <div className="space-y-6">
          {subAdminMembers.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-12 text-center">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400">No sub-admins yet. Promote a member from the Roles tab above.</p>
            </div>
          ) : subAdminMembers.map(sa => {
            const assignedCodes = codes.filter(c => c.assigned_sub_admin_id === sa.id);
            const unusedCodes = assignedCodes.filter(c => !c.is_used);
            const managedMembers = approvedMembers.filter(m => m.referrer_id === sa.id);
            return (
              <div key={sa.id} className="bg-white rounded-2xl border border-gray-100 shadow overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-amber-50 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{sa.full_name}</p>
                    <p className="text-xs text-gray-500">@{sa.username}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-600"><strong>{assignedCodes.length}</strong> codes</span>
                    <span className="text-gray-600"><strong>{unusedCodes.length}</strong> unused</span>
                    <span className="text-gray-600"><strong>{managedMembers.length}</strong> members</span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Managed Members</p>
                  {managedMembers.length === 0 ? <p className="text-sm text-gray-400">No members managed</p> : (
                    <div className="space-y-1">
                      {managedMembers.map(mm => (
                        <div key={mm.id} className="flex items-center justify-between text-sm py-1">
                          <span className="text-gray-700">{mm.full_name} <span className="text-gray-400">@{mm.username}</span></span>
                          <Badge className={mm.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>{mm.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-500" /> Minimum Withdrawal Amount</h2>
            <div className="flex gap-3 items-end">
              <div className="flex-1"><Label>Amount (₱)</Label><Input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} /></div>
              <Button onClick={saveMinAmount} disabled={savingMin} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">Save</Button>
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-500" /> Sidebar Tab Visibility</h2>
            <div className="space-y-3">
              {[
                { key: "monitoring", label: "1st Level Monitoring" },
                { key: "subadmin", label: "Sub-Admin Panel" },
                { key: "terms", label: "Terms & Conditions" },
                { key: "complan", label: "Mamlakah ComPlan" },
              ].map(t => (
                <div key={t.key} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                  <span className="font-medium text-gray-700">{t.label}</span>
                  <button onClick={() => toggleTab(t.key)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${tabVisibility[t.key] ? "bg-green-500" : "bg-gray-300"}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${tabVisibility[t.key] ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      <AnimatePresence>
        {editMember && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditMember(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><UserCog className="w-5 h-5 text-blue-500" /> Edit Member Details</h2>
                <button onClick={() => setEditMember(null)} className="p-1 rounded-lg hover:bg-gray-100"><XIcon className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div><Label>Full Name</Label><Input value={editMember.full_name || ""} onChange={e => setEditMember({ ...editMember, full_name: e.target.value })} /></div>
                <div><Label>Username</Label><Input value={editMember.username || ""} onChange={e => setEditMember({ ...editMember, username: e.target.value })} /></div>
                <div><Label>Password</Label><Input value={editMember.password || ""} onChange={e => setEditMember({ ...editMember, password: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={editMember.email || ""} onChange={e => setEditMember({ ...editMember, email: e.target.value })} placeholder="optional" /></div>
                <div><Label>Phone</Label><Input value={editMember.phone || ""} onChange={e => setEditMember({ ...editMember, phone: e.target.value })} placeholder="optional" /></div>
                <div><Label>Referral Code</Label><Input value={editMember.referral_code || ""} onChange={e => setEditMember({ ...editMember, referral_code: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Available Balance (₱)</Label><Input type="number" value={editMember.available_balance || 0} onChange={e => setEditMember({ ...editMember, available_balance: e.target.value })} /></div>
                  <div><Label>Total Earnings (₱)</Label><Input type="number" value={editMember.total_earnings || 0} onChange={e => setEditMember({ ...editMember, total_earnings: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Maintenance Override</Label>
                  <select value={editMember.maintenance_override || ""} onChange={e => setEditMember({ ...editMember, maintenance_override: e.target.value || null })}
                    className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20">
                    <option value="">None (use timer)</option>
                    <option value="green">Force Green (Active)</option>
                    <option value="red">Force Red (Inactive)</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-3xl">
                <Button onClick={saveEditMember} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">Save Changes</Button>
                <Button onClick={() => setEditMember(null)} variant="outline" className="flex-1">Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Sponsor Modal */}
      <AnimatePresence>
        {sponsorModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSponsorModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><GitBranch className="w-5 h-5 text-amber-500" /> Change Sponsor — {sponsorModal.member?.full_name}</h2>
                <button onClick={() => setSponsorModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><XIcon className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500">Current sponsor: {members.find(m => m.id === sponsorModal.member?.referrer_id)?.username || "None (root)"}</p>
                <p className="text-sm text-gray-500">Changing the sponsor will update downline counts for both old and new sponsors.</p>
                <div>
                  <Label>Select New Sponsor</Label>
                  <select value={sponsorModal.newSponsorId} onChange={e => setSponsorModal({ ...sponsorModal, newSponsorId: e.target.value })}
                    className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20">
                    <option value="">None (root — no sponsor)</option>
                    {approvedMembers.filter(m => m.id !== sponsorModal.member?.id).map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} (@{m.username}) — {m.direct_downlines_count || 0}/10 downlines</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex gap-3">
                <Button onClick={() => changeSponsor(sponsorModal.member.id, sponsorModal.newSponsorId)} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white">Update Sponsor</Button>
                <Button onClick={() => setSponsorModal(null)} variant="outline" className="flex-1">Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
