import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Lock, ArrowLeft, UserPlus, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { generateReferralCode } from "../lib/helpers";
import { Button, Input, Label } from "./ui";

const LOGO_URL = "https://media.base44.com/images/public/69f351e73d5a6169e8e9b7a5/82fc320ca_ChatGPTImageApr28202608_17_52PM.png";

export default function Register() {
  const [params] = useSearchParams();
  const ref = params.get("ref") || "";
  const nav = useNavigate();
  const [form, setForm] = useState({ username: "", password: "", confirm_password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const { data: existing } = await supabase.from("members").select("id").eq("username", form.username).limit(1);
      if (existing?.length > 0) {
        toast.error("Username already taken");
        setBusy(false);
        return;
      }
      let referrerId = null;
      if (ref) {
        const { data: referrer } = await supabase.from("members").select("id").eq("referral_code", ref).limit(1);
        if (referrer?.[0]) referrerId = referrer[0].id;
      }
      const { error } = await supabase.from("members").insert({
        username: form.username,
        password: form.password,
        full_name: form.username,
        referral_code: generateReferralCode(),
        referrer_id: referrerId,
        status: "approved",
        role: "member",
        tree_level: 0,
      });
      if (error) throw error;
      toast.success("Registration submitted! Admin will review your account.");
      nav("/MemberLogin");
    } catch (err) {
      toast.error(err.message || "Registration failed");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-amber-50 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/MemberLogin" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </Link>
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-8 text-center">
            <img src={LOGO_URL} alt="Mamlakah" className="w-20 h-20 rounded-2xl mx-auto mb-4 object-cover shadow-lg" />
            <h1 className="text-2xl font-bold text-white">Mamlakah Registration Form</h1>
          </div>
          <form onSubmit={submit} className="p-8 space-y-5">
            <div className="space-y-2">
              <Label>Username *</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Choose a username" className="pl-12" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input type={showPwd ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" className="pl-12 pr-12" required />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm Password *</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input type={showPwd ? "text" : "password"} value={form.confirm_password} onChange={e => setForm({ ...form, confirm_password: e.target.value })} placeholder="Re-enter your password" className="pl-12" required />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white h-12 rounded-xl font-bold">
              {busy ? "Submitting..." : "Submit Registration"} <UserPlus className="ml-2 w-5 h-5" />
            </Button>
            <p className="text-center text-gray-600">Already have an account? <Link to="/MemberLogin" className="text-amber-600 font-semibold hover:underline">Login here</Link></p>
            <a href="https://forms.gle/bMLvWgG2KGfYXzBz8" target="_blank" rel="noopener noreferrer">
              <Button type="button" className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold h-12 rounded-xl">
                Membership Terms & Conditions
              </Button>
            </a>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
