import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShoppingCart, User } from "lucide-react";
import ShopHome from "./ShopHome";
import Products from "./Products";
import { useCurrentMember, useTable } from "../lib/useData";

const LOGO_URL = "https://media.base44.com/images/public/6a9f6514819dc31adf1bfd4a/a5039a1c6_Firefly_removedotsthelogomustbethesamefromoriginal67432.png";

export default function PublicShop({ children }) {
  const [search, setSearch] = useState("");
  const { data: members = [] } = useTable("members");
  const { currentMember } = useCurrentMember(members);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img src={LOGO_URL} alt="Kabaro Shop" className="w-10 h-10 rounded-xl object-cover" />
            <span className="font-bold text-xl text-gray-900">Kabaro Shop</span>
          </Link>

          {/* Search bar (hidden on mobile) */}
          <div className="hidden md:flex flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products, categories..."
              className="w-full h-10 pl-10 pr-4 rounded-full border border-gray-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
            />
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {currentMember ? (
              <Link to="/Dashboard" className="flex items-center gap-1.5 text-gray-700 hover:text-indigo-600 font-medium text-sm">
                <User className="w-4 h-4" /> Account
              </Link>
            ) : (
              <>
                <Link to="/Register" className="hidden sm:inline px-4 py-2 rounded-xl border border-gray-200 hover:border-indigo-300 text-gray-700 font-semibold text-sm transition-colors">
                  Register
                </Link>
                <Link to="/MemberLogin" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors">
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Shop content or product detail */}
      {children || <ShopHome readOnly />}
    </div>
  );
}
