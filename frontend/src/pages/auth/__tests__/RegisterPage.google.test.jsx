import React, { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../../contexts/AuthContext';
import RegisterPage from '../RegisterPage';
import { render, findByTestId, submitForm, typeText, flushAsync } from '../../../testUtils';

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../lib/api', () => ({
  authAPI: { login: jest.fn(), googleLogin: jest.fn(), register: jest.fn(), resendVerification: jest.fn() },
  restaurantAPI: { getMy: jest.fn() },
}));

import { toast } from 'sonner';
import { authAPI, restaurantAPI } from '../../../lib/api';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';

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

async function renderRegisterPage() {
  const utils = await render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div data-testid="page-login">LOGIN</div>} />
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

async function googleSignUp() {
  expect(gsiCallback).toBeTruthy();
  await act(async () => {
    gsiCallback({ credential: 'google-jwt-1', select_by: 'btn' });
  });
  await flushAsync();
}

function fillRegisterForm(container) {
  const inputs = container.querySelectorAll('input');
  return {
    name: inputs[0],
    email: inputs[1],
    phone: inputs[2],
    password: inputs[3],
    confirm: inputs[4],
  };
}

describe('RegisterPage — Google sign-up', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REACT_APP_GOOGLE_CLIENT_ID = CLIENT_ID;
    installGoogleSdk();
  });

  afterEach(() => {
    delete process.env.REACT_APP_GOOGLE_CLIENT_ID;
  });

  test('brand-new Google user lands on /onboarding and the session is stored', async () => {
    authAPI.googleLogin.mockResolvedValue(tokenResponse({ user: user({ restaurant_id: null }) }));
    const { container } = await renderRegisterPage();

    await googleSignUp();

    expect(authAPI.googleLogin).toHaveBeenCalledWith('google-jwt-1');
    expect(findByTestId(container, 'page-onboarding')).toBeTruthy();
    expect(sessionStorage.getItem('token')).toBe('tok-1');
    expect(JSON.parse(sessionStorage.getItem('user')).role).toBe('owner');
    expect(toast.success).toHaveBeenCalled();
  });

  test('admin signing up through Google lands on /admin (not onboarding)', async () => {
    authAPI.googleLogin.mockResolvedValue(
      tokenResponse({ user: user({ role: 'admin', restaurant_id: null }) })
    );
    const { container } = await renderRegisterPage();

    await googleSignUp();

    expect(findByTestId(container, 'page-admin')).toBeTruthy();
  });

  test('existing subscribed owner signing in via the register page lands on /pos', async () => {
    authAPI.googleLogin.mockResolvedValue(tokenResponse({ user: user() }));
    restaurantAPI.getMy.mockResolvedValue({ data: restaurant('active') });
    const { container } = await renderRegisterPage();

    await googleSignUp();

    expect(findByTestId(container, 'page-pos')).toBeTruthy();
  });

  test('unsubscribed owner signing in via the register page lands on /subscription', async () => {
    authAPI.googleLogin.mockResolvedValue(tokenResponse({ user: user() }));
    restaurantAPI.getMy.mockResolvedValue({ data: restaurant('pending') });
    const { container } = await renderRegisterPage();

    await googleSignUp();

    expect(findByTestId(container, 'page-subscription')).toBeTruthy();
  });

  test('Google sign-up failure is shown and no session is created', async () => {
    authAPI.googleLogin.mockRejectedValue({
      response: { status: 500, data: { detail: 'Google authentication failed' } },
    });
    const { container } = await renderRegisterPage();

    await googleSignUp();
    await flushAsync();

    expect(toast.error).toHaveBeenCalledWith('Google authentication failed');
    expect(findByTestId(container, 'register-page')).toBeTruthy();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(findByTestId(container, 'google-busy')).toBeNull();
  });

  test('cancelled popup does not leave the page spinning', async () => {
    const { container } = await renderRegisterPage();
    await flushAsync();

    expect(findByTestId(container, 'google-busy')).toBeNull();
    expect(gsiCallback).toBeTruthy();
  });
});

describe('RegisterPage — email registration preserved', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('auto-login registration publishes the session and goes to /onboarding', async () => {
    authAPI.register.mockResolvedValue(tokenResponse({ user: user({ restaurant_id: null }) }));
    const { container } = await renderRegisterPage();
    const f = fillRegisterForm(container);

    await typeText(f.name, 'New Owner');
    await typeText(f.email, 'new@example.com');
    await typeText(f.phone, '+919876543210');
    await typeText(f.password, 'secret123');
    await typeText(f.confirm, 'secret123');
    await submitForm(container.querySelector('form'));
    await flushAsync();

    expect(authAPI.register).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('token')).toBe('tok-1');
    expect(findByTestId(container, 'page-onboarding')).toBeTruthy();
  });

  test('verification-mode registration (no token) shows the check-email screen', async () => {
    authAPI.register.mockResolvedValue({ data: { message: 'Verification email sent', email: 'new@example.com' } });
    const { container } = await renderRegisterPage();
    const f = fillRegisterForm(container);

    await typeText(f.name, 'New Owner');
    await typeText(f.email, 'new@example.com');
    await typeText(f.phone, '+919876543210');
    await typeText(f.password, 'secret123');
    await typeText(f.confirm, 'secret123');
    await submitForm(container.querySelector('form'));
    await flushAsync();

    expect(findByTestId(container, 'register-page').textContent).toContain('Check your email');
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  test('password mismatch is rejected client-side without an API call', async () => {
    const { container } = await renderRegisterPage();
    const f = fillRegisterForm(container);

    await typeText(f.name, 'New Owner');
    await typeText(f.email, 'new@example.com');
    await typeText(f.phone, '+919876543210');
    await typeText(f.password, 'secret123');
    await typeText(f.confirm, 'secret999');
    await submitForm(container.querySelector('form'));
    await flushAsync();

    expect(toast.error).toHaveBeenCalledWith('Passwords do not match');
    expect(authAPI.register).not.toHaveBeenCalled();
  });

  test('already-registered email shows the backend detail and links to login', async () => {
    authAPI.register.mockRejectedValue({
      response: { status: 400, data: { detail: 'Email already registered' } },
    });
    const { container } = await renderRegisterPage();
    const f = fillRegisterForm(container);

    await typeText(f.name, 'New Owner');
    await typeText(f.email, 'taken@example.com');
    await typeText(f.phone, '+919876543210');
    await typeText(f.password, 'secret123');
    await typeText(f.confirm, 'secret123');
    await submitForm(container.querySelector('form'));
    await flushAsync();

    expect(toast.error).toHaveBeenCalledWith('Email already registered');
    expect(findByTestId(container, 'register-page')).toBeTruthy();
  });
});
