import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Smartphone, Search, ShoppingCart, X, Wallet, Check, Plus, Pencil, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember, createRecord } from "../lib/useData";
import { money, FALLBACK_PRODUCTS, NETWORK_COLORS, NETWORKS, getFinalPrice, calculateWalletBalance } from "../lib/helpers";
import { useCart } from "../lib/CartContext";
import { Button, Input } from "./ui";
import ProductEditModal from "./ProductEditModal";

const SORT_ORDER_KEY = "kabaro_product_sort_order";

function loadSortOrder() {
  try { return JSON.parse(localStorage.getItem(SORT_ORDER_KEY) || "[]"); } catch { return []; }
}

function saveSortOrder(ids) {
  localStorage.setItem(SORT_ORDER_KEY, JSON.stringify(ids));
}

function sortByStoredOrder(products) {
  const order = loadSortOrder();
  if (!order.length) return products;
  const indexMap = {};
  order.forEach((id, i) => { indexMap[id] = i; });
  return [...products].sort((a, b) => {
    const aIdx = indexMap[a.id] ?? 9999;
    const bIdx = indexMap[b.id] ?? 9999;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return 0;
  });
}

export default function Products() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [filterNetwork, setFilterNetwork] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const { cart, addToCart: cartAddToCart, removeFromCart, updateQty, clearCart } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [addressEdited, setAddressEdited] = useState(false);
  const [mobileEdited, setMobileEdited] = useState(false);
  const [buying, setBuying] = useState(false);
  const [editProduct, setEditProduct] = useState(null); // null = closed, {} = new, {id...} = editing
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [sortVersion, setSortVersion] = useState(0);

  const { data: members = [] } = useTable("members");
  const { data: transactions = [], addLocalRecord: addLocalTx } = useTable("transactions");
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts, updateLocalRecord, addLocalRecord } = useTable("products");
  const { currentMember } = useCurrentMember(members);

  // Prefill delivery details from the member's profile, unless they've edited them for this order
  useEffect(() => {
    if (currentMember && !mobileEdited) setMobileNumber(currentMember.phone || "");
    if (currentMember && !addressEdited) setAddress(currentMember.address || "");
  }, [currentMember?.id]);

  const memberRole = currentMember?.role;
  const canManage = memberRole === "super_admin" || memberRole === "admin" || memberRole === "reseller" || currentMember?.username === "dok";

  const allProducts = products.length > 0 ? products : (!productsLoading ? FALLBACK_PRODUCTS : []);
  // For admin/reseller, show ALL products (including inactive). For regular users, only active.
  const visibleProducts = canManage ? allProducts : allProducts.filter(p => p.is_active !== false);
  const orderedProducts = useMemo(() => sortByStoredOrder(visibleProducts), [visibleProducts, sortVersion]);

  const walletBalance = currentMember ? calculateWalletBalance(transactions, currentMember.id) : 0;

  const filtered = orderedProducts.filter(p => {
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
    cartAddToCart(product);
    toast.success(`${product.name} added to cart`);
  }

  function handleEditSaved(updatedProduct) {
    const scrollY = window.scrollY;
    if (updatedProduct?.id) {
      const exists = products.some(p => String(p.id) === String(updatedProduct.id));
      if (exists) {
        updateLocalRecord(updatedProduct.id, updatedProduct);
      } else {
        addLocalRecord(updatedProduct);
      }
    } else {
      refetchProducts();
    }
    setEditProduct(null);
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  }

  function handleDragStart(e, id) {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e, id) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== draggedId) setDragOverId(id);
  }

  function handleDrop(e, targetId) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const currentOrder = filtered.map(p => p.id);
    const fromIdx = currentOrder.indexOf(draggedId);
    const toIdx = currentOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); setDragOverId(null); return; }
    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedId);
    // Merge with any existing stored order for products not in current filter
    const stored = loadSortOrder().filter(id => !newOrder.includes(id));
    saveSortOrder([...newOrder, ...stored]);
    setDraggedId(null);
    setDragOverId(null);
    setSortVersion(v => v + 1);
  }

  async function handleCheckout(paymentMethod) {
    if (!currentMember) return;
    const hasLoad = cart.some(i => i.category === "load");
    const hasSim = cart.some(i => i.category === "sim");
    if (hasLoad && !mobileNumber.trim()) { toast.error("Please enter a mobile number for load delivery"); return; }
    if (hasSim && !address.trim()) { toast.error("Please enter a delivery address for SIM cards"); return; }
    const isWallet = paymentMethod === "wallet";
    if (isWallet && walletBalance < cartTotal) { toast.error("Insufficient wallet balance. Please top up first."); return; }

    setBuying(true);
    try {
      if (isWallet) {
        for (const item of cart) {
          const details = item.category === "load"
            ? `${item.name} x${item.qty} → ${mobileNumber}`
            : `${item.name} x${item.qty} → ${address}`;
          const tx = await createRecord("transactions", {
            member_id: currentMember.id,
            type: "withdrawal",
            amount: -(item.price * item.qty),
            description: details,
            status: "completed",
          });
          addLocalTx(tx);
        }
        toast.success("Order placed successfully! Paid from wallet.");
        clearCart();
        setCheckoutOpen(false);
      } else {
        const res = await fetch("/api/paymongo/create-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: cartTotal,
            member_id: currentMember.id,
            purpose: "purchase",
            items: cart.map(i => ({ name: i.name, price: i.price, qty: i.qty, category: i.category })),
            delivery: cart.some(i => i.category === "load") ? mobileNumber : address,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create payment link");
        clearCart();
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      toast.error(err?.message || "Failed to place order");
    }
    setBuying(false);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Kabaro Shop</h1>
          <p className="text-gray-500 mt-2">Browse and purchase prepaid load and SIM cards for all networks.</p>
        </div>
        {canManage && (
          <Button onClick={() => setEditProduct({})} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        )}
      </motion.div>

      {/* Wallet balance + Cart button */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        {currentMember && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-xs text-emerald-600">Wallet Balance</p>
              <p className="font-bold text-emerald-700 text-lg">{money(walletBalance)}</p>
            </div>
            <Link to="/Wallet"><Button size="sm" variant="outline" className="ml-2 border-emerald-300 text-emerald-700">Top Up</Button></Link>
          </div>
        )}
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
          <option value="esim">eSIM</option>
        </select>
        <select value={filterNetwork} onChange={e => setFilterNetwork(e.target.value)} className="h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500">
          <option value="all">All Networks</option>
          {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((p, i) => {
          const isAvailable = p.is_active !== false;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              draggable={canManage}
              onDragStart={(e) => handleDragStart(e, p.id)}
              onDragOver={(e) => handleDragOver(e, p.id)}
              onDrop={(e) => handleDrop(e, p.id)}
              onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
              className={`bg-white rounded-2xl shadow border overflow-hidden hover:shadow-lg transition-all relative group ${dragOverId === p.id ? "border-amber-500 ring-2 ring-amber-300" : "border-gray-100 hover:border-amber-300"} ${draggedId === p.id ? "opacity-40" : ""} ${canManage ? "cursor-grab active:cursor-grabbing" : ""}`}
              onClick={() => nav(`/Products/${p.id}`)}>
              {/* Not Available stamp */}
              {!isAvailable && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 pointer-events-none">
                  <span className="text-white font-extrabold text-lg bg-red-600 px-4 py-1 rounded-lg shadow-lg rotate-12">NOT AVAILABLE</span>
                </div>
              )}
              {/* Drag handle + Edit button for admin/reseller */}
              {canManage && (
                <>
                  <div className="absolute top-2 left-2 z-20 p-1.5 bg-white/90 rounded-lg shadow opacity-0 group-hover:opacity-100 transition cursor-grab">
                    <GripVertical className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setEditProduct(p); }}
                    className="absolute top-2 right-2 z-20 p-2 bg-white/90 rounded-lg shadow opacity-0 group-hover:opacity-100 hover:bg-white transition">
                    <Pencil className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </>
              )}
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
                  <div>
                    <p className="text-xl font-extrabold text-orange-600">{money(getFinalPrice(p))}</p>
                    {p.discount_percent > 0 && <span className="text-xs text-gray-400 line-through">{money(p.price)}</span>}
                  </div>
                  <Button size="sm" disabled={!isAvailable}
                    onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                    className={isAvailable ? "bg-orange-500 hover:bg-orange-600 text-white h-10 w-10 p-0" : "bg-gray-300 text-gray-400 cursor-not-allowed h-10 w-10 p-0"}>
                    <ShoppingCart className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No products found.</p>
        </div>
      )}

      {/* Checkout modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setCheckoutOpen(false)}>
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Checkout</h3>
              <button onClick={() => setCheckoutOpen(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6">
              {cart.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Your cart is empty.</p>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded border border-gray-200 text-gray-600">−</button>
                            <span className="text-sm w-6 text-center">{item.qty}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded border border-gray-200 text-gray-600">+</button>
                            <button onClick={() => removeFromCart(item.id)} className="ml-2 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <p className="font-bold text-gray-900 text-sm">{money(item.price * item.qty)}</p>
                      </div>
                    ))}
                  </div>
                  {cart.some(i => i.category === "load") && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Mobile Number (for load)</label>
                        <button type="button" onClick={() => { setMobileEdited(true); setMobileNumber(""); }} className="text-xs text-orange-600 hover:underline">Use a different number</button>
                      </div>
                      <Input value={mobileNumber} onChange={e => { setMobileEdited(true); setMobileNumber(e.target.value); }} placeholder="09XX XXX XXXX" className="mt-1" />
                    </div>
                  )}
                  {cart.some(i => i.category === "sim") && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Delivery Address (for SIM)</label>
                        <button type="button" onClick={() => { setAddressEdited(true); setAddress(""); }} className="text-xs text-orange-600 hover:underline">Use a different address</button>
                      </div>
                      <Input value={address} onChange={e => { setAddressEdited(true); setAddress(e.target.value); }} placeholder="House #, Street, City" className="mt-1" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Wallet Balance</span>
                    <span className="font-bold text-emerald-600">{money(walletBalance)}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-4 flex items-center justify-between mb-4">
                    <span className="font-bold text-gray-900">Total: {money(cartTotal)}</span>
                    {walletBalance < cartTotal && <span className="text-sm text-red-600">Insufficient balance</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => handleCheckout("kabaro")} disabled={buying}
                      className="bg-gradient-to-r from-amber-500 to-orange-600 text-white h-12 rounded-xl font-bold">
                      {buying ? "Placing..." : <><ShoppingCart className="w-5 h-5 mr-2" /> Pay via PayMongo</>}
                    </Button>
                    <Button onClick={() => handleCheckout("wallet")} disabled={buying || walletBalance < cartTotal}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white h-12 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                      {buying ? "Placing..." : <><Check className="w-5 h-5 mr-2" /> Pay from Wallet</>}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Product edit modal */}
      <AnimatePresence>
        {editProduct && (
          <ProductEditModal
            product={editProduct}
            onClose={() => setEditProduct(null)}
            onSaved={handleEditSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
