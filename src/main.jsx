import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

// Bust stale cached pages: if the deployed version changes, force a reload
const APP_VERSION = "2026-09-11-v4";
const storedVersion = localStorage.getItem("app_version");
if (storedVersion && storedVersion !== APP_VERSION) {
  localStorage.setItem("app_version", APP_VERSION);
  window.location.reload();
} else if (!storedVersion) {
  localStorage.setItem("app_version", APP_VERSION);
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);