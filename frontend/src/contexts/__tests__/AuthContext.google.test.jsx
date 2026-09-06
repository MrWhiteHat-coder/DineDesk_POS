import React from 'react';
import { act } from 'react';
import { render, findByTestId, click, flushAsync } from '../../testUtils';
import { AuthProvider, useAuth, getPostAuthPath } from '../AuthContext';

jest.mock('../../lib/api', () => ({
  authAPI: {
    login: jest.fn(),
    googleLogin: jest.fn(),
    register: jest.fn(),
  },
  restaurantAPI: {
    getMy: jest.fn(),
  },
}));

import { authAPI, restaurantAPI } from '../../lib/api';

const GOOGLE_USER_BASE = {
  id: 'u-google-1',
  email: 'chef@gmail.com',
  name: 'Chef Gmail',
  role: 'owner',
  branch_id: null,
  created_at: '2025-01-01T00:00:00Z',
};

function apiOk(data) {
  return { data };
}

function Probe({ onReady }) {
  const auth = useAuth();
  React.useEffect(() => {
    if (onReady) onReady(auth);
  });
  return (
    <div>
      <div data-testid="probe-state">
        {JSON.stringify({
          loading: auth.loading,
          isAuthenticated: auth.isAuthenticated,
          isAdmin: auth.isAdmin,
          hasRestaurant: auth.hasRestaurant,
          isSubscribed: auth.isSubscribed,
          user: auth.user,
          restaurant: auth.restaurant,
        })}
      </div>
      <button data-testid="google-login" onClick={() => auth.googleLogin('jwt-google')}>
        Google
      </button>
      <button data-testid="email-login" onClick={() => auth.login('a@b.c', 'pw')}>
        Email
      </button>
      <button data-testid="logout" onClick={auth.logout}>
        Logout
      </button>
    </div>
  );
}

async function renderProbe(onReady) {
  const utils = await render(
    <AuthProvider>
      <Probe onReady={onReady} />
    </AuthProvider>
  );
  await flushAsync();
  return utils;
}

function stateOf(container) {
  return JSON.parse(findByTestId(container, 'probe-state').textContent);
}

describe('AuthContext.googleLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('publishes the session into React state AND sessionStorage for a new Google user', async () => {
    const newUser = { ...GOOGLE_USER_BASE, restaurant_id: null };
    authAPI.googleLogin.mockResolvedValueOnce(
      apiOk({ access_token: 'tok-new', token_type: 'bearer', user: newUser })
    );

    const { container } = await renderProbe();
    await click(findByTestId(container, 'google-login'));
    await flushAsync();

    const state = stateOf(container);
    expect(state.isAuthenticated).toBe(true);
    expect(state.hasRestaurant).toBe(false);
    expect(state.user.email).toBe('chef@gmail.com');
    expect(state.user.restaurant_id).toBeNull();

    expect(sessionStorage.getItem('token')).toBe('tok-new');
    expect(JSON.parse(sessionStorage.getItem('user')).id).toBe('u-google-1');

    // No restaurant fetch for users without a restaurant.
    expect(restaurantAPI.getMy).not.toHaveBeenCalled();
  });

  test('fetches restaurant/subscription details before returning for an existing owner', async () => {
    const existingOwner = { ...GOOGLE_USER_BASE, restaurant_id: 'r-42' };
    authAPI.googleLogin.mockResolvedValueOnce(
      apiOk({ access_token: 'tok-owner', token_type: 'bearer', user: existingOwner })
    );
    restaurantAPI.getMy.mockResolvedValueOnce(
      apiOk({ id: 'r-42', name: 'Biryani House', subscription_status: 'active' })
    );

    // Capture the resolved value of googleLogin to prove restaurant data is
    // loaded before the promise settles.
    let resolved;
    let authRef;
    authRef = null;
    const { container } = await renderProbe((auth) => {
      authRef = auth;
    });
    await act(async () => {
      resolved = await authRef.googleLogin('jwt-google');
    });

    expect(restaurantAPI.getMy).toHaveBeenCalledTimes(1);
    const state = stateOf(container);
    expect(state.hasRestaurant).toBe(true);
    expect(state.isSubscribed).toBe(true);
    expect(state.restaurant.name).toBe('Biryani House');
    expect(resolved.restaurant.subscription_status).toBe('active');
    expect(resolved.user.restaurant_id).toBe('r-42');
  });

  test('unsubscribed owners keep a session with isSubscribed=false', async () => {
    const existingOwner = { ...GOOGLE_USER_BASE, restaurant_id: 'r-7' };
    authAPI.googleLogin.mockResolvedValueOnce(
      apiOk({ access_token: 'tok', token_type: 'bearer', user: existingOwner })
    );
    restaurantAPI.getMy.mockResolvedValueOnce(
      apiOk({ id: 'r-7', subscription_status: 'pending' })
    );

    const { container } = await renderProbe();
    await click(findByTestId(container, 'google-login'));
    await flushAsync();

    const state = stateOf(container);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isSubscribed).toBe(false);
  });

  test('a failed restaurant fetch does not break the Google login session', async () => {
    const existingOwner = { ...GOOGLE_USER_BASE, restaurant_id: 'r-9' };
    authAPI.googleLogin.mockResolvedValueOnce(
      apiOk({ access_token: 'tok', token_type: 'bearer', user: existingOwner })
    );
    restaurantAPI.getMy.mockRejectedValueOnce(new Error('network down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = await renderProbe();
    await click(findByTestId(container, 'google-login'));
    await flushAsync();

    const state = stateOf(container);
    expect(state.isAuthenticated).toBe(true);
    expect(sessionStorage.getItem('token')).toBe('tok');
    consoleSpy.mockRestore();
  });

  test('failed Google token exchange leaves no session behind and rethrows', async () => {
    authAPI.googleLogin.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), {
        response: { status: 401, data: { detail: 'Invalid Google token' } },
      })
    );

    let authRef;
    const { container } = await renderProbe((auth) => {
      authRef = auth;
    });

    await act(async () => {
      await expect(authRef.googleLogin('bad-cred')).rejects.toMatchObject({
        response: { status: 401 },
      });
    });

    const state = stateOf(container);
    expect(state.isAuthenticated).toBe(false);
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
  });
});

