import React, { useEffect, useMemo, useState } from "react";
import { Search, Save, Eye, EyeOff, User } from "lucide-react";
import toast from "react-hot-toast";
import { updateRecord } from "../lib/useData";
import { money, calculateWalletBalance, formatDate } from "../lib/helpers";
import { Button, Input, Label, Badge } from "./ui";

const PROFILE_FIELDS = [
  { key: "full_name", label: "Full Name" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
];

const GCASH_FIELDS = [
  { key: "gcash_number", label: "GCash Number", placeholder: "09XX XXX XXXX" },
  { key: "gcash_name", label: "GCash Account Name", placeholder: "Registered name" },
];

const EMPTY_FORM = {
  full_name: "", email: "", phone: "", address: "",
  gcash_number: "", gcash_name: "", password: "",
};

export default function AdminProfilesTab({ members = [], transactions = [], onUpdated }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = members.find(m => String(m.id) === String(selectedId)) || null;

  useEffect(() => {
    const member = members.find(m => String(m.id) === String(selectedId));
    if (!member) return;
    setForm({
      full_name: member.full_name || "",
      email: member.email || "",
      phone: member.phone || "",
      address: member.address || "",
      gcash_number: member.gcash_number || "",
      gcash_name: member.gcash_name || "",
      password: member.password || "",
    });
    setShowPwd(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const visibleMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter(m => !q || (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q))
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [members, search]);

  function update(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    if (!selected) return;
    if (!form.password.trim()) { toast.error("Password cannot be empty"); return; }
    setSaving(true);
    try {
      await updateRecord("members", selected.id, form);
      onUpdated?.(selected.id, form);
      toast.success(`Profile updated for @${selected.username}`);
    } catch {
      toast.error("Failed to update profile");
    }
    setSaving(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Member picker */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="pl-10" />
          </div>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          {visibleMembers.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">No members found</p>
          ) : visibleMembers.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${String(m.id) === String(selectedId) ? "bg-amber-50" : "hover:bg-gray-50"}`}
            >
              <p className="font-medium text-gray-900 text-sm truncate">{m.full_name || "—"}</p>
              <p className="text-xs text-gray-400 truncate">@{m.username}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Profile form */}
      {!selected ? (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-12 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Select a member to view and edit their profile</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                {(selected.full_name || selected.username || "U").charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg text-gray-900">{selected.full_name || selected.username}</p>
                <p className="text-sm text-gray-500">@{selected.username}</p>
              </div>
              <Badge className={selected.role === "super_admin" ? "bg-purple-100 text-purple-700" : selected.role === "admin" ? "bg-blue-100 text-blue-700" : selected.role === "reseller" ? "bg-teal-100 text-teal-700" : selected.role === "staff" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}>
                <span className="capitalize">{selected.role}</span>
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 mt-4 border-t border-gray-100">
              <div><p className="text-xs text-gray-500">Status</p><p className="font-bold text-gray-900 capitalize">{selected.status}</p></div>
              <div><p className="text-xs text-gray-500">Wallet</p><p className="font-bold text-gray-900">{money(calculateWalletBalance(transactions, selected.id))}</p></div>
              <div><p className="text-xs text-gray-500">Joined</p><p className="font-bold text-gray-900">{(selected.created_date || selected.created_at) ? formatDate(selected.created_date || selected.created_at, "MMM d, yyyy") : "—"}</p></div>
              <div><p className="text-xs text-gray-500">Username</p><p className="font-bold text-gray-900">@{selected.username}</p></div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Personal Information</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {PROFILE_FIELDS.map(f => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input value={form[f.key]} onChange={update(f.key)} type={f.type || "text"} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">GCash Payout Details</h2>
            <p className="text-sm text-gray-500 mb-4">Used for staff withdrawal payouts.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {GCASH_FIELDS.map(f => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input value={form[f.key]} onChange={update(f.key)} placeholder={f.placeholder || ""} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Account Password</h2>
            <p className="text-sm text-gray-500 mb-4">View or change this member's login password.</p>
            <div>
              <Label>Password</Label>
              <div className="relative">
                <Input value={form.password} onChange={update("password")} type={showPwd ? "text" : "password"} className="pr-11" />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white h-12 rounded-xl font-bold">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      )}
    </div>
  );
}
