import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./contexts/ThemeContext";
import { InstallPrompt, SWUpdateToast } from "./components/pwa/PWAComponents";

const root = ReactDOM.createRoot(document.getElementById("root"));

/* Splash handoff: fade the pre-React splash out the moment the app mounts. */
const dismissSplash = () => {
  const splash = document.getElementById("dd-splash");
  if (!splash) return;
  splash.style.transition = "opacity .45s ease";
  splash.style.opacity = "0";
  setTimeout(() => splash.remove(), 500);
};
setTimeout(dismissSplash, 250);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
      <InstallPrompt />
      <SWUpdateToast />
    </ThemeProvider>
  </React.StrictMode>,
);

// PWA: register the service worker so DineDesk is installable and keeps the
// app shell + last-known data (menu, tables) available offline. Dev server is
// skipped — caching there fights hot reload.
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL || ""}/sw.js`)
      .catch(() => { /* PWA is progressive enhancement — never block boot */ });
  });
}
