import React, { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../../contexts/AuthContext';
import LoginPage from '../LoginPage';
import { render, findByTestId, submitForm, typeText, flushAsync } from '../../../testUtils';

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../lib/api', () => ({
  authAPI: { login: jest.fn(), googleLogin: jest.fn() },
  restaurantAPI: { getMy: jest.fn() },
}));

import { toast } from 'sonner';
import { authAPI, restaurantAPI } from '../../../lib/api';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';

// Google SDK stub — the shared button initializes with a callback we capture,
// exactly like the real popup flow (button iframe is not clickable in jsdom).
let gsiCallback;
function installGoogleSdk() {
  gsiCallback = undefined;
  window.google = {
    accounts: {
      id: {
        initialize: jest.fn((config) => {
          gsiCallback = config.callback;
        }),
        renderButton: jest.fn(),
      },
    },
  };
}

function user(overrides) {
  return {
    id: 'u-1',
    email: 'owner@example.com',
    name: 'Owner',
    role: 'owner',
    restaurant_id: 'r-1',
    branch_id: null,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function restaurant(status) {
  return { id: 'r-1', name: 'Test Restaurant', subscription_status: status };
}

function tokenResponse(overrides = {}) {
  return { data: { access_token: 'tok-1', token_type: 'bearer', ...overrides } };
}

async function renderLoginPage() {
  const utils = await render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<div data-testid="page-onboarding">ONBOARDING</div>} />
          <Route path="/subscription" element={<div data-testid="page-subscription">SUBSCRIPTION</div>} />
          <Route path="/pos" element={<div data-testid="page-pos">POS</div>} />
          <Route path="/admin" element={<div data-testid="page-admin">ADMIN</div>} />
          <Route path="*" element={<div data-testid="page-missing">MISSING</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
  await flushAsync();
  return utils;
}

async function googleSignIn() {
  expect(gsiCallback).toBeTruthy();
  await act(async () => {
    gsiCallback({ credential: 'google-jwt-1', select_by: 'btn' });
  });
  await flushAsync();
}

describe('LoginPage — email sign-in preserved', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAPI.login.mockResolvedValue(tokenResponse({ user: user() }));
    restaurantAPI.getMy.mockResolvedValue({ data: restaurant('active') });
  });

  test('existing subscribed owner lands on /pos with a welcome toast', async () => {
    const { container } = await renderLoginPage();

    await typeText(findByTestId(container, 'login-email-input'), 'owner@example.com');
    await typeText(findByTestId(container, 'login-password-input'), 'secret123');
    await submitForm(container.querySelector('form'));
    await flushAsync();

    expect(authAPI.login).toHaveBeenCalledWith({ email: 'owner@example.com', password: 'secret123' });
    expect(findByTestId(container, 'page-pos')).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith('Welcome back!');
  });

  test('admin email login lands on /admin', async () => {
    authAPI.login.mockResolvedValue(tokenResponse({ user: user({ role: 'admin', restaurant_id: null }) }));
    const { container } = await renderLoginPage();

    await typeText(findByTestId(container, 'login-email-input'), 'demo@dinedesk.in');
    await typeText(findByTestId(container, 'login-password-input'), 'admin123');
    await submitForm(container.querySelector('form'));
    await flushAsync();

    expect(findByTestId(container, 'page-admin')).toBeTruthy();
  });

  test('new user (no restaurant) email login lands on /onboarding', async () => {
    authAPI.login.mockResolvedValue(tokenResponse({ user: user({ restaurant_id: null }) }));
    const { container } = await renderLoginPage();

    await typeText(findByTestId(container, 'login-email-input'), 'new@example.com');
    await typeText(findByTestId(container, 'login-password-input'), 'secret123');
    await submitForm(container.querySelector('form'));
    await flushAsync();

    expect(findByTestId(container, 'page-onboarding')).toBeTruthy();
  });

  test('bad credentials keep the failure visible (no page reload)', async () => {
    authAPI.login.mockRejectedValue({
      response: { status: 401, data: { detail: 'Invalid email or password' } },
    });
    const { container } = await renderLoginPage();

    await typeText(findByTestId(container, 'login-email-input'), 'wrong@example.com');
    await typeText(findByTestId(container, 'login-password-input'), 'nope');
    await submitForm(container.querySelector('form'));
    await flushAsync();

    expect(toast.error).toHaveBeenCalledWith('Invalid email or password');
    // Still on the login page — the form remains usable.
    expect(findByTestId(container, 'login-page')).toBeTruthy();
  });
});

