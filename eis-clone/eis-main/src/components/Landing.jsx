import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LogIn, Smartphone, ShoppingCart, Zap, Shield } from "lucide-react";
import { Button } from "./ui";

const LOGO_URL = "https://media.base44.com/images/public/69f351e73d5a6169e8e9b7a5/82fc320ca_ChatGPTImageApr28202608_17_52PM.png";
const BG_URL = "https://media.base44.com/images/public/6a757d467583dc056bb9db29/acb40a8f7_pngtree-d-render-of-extruded-abstract-background-with-futuristic-black-and-gold-image_3711336.jpg";

const NETWORKS = ["Globe", "Smart", "TM", "TNT", "Sun", "DITO"];

const FEATURES = [
  { icon: Zap, title: "Instant E-Load", desc: "Buy prepaid load for any network in seconds — Globe, Smart, TM, TNT, Sun, and DITO." },
  { icon: Smartphone, title: "SIM Cards", desc: "Order brand new SIM cards delivered straight to your door." },
  { icon: ShoppingCart, title: "Wallet System", desc: "Top up your wallet via GCash and use it for fast, seamless checkout." },
  { icon: Shield, title: "Secure & Trusted", desc: "Your transactions are protected and your data is always safe with us." },
];

export default function Landing() {
  return (
    <div
      className="min-h-screen w-full text-white overflow-x-hidden relative"
      style={{
        backgroundImage: `linear-gradient(to bottom right, rgba(17,17,17,0.82), rgba(26,22,14,0.86)), url('${BG_URL}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Kabaro Load" className="w-10 h-10 rounded-xl object-cover" />
            <span className="font-bold text-xl">Kabaro Load</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/MemberLogin">
              <Button variant="ghost" className="text-white hover:text-amber-400 hover:bg-white/10">Log In</Button>
            </Link>
            <Link to="/Register">
              <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30">
                Sign Up <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-24 pb-16 px-4 sm:px-6 text-center relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[300px] sm:w-[600px] h-[150px] sm:h-[300px] bg-amber-500/20 rounded-full blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="flex justify-center mb-6">
            <img src={LOGO_URL} alt="Kabaro Load" className="w-24 h-24 rounded-2xl object-cover shadow-2xl" />
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold leading-tight mb-6">
            Buy Load & SIM Cards
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Online Anytime</span>
          </h1>
          <p className="text-gray-300 text-lg sm:text-xl mb-8 max-w-2xl mx-auto">
            The fastest way to buy prepaid load and SIM cards in the Philippines. All networks, instant delivery, GCash payment.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/Register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-base sm:text-lg px-8 py-5 shadow-xl shadow-amber-500/30 rounded-2xl">
                Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/MemberLogin" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-white text-gray-900 hover:bg-gray-100 text-base sm:text-lg px-8 py-5 rounded-2xl shadow-lg">
                Log In to Dashboard <LogIn className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Network badges */}
      <section className="py-8 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-4xl mx-auto flex flex-wrap justify-center gap-3"
        >
          {NETWORKS.map(n => (
            <span key={n} className="px-5 py-2 bg-white/10 border border-white/20 rounded-full text-sm font-semibold backdrop-blur-sm">
              {n}
            </span>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-center mb-12"
          >
            Why Choose Kabaro Load?
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <f.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 rounded-3xl p-10 text-center backdrop-blur-sm"
        >
          <h2 className="text-4xl font-bold mb-4">Ready to Buy Load?</h2>
          <p className="text-gray-300 text-lg mb-8">Create your free account and start buying load and SIM cards instantly.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/Register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-base sm:text-lg px-8 py-5 rounded-2xl shadow-xl shadow-amber-500/30">
                Create Free Account <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/MemberLogin" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 text-base sm:text-lg px-8 py-5 rounded-2xl">
                Already a Member?
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="py-8 px-4 border-t border-white/10 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Kabaro Load. All rights reserved.
      </footer>
    </div>
  );
}
