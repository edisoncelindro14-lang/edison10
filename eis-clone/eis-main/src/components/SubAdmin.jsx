import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, ArrowRight, Ticket } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { formatDate, money } from "../lib/helpers";
import { Button, Badge } from "./ui";

export default function SubAdmin() {
  const { data: members = [] } = useTable("members");
  const { data: codes = [] } = useTable("maintenance_codes");
  const { currentMember } = useCurrentMember(members);

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Sub-Admin Panel</h1>
          <p className="text-gray-600 mb-6">Please login to access the sub-admin panel.</p>
          <Link to="/MemberLogin"><Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button></Link>
        </motion.div>
      </div>
    );
  }

  // Codes assigned to this sub-admin
  const myAssignedCodes = codes.filter(c => c.assigned_sub_admin_id === currentMember.id);
  const transferredCodes = myAssignedCodes.filter(c => c.assigned_username);
  const unusedCodes = myAssignedCodes.filter(c => !c.is_used);

  // Members managed by this sub-admin
  const managedMembers = members.filter(m => m.referrer_id === currentMember.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sub-Admin Panel</h1>
            <p className="text-gray-500">Manage your assigned codes and downline members</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Assigned Codes", value: myAssignedCodes.length, color: "from-amber-500 to-orange-600" },
          { label: "Unused Codes", value: unusedCodes.length, color: "from-teal-500 to-emerald-600" },
          { label: "Transferred", value: transferredCodes.length, color: "from-blue-500 to-indigo-600" },
          { label: "Managed Members", value: managedMembers.length, color: "from-purple-500 to-pink-600" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <div className={`w-10 h-10 bg-gradient-to-br ${s.color} rounded-xl mb-3`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Assigned codes */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Ticket className="w-5 h-5 text-amber-500" /> Assigned Maintenance Codes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {["Code", "Amount", "Status", "Assigned To", "Used Date"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {myAssignedCodes.length === 0 ? <tr><td colSpan="5" className="text-center py-12 text-gray-400">No codes assigned to you yet</td></tr> :
              myAssignedCodes.slice(0, 50).map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900">{c.code}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{money(c.amount)}</td>
                  <td className="px-6 py-4"><Badge className={c.is_used ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}>{c.is_used ? "Used" : "Available"}</Badge></td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.assigned_username ? `@${c.assigned_username}` : "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{c.used_at ? formatDate(c.used_at, "MMM d, yyyy") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Managed members */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-blue-500" /> Managed Members</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {["Name", "Username", "Status", "Referral Code", "Joined"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {managedMembers.length === 0 ? <tr><td colSpan="5" className="text-center py-12 text-gray-400">No members assigned to you</td></tr> :
              managedMembers.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.full_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">@{m.username}</td>
                  <td className="px-6 py-4"><Badge className={m.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>{m.status}</Badge></td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{m.referral_code || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{formatDate(m.created_date || m.created_at, "MMM d, yyyy")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
