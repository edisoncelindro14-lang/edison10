import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, GitBranch, Users, Wallet, Layers, User, Shield, LogOut, Menu, X, ChevronRight } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { clearMemberSession, getSessionMemberId } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { MaintenanceBanner } from "./MaintenanceBanner";
import { GCashButton } from "./GCashButton";

const LOGO_URL = "https://media.base44.com/images/public/69f351e73d5a6169e8e9b7a5/82fc320ca_ChatGPTImageApr28202608_17_52PM.png";

const NAV_ITEMS = [
  { name: "Dashboard", icon: LayoutDashboard, path: "Dashboard" },
  { name: "Mamlakah Tree", icon: GitBranch, path: "Genealogy" },
  { name: "1st Level Monitoring", icon: Users, path: "Monitoring" },
  { name: "Total Withdrawal", icon: Wallet, path: "Earnings" },
  { name: "Mamlakah ComPlan", icon: Layers, path: "LevelBonuses" },
  { name: "My Profile", icon: User, path: "Profile" },
];
const ADMIN_ITEMS = [{ name: "Admin Panel", icon: Shield, path: "Admin" }];
const SUBADMIN_ITEMS = [{ name: "Sub-Admin Panel", icon: Shield, path: "SubAdmin" }];

function navPath(path) {
  return "/" + path;
}

export default function Layout({ children, currentPageName }) {
  const nav = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: members = [] } = useTable("members");
  const { data: settings = [], refetch: refetchSettings } = useTable("system_settings");
  const memberId = getSessionMemberId();
  const member = memberId ? members.find(m => m.id === memberId) : null;

  // Real-time update: refetch settings when system_settings changes (e.g. admin toggles tab visibility)
  useEffect(() => {
    const channel = supabase
      .channel("system_settings_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, () => refetchSettings())
      .subscribe();
    // Polling fallback in case realtime is not enabled
    const interval = setInterval(() => refetchSettings(), 3000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [refetchSettings]);

  const settingsMap = {};
  settings.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });
  const showMonitoring = settingsMap.tab_monitoring_visible !== "false";
  const showSubAdmin = settingsMap.tab_subadmin_visible !== "false";
  const showComPlan = settingsMap.tab_complan_visible !== "false";

  const isAdmin = member?.role === "admin";
  const isSubAdmin = member?.role === "sub_admin";

  let items = NAV_ITEMS.filter(item => {
    if (item.path === "Monitoring") return showMonitoring;
    if (item.path === "LevelBonuses") return showComPlan;
    return true;
  });
  if (isAdmin) items = [...items, ...ADMIN_ITEMS];
  if (isSubAdmin) items = [...items, ...SUBADMIN_ITEMS];
  if (isAdmin || showSubAdmin) {
    if (!isSubAdmin && !isAdmin) {
      // no sub-admin for regular members
    }
  }

  function handleLogout() {
    clearMemberSession();
    nav("/MemberLogin");
  }

  if (currentPageName === "Register" || currentPageName === "MemberLogin") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-amber-50">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-gray-100 z-50 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Mamlakah" className="w-10 h-10 rounded-xl object-cover" />
          <span className="font-bold text-xl text-gray-900">Mamlakah</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-100 flex-col z-40">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Mamlakah" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <p className="font-bold text-xl text-gray-900">Mamlakah</p>
              <p className="text-xs text-gray-500">Mamlakah Network System</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {items.map(item => {
            const Icon = item.icon;
            const active = currentPageName === item.path;
            return (
              <Link key={item.path} to={navPath(item.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
                {active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-bold">
              {(member?.username || "U").charAt(0).toUpperCase()}
            </div>
            <p className="font-medium text-gray-900 truncate flex-1">{member?.username || "Member"}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-gray-600 hover:text-red-600 hover:bg-red-50 font-medium transition-all">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/50 z-50 lg:hidden" />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-white z-50 lg:hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={LOGO_URL} alt="Mamlakah" className="w-10 h-10 rounded-xl object-cover" />
                  <span className="font-bold text-xl text-gray-900">Mamlakah</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {items.map(item => {
                  const Icon = item.icon;
                  const active = currentPageName === item.path;
                  return (
                    <Link key={item.path} to={navPath(item.path)} onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                    {(member?.username || "U").charAt(0).toUpperCase()}
                  </div>
                  <p className="font-medium text-gray-900 truncate flex-1">{member?.username || "Member"}</p>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-gray-600 hover:text-red-600 hover:bg-red-50 font-bold transition-all">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <MaintenanceBanner />
        {children}
        <GCashButton />
      </main>
    </div>
  );
}
