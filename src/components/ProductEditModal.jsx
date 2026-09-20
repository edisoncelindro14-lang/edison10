import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { X, Upload, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { updateRecord, createRecord, deleteRecord } from "../lib/useData";
import { NETWORKS, NETWORK_COLORS } from "../lib/helpers";
import { Button, Input, Label, Badge } from "./ui";

export default function ProductEditModal({ product, onClose, onSaved }) {
  // Fallback products use string IDs like "fl-g50" — not real DB records.
  // Treat them as new products so we create a DB record instead of failing to update.
  const isUUID = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isEditing = !!product?.id && isUUID(product.id);
  const [form, setForm] = useState({
    name: product?.name || "",
    price: product?.price || "",
    description: product?.description || "",
    category: product?.category || "load",
    network: product?.network || "Globe",
    image_url: product?.image_url || "",
    is_active: product?.is_active !== false,
    best_seller: product?.best_seller || false,
    has_discount: !!product?.discount_percent,
    discount_percent: product?.discount_percent || "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(product?.image_url || "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(file) {
    if (!file) return form.image_url;
    const fileName = `product_${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("products").upload(fileName, file);
    if (error) {
      // Fallback to data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }
    const { data } = supabase.storage.from("products").getPublicUrl(fileName);
    return data?.publicUrl || null;
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    if (!form.price || parseFloat(form.price) <= 0) { toast.error("Valid price is required"); return; }
    setSaving(true);
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile) : form.image_url;
      const payload = {
        name: form.name.trim(),
        price: parseFloat(form.price),
        description: form.description.trim(),
        category: form.category,
        network: form.network,
        image_url: imageUrl,
        is_active: form.is_active,
        best_seller: form.best_seller,
        discount_percent: form.has_discount ? (parseFloat(form.discount_percent) || 0) : 0,
      };

      if (isEditing) {
        const result = await updateRecord("products", product.id, payload);
        toast.success("Product updated");
        onSaved(result);
      } else {
        const result = await createRecord("products", payload);
        toast.success("Product added");
        onSaved(result);
      }
    } catch (err) {
      console.error("Save product error:", err);
      toast.error("Failed to save product: " + (err?.message || "Unknown error"));
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!isEditing) return;
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await deleteRecord("products", product.id);
      toast.success("Product deleted");
      onSaved();
    } catch {
      toast.error("Failed to delete product");
    }
    setSaving(false);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">{isEditing ? "Edit Product" : "Add Product"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Image upload */}
          <div>
            <Label>Product Image</Label>
            <div className="mt-1 flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div className="flex-1">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="border-gray-200 text-sm">
                  <Upload className="w-4 h-4" /> {imagePreview ? "Change Image" : "Upload Image"}
                </Button>
                {imagePreview && (
                  <button onClick={() => { setImageFile(null); setImagePreview(""); update("image_url", ""); }}
                    className="ml-2 text-sm text-red-500 hover:text-red-600">Remove</button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <Label>Product Name</Label>
            <Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="e.g. Globe Load ₱50" />
          </div>

          {/* Price + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Price (₱)</Label>
              <Input type="number" value={form.price} onChange={e => update("price", e.target.value)} placeholder="50" />
            </div>
            <div>
              <Label>Category</Label>
              <select value={form.category} onChange={e => update("category", e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-lg">
                <option value="load">E-Load</option>
                <option value="sim">SIM Card</option>
                <option value="esim">eSIM</option>
              </select>
            </div>
          </div>

          {/* Network */}
          <div>
            <Label>Network</Label>
            <select value={form.network} onChange={e => update("network", e.target.value)}
              className="w-full h-10 px-3 border border-gray-200 rounded-lg">
              {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <textarea value={form.description} onChange={e => update("description", e.target.value)}
              placeholder="Product description" rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none" />
          </div>

          {/* Availability toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-900">Available for purchase</p>
              <p className="text-xs text-gray-500">When off, shows "Not Available" stamp</p>
            </div>
            <button onClick={() => update("is_active", !form.is_active)}
              className={`relative w-12 h-6 rounded-full transition ${form.is_active ? "bg-green-500" : "bg-gray-300"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.is_active ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          {/* Best Seller toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-900">Best Seller</p>
              <p className="text-xs text-gray-500">Shows a "BEST SELLER" badge on the product</p>
            </div>
            <button onClick={() => update("best_seller", !form.best_seller)}
              className={`relative w-12 h-6 rounded-full transition ${form.best_seller ? "bg-orange-500" : "bg-gray-300"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.best_seller ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          {/* Discount toggle + amount */}
          <div className="p-3 bg-gray-50 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Discount</p>
                <p className="text-xs text-gray-500">Shows a discount badge and % off the price</p>
              </div>
              <button onClick={() => update("has_discount", !form.has_discount)}
                className={`relative w-12 h-6 rounded-full transition ${form.has_discount ? "bg-red-500" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.has_discount ? "left-6" : "left-0.5"}`} />
              </button>
            </div>
            {form.has_discount && (
              <div>
                <Label>Discount Percent (%)</Label>
                <Input type="number" min="0" max="100" value={form.discount_percent} onChange={e => update("discount_percent", e.target.value)} placeholder="e.g. 20" />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          {isEditing ? (
            <button onClick={handleDelete} disabled={saving} className="text-red-500 hover:text-red-600 text-sm font-medium flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="border-gray-200">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Product"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
