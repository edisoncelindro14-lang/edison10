import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LogIn, Crown } from "lucide-react";
import { Button } from "./ui";

const STATS = [
  { label: "Active Members", value: "Growing" },
  { label: "Total Paid Out", value: "More" },
  { label: "Mamlakah Levels", value: "5 Levels" },
  { label: "Max Downlines", value: "10 Direct" },
];

const CROWN_URL = "https://media.base44.com/images/public/69f351e73d5a6169e8e9b7a5/8f5ae6bbe_Untitled11.png";
const LOGO_URL = "https://media.base44.com/images/public/69f351e73d5a6169e8e9b7a5/82fc320ca_ChatGPTImageApr28202608_17_52PM.png";
const BG_URL = "https://media.base44.com/images/public/6a757d467583dc056bb9db29/acb40a8f7_pngtree-d-render-of-extruded-abstract-background-with-futuristic-black-and-gold-image_3711336.jpg";

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
            <img src={LOGO_URL} alt="Mamlakah" className="w-10 h-10 rounded-xl object-cover" />
            <span className="font-bold text-xl">Mamlakah</span>
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
          <div className="flex flex-col items-center mb-6">
            <img src={CROWN_URL} alt="Mamlakah Community" className="w-56 sm:w-72 mb-4 drop-shadow-2xl" />
            <div className="bg-amber-500/10 border border-amber-400/40 rounded-2xl px-6 py-4 max-w-3xl text-center">
              <p className="text-amber-300 font-bold text-lg sm:text-2xl md:text-3xl leading-snug tracking-wide drop-shadow-lg">MATTHEW 6:33</p>
              <p className="text-amber-100 font-semibold italic text-base sm:text-xl md:text-2xl leading-relaxed mt-1">
                "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you."
              </p>
            </div>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold leading-tight mb-6">
            Build Your
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Mamlakah Empire</span>
          </h1>
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

      <section className="py-10 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {STATS.map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center backdrop-blur-sm">
              <p className="text-3xl font-bold text-amber-400">{s.value}</p>
              <p className="text-sm text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="py-20 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 rounded-3xl p-10 text-center backdrop-blur-sm"
        >
          <Crown className="w-14 h-14 text-amber-400 mx-auto mb-4" />
          <h2 className="text-4xl font-bold mb-4">Ready to Start Earning?</h2>
          <p className="text-gray-300 text-lg mb-8">Join hundreds of members already growing their mamlakah network and earning maintenance bonuses daily.</p>
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
        © {new Date().getFullYear()} Mamlakah. All rights reserved.
      </footer>
    </div>
  );
}
