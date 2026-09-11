import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ShoppingCart, X, Zap, Smartphone, Check, Star, ArrowRight, Plus, Pencil, GripVertical, Wallet, Link as LinkIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember, createRecord } from "../lib/useData";
import { money, FALLBACK_PRODUCTS, NETWORK_COLORS, NETWORKS, SHOP_CATEGORIES,
  getProductRating, getProductReviewCount, getProductBadge, getDiscountPercent } from "../lib/helpers";
import { Button, Input } from "./ui";
import ProductEditModal from "./ProductEditModal";

const SORT_ORDER_KEY = "kabaro_product_sort_order";
function loadSortOrder() { try { return JSON.parse(localStorage.getItem(SORT_ORDER_KEY) || "[]"); } catch { return []; } }
function saveSortOrder(ids) { localStorage.setItem(SORT_ORDER_KEY, JSON.stringify(ids)); }
function sortByStoredOrder(products) {
  const order = loadSortOrder();
  if (!order.length) return products;
  const indexMap = {};
  order.forEach((id, i) => { indexMap[id] = i; });
  return [...products].sort((a, b) => (indexMap[a.id] ?? 9999) - (indexMap[b.id] ?? 9999));
}

function StarRating({ rating, count }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)} ({count.toLocaleString()})</span>
    </div>
  );
}

