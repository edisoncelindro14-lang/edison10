import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { getSessionMemberId } from "./lib/auth";
import Layout from "./components/Layout";
import Landing from "./components/Landing";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Products from "./components/Products";
import ProductDetail from "./components/ProductDetail";
import Wallet from "./components/Wallet";
import Orders from "./components/Orders";
import Profile from "./components/Profile";
import Admin from "./components/Admin";
import SuperAdminPanel from "./components/SuperAdminPanel";
import AdminPanel from "./components/AdminPanel";
import ResellerPanel from "./components/ResellerPanel";

const PAGES = {
  Dashboard, Products, Wallet, Orders, Profile, Admin,
  SuperAdminPanel, AdminPanel, ResellerPanel,
};

function PageRouter() {
  const location = useLocation();
  const path = location.pathname.replace(/^\//, "").split("/")[0];
  const loggedIn = !!getSessionMemberId();

  // Public routes
  if (path === "" ) return <Landing />;
  if (path === "MemberLogin") return <Layout currentPageName="MemberLogin"><Login /></Layout>;
  if (path === "Register") return <Layout currentPageName="Register"><Register /></Layout>;

  // Product detail route: /Products/:id
  if (path.toLowerCase() === "products") {
    const parts = location.pathname.replace(/^\//, "").split("/");
    if (parts.length > 1 && parts[1]) {
      if (!loggedIn) return <Navigate to="/MemberLogin" replace />;
      return <Layout currentPageName="Products"><ProductDetail /></Layout>;
    }
  }

  // Protected routes
  const pageKey = Object.keys(PAGES).find(k => k.toLowerCase() === path.toLowerCase());
  if (pageKey) {
    if (!loggedIn) return <Navigate to="/MemberLogin" replace />;
    const PageComponent = PAGES[pageKey];
    return <Layout currentPageName={pageKey}><PageComponent /></Layout>;
  }

  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/*" element={<PageRouter />} />
      </Routes>
    </>
  );
}
