import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Smartphone, Search, ShoppingCart, X, Wallet, Check } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember, createRecord } from "../lib/useData";
import { supabase } from "../lib/supabase";
import { money, FALLBACK_PRODUCTS, NETWORK_COLORS, NETWORKS } from "../lib/helpers";
import { Button, Input } from "./ui";

export default function Products() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [filterNetwork, setFilterNetwork] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [buying, setBuying] = useState(false);

  const { data: members = [] } = useTable("members");
  const { data: transactions = [] } = useTable("transactions");
  const { data: products = [] } = useTable("products");
  const { currentMember } = useCurrentMember(members);

  const allProducts = products.length > 0 ? products : FALLBACK_PRODUCTS;
  const activeProducts = allProducts.filter(p => p.is_active !== false);

  const walletBalance = currentMember
    ? transactions.filter(t => t.member_id === currentMember.id && t.status === "completed").reduce((sum, t) => sum + Number(t.amount || 0), 0)
    : 0;

  const filtered = activeProducts.filter(p => {
    if (filterNetwork !== "all" && p.network !== filterNetwork) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.network?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  function addToCart(product) {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
    toast.success(`${product.name} added to cart`);
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  function updateQty(id, delta) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  }

  async function handleCheckout() {
    if (!currentMember) return;
    const hasLoad = cart.some(i => i.category === "load");
    const hasSim = cart.some(i => i.category === "sim");
    if (hasLoad && !mobileNumber.trim()) { toast.error("Please enter a mobile number for load delivery"); return; }
    if (hasSim && !address.trim()) { toast.error("Please enter a delivery address for SIM cards"); return; }
    if (walletBalance < cartTotal) { toast.error("Insufficient wallet balance. Please top up first."); return; }

    setBuying(true);
    try {
      for (const item of cart) {
        const details = item.category === "load"
          ? `${item.name} x${item.qty} → ${mobileNumber}`
          : `${item.name} x${item.qty} → ${address}`;
        await createRecord("transactions", {
          member_id: currentMember.id,
          type: "purchase",
          amount: -(item.price * item.qty),
          description: details,
          status: "pending",
        });
      }
      toast.success("Order placed successfully! Admin will process it shortly.");
      setCart([]);
      setMobileNumber("");
      setAddress("");
      setCheckoutOpen(false);
    } catch (err) {
      toast.error("Failed to place order");
    }
    setBuying(false);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Buy Load & SIM</h1>
        <p className="text-gray-500 mt-2">Browse and purchase prepaid load and SIM cards for all networks.</p>
      </motion.div>

      {/* Wallet balance + Cart button */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3">
          <Wallet className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-xs text-emerald-600">Wallet Balance</p>
            <p className="font-bold text-emerald-700 text-lg">{money(walletBalance)}</p>
          </div>
          <Link to="/Wallet"><Button size="sm" variant="outline" className="ml-2 border-emerald-300 text-emerald-700">Top Up</Button></Link>
        </div>
        <button onClick={() => setCheckoutOpen(true)} className="relative flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-3 rounded-2xl shadow-lg transition-all">
          <ShoppingCart className="w-5 h-5" /> Cart
          {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">{cart.length}</span>}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-10" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500">
          <option value="all">All Categories</option>
          <option value="load">E-Load</option>
          <option value="sim">SIM Cards</option>
        </select>
        <select value={filterNetwork} onChange={e => setFilterNetwork(e.target.value)} className="h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500">
          <option value="all">All Networks</option>
          {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer"
            onClick={() => nav(`/Products/${p.id}`)}>
            <div className="h-24 overflow-hidden">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`h-full bg-gradient-to-br ${NETWORK_COLORS[p.network] || "from-gray-400 to-gray-600"} flex items-center justify-center`}>
                  {p.category === "sim" ? <Smartphone className="w-10 h-10 text-white" /> : <Zap className="w-10 h-10 text-white" />}
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="font-bold text-sm text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-500 mt-1">{p.description || p.network}</p>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xl font-extrabold text-orange-600">{money(p.price)}</p>
                <Button size="sm" onClick={(e) => { e.stopPropagation(); addToCart(p); }} className="bg-orange-500 hover:bg-orange-600 text-white">
                  <ShoppingCart className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No products found. Try a different search or filter.</p>
        </div>
      )}

      {/* Cart Drawer */}
      <AnimatePresence>
        {checkoutOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCheckoutOpen(false)} className="fixed inset-0 bg-black/50 z-50" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 flex flex-col">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Your Cart</h2>
                <button onClick={() => setCheckoutOpen(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <>
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${NETWORK_COLORS[item.network] || "from-gray-400 to-gray-600"} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          {item.category === "sim" ? <Smartphone className="w-5 h-5 text-white" /> : <Zap className="w-5 h-5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                          <p className="text-orange-600 font-bold">{money(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold">−</button>
                          <span className="w-6 text-center font-bold text-gray-900">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold">+</button>
                          <button onClick={() => removeFromCart(item.id)} className="ml-1 text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}

                    {/* Delivery details */}
                    {cart.some(i => i.category === "load") && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Mobile Number (for load)</label>
                        <Input value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="09XX XXX XXXX" className="mt-1" />
                      </div>
                    )}
                    {cart.some(i => i.category === "sim") && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Delivery Address (for SIM)</label>
                        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="House #, Street, City" className="mt-1" />
                      </div>
                    )}
                  </>
                )}
              </div>
              {cart.length > 0 && (
                <div className="p-6 border-t border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Wallet Balance</p>
                      <p className="font-bold text-emerald-600">{money(walletBalance)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total</p>
                      <p className="text-2xl font-extrabold text-gray-900">{money(cartTotal)}</p>
                    </div>
                  </div>
                  {walletBalance < cartTotal && (
                    <p className="text-sm text-red-600 font-medium">⚠ Insufficient balance. <Link to="/Wallet" className="underline">Top up your wallet</Link> first.</p>
                  )}
                  <Button onClick={handleCheckout} disabled={buying || walletBalance < cartTotal}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white h-12 rounded-xl font-bold">
                    {buying ? "Placing order..." : <><Check className="w-5 h-5 mr-2" /> Place Order ({money(cartTotal)})</>}
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
