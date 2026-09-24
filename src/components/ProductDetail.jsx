import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, ChevronLeft, Zap, Smartphone, Store, Check, Pencil, Star } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember, createRecord } from "../lib/useData";
import { money, NETWORK_COLORS, FALLBACK_PRODUCTS,
  getProductRating, getProductReviewCount, getProductBadge, getDiscountPercent, getFinalPrice } from "../lib/helpers";
import { Button, Input } from "./ui";
import ProductEditModal from "./ProductEditModal";

export default function ProductDetail({ productId }) {
  const { id: paramId } = useParams();
  const id = productId || paramId;
  const nav = useNavigate();
  const [qty, setQty] = useState(1);
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [addressEdited, setAddressEdited] = useState(false);
  const [mobileEdited, setMobileEdited] = useState(false);
  const [buying, setBuying] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  const { data: members = [] } = useTable("members");
  const { data: transactions = [] } = useTable("transactions");
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts, updateLocalRecord } = useTable("products");
  const { currentMember } = useCurrentMember(members);

  // Prefill delivery details from the member's profile, unless they've edited them for this order
  useEffect(() => {
    if (currentMember && !mobileEdited) setMobileNumber(currentMember.phone || "");
    if (currentMember && !addressEdited) setAddress(currentMember.address || "");
  }, [currentMember?.id]);

  const memberRole = currentMember?.role;
  const canManage = memberRole === "super_admin" || memberRole === "admin" || memberRole === "reseller" || currentMember?.username === "dok";

  const walletBalance = currentMember
    ? transactions.filter(t => t.member_id === currentMember.id && t.status === "completed").reduce((sum, t) => sum + Number(t.amount || 0), 0)
    : 0;

  const product = products.find(p => String(p.id) === String(id)) || FALLBACK_PRODUCTS.find(p => String(p.id) === String(id));

  if (!product) {
    if (productsLoading) {
      return (
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="inline-block w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 text-lg">Product not found.</p>
        <Button onClick={() => nav("/")} className="mt-4 bg-indigo-600 text-white">Back to Shop</Button>
      </div>
    );
  }

  const finalPrice = getFinalPrice(product);
  const total = finalPrice * qty;
  const hasLoad = product.category === "load";
  const hasSim = product.category === "sim";
  const isAvailable = product.is_active !== false;
  const rating = getProductRating(product);
  const reviewCount = getProductReviewCount(product);
  const badge = getProductBadge(product);
  const discount = getDiscountPercent(product);
  const gradient = NETWORK_COLORS[product.network] || "from-gray-400 to-gray-600";

  // Related products (same category or network, exclude current)
  const relatedProducts = (products.length > 0 ? products : FALLBACK_PRODUCTS)
    .filter(p => p.id !== product.id && (p.category === product.category || p.network === product.network))
    .slice(0, 4);

  async function handleBuyNow(paymentMethod) {
    if (!currentMember) { nav("/MemberLogin"); return; }
    if (hasLoad && !mobileNumber.trim()) { toast.error("Please enter a mobile number for load delivery"); return; }
    if (hasSim && !address.trim()) { toast.error("Please enter a delivery address for SIM cards"); return; }
    const isWallet = paymentMethod === "wallet";
    if (isWallet && walletBalance < total) { toast.error("Insufficient wallet balance. Please top up first."); return; }
    setBuying(true);
    try {
      const details = hasLoad ? `${product.name} x${qty} → ${mobileNumber}` : `${product.name} x${qty} → ${address}`;
      if (isWallet) {
        await createRecord("transactions", { member_id: currentMember.id, type: "withdrawal", amount: -total, description: details, status: "pending" });
        toast.success("Order placed! Paid from wallet.");
        nav("/Orders");
      } else {
        const res = await fetch("/api/paymongo/create-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: total,
            member_id: currentMember.id,
            purpose: "purchase",
            items: [{ name: product.name, price: finalPrice, qty, category: product.category }],
            delivery: hasLoad ? mobileNumber : address,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create payment link");
        window.location.href = data.checkout_url;
      }
    } catch (err) { toast.error(err?.message || "Failed to place order"); }
    setBuying(false);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
          <ChevronLeft className="w-4 h-4" /> Back to Shop
        </Link>
        {canManage && (
          <Button onClick={() => setEditProduct(product)} variant="outline" className="border-gray-200 text-sm">
            <Pencil className="w-4 h-4" /> Edit Product
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product Image */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden relative">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-80 md:h-96 object-cover" />
            ) : (
              <div className={`h-80 md:h-96 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                {hasSim ? <Smartphone className="w-24 h-24 text-white/80" /> : <Zap className="w-24 h-24 text-white/80" />}
              </div>
            )}
            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1">
              {badge === "best_seller" && <span className="text-xs font-bold px-2.5 py-1 rounded bg-orange-500 text-white">BEST SELLER</span>}
              {badge === "new" && <span className="text-xs font-bold px-2.5 py-1 rounded bg-teal-500 text-white">NEW</span>}
              {discount > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded bg-red-500 text-white">-{discount}%</span>}
            </div>
            {!isAvailable && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                <span className="text-white font-extrabold text-2xl bg-red-600 px-6 py-2 rounded-xl shadow-lg rotate-12">NOT AVAILABLE</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Product Info */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full capitalize">
              <Store className="w-3 h-3" /> {product.category}
            </span>
            {product.network && <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full">{product.network}</span>}
            {!isAvailable && <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">Unavailable</span>}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.name}</h1>

          {/* Rating + stock */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />)}
              <span className="text-sm font-medium text-gray-700 ml-1">{rating.toFixed(1)}</span>
            </div>
            <span className="text-sm text-gray-400">{reviewCount.toLocaleString()} Reviews</span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3 mt-4">
            <span className="text-3xl md:text-4xl font-extrabold text-indigo-600">{money(finalPrice)}</span>
            {product.discount_percent > 0 ? (
              <span className="text-gray-400 text-lg line-through">{money(product.price)}</span>
            ) : product.load_amount && <span className="text-gray-400 text-lg line-through">₱{product.load_amount}</span>}
            {discount > 0 && <span className="text-sm font-bold text-green-600">{discount}% OFF</span>}
          </div>

          {product.description && <p className="text-gray-600 mt-4 leading-relaxed">{product.description}</p>}

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
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Mobile Number (for load delivery)</label>
                  <button type="button" onClick={() => { setMobileEdited(true); setMobileNumber(""); }} className="text-xs text-indigo-600 hover:underline">Use a different number</button>
                </div>
                <Input value={mobileNumber} onChange={e => { setMobileEdited(true); setMobileNumber(e.target.value); }} placeholder="09XX XXX XXXX" className="mt-1" />
              </div>
            )}
            {hasSim && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Delivery Address</label>
                  <button type="button" onClick={() => { setAddressEdited(true); setAddress(""); }} className="text-xs text-indigo-600 hover:underline">Use a different address</button>
                </div>
                <Input value={address} onChange={e => { setAddressEdited(true); setAddress(e.target.value); }} placeholder="House #, Street, City" className="mt-1" />
              </div>
            )}
          </div>

          {/* Buy section */}
          <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-2xl font-extrabold text-gray-900">{money(total)}</span>
            </div>
            {currentMember && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Wallet Balance</span>
                <span className="font-bold text-emerald-600">{money(walletBalance)}</span>
              </div>
            )}
            {!isAvailable ? (
              <div className="w-full bg-red-100 text-red-700 h-12 rounded-xl font-bold flex items-center justify-center">This product is currently unavailable</div>
            ) : !currentMember ? (
              <Link to="/MemberLogin" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white h-12 rounded-xl font-bold flex items-center justify-center gap-2">
                <Check className="w-5 h-5" /> Login to Purchase
              </Link>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => handleBuyNow("kabaro")} disabled={buying} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white h-12 rounded-xl font-bold">
                  {buying ? "Placing..." : <><ShoppingCart className="w-5 h-5 mr-2" /> Pay to Kabaro</>}
                </Button>
                <Button onClick={() => handleBuyNow("wallet")} disabled={buying || walletBalance < total} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white h-12 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                  {buying ? "Placing..." : <><Check className="w-5 h-5 mr-2" /> Pay from Wallet</>}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Related Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {relatedProducts.map(p => (
              <Link key={p.id} to={`/Products/${p.id}`}>
                <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden hover:shadow-lg hover:border-indigo-300 transition-all">
                  <div className="h-28 overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`h-full bg-gradient-to-br ${NETWORK_COLORS[p.network] || "from-gray-400 to-gray-600"} flex items-center justify-center`}>
                        {p.category === "sim" ? <Smartphone className="w-8 h-8 text-white" /> : <Zap className="w-8 h-8 text-white" />}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-sm text-gray-900 truncate">{p.name}</p>
                    <p className="text-lg font-extrabold text-indigo-600 mt-1">{money(getFinalPrice(p))}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editProduct && (
          <ProductEditModal
            product={editProduct}
            onClose={() => setEditProduct(null)}
            onSaved={(updatedProduct) => {
              if (updatedProduct?.id && updatedProduct.id !== id) {
                nav(`/Products/${updatedProduct.id}`, { replace: true });
              } else if (updatedProduct?.id) {
                updateLocalRecord(updatedProduct.id, updatedProduct);
              }
              setEditProduct(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
