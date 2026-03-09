import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, restaurantAPI } from '../lib/api';

const AuthContext = createContext(null);

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
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
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
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { access_token, user: userData } = response.data;
    
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
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

  const register = async (name, email, password) => {
    const response = await authAPI.register({ name, email, password });
    const { access_token, user: userData } = response.data;
    
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setRestaurant(null);
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  const updateRestaurant = (data) => {
    setRestaurant(data);
  };

  const value = {
    user,
    restaurant,
    loading,
    login,
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
