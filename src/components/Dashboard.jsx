import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet, ArrowRight, ShoppingBag, Zap, Smartphone, TrendingUp, Crown, Shield, Store, Pencil, LayoutDashboard, User } from "lucide-react";
import { useTable, useCurrentMember, createRecord } from "../lib/useData";
import { supabase } from "../lib/supabase";
import { money, formatDate, FALLBACK_PRODUCTS, NETWORK_COLORS, getFinalPrice, computeWalletBalance } from "../lib/helpers";
import { Button } from "./ui";

export default function Dashboard() {
  const { data: members = [], isLoading } = useTable("members");
  const { data: transactions = [] } = useTable("transactions");
  const { data: products = [], isLoading: productsLoading } = useTable("products");
  const { currentMember } = useCurrentMember(members);

  const allProducts = products.length > 0 ? products : (!productsLoading ? FALLBACK_PRODUCTS : []);

  const myTx = currentMember ? transactions.filter(t => t.member_id === currentMember.id) : [];
  const walletBalance = computeWalletBalance(myTx);

  const myOrders = myTx.filter(t => t.type === "withdrawal" || t.type === "purchase").sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const recentOrders = myOrders.slice(0, 5);

  const featuredProducts = allProducts.filter(p => p.is_active !== false).slice(0, 6);

  const allPanels = [
    { label: "Super Admin Panel", desc: "Full system control", icon: Crown, path: "/SuperAdminPanel", color: "from-purple-500 to-indigo-600", roles: ["super_admin"] },
    { label: "Admin Panel", desc: "Manage orders & members", icon: Shield, path: "/AdminPanel", color: "from-blue-500 to-indigo-600", roles: ["super_admin", "admin"] },
    { label: "Reseller Panel", desc: "Manage your products", icon: Store, path: "/ResellerPanel", color: "from-teal-500 to-emerald-600", roles: ["super_admin", "admin", "reseller"] },
  ];
  const myRole = currentMember?.role;
  const accessiblePanels = myRole ? allPanels.filter(p => p.roles.includes(myRole)) : [];

  if (!currentMember && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-orange-500 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-white" />
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Welcome header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">{currentMember.username || "Member"}</span>
        </h1>
        <p className="text-gray-500 mt-2">Buy load, SIM cards, and manage your wallet — all in one place.</p>
      </motion.div>

      {/* Role panel tabs */}
      {accessiblePanels.length > 0 && (
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {accessiblePanels.find(p => p.path === "/SuperAdminPanel") && (
        <Link to="/SuperAdminPanel">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all">
            <Crown className="w-4 h-4" /> SuperAdmin
          </button>
        </Link>
        )}
        {accessiblePanels.find(p => p.path === "/AdminPanel") && (
        <Link to="/AdminPanel">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all">
            <Shield className="w-4 h-4" /> Admin
          </button>
        </Link>
        )}
        {accessiblePanels.find(p => p.path === "/ResellerPanel") && (
        <Link to="/ResellerPanel">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all">
            <Store className="w-4 h-4" /> Reseller
          </button>
        </Link>
        )}
      </div>
      )}

      {/* Panel quick access */}
      {accessiblePanels.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Management Panels</h2>
          <div className={`grid gap-4 ${accessiblePanels.length === 1 ? "grid-cols-1" : accessiblePanels.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
            {accessiblePanels.map(p => (
              <Link key={p.path} to={p.path}>
                <div className={`bg-gradient-to-br ${p.color} rounded-3xl p-6 text-white shadow-xl hover:shadow-2xl transition-all cursor-pointer h-full`}>
                  <div className="p-3 bg-white/20 rounded-2xl w-fit mb-3">
                    <p.icon className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-lg font-bold">{p.label}</p>
                  <p className="text-white/80 text-sm mt-1">{p.desc}</p>
                  <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-white/90">
                    Open <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Manage Shop quick access */}
      {accessiblePanels.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link to={myRole === "reseller" ? "/ResellerPanel?tab=products" : myRole === "admin" ? "/AdminPanel?tab=products" : "/SuperAdminPanel?tab=products"}>
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white shadow-xl hover:shadow-2xl transition-all flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Pencil className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold">Manage Shop</p>
                <p className="text-white/80 text-sm">Add, edit, or remove products in your online store</p>
              </div>
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
          </Link>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl">
          <Wallet className="w-8 h-8 mb-3" />
          <p className="text-emerald-100 text-sm">Wallet Balance</p>
          <p className="text-4xl font-extrabold mt-1">{money(walletBalance)}</p>
          <Link to="/Wallet" className="inline-block mt-3 text-sm font-semibold text-white/90 hover:text-white underline">Top up wallet →</Link>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-xl">
          <ShoppingBag className="w-8 h-8 mb-3" />
          <p className="text-blue-100 text-sm">Total Orders</p>
          <p className="text-4xl font-extrabold mt-1">{myOrders.length}</p>
          <Link to="/Orders" className="inline-block mt-3 text-sm font-semibold text-white/90 hover:text-white underline">View orders →</Link>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-xl">
          <Zap className="w-8 h-8 mb-3" />
          <p className="text-amber-100 text-sm">Quick Buy</p>
          <p className="text-lg font-bold mt-1">Browse load & SIM</p>
          <Link to="/Products" className="inline-block mt-3 text-sm font-semibold text-white/90 hover:text-white underline">Shop now →</Link>
        </motion.div>
      </div>

      {/* Quick buy */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Quick Buy</h2>
          <Link to="/Products" className="text-sm font-semibold text-orange-600 hover:text-orange-700">View all →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {featuredProducts.map(p => (
            <Link key={p.id} to="/Products">
              <div className="bg-white rounded-2xl shadow border border-gray-100 p-4 text-center hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer">
                <div className={`w-12 h-12 bg-gradient-to-br ${NETWORK_COLORS[p.network] || "from-gray-400 to-gray-600"} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                  {p.category === "sim" ? <Smartphone className="w-6 h-6 text-white" /> : <Zap className="w-6 h-6 text-white" />}
                </div>
                <p className="font-bold text-sm text-gray-900 truncate">{p.name}</p>
                <p className="text-lg font-extrabold text-orange-600 mt-1">{money(getFinalPrice(p))}</p>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Recent orders */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Recent Orders</h2>
          <Link to="/Orders" className="text-sm font-semibold text-orange-600 hover:text-orange-700">View all →</Link>
        </div>
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          {recentOrders.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">No orders yet. Start shopping!</p>
              <Link to="/Products"><Button className="mt-4 bg-orange-500 hover:bg-orange-600 text-white">Browse Products</Button></Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{o.description || "Purchase"}</p>
                    <p className="text-sm text-gray-500">{formatDate(o.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{money(Math.abs(o.amount))}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
