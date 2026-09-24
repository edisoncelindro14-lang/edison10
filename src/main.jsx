import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles.css";

// Bust stale cached pages: if the deployed version changes, force a reload
const APP_VERSION = "2026-09-24-v1";
const storedVersion = localStorage.getItem("app_version");
if (storedVersion && storedVersion !== APP_VERSION) {
  localStorage.setItem("app_version", APP_VERSION);
  window.location.reload();
} else if (!storedVersion) {
  localStorage.setItem("app_version", APP_VERSION);
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);