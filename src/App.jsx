import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { getSessionMemberId } from "./lib/auth";
import { useTable } from "./lib/useData";
import { CartProvider } from "./lib/CartContext";
import Layout from "./components/Layout";
import Landing from "./components/Landing";
import PublicShop from "./components/PublicShop";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import ShopHome from "./components/ShopHome";
import ProductDetail from "./components/ProductDetail";
import Wallet from "./components/Wallet";
import Orders from "./components/Orders";
import Profile from "./components/Profile";
import Admin from "./components/Admin";
import SuperAdminPanel from "./components/SuperAdminPanel";
import AdminPanel from "./components/AdminPanel";
import ResellerPanel from "./components/ResellerPanel";
import JoytelTest from "./components/JoytelTest";
import JoytelDealerLogin from "./components/JoytelDealerLogin";
import JoytelDashboard from "./components/JoytelDashboard";

const PAGES = {
  Dashboard, Products: ShopHome, Wallet, Orders, Profile, Admin,
  SuperAdminPanel, AdminPanel, ResellerPanel, JoytelTest, JoytelDealerLogin, JoytelDashboard,
};

function PageRouter() {
  const location = useLocation();
  const path = location.pathname.replace(/^\//, "").split("/")[0];
  const loggedIn = !!getSessionMemberId();
  const { data: members = [] } = useTable("members");
  const currentMemberId = getSessionMemberId();
  const currentMember = members.find(m => m.id === currentMemberId);
  const memberRole = currentMember?.role;
  const isDokAccount = currentMember?.username === "dok";

  // Public routes
  if (path === "" ) return <PublicShop />;
  if (path === "MemberLogin") return <Layout currentPageName="MemberLogin"><Login /></Layout>;
  if (path === "Register") return <Layout currentPageName="Register"><Register /></Layout>;

  // Product detail route: /Products/:id — public, no login required
  if (path.toLowerCase() === "products") {
    const parts = location.pathname.replace(/^\//, "").split("/");
    if (parts.length > 1 && parts[1]) {
      return <PublicShop><ProductDetail productId={parts[1]} /></PublicShop>;
    }
  }

  // Protected routes
  const pageKey = Object.keys(PAGES).find(k => k.toLowerCase() === path.toLowerCase());
  if (pageKey) {
    if (!loggedIn) return <Navigate to="/MemberLogin" replace />;

    // Role-based access for admin/superadmin/reseller panels
    const canAccessSuperAdmin = isDokAccount || memberRole === "super_admin";
    const canAccessAdmin = isDokAccount || memberRole === "super_admin" || memberRole === "admin";
    const canAccessReseller = isDokAccount || memberRole === "super_admin" || memberRole === "admin" || memberRole === "reseller";
    const canAccessJoytel = canAccessReseller; // admin, super_admin, reseller
    const panelAccess = {
      SuperAdminPanel: canAccessSuperAdmin,
      AdminPanel: canAccessAdmin,
      ResellerPanel: canAccessReseller,
      JoytelDashboard: canAccessJoytel,
      JoytelTest: canAccessJoytel,
      JoytelDealerLogin: canAccessJoytel,
    };
    if (pageKey in panelAccess && !panelAccess[pageKey]) {
      return <Navigate to="/Dashboard" replace />;
    }

    const PageComponent = PAGES[pageKey];
    return <Layout currentPageName={pageKey}><PageComponent /></Layout>;
  }

  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <CartProvider>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/*" element={<PageRouter />} />
      </Routes>
    </CartProvider>
  );
}
