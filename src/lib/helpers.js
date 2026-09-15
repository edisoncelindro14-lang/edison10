// Kabaro Load — Helpers & Product Catalog

export const money = n => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function formatDate(date, fmt = "MMM d, yyyy h:mm a") {
  const d = new Date(date);
  if (isNaN(d)) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h12 = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return fmt
    .replace("MMM", months[d.getMonth()])
    .replace("yyyy", d.getFullYear())
    .replace("d,", `${d.getDate()},`)
    .replace("d", d.getDate())
    .replace("h:mm", `${h12}:${String(d.getMinutes()).padStart(2, "0")}`)
    .replace("a", ampm);
}

// Fallback product catalog (used when DB products table doesn't exist yet)
export const FALLBACK_PRODUCTS = [
  { id: "fl-g50", name: "Globe Load ₱50", category: "load", network: "Globe", price: 52, load_amount: 50, description: "₱50 regular load for Globe" },
  { id: "fl-g100", name: "Globe Load ₱100", category: "load", network: "Globe", price: 102, load_amount: 100, description: "₱100 regular load for Globe" },
  { id: "fl-g300", name: "Globe Load ₱300", category: "load", network: "Globe", price: 302, load_amount: 300, description: "₱300 regular load for Globe" },
  { id: "fl-g500", name: "Globe Load ₱500", category: "load", network: "Globe", price: 502, load_amount: 500, description: "₱500 regular load for Globe" },
  { id: "fl-s50", name: "Smart Load ₱50", category: "load", network: "Smart", price: 52, load_amount: 50, description: "₱50 regular load for Smart" },
  { id: "fl-s100", name: "Smart Load ₱100", category: "load", network: "Smart", price: 102, load_amount: 100, description: "₱100 regular load for Smart" },
  { id: "fl-s300", name: "Smart Load ₱300", category: "load", network: "Smart", price: 302, load_amount: 300, description: "₱300 regular load for Smart" },
  { id: "fl-s500", name: "Smart Load ₱500", category: "load", network: "Smart", price: 502, load_amount: 500, description: "₱500 regular load for Smart" },
  { id: "fl-t50", name: "TM Load ₱50", category: "load", network: "TM", price: 52, load_amount: 50, description: "₱50 regular load for TM" },
  { id: "fl-t100", name: "TM Load ₱100", category: "load", network: "TM", price: 102, load_amount: 100, description: "₱100 regular load for TM" },
  { id: "fl-t300", name: "TM Load ₱300", category: "load", network: "TM", price: 302, load_amount: 300, description: "₱300 regular load for TM" },
  { id: "fl-tn50", name: "TNT Load ₱50", category: "load", network: "TNT", price: 52, load_amount: 50, description: "₱50 regular load for TNT" },
  { id: "fl-tn100", name: "TNT Load ₱100", category: "load", network: "TNT", price: 102, load_amount: 100, description: "₱100 regular load for TNT" },
  { id: "fl-tn300", name: "TNT Load ₱300", category: "load", network: "TNT", price: 302, load_amount: 300, description: "₱300 regular load for TNT" },
  { id: "fl-su50", name: "Sun Load ₱50", category: "load", network: "Sun", price: 52, load_amount: 50, description: "₱50 regular load for Sun" },
  { id: "fl-su100", name: "Sun Load ₱100", category: "load", network: "Sun", price: 102, load_amount: 100, description: "₱100 regular load for Sun" },
  { id: "fl-d50", name: "DITO Load ₱50", category: "load", network: "DITO", price: 52, load_amount: 50, description: "₱50 regular load for DITO" },
  { id: "fl-d100", name: "DITO Load ₱100", category: "load", network: "DITO", price: 102, load_amount: 100, description: "₱100 regular load for DITO" },
  { id: "sim-globe", name: "Globe SIM Card", category: "sim", network: "Globe", price: 40, description: "Brand new Globe SIM card" },
  { id: "sim-smart", name: "Smart SIM Card", category: "sim", network: "Smart", price: 40, description: "Brand new Smart SIM card" },
  { id: "sim-tm", name: "TM SIM Card", category: "sim", network: "TM", price: 40, description: "Brand new TM SIM card" },
  { id: "sim-tnt", name: "TNT SIM Card", category: "sim", network: "TNT", price: 40, description: "Brand new TNT SIM card" },
  { id: "sim-sun", name: "Sun SIM Card", category: "sim", network: "Sun", price: 40, description: "Brand new Sun SIM card" },
  { id: "sim-dito", name: "DITO SIM Card", category: "sim", network: "DITO", price: 50, description: "Brand new DITO SIM card" },
];

