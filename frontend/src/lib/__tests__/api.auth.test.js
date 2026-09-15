import api, { authAPI } from '../../lib/api';

/**
 * Exercises the axios interceptors with a fake adapter, so no network is hit.
 * A non-2xx adapter response is wrapped by axios into an error whose
 * `response` the interceptor inspects — exactly like production.
 */
function installFakeAdapter(handler) {
  api.defaults.adapter = async (config) => {
    let result;
    try {
      result = await handler(config);
    } catch (err) {
      // Real axios rejections carry the request config; attach it so the
      // response interceptor can inspect Authorization headers etc.
      if (err && !err.config) err.config = config;
      throw err;
    }
    return result;
  };
}

function unauth401(detail = 'Not authenticated') {
  const error = new Error(`Request failed with status code 401`);
  error.response = { status: 401, data: { detail } };
  throw error;
}

function setLocation(pathname) {
  const assign = jest.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, assign, href: `http://localhost${pathname}` },
    writable: true,
  });
  return assign;
}

describe('lib/api — 401 handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    setLocation('/pos');
  });

  test('expired authenticated request clears the session and redirects to /login', async () => {
    sessionStorage.setItem('token', 'expired-token');
    sessionStorage.setItem('user', '{"id":"u1"}');
    const assign = setLocation('/pos');

    installFakeAdapter(async (config) => {
      if (config.url === '/restaurants/my') return unauth401('Not authenticated');
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    });

    await expect(restaurantGetMy()).rejects.toBeTruthy();

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  test('anonymous 401 (no bearer token) does NOT reload or clear anything', async () => {
    const assign = setLocation('/pos');

    // No session at all — an anonymous request that the backend rejects with
    // 401 (e.g. token-expired guard on an endpoint) must not cause a reload.
    installFakeAdapter(async () => unauth401('Not authenticated'));

    await expect(restaurantGetMy()).rejects.toBeTruthy();

    expect(assign).not.toHaveBeenCalled();
  });

  test('wrong-password 401 on /auth/login does not redirect (error stays visible)', async () => {
    sessionStorage.setItem('token', 'stale-token');
    const assign = setLocation('/login');

    installFakeAdapter(async () => unauth401('Invalid email or password'));

    await expect(authAPI.login({ email: 'a@b.c', password: 'wrong' })).rejects.toBeTruthy();

    expect(assign).not.toHaveBeenCalled();
  });

  test('invalid signup OTP 401 with a stale bearer header still does not redirect', async () => {
    sessionStorage.setItem('token', 'stale-token');
    const assign = setLocation('/register');

    installFakeAdapter(async () => unauth401('Invalid code. 3 attempts remaining.'));

    await expect(authAPI.verifySignupOtp('a@b.c', '000000')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(assign).not.toHaveBeenCalled();
  });

  test('no redirect loop when an expired request 401s while already on /login', async () => {
    sessionStorage.setItem('token', 'expired-token');
    const assign = setLocation('/login');

    installFakeAdapter(async (config) => {
      if (config.url === '/restaurants/my') return unauth401();
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    });

    await expect(restaurantGetMy()).rejects.toBeTruthy();

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  test('non-401 errors pass through untouched', async () => {
    sessionStorage.setItem('token', 'tok');
    const assign = setLocation('/pos');
    const err = new Error('boom');
    err.response = { status: 500, data: { detail: 'Internal error' } };

    installFakeAdapter(async () => {
      throw err;
    });

    await expect(authAPI.getMe()).rejects.toMatchObject({ response: { status: 500 } });
    expect(sessionStorage.getItem('token')).toBe('tok');
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('lib/api — email-only auth endpoints', () => {
  test('verifySignupOtp posts to /auth/verify-signup-otp with email + otp', async () => {
    let captured;
    installFakeAdapter(async (config) => {
      captured = config;
      return { data: { access_token: 'tok', user: { id: 'u1' } }, status: 200, statusText: 'OK', headers: {}, config };
    });

    await authAPI.verifySignupOtp('a@b.c', '123456');
    expect(captured.url).toBe('/auth/verify-signup-otp');
    expect(JSON.parse(captured.data)).toEqual({ email: 'a@b.c', otp: '123456' });
  });

  test('resendSignupOtp posts to /auth/resend-signup-otp', async () => {
    let captured;
    installFakeAdapter(async (config) => {
      captured = config;
      return { data: { message: 'ok' }, status: 200, statusText: 'OK', headers: {}, config };
    });

    await authAPI.resendSignupOtp('a@b.c');
    expect(captured.url).toBe('/auth/resend-signup-otp');
    expect(JSON.parse(captured.data)).toEqual({ email: 'a@b.c' });
  });
});

// Small local wrappers so the tests read naturally.
async function restaurantGetMy() {
  return api.get('/restaurants/my');
}
