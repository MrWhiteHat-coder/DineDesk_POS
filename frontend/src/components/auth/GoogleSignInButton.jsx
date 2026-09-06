import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleIdentityScript } from '../../lib/googleIdentity';

/**
 * Shared official Google sign-in button (used on both Login and Register).
 *
 * - Renders the official `google.accounts.id.renderButton` iframe — no One Tap
 *   prompts, no hidden-container programmatic clicks.
 * - Loads the GIS SDK asynchronously with retries and a 15s timeout.
 * - Requires an explicit `clientId` prop; there is no hard-coded fallback.
 * - Ignores stale credential callbacks after navigation/unmount.
 * - Never starts an unbounded spinner: busy state is driven only by the
 *   parent while it exchanges the credential with our backend, and a
 *   cancelled popup simply never fires a callback.
 */

function GoogleLogo({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function GoogleSignInButton({
  clientId,
  onSuccess,
  onError,
  disabled = false,
  className = '',
}) {
  const [status, setStatus] = useState(clientId ? 'loading' : 'missing');
  const [attempt, setAttempt] = useState(0);
  const containerRef = useRef(null);
  const mountedRef = useRef(true);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load SDK, then initialize with the credential callback.
  useEffect(() => {
    if (!clientId) {
      setStatus('missing');
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');

    (async () => {
      const loaded = await loadGoogleIdentityScript();
      if (cancelled) return;
      if (!loaded || !window.google?.accounts?.id) {
        throw new Error('Google sign-in is temporarily unavailable. Please try again.');
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          // Stale callbacks after navigation/unmount are ignored.
          if (cancelled || !mountedRef.current) return;
          // Popup dismissed/cancelled → Google sends no callback at all.
          if (!response || !response.credential) return;
          onSuccessRef.current?.(response.credential);
        },
      });
      setStatus('ready');
    })().catch((err) => {
      if (cancelled) return;
      console.error('Google sign-in initialization failed:', err);
      setStatus('error');
      onErrorRef.current?.(err.message || 'Google sign-in failed to initialize.');
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, attempt]);

  // Render the official button once the SDK + container are ready.
  useEffect(() => {
    if (status !== 'ready' || !window.google?.accounts?.id) return undefined;
    const el = containerRef.current;
    if (!el) return undefined;
    if (el.querySelector('iframe')) return undefined;
    const width = Math.min(400, Math.max(200, el.clientWidth || 300));
    window.google.accounts.id.renderButton(el, {
      client_id: clientId,
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width,
    });
    return undefined;
  }, [status, clientId]);

  // No configured client id — tell the user instead of silently failing.
  if (status === 'missing' || !clientId) {
    return (
      <div className={className}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onErrorRef.current?.('Google sign-in is not configured yet.')}
          className="w-full h-11 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-semibold text-sm flex items-center justify-center gap-2.5 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-60"
          data-testid="google-config-missing-btn"
        >
          <GoogleLogo />
          Continue with Google
        </button>
        <p className="text-[11px] text-gray-400 text-center mt-2" data-testid="google-config-missing-note">
          Google sign-in is not configured for this environment yet.
        </p>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className={className}>
        <div
          className="w-full h-11 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-400 font-semibold text-sm flex items-center justify-center gap-2.5"
          data-testid="google-loading"
        >
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
          Loading Google Sign-In…
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={className}>
        <div
          className="w-full h-11 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-500 font-semibold text-sm flex items-center justify-center"
          data-testid="google-error"
        >
          Google sign-in failed to load.
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAttempt((a) => a + 1)}
          className="w-full text-xs text-gray-500 underline underline-offset-2 hover:text-gray-700 mt-2 text-center"
          data-testid="google-retry-btn"
        >
          Try again
        </button>
      </div>
    );
  }

  // Ready — official Google iframe button.
  return (
    <div
      ref={containerRef}
      className={`flex justify-center rounded-xl overflow-hidden bg-white border border-gray-200 ${className}`}
      data-testid="google-official-btn"
    />
  );
}
