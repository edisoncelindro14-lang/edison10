import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Radio, ExternalLink, AlertCircle, Camera, Loader2, Upload } from "lucide-react";
import { Button } from "./ui";
import { supabase } from "../lib/supabase";
import { getSessionMemberId } from "../lib/auth";
import { useTable } from "../lib/useData";
import { uploadToCloudinary } from "../lib/cloudinary";
import toast from "react-hot-toast";

const JOYTEL_PORTAL_URL = "https://www.joytelshop.com/#/login/pwd-login?redirect=/dashboard/workbench";

export default function JoytelDealerLogin() {
  const [iframeError, setIframeError] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const iframeRef = useRef(null);
  const fileInputRef = useRef(null);
  const { data: members = [] } = useTable("members");
  const memberId = getSessionMemberId();
  const currentMember = memberId ? members.find(m => m.id === memberId) : null;

  async function saveScreenshot(imageUrl) {
    const ts = Date.now();
    const { error } = await supabase.from("system_settings").insert({
      setting_key: `joytel_screenshot_${ts}`,
      setting_value: JSON.stringify({
        image: imageUrl,
        captured_by: currentMember?.username || "admin",
        title: `JoyTel Portal — ${new Date().toLocaleString()}`,
      }),
      description: `JoyTel dealer portal screenshot by ${currentMember?.username || "admin"}`,
    });
    if (error) throw error;
  }

  async function captureScreenshot() {
    // Mobile browsers don't support getDisplayMedia — show upload hint
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast("Screen capture not supported on this device. Use Upload Screenshot instead.", { icon: "📱" });
      return;
    }
    setCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        monitorTypeSurfaces: "exclude",
        systemAudio: "exclude",
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;

      await new Promise((resolve) => {
        video.onloadeddata = resolve;
        video.play();
      });

      // Full capture
      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = video.videoWidth;
      fullCanvas.height = video.videoHeight;
      const fullCtx = fullCanvas.getContext("2d");
      fullCtx.drawImage(video, 0, 0);

      // Stop stream immediately
      stream.getTracks().forEach(t => t.stop());

      // Get iframe position relative to the viewport
      const iframe = iframeRef.current;
      const rect = iframe ? iframe.getBoundingClientRect() : null;

      let finalCanvas;
      if (rect && rect.width > 0 && rect.height > 0) {
        // Scale factor: video pixels per CSS pixel
        const scaleX = fullCanvas.width / window.innerWidth;
        const scaleY = fullCanvas.height / window.innerHeight;

        const cropX = Math.max(0, rect.left * scaleX);
        const cropY = Math.max(0, rect.top * scaleY);
        const cropW = Math.min(fullCanvas.width - cropX, rect.width * scaleX);
        const cropH = Math.min(fullCanvas.height - cropY, rect.height * scaleY);

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext("2d");
        cropCtx.drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // Resize if too wide
        const maxW = 1280;
        if (cropCanvas.width > maxW) {
          const scale = maxW / cropCanvas.width;
          const resized = document.createElement("canvas");
          resized.width = maxW;
          resized.height = cropCanvas.height * scale;
          resized.getContext("2d").drawImage(cropCanvas, 0, 0, maxW, resized.height);
          finalCanvas = resized;
        } else {
          finalCanvas = cropCanvas;
        }
      } else {
        finalCanvas = fullCanvas;
      }

      const blob = await new Promise((resolve) =>
        finalCanvas.toBlob(resolve, "image/jpeg", 0.8)
      );
      if (!blob) throw new Error("Failed to create screenshot image");
      const imageUrl = await uploadToCloudinary(blob, "joytel-screenshots");
      await saveScreenshot(imageUrl);
      toast.success("Screenshot saved to Admin & Reseller panels!");
    } catch (err) {
      if (err.name === "NotAllowedError") {
        toast.error("Screen capture cancelled. Try Upload Screenshot instead.");
      } else {
        console.error("Screenshot error:", err);
        toast.error("Failed to capture. Try Upload Screenshot instead.");
      }
    } finally {
      setCapturing(false);
    }
  }

  // Upload a screenshot from phone gallery (works on all devices)
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await uploadToCloudinary(file, "joytel-screenshots");
      await saveScreenshot(imageUrl);
      toast.success("Screenshot uploaded & saved!");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload screenshot");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function triggerUpload() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">JoyTel Dealer Portal</h1>
              <p className="text-gray-500">Log in with your real JoyTel dealer account to manage orders & inventory</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={captureScreenshot} disabled={capturing} className="bg-blue-600 hover:bg-blue-700 text-white">
              {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {capturing ? "Saving..." : "Screenshot"}
            </Button>
            <Button onClick={triggerUpload} disabled={uploading} variant="outline" className="border-blue-300 text-blue-700">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading..." : "Upload"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <a href={JOYTEL_PORTAL_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-blue-300 text-blue-700">
                <ExternalLink className="w-4 h-4" /> Open in New Tab
              </Button>
            </a>
          </div>
        </div>
      </motion.div>

      {/* Mobile hint */}
      <div className="sm:hidden bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-center">
        <p className="text-xs text-blue-700">
          📱 On phone: take a screenshot using your phone's buttons, then tap <strong>Upload</strong> to save it.
        </p>
      </div>

      {iframeError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-2">The JoyTel portal can't be displayed inline.</p>
          <p className="text-gray-500 text-sm mb-4">Click below to open it in a new tab.</p>
          <a href={JOYTEL_PORTAL_URL} target="_blank" rel="noopener noreferrer">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <ExternalLink className="w-4 h-4" /> Open JoyTel Portal
            </Button>
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <span className="text-sm text-gray-500 ml-2">www.joytelshop.com</span>
            <span className="text-xs text-blue-500 ml-auto flex items-center gap-1">
              <Camera className="w-3 h-3" /> Screenshot or Upload
            </span>
          </div>
          <iframe
            ref={iframeRef}
            src={JOYTEL_PORTAL_URL}
            title="JoyTel Dealer Login"
            className="w-full"
            style={{ height: "75vh", border: "none" }}
            referrerPolicy="no-referrer-when-downgrade"
            allow="clipboard-read; clipboard-write; fullscreen"
            onError={() => setIframeError(true)}
          />
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4 text-center">
        Use your real JoyTel credentials. On desktop, click <strong>Screenshot</strong> to capture only the JoyTel window.
        On phone, take a screenshot then tap <strong>Upload</strong>.
      </p>
    </div>
  );
}
