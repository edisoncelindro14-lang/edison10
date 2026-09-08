import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet, ArrowRight, TrendingUp, TrendingDown, Filter } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { money, formatDate, TRANSACTION_TYPES } from "../lib/helpers";
import { Button, Badge } from "./ui";

export default function Earnings() {
  const [filter, setFilter] = useState("all");
  const { data: members = [] } = useTable("members");
  const { data: transactions = [] } = useTable("transactions");
  const { currentMember } = useCurrentMember(members);

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Earnings</h1>
          <p className="text-gray-600 mb-6">Please login to view your earnings.</p>
          <Link to="/MemberLogin">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  const myTx = currentMember ? transactions.filter(t => t.member_id === currentMember.id) : [];
  const lastWithdrawal = myTx
    .filter(t => t.type === "withdrawal" && t.status === "completed")
    .sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at))[0];
  const lastWDate = lastWithdrawal ? new Date(lastWithdrawal.created_date || lastWithdrawal.created_at) : null;

  const availableBalance = myTx
    .filter(t => ["level_bonus", "referral_bonus", "adjustment"].includes(t.type) && (!lastWDate || new Date(t.created_date || t.created_at) > lastWDate))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalWithdrawn = myTx
    .filter(t => t.type === "withdrawal" && t.status === "completed")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

  const filteredTx = filter === "all" ? myTx : myTx.filter(t => t.type === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Total Withdrawal</h1>
            <p className="text-gray-500">Track your earnings and withdrawal history</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl">
          <TrendingUp className="w-8 h-8 mb-3" />
          <p className="text-emerald-100 text-sm">Available Balance</p>
          <p className="text-4xl font-extrabold mt-1">{money(availableBalance)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-xl">
          <Wallet className="w-8 h-8 mb-3" />
          <p className="text-blue-100 text-sm">Total Withdrawn</p>
          <p className="text-4xl font-extrabold mt-1">{money(totalWithdrawn)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-xl">
          <TrendingDown className="w-8 h-8 mb-3" />
          <p className="text-amber-100 text-sm">Total Transactions</p>
          <p className="text-4xl font-extrabold mt-1">{myTx.length}</p>
        </motion.div>
      </div>

      {/* Transactions table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-lg font-bold text-gray-900">Transaction History</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-500">
              <option value="all">All</option>
              <option value="level_bonus">Level Bonus</option>
              <option value="referral_bonus">Referral Bonus</option>
              <option value="adjustment">Maintenance Code</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-12 text-gray-400">No transactions yet</td></tr>
              ) : (
                filteredTx.sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at)).map(tx => {
                  const typeInfo = TRANSACTION_TYPES[tx.type] || { label: tx.type, color: "bg-gray-100 text-gray-700" };
                  const isWithdrawal = tx.type === "withdrawal";
                  return (
                    <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(tx.created_date || tx.created_at)}</td>
                      <td className="px-6 py-4"><Badge className={typeInfo.color}>{typeInfo.label}</Badge></td>
                      <td className="px-6 py-4 text-sm text-gray-600">{tx.description || "—"}</td>
                      <td className={`px-6 py-4 text-right font-bold ${isWithdrawal ? "text-red-600" : "text-emerald-600"}`}>
                        {isWithdrawal ? "-" : "+"}{money(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-right"><Badge className="bg-gray-100 text-gray-600">{tx.status}</Badge></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
