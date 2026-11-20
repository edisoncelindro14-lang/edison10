import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingCart, X, Wallet, Check, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { payFromWallet, summarizeOrders } from "../lib/orders";
import { useTable, useCurrentMember, useProductPage } from "../lib/useData";
import { money, FALLBACK_PRODUCTS, NETWORKS, getCategoryAdjustments, calculateWalletBalance, isJoytelEsim, isJoytelRecharge, needsMobile, deliveryFor } from "../lib/helpers";
import { useCart } from "../lib/CartContext";
import { Button, Input } from "./ui";
import ProductCard from "./ProductCard";
import ProductEditModal from "./ProductEditModal";
import JoytelCatalogPicker from "./JoytelCatalogPicker";
import { sortProductsByOrder, persistProductOrder } from "../lib/productSort";

const PAGE_SIZE = 24;

export default function Products() {
  const [search, setSearch] = useState("");
  const [filterNetwork, setFilterNetwork] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const { cart, addToCart: cartAddToCart, removeFromCart, updateQty, clearCart } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [serial, setSerial] = useState("");
  const [address, setAddress] = useState("");
  const [addressEdited, setAddressEdited] = useState(false);
  const [mobileEdited, setMobileEdited] = useState(false);
  const [buying, setBuying] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editProduct, setEditProduct] = useState(null); // null = closed, {} = new, {id...} = editing
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [sortVersion, setSortVersion] = useState(0);

  const { data: members = [] } = useTable("members");
  const { data: transactions = [], addLocalRecord: addLocalTx, refetch: refetchTx } = useTable("transactions");
  const { data: shopSettings = [] } = useTable("system_settings");
  // Admin-set surcharge per category (load / esim / sim), added to every card's price.
  const priceAdjustments = getCategoryAdjustments(shopSettings);
  const { currentMember } = useCurrentMember(members);
  const memberRole0 = currentMember?.role;
  const canSeeInactive = memberRole0 === "super_admin" || memberRole0 === "admin" || memberRole0 === "reseller" || currentMember?.username === "dok";
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, filterNetwork, filterCategory, canSeeInactive]);
  // Products are fetched one page at a time from the server (the catalogue can hold thousands).
  const { data: products = [], total, isLoading: productsLoading, refetch: refetchProducts, updateLocalRecord } =
    useProductPage({ category: filterCategory, network: filterNetwork, query: search, activeOnly: !canSeeInactive, page, pageSize: PAGE_SIZE });
  const addLocalRecord = () => refetchProducts();

  // Prefill delivery details from the member's profile, unless they've edited them for this order
  useEffect(() => {
    if (currentMember && !mobileEdited) setMobileNumber(currentMember.phone || "");
    if (currentMember && !addressEdited) setAddress(currentMember.address || "");
  }, [currentMember?.id]);

  const memberRole = currentMember?.role;
  const canManage = memberRole === "super_admin" || memberRole === "admin" || memberRole === "reseller" || currentMember?.username === "dok";
  // Only admins/super_admins may reorder product cards via drag-and-drop.
  const canReorder = memberRole === "super_admin" || memberRole === "admin";

  const noFilters = !search && filterNetwork === "all" && filterCategory === "all";
  const showFallback = !productsLoading && total === 0 && noFilters;
  const filtered = showFallback ? sortProductsByOrder(FALLBACK_PRODUCTS) : products;
  const orderedProducts = filtered;
  // Drag-to-reorder only makes sense when the whole list is on one page.
  const reorderable = canReorder && noFilters && total <= PAGE_SIZE;

  const walletBalance = currentMember ? calculateWalletBalance(transactions, currentMember.id) : 0;

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  function addToCart(product) {
    cartAddToCart(product, priceAdjustments);
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
    // Reorder within the full product list (not just the filtered view) so the
    // saved sort_order is consistent across every device and deployment.
    const fullOrder = orderedProducts.map(p => p.id);
    const fromIdx = fullOrder.indexOf(draggedId);
    const toIdx = fullOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); setDragOverId(null); return; }
    const newOrder = [...fullOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedId);
    // Optimistically reflect the new order locally, then persist to the server.
    newOrder.forEach((id, i) => updateLocalRecord(id, { sort_order: i }));
    setDraggedId(null);
    setDragOverId(null);
    setSortVersion(v => v + 1);
    persistProductOrder(newOrder).catch(err => {
      console.error("Failed to persist product order:", err);
      toast.error("Could not save product order — showing the last saved layout.");
      refetchProducts();
    });
  }

  async function handleCheckout(paymentMethod) {
    if (!currentMember) return;
    const hasLoad = cart.some(i => i.category === "load");
    const hasSim = cart.some(i => i.category === "sim");
    const hasMobile = cart.some(needsMobile);
    if (cart.some(isJoytelRecharge) && !serial.trim()) { toast.error("Please enter your SIM number"); return; }
    if (hasMobile && !mobileNumber.trim()) { toast.error("Please enter a mobile number for your order"); return; }
    if (hasSim && !address.trim()) { toast.error("Please enter a delivery address for SIM cards"); return; }
    const isWallet = paymentMethod === "wallet";
    if (isWallet && walletBalance < cartTotal) { toast.error("Insufficient wallet balance. Please top up first."); return; }

    setBuying(true);
    try {
      if (isWallet) {
        const out = await payFromWallet(
          currentMember.id,
          cart.map(i => ({
            product_id: i.id, qty: i.qty,
            delivery: deliveryFor(i, { mobile: mobileNumber, address, serial }),
          })),
        );
        out.transactions.forEach(addLocalTx);
        summarizeOrders(out.orders, toast);
        refetchTx();
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
            items: cart.map(i => ({ product_id: i.id, name: i.name, price: i.price, qty: i.qty, category: i.category, delivery: isJoytelRecharge(i) ? serial.trim() : undefined })),
            delivery: hasMobile ? mobileNumber : (cart.every(isJoytelEsim) ? "" : address),
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
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowImport(true)} className="border-gray-200">Import JoyTel eSIMs</Button>
            <Button onClick={() => setEditProduct({})} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          </div>
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
        {filtered.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            index={i}
            adjustments={priceAdjustments}
            canManage={canManage}
            canReorder={reorderable}
            onEdit={setEditProduct}
            onAddToCart={addToCart}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
            draggedId={draggedId}
            dragOverId={dragOverId}
            showRating={false}
            showDescription
            showJoytelBadge
            showJoytelDetails
          />
        ))}
      </div>


      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button variant="outline" disabled={page === 0} onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo(0, 0); }}>Previous</Button>
          <span className="text-sm text-gray-500">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)} · {total} products</span>
          <Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0); }}>Next</Button>
        </div>
      )}

      {filtered.length === 0 && !productsLoading && (
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
                  {cart.some(isJoytelRecharge) && (
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700">SIM number</label>
                      <Input value={serial} onChange={e => setSerial(e.target.value)} placeholder="Enter your SIM number" className="mt-1" />
                    </div>
                  )}
                  {cart.some(needsMobile) && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Mobile Number {cart.some(i => i.category === "load") ? "(for load)" : "(for your order)"}</label>
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

      <AnimatePresence>
        {showImport && <JoytelCatalogPicker mode="import" onClose={() => setShowImport(false)} onImported={refetchProducts} />}
      </AnimatePresence>

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
