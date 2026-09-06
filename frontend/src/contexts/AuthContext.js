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
      const token = sessionStorage.getItem('token');
      const savedUser = sessionStorage.getItem('user');
      
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
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { access_token, user: userData } = response.data;
    
    sessionStorage.setItem('token', access_token);
    sessionStorage.setItem('user', JSON.stringify(userData));
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

    // Publish the session in React state (not only sessionStorage) so
    // ProtectedRoute/PublicRoute see the user as authenticated immediately
    // instead of bouncing them back to /login.
    sessionStorage.setItem('token', access_token);
    sessionStorage.setItem('user', JSON.stringify(userData));
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
    sessionStorage.setItem('token', data.access_token);
    sessionStorage.setItem('user', JSON.stringify(userData));
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
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
    setRestaurant(null);
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    sessionStorage.setItem('user', JSON.stringify(updated));
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
