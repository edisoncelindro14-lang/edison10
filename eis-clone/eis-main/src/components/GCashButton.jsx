import React, { useState } from "react";
import { Smartphone, Copy, Upload, Check } from "lucide-react";
import toast from "react-hot-toast";
import { useTable } from "../lib/useData";
import { getSessionMemberId } from "../lib/auth";
import { supabase } from "../lib/supabase";

export function GCashButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const memberId = getSessionMemberId();
  const { data: gcashInfo = [] } = useTable("gcash_info");
  const active = gcashInfo.find(g => g.is_active) || gcashInfo[0];

  if (!memberId || !active) return null;

  function copyNumber() {
    if (active.gcash_number) {
      navigator.clipboard.writeText(active.gcash_number);
      setCopied(true);
      toast.success("GCash number copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function uploadReceipt(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `receipts/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(fileName, file);
      let receiptUrl = fileName;
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(fileName);
        receiptUrl = urlData.publicUrl;
      }
      const memberName = "";
      await supabase.from("gcash_receipts").insert({
        member_id: memberId,
        member_name: memberName,
        receipt_url: receiptUrl,
        status: "pending",
      });
      toast.success("Receipt uploaded successfully!");
    } catch {
      toast.error("Failed to upload receipt");
    }
    setUploading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 left-4 right-auto lg:bottom-16 lg:left-auto lg:right-6 z-50 h-12 lg:h-14 pl-4 pr-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg lg:shadow-xl flex items-center gap-2 hover:scale-105 transition-transform"
        title="GCash Payment"
      >
        <Smartphone className="w-5 h-5 lg:w-6 lg:h-6" />
        <span className="font-bold text-sm tracking-wide">GCASH<span className="hidden lg:inline"> PAYMENT</span></span>
      </button>
      {open && (
        <div className="fixed bottom-20 left-4 right-auto lg:bottom-32 lg:left-auto lg:right-6 z-50 w-80 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="font-bold">GCash Payment</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">✕</button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Send payment to:</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 font-bold text-gray-900 text-lg">{active.gcash_number}</p>
                <button onClick={copyNumber} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{active.gcash_name}</p>
            </div>
            <label className="block">
              <input type="file" accept="image/*" onChange={uploadReceipt} className="hidden" />
              <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 cursor-pointer transition-all">
                <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload Receipt"}
              </div>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
