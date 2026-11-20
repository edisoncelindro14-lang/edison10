import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingCart, Zap, Smartphone, Star, Pencil, GripVertical, Radio, Sparkles } from "lucide-react";
import {
  money, NETWORK_COLORS, SHOP_CATEGORIES,
  getProductRating, getProductReviewCount, getProductBadge, getDiscountPercent, getFinalPrice,
  productCategory, joytelBadgeLabel, joytelTypeName, brandText,
} from "../lib/helpers";

function StarRating({ rating, count }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)} ({count.toLocaleString()})</span>
    </div>
  );
}

/**
 * Shared product card used by the shop grids and the related-products strip.
 * `compact` renders the smaller related-products version (name + price only).
 */
export default function ProductCard({
  product,
  adjustments,
  index = 0,
  canManage = false,
  showJoytelBadge = false,
  showJoytelDetails = false,
  showRating = true,
  showDescription = false,
  compact = false,
  canReorder = false,
  onEdit,
  onAddToCart,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  draggedId,
  dragOverId,
}) {
  const nav = useNavigate();
  const isAvailable = product.is_active !== false;
  const isBestSeller = getProductBadge(product) === "best_seller";
  const discount = getDiscountPercent(product);
  const finalPrice = getFinalPrice(product, adjustments);
  const category = SHOP_CATEGORIES.find(c => c.id === productCategory(product));
  const MediaIcon = productCategory(product) === "sim" ? Smartphone : Zap;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      draggable={canReorder}
      onDragStart={canReorder ? (e) => onDragStart(e, product.id) : undefined}
      onDragOver={canReorder ? (e) => onDragOver(e, product.id) : undefined}
      onDrop={canReorder ? (e) => onDrop(e, product.id) : undefined}
      onDragEnd={canReorder ? onDragEnd : undefined}
      onClick={() => nav(`/Products/${product.id}`)}
      className={`group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border bg-white transition-all duration-300
        ${compact ? "shadow-sm" : "shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:-translate-y-1 hover:shadow-xl"}
        ${dragOverId === product.id ? "border-amber-500 ring-2 ring-amber-300" : "border-gray-200 hover:border-gray-300"}
        ${draggedId === product.id ? "opacity-40" : ""}
        ${canReorder ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      {!isAvailable && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 pointer-events-none">
          <span className="text-white font-extrabold text-sm bg-red-600 px-3 py-1 rounded-lg shadow-lg rotate-12">NOT AVAILABLE</span>
        </div>
      )}

      {/* Best Choice ribbon */}
      {isBestSeller && !compact && (
        <div className="flex items-center justify-center gap-1.5 bg-gray-900 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
          <Sparkles className="w-3 h-3" /> Best Choice
        </div>
      )}

      {/* Media */}
      <div className={`relative overflow-hidden ${compact ? "h-24" : "h-28 sm:h-32"}`}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className={`relative h-full bg-gradient-to-br ${NETWORK_COLORS[product.network] || "from-gray-400 to-gray-600"}`}>
            <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/20 blur-xl" />
            <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-black/15 blur-xl" />
            <div className="relative flex h-full items-center justify-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-white/20 shadow-inner backdrop-blur-sm">
                <MediaIcon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        )}

        {discount > 0 && !compact && (
          <span className="absolute left-2 top-2 z-20 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">-{discount}%</span>
        )}

        {canManage && (
          <>
            {canReorder && (
              <div className="absolute right-11 top-2 z-20 rounded-full bg-white/90 p-2 shadow-sm opacity-0 transition group-hover:opacity-100 cursor-grab">
                <GripVertical className="w-3.5 h-3.5 text-gray-500" />
              </div>
            )}
            <button
              aria-label="Edit product"
              onClick={(e) => { e.stopPropagation(); onEdit(product); }}
              className="absolute right-2 top-2 z-20 rounded-full bg-white/90 p-2 shadow-sm opacity-0 transition group-hover:opacity-100 hover:bg-white"
            >
              <Pencil className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </>
        )}
      </div>

      {/* Details */}
      <div className={`flex flex-1 flex-col ${compact ? "p-3" : "p-3.5 sm:p-4"}`}>
        <div className="flex items-start justify-between gap-2">
          <p className={`truncate font-bold text-gray-900 ${compact ? "text-sm" : "text-sm sm:text-[15px]"}`}>{brandText(product.name)}</p>
          {showJoytelBadge && product.joytel_enabled && (
            <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 ring-1 ring-blue-100">
              <Radio className="w-2.5 h-2.5" /> Kabaro {joytelBadgeLabel(product)}
            </span>
          )}
        </div>

        {showDescription && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{product.description || product.network}</p>
        )}

        {showRating && !compact && (
          <div className="mt-1.5"><StarRating rating={getProductRating(product)} count={getProductReviewCount(product)} /></div>
        )}

        {showJoytelDetails && product.joytel_enabled && (
          <div className="mt-1.5 space-y-0.5">
            {product.joytel_product_code && <p className="text-[10px] font-medium text-blue-600">Code: {product.joytel_product_code}</p>}
            <p className="text-[10px] text-gray-400">{joytelTypeName(product)}{product.joytel_warehouse ? ` · ${product.joytel_warehouse}` : ""}</p>
          </div>
        )}

        <div className={`mt-auto flex items-end justify-between gap-2 ${compact ? "pt-2" : "border-t border-dashed border-gray-100 pt-3"}`}>
          <div className="min-w-0">
            <p className={`font-extrabold tracking-tight text-gray-900 ${compact ? "text-base" : "text-lg sm:text-xl"}`}>{money(finalPrice)}</p>
            {!compact && (product.discount_percent > 0 ? (
              <span className="text-[11px] text-gray-400 line-through">{money(product.price)}</span>
            ) : product.load_amount ? (
              <span className="text-[11px] text-gray-400 line-through">₱{product.load_amount}</span>
            ) : null)}
          </div>
          {onAddToCart && (
            <button
              aria-label="Add to cart"
              disabled={!isAvailable}
              onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
              className={`flex flex-shrink-0 items-center justify-center rounded-full shadow-md transition-all duration-200
                ${compact ? "h-8 w-8" : "h-10 w-10"}
                ${isAvailable ? "bg-gray-900 text-white hover:scale-105 hover:bg-orange-500" : "cursor-not-allowed bg-gray-200 text-gray-400"}`}
            >
              <ShoppingCart className={compact ? "w-4 h-4" : "w-5 h-5"} />
            </button>
          )}
        </div>

        {!compact && category && (
          <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-100">
            <span>{category.icon}</span> {category.label}
          </span>
        )}
      </div>
    </motion.div>
  );
}
