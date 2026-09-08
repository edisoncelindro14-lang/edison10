import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ArrowRight, KeyRound, ChevronDown, ChevronUp, Ticket, Clock, AlertCircle, Share2, Check, FileText, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember, createRecord } from "../lib/useData";
import { supabase } from "../lib/supabase";
import { money, formatDate, withdrawalCharge, LEVEL_CONFIG, maintenanceStatus } from "../lib/helpers";
import { Button, Badge } from "./ui";

export default function Dashboard() {
  const [showHistory, setShowHistory] = useState(false);
  const [code, setCode] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: members = [], isLoading } = useTable("members");
  const { data: allCodes = [] } = useTable("maintenance_codes");
  const { data: transactions = [] } = useTable("transactions");
  const { data: conversionReqs = [] } = useTable("conversion_requests");
  const { data: settings = [] } = useTable("system_settings");
  const { currentMember } = useCurrentMember(members);

  const termsVisible = settings.find(s => s.setting_key === "tab_terms_visible")?.setting_value !== "false";
  const minWithdrawal = settings.find(s => s.setting_key === "withdrawal_minimum_amount")?.setting_value || "300";
  const minAmount = parseFloat(minWithdrawal);

  const myTx = currentMember ? transactions.filter(t => t.member_id === currentMember.id) : [];
  const lastWithdrawal = myTx
    .filter(t => t.type === "withdrawal" && t.status === "completed")
    .sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at))[0];
  const lastWDate = lastWithdrawal ? new Date(lastWithdrawal.created_date || lastWithdrawal.created_at) : null;

  const availableBalance = myTx
    .filter(t => ["level_bonus", "referral_bonus", "adjustment"].includes(t.type) && (!lastWDate || new Date(t.created_date || t.created_at) > lastWDate))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const pendingWithdrawal = conversionReqs.find(r => r.member_id === currentMember?.id && r.status === "pending");
  const withdrawals = myTx.filter(t => t.type === "withdrawal").sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at));
  const myRedeemedCodes = allCodes.filter(c => c.is_used && c.used_by_member_id === currentMember?.id).sort((a, b) => new Date(b.used_at) - new Date(a.used_at));

  const profileComplete = currentMember?.gcash_number && currentMember?.gcash_name && currentMember?.phone && currentMember?.address;

  async function handleWithdraw() {
    if (!profileComplete) {
      toast.error("Please fill in your GCash details, phone, and address in My Profile.");
      return;
    }
    if (availableBalance < minAmount) {
      toast.error(`You need at least ₱${minAmount.toLocaleString()} to withdraw.`);
      return;
    }
    try {
      await createRecord("conversion_requests", {
        member_id: currentMember.id,
        amount: availableBalance,
        status: "pending",
      });
      toast.success("Withdrawal request submitted!");
      window.location.reload();
    } catch (err) {
      toast.error("Failed to submit withdrawal request");
    }
  }

  async function handleRedeem(e) {
    e.preventDefault();
    if (!code) return;
    setRedeemBusy(true);
    try {
      // Find the code
      const { data: found, error } = await supabase
        .from("maintenance_codes").select("*").eq("code", code.toUpperCase()).eq("is_used", false).limit(1);
      if (error || !found?.length) {
        toast.error("Invalid or already used code");
        setRedeemBusy(false);
        return;
      }
      const codeRecord = found[0];
      if (codeRecord.assigned_username && codeRecord.assigned_username !== currentMember.username) {
        toast.error(`This code is assigned to @${codeRecord.assigned_username}`);
        setRedeemBusy(false);
        return;
      }
      // Mark code as used
      await supabase
        .from("maintenance_codes").update({
          is_used: true,
          used_by_member_id: currentMember.id,
          used_at: new Date().toISOString(),
        }).eq("id", codeRecord.id);
      // Record redemption as a transaction
      await supabase.from("transactions").insert({
        member_id: currentMember.id,
        type: "maintenance_code",
        amount: 0,
        description: `Redeemed maintenance code: ${codeRecord.code}`,
        status: "completed",
      });
      // Fetch fresh data so upline maintenance status is accurate (not stale from page load)
      const { data: freshMembers } = await supabase.from("members").select("*");
      const { data: freshCodes } = await supabase.from("maintenance_codes").select("*");
      // Distribute upline bonuses (only to uplines with green/active maintenance status)
      await distributeUplineBonuses(currentMember, freshMembers || members, freshCodes || allCodes, codeRecord);
      toast.success("Code redeemed successfully! Upline bonuses distributed.");
      setCode("");
      window.location.reload();
    } catch (err) {
      toast.error(err.message || "Failed to redeem code");
    }
    setRedeemBusy(false);
  }

  async function distributeUplineBonuses(member, allMembers, allCodes, codeRecord) {
    // Only uplines with GREEN maintenance status (redeemed & active) can earn bonuses
    const canEarn = (m) => {
      if (!m || m.status !== "approved") return false;
      const status = maintenanceStatus(m, allCodes);
      return status.isGreen;
    };

    // Level 1: bonus goes to direct referrer (who shared the link)
    const referrer = allMembers.find(m => m.id === member.referrer_id);
    if (canEarn(referrer)) {
      const bonus1 = LEVEL_CONFIG.find(l => l.level === 1)?.bonus_amount || 0;
      if (bonus1 > 0) {
        await supabase.from("transactions").insert({
          member_id: referrer.id,
          type: "referral_bonus",
          amount: bonus1,
          bonus_level: 1,
          description: `Level 1 bonus from ${member.username}`,
          status: "completed",
          from_member_id: member.id,
        });
      }
    }
    // Levels 2-5: walk up the referrer chain (unilevel)
    let current = referrer;
    for (let level = 2; level <= 5; level++) {
      if (!current) break;
      const upline = allMembers.find(m => m.id === current.referrer_id);
      if (!upline) break;
      // Skip uplines who haven't redeemed (red banner) — they don't earn
      if (canEarn(upline)) {
        const bonus = LEVEL_CONFIG.find(l => l.level === level)?.bonus_amount || 0;
        if (bonus > 0) {
          await supabase.from("transactions").insert({
            member_id: upline.id,
            type: "level_bonus",
            amount: bonus,
            bonus_level: level,
            description: `Level ${level} bonus from ${member.username}`,
            status: "completed",
            from_member_id: member.id,
          });
        }
      }
      current = upline;
    }
  }

  const referralLink = currentMember?.referral_code ? `${window.location.origin}/Register?ref=${currentMember.referral_code}` : "";

  function copyReferral() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  if (!currentMember && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-orange-500 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Welcome!</h1>
          <p className="text-gray-600 mb-6">Please login to access your dashboard.</p>
          <Link to="/MemberLogin">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  if (!currentMember) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const charge = withdrawalCharge(availableBalance, minAmount);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top action buttons */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex justify-end gap-2 sm:gap-3">
        <a href="https://forms.gle/bMLvWgG2KGfYXzBz8" target="_blank" rel="noopener noreferrer" className={termsVisible ? "" : "hidden"}>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm h-auto whitespace-nowrap">
            <FileText className="w-4 h-4 mr-1" /> Membership Terms & Conditions
          </Button>
        </a>
      </motion.div>

      {/* Welcome header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">{currentMember.username || "Member"}</span>
        </h1>
        <p className="text-gray-500 mt-2">Here's your mamlakah network overview</p>
      </motion.div>

      {/* Balance card + Maintenance code */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Balance card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-8 bg-black">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-emerald-100 text-base font-medium">Current Balance</p>
                <p className="text-5xl font-extrabold text-white mt-1">{money(availableBalance)}</p>
                <p className="text-emerald-100 text-xs mt-1">Minimum withdrawal: ₱{minAmount.toLocaleString()}</p>
              </div>
            </div>
            {!profileComplete && (
              <div className="mt-5 bg-white/20 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-white">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Complete your profile (GCash, phone, address) to withdraw — <Link to="/Profile" className="underline font-semibold">My Profile</Link></span>
              </div>
            )}
            {availableBalance >= minAmount && !pendingWithdrawal && (
              <div className="mt-5 bg-white/20 rounded-2xl px-4 py-3 text-sm text-white space-y-1">
                <p className="font-bold">📋 Withdrawal Transaction Charge</p>
                <p>• ₱{minAmount.toLocaleString()}–₱999: flat <span className="font-bold">₱10</span> charge</p>
                <p>• ₱1,000+: <span className="font-bold">₱15 per ₱1,000</span></p>
                <div className="border-t border-white/30 mt-2 pt-2 flex justify-between">
                  <span>Your balance: <span className="font-bold">{money(availableBalance)}</span></span>
                  <span>Charge: <span className="font-bold text-yellow-300">{money(charge)}</span></span>
                </div>
                <p className="font-bold text-yellow-200">You will receive: ₱{(availableBalance - charge).toLocaleString()}</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              {pendingWithdrawal ? (
                <div className="bg-white/20 rounded-2xl px-5 py-3 flex items-center gap-2 text-white text-sm font-semibold">
                  <Clock className="w-4 h-4" /> Withdrawal pending admin approval
                </div>
              ) : (
                <Button onClick={handleWithdraw} disabled={availableBalance < minAmount || !profileComplete}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 font-bold text-base px-8 py-4 h-auto rounded-2xl shadow-lg disabled:opacity-100 disabled:text-gray-400">
                  <Wallet className="w-5 h-5 mr-2" /> Withdraw Now
                </Button>
              )}
              <Button onClick={() => setShowHistory(!showHistory)} variant="ghost"
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-2xl">
                {showHistory ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />} Withdrawal History
              </Button>
            </div>
            <AnimatePresence>
              {showHistory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="bg-white/10 border-t border-white/20 overflow-hidden">
                  <div className="p-6">
                    <h3 className="text-white font-bold mb-4">Withdrawal History</h3>
                    {withdrawals.length === 0 ? (
                      <p className="text-emerald-100 text-sm text-center py-4">No withdrawals yet</p>
                    ) : (
                      <div className="space-y-3">
                        {withdrawals.map(w => (
                          <div key={w.id} className="bg-white/10 rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-white text-sm font-semibold">Withdrawal</p>
                              <p className="text-emerald-100 text-xs">{formatDate(w.created_date || w.created_at)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-bold">-{money(Math.abs(w.amount || 0))}</p>
                              <Badge className="bg-white/20 text-white border-white/30 text-xs mt-1">{w.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Maintenance code redemption */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-emerald-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Maintenance Code</h2>
                <p className="text-sm text-gray-500">Redeem to earn rewards — your uplines earn level bonuses automatically</p>
              </div>
            </div>
          </div>
          <div className="px-6 pt-4 grid grid-cols-5 gap-3">
            {LEVEL_CONFIG.map(l => (
              <div key={l.level} className="text-center">
                <div className={`w-10 h-10 bg-gradient-to-br ${l.color} rounded-xl flex items-center justify-center text-white font-extrabold text-lg mx-auto mb-1`}>
                  L{l.level}
                </div>
                <p className="text-xs font-bold text-gray-700">₱{l.bonus_amount}</p>
              </div>
            ))}
          </div>
          <div className="p-6">
            <form onSubmit={handleRedeem} className="space-y-3">
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="MAINT-XXXXXX"
                className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 uppercase"
              />
              <Button type="submit" disabled={redeemBusy}
                className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold h-12 rounded-xl">
                <KeyRound className="w-4 h-4 mr-2" /> {redeemBusy ? "Redeeming..." : "Redeem Code"}
              </Button>
            </form>
            {myRedeemedCodes.length > 0 && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className="text-sm font-bold text-gray-700 mb-2">Redeemed Codes History</p>
                <div className="space-y-2 max-h-[100px] overflow-y-auto">
                  {myRedeemedCodes.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-teal-50 rounded-lg px-3 py-2">
                      <code className="font-mono text-sm font-bold text-gray-900">{c.code}</code>
                      <span className="text-xs text-gray-500">{formatDate(c.used_at, "MMM d, yyyy")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Referral link */}
      {currentMember.referral_code && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Your Referral Link</h3>
              <p className="text-sm text-gray-500">Share this link to invite new members to your network</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white rounded-xl px-4 py-3 border border-amber-200 text-sm text-gray-700 truncate">{referralLink}</div>
            <Button onClick={copyReferral} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-3 h-auto rounded-xl">
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
