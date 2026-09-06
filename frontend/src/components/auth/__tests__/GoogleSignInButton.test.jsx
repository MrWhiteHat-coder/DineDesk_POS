import React from 'react';
import { findByTestId, click, render, flushAsync, unmountAll } from '../../../testUtils';
import GoogleSignInButton from '../GoogleSignInButton';

// The component's own loader is mocked so component tests can control
// load success/failure deterministically. Real-loader behaviour is tested
// separately with the actual module (jest.requireActual) below.
jest.mock('../../../lib/googleIdentity', () => ({
  GSI_SCRIPT_SRC: 'https://accounts.google.com/gsi/client',
  SDK_TIMEOUT_MS: 15000,
  ATTEMPT_TIMEOUT_MS: 5000,
  SDK_POLL_INTERVAL_MS: 150,
  MAX_SDK_ATTEMPTS: 3,
  hasGoogleIdentitySdk: jest.fn(),
  getGsiScriptTag: jest.fn(),
  ensureGsiScriptTag: jest.fn(),
  loadGoogleIdentityScript: jest.fn(),
}));

import { loadGoogleIdentityScript } from '../../../lib/googleIdentity';
const realLoader = jest.requireActual('../../../lib/googleIdentity');

const CLIENT_ID = 'test-client-123.apps.googleusercontent.com';

function installGoogleSdk() {
  const sdk = { credential: null };
  window.google = {
    accounts: {
      id: {
        initialize: jest.fn((config) => {
          sdk.credential = config.callback;
        }),
        renderButton: jest.fn(),
        prompt: jest.fn(),
      },
    },
  };
  sdk.googleWindow = window.google.accounts.id;
  return sdk;
}

describe('GoogleSignInButton — configuration', () => {
  test('requires an explicit client id (no hard-coded fallback)', async () => {
    const onError = jest.fn();
    const { container } = await render(<GoogleSignInButton clientId="" onSuccess={jest.fn()} onError={onError} />);
    expect(findByTestId(container, 'google-config-missing-btn')).toBeTruthy();
    expect(findByTestId(container, 'google-config-missing-note')).toBeTruthy();
    expect(loadGoogleIdentityScript).not.toHaveBeenCalled();

    await click(findByTestId(container, 'google-config-missing-btn'));
    expect(onError).toHaveBeenCalledWith('Google sign-in is not configured yet.');
  });

  test('shows loading placeholder while the SDK is being fetched', async () => {
    loadGoogleIdentityScript.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = await render(
      <GoogleSignInButton clientId={CLIENT_ID} onSuccess={jest.fn()} onError={jest.fn()} />
    );
    expect(findByTestId(container, 'google-loading')).toBeTruthy();
    expect(loadGoogleIdentityScript).toHaveBeenCalledTimes(1);
  });
});