function ProductCard({ product, canManage, onEdit, onAddToCart, onDragStart, onDragOver, onDrop, onDragEnd, draggedId, dragOverId }) {
  const nav = useNavigate();
  const isAvailable = product.is_active !== false;
  const rating = getProductRating(product);
  const reviewCount = getProductReviewCount(product);
  const badge = getProductBadge(product);
  const discount = getDiscountPercent(product);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      draggable={canManage}
      onDragStart={(e) => onDragStart(e, product.id)}
      onDragOver={(e) => onDragOver(e, product.id)}
      onDrop={(e) => onDrop(e, product.id)}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-2xl shadow border overflow-hidden hover:shadow-lg transition-all relative group cursor-pointer
        ${dragOverId === product.id ? "border-amber-500 ring-2 ring-amber-300" : "border-gray-100 hover:border-amber-300"}
        ${draggedId === product.id ? "opacity-40" : ""}`}
      onClick={() => nav(`/Products/${product.id}`)}
    >
      {!isAvailable && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 pointer-events-none">
          <span className="text-white font-extrabold text-sm bg-red-600 px-3 py-1 rounded-lg shadow-lg rotate-12">NOT AVAILABLE</span>
        </div>
      )}
      {/* Badges */}
      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
        {badge === "best_seller" && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500 text-white">BEST SELLER</span>}
        {badge === "new" && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500 text-white">NEW</span>}
        {discount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500 text-white">-{discount}%</span>}
      </div>
      {canManage && (
        <>
          <div className="absolute top-2 right-10 z-20 p-1.5 bg-white/90 rounded-lg shadow opacity-0 group-hover:opacity-100 transition cursor-grab">
            <GripVertical className="w-3.5 h-3.5 text-gray-500" />
          </div>
          <button onClick={(e) => { e.stopPropagation(); onEdit(product); }}
            className="absolute top-2 right-2 z-20 p-2 bg-white/90 rounded-lg shadow opacity-0 group-hover:opacity-100 hover:bg-white transition">
            <Pencil className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </>
      )}
      <div className="h-32 overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className={`h-full bg-gradient-to-br ${NETWORK_COLORS[product.network] || "from-gray-400 to-gray-600"} flex items-center justify-center`}>
            {product.category === "sim" ? <Smartphone className="w-10 h-10 text-white" /> : <Zap className="w-10 h-10 text-white" />}
          </div>
        )}
      </div>
      <div className="p-3">
        <span className="text-[10px] text-gray-400 uppercase font-medium">{product.category}</span>
        <p className="font-bold text-sm text-gray-900 truncate">{product.name}</p>
        <div className="mt-1"><StarRating rating={rating} count={reviewCount} /></div>
        <div className="flex items-center justify-between mt-2">
          <div>
            <p className="text-lg font-extrabold text-orange-600">{money(product.price)}</p>
            {product.load_amount && <span className="text-xs text-gray-400 line-through">₱{product.load_amount}</span>}
          </div>
          <Button size="sm" disabled={!isAvailable}
            onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
            className={isAvailable ? "bg-orange-500 hover:bg-orange-600 text-white h-8 w-8 p-0" : "bg-gray-300 text-gray-400 cursor-not-allowed h-8 w-8 p-0"}>
            <ShoppingCart className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ShopHome({ readOnly = false }) {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [buying, setBuying] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [sortVersion, setSortVersion] = useState(0);

  const { data: members = [] } = useTable("members");
  const { data: transactions = [] } = useTable("transactions");
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts, updateLocalRecord, addLocalRecord } = useTable("products");
  const { currentMember } = useCurrentMember(members);

  const memberRole = currentMember?.role;
  const canManage = !readOnly && (memberRole === "super_admin" || memberRole === "admin" || memberRole === "reseller" || currentMember?.username === "dok");

  const allProducts = products.length > 0 ? products : (productsLoading ? FALLBACK_PRODUCTS : []);
  const visibleProducts = canManage ? allProducts : allProducts.filter(p => p.is_active !== false);
  const orderedProducts = useMemo(() => sortByStoredOrder(visibleProducts), [visibleProducts, sortVersion]);

  const walletBalance = currentMember
    ? transactions.filter(t => t.member_id === currentMember.id && t.status === "completed").reduce((sum, t) => sum + Number(t.amount || 0), 0)
    : 0;

  const featured = orderedProducts.slice(0, 4);
  const bestSellers = orderedProducts.filter(p => getProductBadge(p) === "best_seller").slice(0, 5);
  const bestSellerFallback = orderedProducts.slice(4, 9);
  const bestSellerList = bestSellers.length >= 4 ? bestSellers : bestSellerFallback;

  const filtered = orderedProducts.filter(p => {
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
  function removeFromCart(id) { setCart(prev => prev.filter(i => i.id !== id)); }
  function updateQty(id, delta) { setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)); }

  function handleEditSaved(updatedProduct) {
    const scrollY = window.scrollY;
    if (updatedProduct?.id) {
      const exists = products.some(p => String(p.id) === String(updatedProduct.id));
      if (exists) updateLocalRecord(updatedProduct.id, updatedProduct);
      else addLocalRecord(updatedProduct);
    } else { refetchProducts(); }
    setEditProduct(null);
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  }

  function handleDragStart(e, id) { setDraggedId(id); e.dataTransfer.effectAllowed = "move"; }
  function handleDragOver(e, id) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (id !== draggedId) setDragOverId(id); }
  function handleDrop(e, targetId) {
    e.preventDefault(); e.stopPropagation();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const currentOrder = filtered.map(p => p.id);
    const fromIdx = currentOrder.indexOf(draggedId);
    const toIdx = currentOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); setDragOverId(null); return; }
    const newOrder = [...currentOrder]; newOrder.splice(fromIdx, 1); newOrder.splice(toIdx, 0, draggedId);
    const stored = loadSortOrder().filter(id => !newOrder.includes(id));
    saveSortOrder([...newOrder, ...stored]);
    setDraggedId(null); setDragOverId(null); setSortVersion(v => v + 1);
  }

  async function handleCheckout() {
    if (!currentMember) { nav("/MemberLogin"); return; }
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
        await createRecord("transactions", { member_id: currentMember.id, type: "withdrawal", amount: -(item.price * item.qty), description: details, status: "pending" });
      }
      toast.success("Order placed successfully! Admin will process it shortly.");
      setCart([]); setMobileNumber(""); setAddress(""); setCheckoutOpen(false);
    } catch { toast.error("Failed to place order"); }
    setBuying(false);
  }

  const cardProps = { canManage, onEdit: setEditProduct, onAddToCart: addToCart, onDragStart: handleDragStart, onDragOver: handleDragOver, onDrop: handleDrop, onDragEnd: () => { setDraggedId(null); setDragOverId(null); }, draggedId, dragOverId };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Hero Section */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-3xl overflow-hidden mb-8">
        <div className="px-6 py-10 sm:px-12 sm:py-16">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900">
            KABARO<span className="text-indigo-600"> ONLINE SHOP!</span>
          </h1>
          <p className="text-gray-500 mt-3 text-lg">Browse and purchase prepaid load and SIM cards for all networks.</p>
          <div className="flex gap-3 mt-6">
            <a href="#all-products"><Button className="bg-indigo-600 hover:bg-indigo-700 text-white">Shop Now <ArrowRight className="w-4 h-4 ml-1" /></Button></a>
            {!currentMember && <Link to="/MemberLogin"><Button variant="outline" className="border-gray-300">Log In</Button></Link>}
          </div>
          <div className="flex gap-8 mt-8">
            <div><p className="text-2xl font-extrabold text-gray-900">{allProducts.length}+</p><p className="text-xs text-gray-400 uppercase">Products</p></div>
            <div><p className="text-2xl font-extrabold text-gray-900">10K+</p><p className="text-xs text-gray-400 uppercase">Happy Customers</p></div>
            <div><p className="text-2xl font-extrabold text-gray-900 flex items-center gap-1">4.9 <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /></p><p className="text-xs text-gray-400 uppercase">Rating</p></div>
          </div>
        </div>
      </motion.div>

      {/* Wallet + Cart bar for logged-in users */}
      {currentMember && (
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-xs text-emerald-600">Wallet Balance</p>
              <p className="font-bold text-emerald-700 text-lg">{money(walletBalance)}</p>
            </div>
            <Link to="/Wallet"><Button size="sm" variant="outline" className="ml-2 border-emerald-300 text-emerald-700">Top Up</Button></Link>
          </div>
          <button onClick={() => setCheckoutOpen(true)} className="relative flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-2xl shadow-lg transition-all">
            <ShoppingCart className="w-5 h-5" /> Cart
            {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">{cart.length}</span>}
          </button>
        </div>
      )}
      {/* Cart button for guests */}
      {!currentMember && cart.length > 0 && (
        <div className="flex justify-end mb-6">
          <button onClick={() => setCheckoutOpen(true)} className="relative flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-2xl shadow-lg transition-all">
            <ShoppingCart className="w-5 h-5" /> Cart
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">{cart.length}</span>
          </button>
        </div>
      )}

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="mb-10">
          <div className="mb-4">
            <p className="text-xs font-bold text-indigo-600 uppercase">Handpicked</p>
            <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map(p => <ProductCard key={p.id} product={p} {...cardProps} />)}
          </div>
        </section>
      )}

      {/* Shop by Category */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Shop by Category</h2>
          <p className="text-gray-500 text-sm">Find exactly what you're looking for.</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {SHOP_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => { setFilterCategory(cat.id); document.getElementById("all-products")?.scrollIntoView({ behavior: "smooth" }); }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center hover:shadow-md hover:border-indigo-300 transition-all">
              <div className="text-3xl mb-2">{cat.icon}</div>
              <p className="text-sm font-medium text-gray-700">{cat.label}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Best Sellers */}
      {bestSellerList.length > 0 && (
        <section className="mb-10">
          <div className="mb-4">
            <p className="text-xs font-bold text-indigo-600 uppercase">Trending Now</p>
            <h2 className="text-2xl font-bold text-gray-900">Best Sellers</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {bestSellerList.map(p => <ProductCard key={p.id} product={p} {...cardProps} />)}
          </div>
        </section>
      )}

      {/* All Products */}
      <section id="all-products" className="mb-10 scroll-mt-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">All Products <span className="text-gray-400 text-base font-normal">({filtered.length} items)</span></h2>
          {canManage && <Button onClick={() => setEditProduct({})} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="w-4 h-4" /> Add Product</Button>}
        </div>

        {/* Category tabs + search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterCategory("all")} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filterCategory === "all" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>All</button>
            {SHOP_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setFilterCategory(cat.id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filterCategory === cat.id ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{cat.label}</button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-10" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => <ProductCard key={p.id} product={p} {...cardProps} />)}
        </div>
        {filtered.length === 0 && <div className="text-center py-16"><p className="text-gray-400 text-lg">No products found.</p></div>}
      </section>

      {/* CTA */}
      {!currentMember && (
        <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-center text-white mb-8">
          <h2 className="text-2xl font-bold">Join Kabaro & unlock member perks</h2>
          <p className="text-indigo-100 mt-2">Create an account to track orders, save favorites, and get exclusive member-only deals.</p>
          <div className="flex justify-center gap-3 mt-6">
            <Link to="/Register"><Button className="bg-white text-indigo-600 hover:bg-indigo-50">Create Free Account</Button></Link>
            <Link to="/MemberLogin"><Button variant="outline" className="border-white text-white hover:bg-white/10">Log In</Button></Link>
          </div>
        </section>
      )}

      {/* Checkout modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setCheckoutOpen(false)}>
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Checkout</h3>
              <button onClick={() => setCheckoutOpen(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6">
              {cart.length === 0 ? <p className="text-center text-gray-400 py-8">Your cart is empty.</p> : (
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
                    <div className="mb-4"><label className="text-sm font-medium text-gray-700">Mobile Number (for load)</label><Input value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="09XX XXX XXXX" className="mt-1" /></div>
                  )}
                  {cart.some(i => i.category === "sim") && (
                    <div className="mb-4"><label className="text-sm font-medium text-gray-700">Delivery Address (for SIM)</label><Input value={address} onChange={e => setAddress(e.target.value)} placeholder="House #, Street, City" className="mt-1" /></div>
                  )}
                  <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                    <span className="font-bold text-gray-900">Total: {money(cartTotal)}</span>
                    {currentMember && walletBalance < cartTotal && <span className="text-sm text-red-600">Insufficient balance</span>}
                  </div>
                  <Button onClick={handleCheckout} disabled={buying || (currentMember ? walletBalance < cartTotal : false)} className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white h-12 rounded-xl font-bold">
                    {buying ? "Placing order..." : <><Check className="w-5 h-5 mr-2" /> {currentMember ? "Place Order" : "Login to Checkout"}</>}
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit modal */}
      {editProduct && <ProductEditModal product={editProduct} onClose={() => setEditProduct(null)} onSaved={handleEditSaved} />}
    </div>
  );
}