describe('AuthContext — email flows still work unchanged', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('email login still stores token/user and updates state', async () => {
    const owner = { ...GOOGLE_USER_BASE, email: 'demo@restaurant.com', restaurant_id: 'r-1' };
    authAPI.login.mockResolvedValueOnce(apiOk({ access_token: 'tok-mail', user: owner }));
    restaurantAPI.getMy.mockResolvedValueOnce(apiOk({ id: 'r-1', subscription_status: 'active' }));

    const { container } = await renderProbe();
    await click(findByTestId(container, 'email-login'));
    await flushAsync();

    const state = stateOf(container);
    expect(state.isAuthenticated).toBe(true);
    expect(sessionStorage.getItem('token')).toBe('tok-mail');
    expect(state.restaurant.subscription_status).toBe('active');
  });

  test('logout clears storage and React state', async () => {
    const owner = { ...GOOGLE_USER_BASE, restaurant_id: 'r-1' };
    authAPI.googleLogin.mockResolvedValueOnce(apiOk({ access_token: 'tok', user: owner }));
    restaurantAPI.getMy.mockResolvedValueOnce(apiOk({ id: 'r-1', subscription_status: 'active' }));

    const { container } = await renderProbe();
    await click(findByTestId(container, 'google-login'));
    await flushAsync();
    expect(stateOf(container).isAuthenticated).toBe(true);

    await click(findByTestId(container, 'logout'));
    await flushAsync();

    const state = stateOf(container);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.restaurant).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });
});

describe('getPostAuthPath routing helper', () => {
  test('maps every post-auth state to the correct route', () => {
    const subscribed = { id: 'r-1', subscription_status: 'active' };
    const pendingSub = { id: 'r-1', subscription_status: 'pending' };

    expect(getPostAuthPath({ role: 'admin', restaurant_id: null }, null)).toBe('/admin');
    // Admin signed up through Google — restaurant still absent.
    expect(getPostAuthPath({ role: 'admin', restaurant_id: 'r-9' }, subscribed)).toBe('/admin');
    // New Google user without a restaurant → onboarding
    expect(getPostAuthPath({ role: 'owner', restaurant_id: null }, null)).toBe('/onboarding');
    // Subscribed owner → POS
    expect(getPostAuthPath({ role: 'owner', restaurant_id: 'r-1' }, subscribed)).toBe('/pos');
    // Unsubscribed owner → subscription page
    expect(getPostAuthPath({ role: 'owner', restaurant_id: 'r-1' }, pendingSub)).toBe('/subscription');
    // Owner whose restaurant details could not load → subscription (safe default)
    expect(getPostAuthPath({ role: 'owner', restaurant_id: 'r-1' }, null)).toBe('/subscription');
  });
});
