import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, LayoutDashboard, ExternalLink } from "lucide-react";
import { Button } from "./ui";

export default function PaymentRedirect() {
  const location = useLocation();
  const nav = useNavigate();
  const checkoutUrl = location.state?.checkout_url;
  const redirected = useRef(false);

  useEffect(() => {
    if (!checkoutUrl) return;
    const timer = setTimeout(() => {
      if (!redirected.current) {
        redirected.current = true;
        window.location.href = checkoutUrl;
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [checkoutUrl]);

  if (!checkoutUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">No Payment Session</h1>
          <p className="text-gray-600 mb-6">We couldn't find a payment link. Please try again from the shop.</p>
          <Button onClick={() => nav("/Dashboard")} className="bg-orange-500 hover:bg-orange-600 text-white">
            <LayoutDashboard className="w-5 h-5 mr-2" /> Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md w-full">
        <motion.div
          initial={{ scale: 0.8 }} animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl mx-auto mb-6 flex items-center justify-center"
        >
          <ShieldCheck className="w-10 h-10 text-white" />
        </motion.div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Redirecting to Secure Payment</h1>
        <p className="text-gray-600 mb-8">You'll be redirected to our payment partner (PayMongo) to complete your purchase securely.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => { redirected.current = true; nav("/Dashboard"); }} variant="outline" className="border-gray-300">
            <LayoutDashboard className="w-5 h-5 mr-2" /> Back to Dashboard
          </Button>
          <Button onClick={() => { redirected.current = true; window.location.href = checkoutUrl; }} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
            <ExternalLink className="w-5 h-5 mr-2" /> Pay Now
          </Button>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
          Redirecting automatically...
        </div>
      </motion.div>
    </div>
  );
}