export const NETWORKS = ["Globe", "Smart", "TM", "TNT", "Sun", "DITO"];

export const NETWORK_COLORS = {
  Globe: "from-blue-500 to-indigo-600",
  Smart: "from-green-500 to-emerald-600",
  TM: "from-purple-500 to-pink-600",
  TNT: "from-orange-500 to-red-600",
  Sun: "from-yellow-500 to-amber-600",
  DITO: "from-red-500 to-rose-600",
};

export const TRANSACTION_TYPES = {
  topup: { label: "Wallet Top-up", color: "bg-emerald-100 text-emerald-700" },
  purchase: { label: "Purchase", color: "bg-blue-100 text-blue-700" },
  refund: { label: "Refund", color: "bg-amber-100 text-amber-700" },
  adjustment: { label: "Wallet Top-up", color: "bg-emerald-100 text-emerald-700" },
  level_bonus: { label: "Level Bonus", color: "bg-purple-100 text-purple-700" },
  referral_bonus: { label: "Referral Bonus", color: "bg-indigo-100 text-indigo-700" },
  withdrawal: { label: "Purchase", color: "bg-blue-100 text-blue-700" },
};

export function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// --- Zhoppy-style shop helpers ---

// Deterministic pseudo-random based on string id (stable across renders)
function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getProductRating(product) {
  const h = hashId(String(product.id || product.name));
  const ratings = [4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.0];
  return ratings[h % ratings.length];
}

export function getProductReviewCount(product) {
  const h = hashId(String(product.id || product.name));
  const counts = [190, 260, 320, 350, 410, 430, 580, 620, 740, 890, 1240, 1500];
  return counts[h % counts.length];
}

export function getProductBadge(product) {
  const h = hashId(String(product.id || product.name));
  const badges = ["best_seller", "new", null, "best_seller", null, "new"];
  return badges[h % badges.length];
}

export function getDiscountPercent(product) {
  if (product.load_amount && product.price > product.load_amount) {
    return Math.round((1 - product.load_amount / product.price) * 100);
  }
  if (product.original_price && product.price < product.original_price) {
    return Math.round((1 - product.price / product.original_price) * 100);
  }
  const h = hashId(String(product.id || product.name));
  const discounts = [0, 0, 15, 20, 25, 30, 40, 50];
  return discounts[h % discounts.length];
}

export function getStockCount(product) {
  const h = hashId(String(product.id || product.name));
  return (h % 100) + 5;
}

export const SHOP_CATEGORIES = [
  { id: "load", label: "E-Load", icon: "⚡" },
  { id: "sim", label: "SIM Cards", icon: "📱" },
  { id: "esim", label: "eSIM", icon: "📶" },
];

export const TRUST_BADGES = [
  { icon: "🚚", title: "Free Shipping", desc: "Over ₱2,500" },
  { icon: "🔒", title: "Secure Pay", desc: "GCash / COD" },
  { icon: "↩️", title: "7-Day Returns", desc: "Easy returns" },
];

export function formatOrderNumber(order, index) {
  if (order.order_number) return order.order_number;
  const prefix = order.type === "purchase" ? "LUM" : "GST";
  const num = String(100000 + (index + 1) * 137).padStart(6, "0");
  return `${prefix}-${num.slice(-6)}`;
}
