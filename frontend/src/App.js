import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FeatureProvider } from './contexts/FeatureContext';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
// Onboarding Pages
import BusinessCategoryPage from './pages/onboarding/BusinessCategoryPage';
import RestaurantSetupPage from './pages/onboarding/RestaurantSetupPage';
import SubscriptionPage from './pages/onboarding/SubscriptionPage';

// Restaurant POS Pages
import POSDashboard from './pages/pos/POSDashboard';
import POSMain from './pages/pos/POSMain';
import MenuManagement from './pages/pos/MenuManagement';
import OrderManagement from './pages/pos/OrderManagement';
import TablesPage from './pages/pos/TablesPage';
import InventoryPage from './pages/pos/InventoryPage';
import AnalyticsPage from './pages/pos/AnalyticsPage';
import StaffPage from './pages/pos/StaffPage';
import SettingsPage from './pages/pos/SettingsPage';
import OnlineOrdersPage from './pages/pos/OnlineOrdersPage';
import KDSPage from './pages/pos/KDSPage';
import WalletPage from './pages/pos/WalletPage';
import BranchesPage from './pages/pos/BranchesPage';
import QuickPOSPage from './pages/pos/QuickPOSPage';
import PurchaseOrdersPage from './pages/pos/PurchaseOrdersPage';
import NotificationsPage from './pages/pos/NotificationsPage';
import CustomersPage from './pages/pos/CustomersPage';
import GiftCardsPage from './pages/pos/GiftCardsPage';
import TridentCoinsPage from './pages/pos/TridentCoinsPage';
import StorePage from './pages/pos/StorePage';
import FeatureLocked from './components/store/FeatureLocked';
import { useFeatures } from './contexts/FeatureContext';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRestaurants from './pages/admin/AdminRestaurants';
import AdminSubscriptions from './pages/admin/AdminSubscriptions';
import AdminUsers from './pages/admin/AdminUsers';
import AdminLogs from './pages/admin/AdminLogs';
import AdminAnalytics from './pages/admin/AdminAnalytics';

// Layouts
import POSLayout from './layouts/POSLayout';
import AdminLayout from './layouts/AdminLayout';

// Protected Route Component
const ProtectedRoute = ({ children, requireAdmin = false, requireSubscription = false }) => {
  const { isAuthenticated, loading, isAdmin, isSubscribed, hasRestaurant } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/pos" replace />;
  }

  if (requireSubscription && !isSubscribed) {
    return <Navigate to="/subscription" replace />;
  }

  return children;
};

// Public Route - redirect if already logged in
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, isAdmin, hasRestaurant, isSubscribed } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (isAdmin) {
      return <Navigate to="/admin" replace />;
    }
    if (!hasRestaurant) {
      return <Navigate to="/onboarding" replace />;
    }
    if (!isSubscribed) {
      return <Navigate to="/subscription" replace />;
    }
    return <Navigate to="/pos" replace />;
  }

  return children;
};

/* Feature Gate — shows locked banner if addon not purchased */
const FeatureGate = ({ featureKey, children }) => {
  const { isFeatureUnlocked, getRequiredAddon, loading } = useFeatures();
  if (loading) return null;
  if (isFeatureUnlocked(featureKey)) return children;
  const addon = getRequiredAddon(featureKey);
  return <FeatureLocked addonName={addon?.name} addonPrice={addon?.monthly_price} />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
<Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* Onboarding Routes */}
      <Route path="/onboarding" element={<ProtectedRoute><BusinessCategoryPage /></ProtectedRoute>} />
      <Route path="/onboarding/setup" element={<ProtectedRoute><RestaurantSetupPage /></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />

      {/* POS Routes */}
      <Route path="/pos" element={<ProtectedRoute requireSubscription><POSLayout /></ProtectedRoute>}>
        <Route index element={<POSDashboard />} />
        <Route path="orders" element={<POSMain />} />
        <Route path="menu" element={<MenuManagement />} />
        <Route path="order-management" element={<OrderManagement />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="inventory" element={<FeatureGate featureKey="inventory"><InventoryPage /></FeatureGate>} />
        <Route path="analytics" element={<FeatureGate featureKey="analytics"><AnalyticsPage /></FeatureGate>} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="online-orders" element={<FeatureGate featureKey="online_orders"><OnlineOrdersPage /></FeatureGate>} />
        <Route path="kds" element={<KDSPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="branches" element={<FeatureGate featureKey="branches"><BranchesPage /></FeatureGate>} />
        <Route path="quick-pos" element={<QuickPOSPage />} />
        <Route path="purchase-orders" element={<FeatureGate featureKey="purchase_orders"><PurchaseOrdersPage /></FeatureGate>} />
        <Route path="notifications" element={<FeatureGate featureKey="notifications"><NotificationsPage /></FeatureGate>} />
        <Route path="customers" element={<FeatureGate featureKey="customers"><CustomersPage /></FeatureGate>} />
        <Route path="gift-cards" element={<FeatureGate featureKey="gift_cards"><GiftCardsPage /></FeatureGate>} />
        <Route path="trident-coins" element={<FeatureGate featureKey="trident_coins"><TridentCoinsPage /></FeatureGate>} />
        <Route path="store" element={<StorePage />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="restaurants" element={<AdminRestaurants />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="analytics" element={<AdminAnalytics />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (    <BrowserRouter>
      <AuthProvider>
        <FeatureProvider>
          <AppRoutes />
          <Toaster 
            position="top-right"
            richColors
            toastOptions={{
              style: { fontFamily: 'Inter, sans-serif' }
            }}
          />
          <Analytics />
        </FeatureProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
