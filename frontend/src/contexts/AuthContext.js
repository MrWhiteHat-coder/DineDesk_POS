import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, restaurantAPI } from '../lib/api';

const AuthContext = createContext(null);

/**
 * Decide where an authenticated user should land after login/signup.
 * - Admins → /admin (including when they sign up/sign in via Google).
 * - Users without a restaurant yet (new signups) → /onboarding.
 * - Owners whose subscription is not active → /subscription.
 * - Everyone else (active subscribers) → /pos.
 */
export const getPostAuthPath = (user, restaurant) => {
  if (user?.role === 'admin') return '/admin';
  if (!user?.restaurant_id) return '/onboarding';
  if (!restaurant || restaurant.subscription_status !== 'active') return '/subscription';
  return '/pos';
};

/* Session storage: the token lives in BOTH sessionStorage and localStorage.
 * - sessionStorage keeps multi-tab behaviour identical to before (each tab
 *   shares localStorage, so reads fall through to it).
 * - localStorage is what makes the installed PWA work: closing the app no
 *   longer wipes the session, and the offline order queue can replay with a
 *   valid token even after a fresh app launch without network.
 */
const setSession = (token, userData) => {
  sessionStorage.setItem('token', token);
  sessionStorage.setItem('user', JSON.stringify(userData));
  try { localStorage.setItem('token', token); } catch { /* private mode */ }
  try { localStorage.setItem('user', JSON.stringify(userData)); } catch { /* private mode */ }
};

const clearSession = () => {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  try { localStorage.removeItem('token'); } catch { /* noop */ }
  try { localStorage.removeItem('user'); } catch { /* noop */ }
};

const readSession = () => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const savedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
  return { token, savedUser };
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { token, savedUser } = readSession();
      
      if (token && savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
          
          // Fetch restaurant if user has one
          if (parsed.restaurant_id) {
            try {
              const res = await restaurantAPI.getMy();
              setRestaurant(res.data);
            } catch (e) {
              console.error('Failed to fetch restaurant:', e);
            }
          }
        } catch (e) {
          clearSession();
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { access_token, user: userData } = response.data;
    
    setSession(access_token, userData);
    setUser(userData);
    
    // Fetch restaurant if exists
    if (userData.restaurant_id) {
      try {
        const res = await restaurantAPI.getMy();
        setRestaurant(res.data);
      } catch (e) {
        console.error('Failed to fetch restaurant:', e);
      }
    }
    
    return userData;
  };

  const googleLogin = async (credential) => {
    const response = await authAPI.googleLogin(credential);
    const { access_token, user: userData } = response.data;

    sessionStorage.setItem('token', access_token);
    sessionStorage.setItem('user', JSON.stringify(userData));
    try { localStorage.setItem('token', access_token); } catch { /* private mode */ }
    try { localStorage.setItem('user', JSON.stringify(userData)); } catch { /* private mode */ }
    setUser(userData);
    setRestaurant(null);

    // Load restaurant/subscription details BEFORE returning so callers can
    // route straight to onboarding / subscription / POS / admin correctly.
    let restaurantData = null;
    if (userData.restaurant_id) {
      try {
        const res = await restaurantAPI.getMy();
        restaurantData = res.data;
        setRestaurant(restaurantData);
      } catch (e) {
        console.error('Failed to fetch restaurant:', e);
      }
    }

    return { user: userData, restaurant: restaurantData };
  };

  const register = async (name, email, password, phone) => {
    const response = await authAPI.register({ name, email, password, phone });
    const data = response.data || {};

    // Verification mode: backend returns {message, email} — no session yet.
    // Caller (RegisterPage) shows the check-email screen.
    if (!data.access_token || !data.user) {
      return null;
    }

    // Auto-login mode: session starts immediately. We set BOTH the storage
    // AND the in-memory user state here so ProtectedRoute sees the user as
    // authenticated and routes them into onboarding/POS instead of bouncing
    // them back to the login page.
    const userData = data.user;
    setSession(data.access_token, userData);
    setUser(userData);

    if (userData.restaurant_id) {
      try {
        const res = await restaurantAPI.getMy();
        setRestaurant(res.data);
      } catch (e) {
        console.error('Failed to fetch restaurant:', e);
      }
    }

    return userData;
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setRestaurant(null);
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    setSession(sessionStorage.getItem('token') || localStorage.getItem('token'), updated);
  };

  const updateRestaurant = (data) => {
    setRestaurant(data);
  };

  const value = {
    user,
    restaurant,
    loading,
    login,
    googleLogin,
    register,
    logout,
    updateUser,
    updateRestaurant,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    hasRestaurant: !!user?.restaurant_id,
    isSubscribed: restaurant?.subscription_status === 'active',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
