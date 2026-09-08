import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { getSessionMemberId } from "./lib/auth";
import Layout from "./components/Layout";
import Landing from "./components/Landing";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Genealogy from "./components/Genealogy";
import Earnings from "./components/Earnings";
import Monitoring from "./components/Monitoring";
import LevelBonuses from "./components/LevelBonuses";
import Profile from "./components/Profile";
import Admin from "./components/Admin";
import SubAdmin from "./components/SubAdmin";

const PAGES = {
  Dashboard, Genealogy, Earnings, Monitoring, LevelBonuses, Profile, Admin, SubAdmin,
};

function PageRouter() {
  const location = useLocation();
  const path = location.pathname.replace(/^\//, "").split("/")[0];
  const loggedIn = !!getSessionMemberId();

  // Public routes
  if (path === "" ) return <Landing />;
  if (path === "MemberLogin") return <Layout currentPageName="MemberLogin"><Login /></Layout>;
  if (path === "Register") return <Layout currentPageName="Register"><Register /></Layout>;

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
