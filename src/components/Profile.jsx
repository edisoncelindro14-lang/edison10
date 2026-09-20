import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { User, ArrowRight, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember, updateRecord } from "../lib/useData";
import { Button, Input, Label } from "./ui";

export default function Profile() {
  const { data: members = [], isLoading } = useTable("members");
  const { currentMember } = useCurrentMember(members);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (currentMember && !initialized) {
      setForm({
        full_name: currentMember.full_name || "",
        email: currentMember.email || "",
        phone: currentMember.phone || "",
        address: currentMember.address || "",
        gcash_number: currentMember.gcash_number || "",
        gcash_name: currentMember.gcash_name || "",
      });
      setInitialized(true);
    }
  }, [currentMember, initialized]);

  if (!currentMember && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please login to view your profile.</p>
          <Link to="/MemberLogin"><Button className="bg-orange-500 hover:bg-orange-600 text-white">Login <ArrowRight className="ml-2 w-4 h-4" /></Button></Link>
        </div>
      </div>
    );
  }

  if (!form) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  function update(key) { return e => setForm(f => ({ ...f, [key]: e.target.value })); }

  const fields = [
    { key: "full_name", label: "Full Name" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone" },
    { key: "address", label: "Address" },
  ];

  const gcashFields = [
    { key: "gcash_number", label: "GCash Number", placeholder: "09XX XXX XXXX" },
    { key: "gcash_name", label: "GCash Account Name", placeholder: "Registered name" },
  ];

  async function save() {
    const allFields = [...fields, ...gcashFields];
    const missing = allFields.filter(f => !String(form[f.key] || "").trim());
    if (missing.length > 0) {
      toast.error(`Please fill out: ${missing.map(f => f.label).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      await updateRecord("members", currentMember.id, form);
      toast.success("Profile updated successfully!");
    } catch {
      toast.error("Failed to update profile");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="text-gray-500">Manage your account information</p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
            {(currentMember.full_name || "U").charAt(0)}
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900">{currentMember.full_name || currentMember.username}</p>
            <p className="text-sm text-gray-500">@{currentMember.username}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 capitalize">{currentMember.role}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div><p className="text-xs text-gray-500">Status</p><p className="font-bold text-gray-900 capitalize">{currentMember.status}</p></div>
          <div><p className="text-xs text-gray-500">Joined</p><p className="font-bold text-gray-900">{(currentMember.created_date || currentMember.created_at) ? new Date(currentMember.created_date || currentMember.created_at).toLocaleDateString() : "—"}</p></div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Personal Information</h2>
        <div className="space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input value={form[f.key]} onChange={update(f.key)} type={f.type || "text"} required />
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">GCash Payout Details</h2>
        <p className="text-sm text-gray-500 mb-4">Required for staff withdrawals — payouts are sent directly to this GCash account.</p>
        <div className="space-y-4">
          {gcashFields.map(f => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input value={form[f.key]} onChange={update(f.key)} placeholder={f.placeholder || ""} required />
            </div>
          ))}
        </div>
      </motion.div>

      <Button onClick={save} disabled={saving} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white h-12 rounded-xl font-bold">
        <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
