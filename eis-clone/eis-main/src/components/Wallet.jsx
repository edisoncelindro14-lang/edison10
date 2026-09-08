import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, ArrowRight, TrendingUp, TrendingDown, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember, createRecord } from "../lib/useData";
import { money, formatDate, TRANSACTION_TYPES } from "../lib/helpers";
import { Button, Input, Badge } from "./ui";

const TOPUP_AMOUNTS = [50, 100, 200, 300, 500, 1000];

export default function Wallet() {
  const [topupAmount, setTopupAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: members = [] } = useTable("members");
  const { data: transactions = [] } = useTable("transactions");
  const { data: topupReqs = [] } = useTable("conversion_requests");
  const { currentMember } = useCurrentMember(members);

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <WalletIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">My Wallet</h1>
          <p className="text-gray-600 mb-6">Please login to view your wallet.</p>
          <Link to="/MemberLogin"><Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button></Link>
        </motion.div>
      </div>
    );
  }

  const myTx = transactions.filter(t => t.member_id === currentMember.id);
  const walletBalance = myTx.filter(t => t.status === "completed").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalSpent = myTx.filter(t => t.type === "purchase" && t.status === "completed").reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
  const myTopupReqs = topupReqs.filter(r => r.member_id === currentMember.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  async function handleTopup() {
    const amount = parseFloat(topupAmount);
    if (!amount || amount < 10) { toast.error("Enter at least ₱10"); return; }
    setSubmitting(true);
    try {
      await createRecord("conversion_requests", {
        member_id: currentMember.id,
        amount,
        status: "pending",
      });
      toast.success("Top-up request submitted! Send GCash payment and upload receipt.");
      setTopupAmount("");
    } catch {
      toast.error("Failed to submit top-up request");
    }
    setSubmitting(false);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl">
            <WalletIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Wallet</h1>
            <p className="text-gray-500">Top up and manage your balance</p>
          </div>
        </div>
      </motion.div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl">
          <TrendingUp className="w-8 h-8 mb-3" />
          <p className="text-emerald-100 text-sm">Wallet Balance</p>
          <p className="text-4xl font-extrabold mt-1">{money(walletBalance)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-xl">
          <WalletIcon className="w-8 h-8 mb-3" />
          <p className="text-blue-100 text-sm">Total Spent</p>
          <p className="text-4xl font-extrabold mt-1">{money(totalSpent)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-xl">
          <TrendingDown className="w-8 h-8 mb-3" />
          <p className="text-amber-100 text-sm">Pending Top-ups</p>
          <p className="text-4xl font-extrabold mt-1">{myTopupReqs.filter(r => r.status === "pending").length}</p>
        </motion.div>
      </div>

      {/* Top up form */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-500" /> Top Up Wallet</h2>
        <div className="flex gap-3 mb-4">
          {TOPUP_AMOUNTS.map(a => (
            <button key={a} onClick={() => setTopupAmount(String(a))} className={`px-4 py-2 rounded-xl border font-bold text-sm transition-all ${topupAmount === String(a) ? "bg-emerald-500 text-white border-emerald-500" : "border-gray-200 text-gray-600 hover:border-emerald-300"}`}>
              ₱{a}
            </button>
          ))}
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">Custom Amount (₱)</label>
            <Input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="Enter amount" className="mt-1" />
          </div>
          <Button onClick={handleTopup} disabled={submitting} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white h-12 px-8">
            {submitting ? "Submitting..." : "Request Top-up"}
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-3">After requesting, use the GCash Payment button (bottom right) to send payment and upload your receipt. Admin will approve your top-up.</p>
      </motion.div>

      {/* Top-up history */}
      {myTopupReqs.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Top-up Requests</h2></div>
          <div className="divide-y divide-gray-50">
            {myTopupReqs.map(r => (
              <div key={r.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-gray-900">{money(r.amount)}</p>
                  <p className="text-sm text-gray-500">{formatDate(r.created_at || r.created_date)}</p>
                </div>
                <Badge className={r.status === "approved" ? "bg-green-100 text-green-700" : r.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}>{r.status}</Badge>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Transaction history */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">Transaction History</h2></div>
        {myTx.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No transactions yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {myTx.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(tx => {
              const typeInfo = TRANSACTION_TYPES[tx.type] || { label: tx.type, color: "bg-gray-100 text-gray-700" };
              const isPurchase = tx.type === "purchase";
              return (
                <div key={tx.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{tx.description || "—"}</p>
                    <p className="text-sm text-gray-500">{formatDate(tx.created_at || tx.created_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${isPurchase ? "text-red-600" : "text-emerald-600"}`}>{isPurchase ? "" : "+"}{money(Math.abs(tx.amount))}</p>
                    <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
