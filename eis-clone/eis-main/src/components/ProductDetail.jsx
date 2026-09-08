import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingCart, ChevronLeft, Zap, Smartphone, Store, Check } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember, createRecord } from "../lib/useData";
import { money, NETWORK_COLORS, FALLBACK_PRODUCTS } from "../lib/helpers";
import { Button, Input } from "./ui";

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [qty, setQty] = useState(1);
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [buying, setBuying] = useState(false);

  const { data: members = [] } = useTable("members");
  const { data: transactions = [] } = useTable("transactions");
  const { data: products = [] } = useTable("products");
  const { currentMember } = useCurrentMember(members);

  const walletBalance = currentMember
    ? transactions.filter(t => t.member_id === currentMember.id && t.status === "completed").reduce((sum, t) => sum + Number(t.amount || 0), 0)
    : 0;

  // Find product from DB or fallback
  const allProducts = products.length > 0 ? products : FALLBACK_PRODUCTS;
  const product = allProducts.find(p => p.id === id);

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 text-lg">Product not found.</p>
        <Button onClick={() => nav("/Products")} className="mt-4 bg-orange-500 text-white">Back to Shop</Button>
      </div>
    );
  }

  const total = product.price * qty;
  const hasLoad = product.category === "load";
  const hasSim = product.category === "sim";

  async function handleBuyNow() {
    if (!currentMember) return;
    if (hasLoad && !mobileNumber.trim()) { toast.error("Please enter a mobile number for load delivery"); return; }
    if (hasSim && !address.trim()) { toast.error("Please enter a delivery address for SIM cards"); return; }
    if (walletBalance < total) { toast.error("Insufficient wallet balance. Please top up first."); return; }

    setBuying(true);
    try {
      const details = hasLoad
        ? `${product.name} x${qty} → ${mobileNumber}`
        : `${product.name} x${qty} → ${address}`;
      await createRecord("transactions", {
        member_id: currentMember.id,
        type: "purchase",
        amount: -(product.price * qty),
        description: details,
        status: "pending",
      });
      toast.success("Order placed successfully! Admin will process it shortly.");
      nav("/Orders");
    } catch {
      toast.error("Failed to place order");
    }
    setBuying(false);
  }

  const gradient = NETWORK_COLORS[product.network] || "from-gray-400 to-gray-600";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/Products" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 font-medium">
        <ChevronLeft className="w-4 h-4" /> Back to Shop
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product Image */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-80 md:h-96 object-cover" />
            ) : (
              <div className={`h-80 md:h-96 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                {hasSim ? <Smartphone className="w-24 h-24 text-white/80" /> : <Zap className="w-24 h-24 text-white/80" />}
              </div>
            )}
          </div>
        </motion.div>

        {/* Product Info */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full capitalize">
              <Store className="w-3 h-3" /> {product.category}
            </span>
            {product.network && (
              <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full">{product.network}</span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.name}</h1>
          <div className="flex items-baseline gap-3 mt-4">
            <span className="text-3xl md:text-4xl font-extrabold text-orange-600">{money(product.price)}</span>
            {product.load_amount && (
              <span className="text-gray-400 text-lg line-through">₱{product.load_amount}</span>
            )}
          </div>
          {product.description && (
            <p className="text-gray-600 mt-4 leading-relaxed">{product.description}</p>
          )}

          {/* Quantity */}
          <div className="mt-6">
            <label className="text-sm font-medium text-gray-700">Quantity</label>
            <div className="flex items-center gap-3 mt-2">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold text-lg">−</button>
              <span className="w-12 text-center font-bold text-lg text-gray-900">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="w-10 h-10 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold text-lg">+</button>
            </div>
          </div>

          {/* Delivery details */}
          <div className="mt-6 space-y-4">
            {hasLoad && (
              <div>
                <label className="text-sm font-medium text-gray-700">Mobile Number (for load delivery)</label>
                <Input value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="09XX XXX XXXX" className="mt-1" />
              </div>
            )}
            {hasSim && (
              <div>
                <label className="text-sm font-medium text-gray-700">Delivery Address</label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="House #, Street, City" className="mt-1" />
              </div>
            )}
          </div>

          {/* Wallet + Buy */}
          <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-2xl font-extrabold text-gray-900">{money(total)}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Wallet Balance</span>
              <span className="font-bold text-emerald-600">{money(walletBalance)}</span>
            </div>
            {walletBalance < total && (
              <p className="text-sm text-red-600 font-medium mb-3">⚠ Insufficient balance. <Link to="/Wallet" className="underline">Top up your wallet</Link> first.</p>
            )}
            <Button onClick={handleBuyNow} disabled={buying || walletBalance < total}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white h-12 rounded-xl font-bold">
              {buying ? "Placing order..." : <><Check className="w-5 h-5 mr-2" /> Buy Now</>}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