describe('GoogleSignInButton — successful load', () => {
  beforeEach(() => {
    loadGoogleIdentityScript.mockReset();
    loadGoogleIdentityScript.mockResolvedValue(true);
  });

  test('initializes GIS with the configured client id and a callback', async () => {
    installGoogleSdk();
    const onSuccess = jest.fn();
    const { container } = await render(
      <GoogleSignInButton clientId={CLIENT_ID} onSuccess={onSuccess} onError={jest.fn()} />
    );
    await flushAsync();

    expect(window.google.accounts.id.initialize).toHaveBeenCalledTimes(1);
    const initArg = window.google.accounts.id.initialize.mock.calls[0][0];
    expect(initArg.client_id).toBe(CLIENT_ID);
    expect(typeof initArg.callback).toBe('function');
    expect(findByTestId(container, 'google-official-btn')).toBeTruthy();
  });

  test('renders the official branded button (renderButton, no programmatic click)', async () => {
    installGoogleSdk();
    const { container } = await render(
      <GoogleSignInButton clientId={CLIENT_ID} onSuccess={jest.fn()} onError={jest.fn()} />
    );
    await flushAsync();

    expect(window.google.accounts.id.renderButton).toHaveBeenCalledTimes(1);
    const [hostEl, options] = window.google.accounts.id.renderButton.mock.calls[0];
    expect(hostEl).toBe(findByTestId(container, 'google-official-btn'));
    expect(options.client_id).toBe(CLIENT_ID);
    expect(options.text).toBe('continue_with');
    // One Tap is never used for this flow
    expect(window.google.accounts.id.prompt).not.toHaveBeenCalled();
    expect(container.querySelector('[id="google-signin-btn"]')).toBeNull();
  });

  test('forwards the credential from the popup to onSuccess', async () => {
    const sdk = installGoogleSdk();
    const onSuccess = jest.fn();
    await render(<GoogleSignInButton clientId={CLIENT_ID} onSuccess={onSuccess} onError={jest.fn()} />);
    await flushAsync();

    sdk.credential({ credential: 'jwt-credential-abc', select_by: 'btn' });
    await flushAsync();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('jwt-credential-abc');
  });

  test('ignores a callback without a credential (dismissed/empty)', async () => {
    const sdk = installGoogleSdk();
    const onSuccess = jest.fn();
    await render(<GoogleSignInButton clientId={CLIENT_ID} onSuccess={onSuccess} onError={jest.fn()} />);
    await flushAsync();

    sdk.credential({});
    await flushAsync();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test('ignores stale callbacks that arrive after unmount/navigation', async () => {
    const sdk = installGoogleSdk();
    const onSuccess = jest.fn();
    await render(<GoogleSignInButton clientId={CLIENT_ID} onSuccess={onSuccess} onError={jest.fn()} />);
    await flushAsync();

    // Simulate the user navigating away before Google returns.
    await unmountAll();

    sdk.credential({ credential: 'late-jwt' });
    await flushAsync();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('GoogleSignInButton — SDK load failures', () => {
  test('shows an inline error and notifies onError when the SDK cannot load', async () => {
    installGoogleSdk();
    loadGoogleIdentityScript.mockReset();
    loadGoogleIdentityScript.mockResolvedValue(false);
    const onError = jest.fn();
    const { container } = await render(
      <GoogleSignInButton clientId={CLIENT_ID} onSuccess={jest.fn()} onError={onError} />
    );
    await flushAsync();

    expect(findByTestId(container, 'google-error')).toBeTruthy();
    expect(findByTestId(container, 'google-retry-btn')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test('does not show an indefinite spinner: error appears after load timeout', async () => {
    installGoogleSdk();
    loadGoogleIdentityScript.mockReset();
    loadGoogleIdentityScript.mockRejectedValue(new Error('Google sign-in is temporarily unavailable. Please try again.'));
    const { container } = await render(
      <GoogleSignInButton clientId={CLIENT_ID} onSuccess={jest.fn()} onError={jest.fn()} />
    );
    await flushAsync();

    expect(findByTestId(container, 'google-loading')).toBeNull();
    expect(findByTestId(container, 'google-error')).toBeTruthy();
  });

  test('"Try again" retries loading and can recover', async () => {
    installGoogleSdk();
    loadGoogleIdentityScript.mockReset();
    loadGoogleIdentityScript.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { container } = await render(
      <GoogleSignInButton clientId={CLIENT_ID} onSuccess={jest.fn()} onError={jest.fn()} />
    );
    await flushAsync();
    expect(findByTestId(container, 'google-error')).toBeTruthy();

    await click(findByTestId(container, 'google-retry-btn'));
    await flushAsync();

    expect(loadGoogleIdentityScript).toHaveBeenCalledTimes(2);
    expect(findByTestId(container, 'google-official-btn')).toBeTruthy();
  });
});

describe('googleIdentity SDK loader (real module)', () => {
  let spyAppend;

  // Jest 27 fake timers have no advanceTimersByTimeAsync — flush manually.
  async function advance(ms) {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    jest.useFakeTimers('modern');
    delete window.google;
    document.head.innerHTML = '';
    spyAppend = jest.spyOn(document.head, 'appendChild');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('returns immediately when the SDK is already present (no duplicate script tag)', async () => {
    window.google = { accounts: { id: { initialize: jest.fn() } } };
    const result = await realLoader.loadGoogleIdentityScript();
    expect(result).toBe(true);
    expect(spyAppend).not.toHaveBeenCalled();
  });

  test('injects the GIS script tag exactly once when the SDK is missing', async () => {
    const promise = realLoader.loadGoogleIdentityScript();
    // First attempt injects a script tag synchronously before any await.
    const tags = Array.from(document.querySelectorAll(`script[src="${realLoader.GSI_SCRIPT_SRC}"]`));
    expect(tags.length).toBe(1);
    window.google = { accounts: { id: { initialize: jest.fn() } } };
    await advance(realLoader.SDK_POLL_INTERVAL_MS); // first poll sees the SDK
    await expect(promise).resolves.toBe(true);
    expect(document.querySelectorAll(`script[src="${realLoader.GSI_SCRIPT_SRC}"]`).length).toBe(1);
  });

  test('retries and eventually gives up after the 15s budget with a false result', async () => {
    const step = realLoader.ATTEMPT_TIMEOUT_MS + realLoader.SDK_POLL_INTERVAL_MS;
    const injections = () =>
      spyAppend.mock.calls.filter(
        ([n]) => n.tagName === 'SCRIPT' && n.src === realLoader.GSI_SCRIPT_SRC
      ).length;
    const promise = realLoader.loadGoogleIdentityScript();
    await advance(step); // attempt 1 fails (first poll past its 5s deadline)
    expect(injections()).toBe(2); // initial + retry re-injection
    await advance(step); // attempt 2 fails → attempt 3 injects again
    expect(injections()).toBe(3);
    await advance(step); // attempt 3 fails → total ~15s budget
    await expect(promise).resolves.toBe(false);
    // No infinite retry loop: exactly MAX_SDK_ATTEMPTS script injections happened.
    expect(injections()).toBe(realLoader.MAX_SDK_ATTEMPTS);
  });

  test('recovers mid-retry once the SDK becomes available', async () => {
    const promise = realLoader.loadGoogleIdentityScript();
    await advance(realLoader.ATTEMPT_TIMEOUT_MS); // attempt 1 fails (microtask flushes after advance)
    window.google = { accounts: { id: { initialize: jest.fn() } } };
    await advance(realLoader.SDK_POLL_INTERVAL_MS); // attempt 2 sees the SDK
    await expect(promise).resolves.toBe(true);
  });
});
