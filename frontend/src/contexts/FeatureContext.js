import React, { createContext, useContext, useState, useEffect } from 'react';
import { storeAPI } from '../lib/api';

const FeatureContext = createContext(null);

export const useFeatures = () => {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeatures must be used within FeatureProvider');
  }
  return context;
};

/* ── Addon → Feature mapping ── */
const ADDON_FEATURES = {
  // addon_id patterns (matched by name slug or id)
  crm_loyalty: ['trident_coins', 'customers'],
  inventory: ['inventory', 'purchase_orders'],
  whatsapp: ['notifications'],
  branches: ['branches'],
  analytics: ['analytics'],
  api_access: [],
  custom_branding: [],
  gift_cards: ['gift_cards'],
};

/* Slug-based matching for flexible addon identification */
function getAddonSlug(addon) {
  const name = (addon.name || '').toLowerCase();
  if (name.includes('crm') || name.includes('loyalty')) return 'crm_loyalty';
  if (name.includes('inventory')) return 'inventory';
  if (name.includes('whatsapp') || name.includes('marketing')) return 'whatsapp';
  if (name.includes('branch') || name.includes('multi')) return 'branches';
  if (name.includes('analytics') || name.includes('advanced')) return 'analytics';
  if (name.includes('api')) return 'api_access';
  if (name.includes('branding') || name.includes('custom')) return 'custom_branding';
  if (name.includes('gift') || name.includes('voucher')) return 'gift_cards';
  return addon.id || 'unknown';
}

export const FeatureProvider = ({ children }) => {
  const [activeAddons, setActiveAddons] = useState([]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFeatures = async () => {
    try {
      const [addonsRes, subRes] = await Promise.all([
        storeAPI.getAddons(),
        storeAPI.getSubscription(),
      ]);
      setAddons(addonsRes.data || []);
      setActiveAddons(subRes.data?.active_addons || []);
    } catch (err) {
      console.error('Failed to fetch features:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeatures(); }, []);

  /* Check if a feature key is unlocked */
  const isFeatureUnlocked = (featureKey) => {
    // Base features are always unlocked
    const baseFeatures = ['dashboard', 'menu_order', 'quick_pos', 'kds', 'tables', 'menu', 'staff', 'settings', 'online_orders', 'wallet'];
    if (baseFeatures.includes(featureKey)) return true;

    // Check each active addon
    for (const addon of addons) {
      const slug = getAddonSlug(addon);
      const isActive = activeAddons.includes(addon.id);
      if (isActive && ADDON_FEATURES[slug]?.includes(featureKey)) {
        return true;
      }
    }
    return false;
  };

  /* Get the addon that unlocks a feature */
  const getRequiredAddon = (featureKey) => {
    for (const [slug, features] of Object.entries(ADDON_FEATURES)) {
      if (features.includes(featureKey)) {
        const addon = addons.find(a => getAddonSlug(a) === slug);
        if (addon && !activeAddons.includes(addon.id)) {
          return addon;
        }
      }
    }
    return null;
  };

  /* Check if an addon is active */
  const isAddonActive = (addonId) => activeAddons.includes(addonId);

  const refreshFeatures = () => {
    setLoading(true);
    fetchFeatures();
  };

  const value = {
    activeAddons,
    addons,
    loading,
    isFeatureUnlocked,
    getRequiredAddon,
    isAddonActive,
    refreshFeatures,
  };

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
};
