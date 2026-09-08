import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, ArrowRight, Ticket, CheckCircle, AlertCircle } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { maintenanceStatus, formatDate, formatTime } from "../lib/helpers";
import { Button, Badge } from "./ui";

export default function Monitoring() {
  const { data: members = [], isLoading } = useTable("members");
  const { data: codes = [] } = useTable("maintenance_codes");
  const { currentMember, loading } = useCurrentMember(members);

  if (isLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  }

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Monitoring</h1>
          <p className="text-gray-600 mb-6">Please login to access your downline monitoring.</p>
          <Link to="/MemberLogin"><Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button></Link>
        </motion.div>
      </div>
    );
  }

  if (currentMember.status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md bg-white rounded-3xl p-8 shadow-xl border border-amber-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Pending Approval</h1>
          <p className="text-gray-600">Your registration is being reviewed by the admin.</p>
        </motion.div>
      </div>
    );
  }

  const downlines = members.filter(m => m.referrer_id === currentMember.id && m.status === "approved");

  function getMemberCodes(memberId) {
    return codes.filter(c => c.is_used && c.used_by_member_id === memberId).sort((a, b) => new Date(b.used_at) - new Date(a.used_at));
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Downline Monitoring</h1>
        <p className="text-gray-500 mt-2">Track each 1st-level downline's maintenance-code redemptions, cycle by cycle.</p>
      </motion.div>

      {downlines.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400">No downlines yet. Share your referral link to grow your network!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {downlines.map((d, i) => {
            const status = maintenanceStatus(d, codes);
            const memberCodes = getMemberCodes(d.id);
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                <div className={`p-4 ${status.isGreen ? "bg-green-50" : "bg-red-50"} border-b border-gray-100 flex items-center gap-3`}>
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                    {(d.full_name || "U").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{d.full_name || d.username}</p>
                    <p className="text-xs text-gray-500">Level {d.tree_level || 0}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${status.isGreen ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                    {status.isGreen ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {status.isGreen ? "Active" : "Inactive"}
                  </div>
                </div>
                <div className="p-4">
                  {status.isGreen && (
                    <div className="mb-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Expires in</p>
                      <p className="font-mono font-bold text-gray-900 text-lg">{formatTime(status.secondsLeft)}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Ticket className="w-3 h-3" /> Recent Redemptions
                    </p>
                    {memberCodes.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">No codes redeemed yet</p>
                    ) : (
                      memberCodes.slice(0, 5).map(c => (
                        <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                          <span className="text-gray-600 font-mono">{c.code}</span>
                          <span className="text-gray-400 text-xs">{formatDate(c.used_at, "MMM d, yyyy")}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
