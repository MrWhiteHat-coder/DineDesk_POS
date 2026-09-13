import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

/**
 * Captures the browser's native install prompt (Android Chrome fires this for
 * PWA-eligible apps) and surfaces a calm in-app banner. Clicking it triggers
 * the OS install dialog → DineDesk lands on the home screen as an app.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('dd-install-dismissed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const install = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    try { localStorage.setItem('dd-install-dismissed', '1'); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[90] flex items-center gap-3 rounded-2xl bg-[#0F2417] text-white p-4 shadow-2xl animate-fade-in"
      data-testid="install-prompt"
      role="dialog"
      aria-label="Install DineDesk app"
    >
      <img src="/pwa-icon-192.png" alt="" width="40" height="40" className="rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Install DineDesk</p>
        <p className="text-xs text-white/70 mt-0.5">Full-screen app on this device. Works even offline.</p>
      </div>
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2E9E5B] text-white text-xs font-bold hover:brightness-110 transition-all flex-shrink-0"
        data-testid="install-confirm-btn"
      >
        <Download className="w-3.5 h-3.5" /> Install
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4 text-white/70" />
      </button>
    </div>
  );
}

/**
 * Shows a gentle toast when a new service worker version is waiting. The SW
 * calls skipWaiting() on install, so this only appears for tabs opened before
 * a deploy — tapping reloads into the fresh version.
 */
export function SWUpdateToast() {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onControllerChange = () => {
      // A new SW took control after skipWaiting — offer a reload to pick up
      // the new assets (the old tab may still be running stale chunks).
      if (navigator.serviceWorker.controller) setWaiting(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  if (!waiting) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[90] flex items-center gap-3 rounded-2xl bg-white dark:bg-[#142B1D] border border-[#DCEDDF] dark:border-white/10 p-4 shadow-2xl animate-fade-in"
      data-testid="sw-update-toast"
      role="alert"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Update available</p>
        <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">Refresh to get the latest DineDesk.</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2E9E5B] text-white text-xs font-bold hover:brightness-110 transition-all flex-shrink-0"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Reload
      </button>
      <button
        onClick={() => setWaiting(false)}
        aria-label="Dismiss update toast"
        className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}
