/**
 * Google Identity Services (GIS) script loader.
 *
 * Loads https://accounts.google.com/gsi/client asynchronously with retries
 * and an overall 15-second timeout, so the UI never waits forever and never
 * crashes when the SDK is blocked or slow.
 */

export const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
export const SDK_TIMEOUT_MS = 15000;
export const ATTEMPT_TIMEOUT_MS = 5000;
export const SDK_POLL_INTERVAL_MS = 150;
export const MAX_SDK_ATTEMPTS = 3;

export function hasGoogleIdentitySdk() {
  return !!(
    typeof window !== 'undefined' &&
    window.google &&
    window.google.accounts &&
    window.google.accounts.id
  );
}

export function getGsiScriptTag() {
  if (typeof document === 'undefined') return null;
  return document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`);
}

export function ensureGsiScriptTag() {
  if (typeof document === 'undefined') return null;
  let tag = getGsiScriptTag();
  if (!tag) {
    tag = document.createElement('script');
    tag.src = GSI_SCRIPT_SRC;
    tag.async = true;
    tag.defer = true;
    tag.setAttribute('data-google-signin', 'true');
    document.head.appendChild(tag);
  }
  return tag;
}

function waitForSdk(timeoutMs) {
  return new Promise((resolve) => {
    if (hasGoogleIdentitySdk()) {
      resolve(true);
      return;
    }
    const startedAt = Date.now();
    const poll = () => {
      if (hasGoogleIdentitySdk()) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(poll, SDK_POLL_INTERVAL_MS);
    };
    setTimeout(poll, SDK_POLL_INTERVAL_MS);
  });
}

/**
 * Ensure the Google Identity SDK is available.
 * Returns true when window.google.accounts.id is ready, false on timeout.
 * Retries by re-injecting the script tag up to MAX_SDK_ATTEMPTS within a
 * total SDK_TIMEOUT_MS budget.
 */
export async function loadGoogleIdentityScript() {
  if (hasGoogleIdentitySdk()) return true;

  const deadline = Date.now() + SDK_TIMEOUT_MS;
  let attempt = 0;
  while (attempt < MAX_SDK_ATTEMPTS && Date.now() < deadline) {
    ensureGsiScriptTag();
    const remaining = Math.max(0, deadline - Date.now());
    const ok = await waitForSdk(Math.min(ATTEMPT_TIMEOUT_MS, remaining));
    if (ok) return true;
    attempt += 1;
    // Re-fetch the script on the next attempt in case the first download failed.
    if (attempt < MAX_SDK_ATTEMPTS) getGsiScriptTag()?.remove();
  }
  return false;
}