describe('LoginPage — Google sign-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REACT_APP_GOOGLE_CLIENT_ID = CLIENT_ID;
    installGoogleSdk();
  });

  afterEach(() => {
    delete process.env.REACT_APP_GOOGLE_CLIENT_ID;
  });

  test('new Google user (no restaurant) lands on /onboarding', async () => {
    authAPI.googleLogin.mockResolvedValue(tokenResponse({ user: user({ restaurant_id: null }) }));
    const { container } = await renderLoginPage();

    await googleSignIn();

    expect(authAPI.googleLogin).toHaveBeenCalledWith('google-jwt-1');
    expect(findByTestId(container, 'page-onboarding')).toBeTruthy();
    expect(sessionStorage.getItem('token')).toBe('tok-1');
    expect(toast.success).toHaveBeenCalled();
  });

  test('existing subscribed Google owner lands on /pos', async () => {
    authAPI.googleLogin.mockResolvedValue(tokenResponse({ user: user() }));
    restaurantAPI.getMy.mockResolvedValue({ data: restaurant('active') });
    const { container } = await renderLoginPage();

    await googleSignIn();

    expect(findByTestId(container, 'page-pos')).toBeTruthy();
    expect(restaurantAPI.getMy).toHaveBeenCalledTimes(1);
  });

  test('unsubscribed Google owner lands on /subscription', async () => {
    authAPI.googleLogin.mockResolvedValue(tokenResponse({ user: user() }));
    restaurantAPI.getMy.mockResolvedValue({ data: restaurant('pending') });
    const { container } = await renderLoginPage();

    await googleSignIn();

    expect(findByTestId(container, 'page-subscription')).toBeTruthy();
  });

  test('Google admin lands on /admin', async () => {
    authAPI.googleLogin.mockResolvedValue(
      tokenResponse({ user: user({ role: 'admin', restaurant_id: null }) })
    );
    const { container } = await renderLoginPage();

    await googleSignIn();

    expect(findByTestId(container, 'page-admin')).toBeTruthy();
  });

  test('Google sign-in failure shows the error and stays on the login page', async () => {
    authAPI.googleLogin.mockRejectedValue({
      response: { status: 401, data: { detail: 'Invalid Google token' } },
    });
    const { container } = await renderLoginPage();

    await googleSignIn();
    await flushAsync();

    expect(toast.error).toHaveBeenCalledWith('Invalid Google token');
    expect(findByTestId(container, 'login-page')).toBeTruthy();
    expect(sessionStorage.getItem('token')).toBeNull();
    // No busy indicator left spinning after the failure.
    expect(findByTestId(container, 'google-busy')).toBeNull();
  });

  test('cancelled popup leaves the page idle — no indefinite spinner', async () => {
    authAPI.googleLogin.mockResolvedValue(tokenResponse({ user: user() }));
    restaurantAPI.getMy.mockResolvedValue({ data: restaurant('active') });
    const { container } = await renderLoginPage();
    await flushAsync();

    // A cancelled popup never invokes the credential callback.
    expect(findByTestId(container, 'google-busy')).toBeNull();
    expect(gsiCallback).toBeTruthy();
    // Button area remains interactive (no stuck spinner state).
    expect(findByTestId(container, 'google-official-btn')).toBeTruthy();
  });

  test('without a configured client id the page shows the not-configured state', async () => {
    delete process.env.REACT_APP_GOOGLE_CLIENT_ID;
    const { container } = await renderLoginPage();

    expect(findByTestId(container, 'google-config-missing-note')).toBeTruthy();
    expect(authAPI.googleLogin).not.toHaveBeenCalled();
  });
});
