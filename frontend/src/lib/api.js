import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://dinedesk-pos.onrender.com';

// Endpoints that return 401 for reasons OTHER than an expired/missing session
// (bad credentials, wrong OTP, …). A 401 here must stay
// visible as an error message instead of wiping the session/reloading the page.
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-signup-otp',
  '/auth/resend-signup-otp',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor for auth token. Reads sessionStorage first (per-tab
// session) and falls back to localStorage (survives PWA close/reopen — needed
// for offline order sync after a fresh app launch).
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const config = error.config || {};
      const headers = config.headers || {};
      const authHeader =
        headers?.Authorization ||
        headers?.authorization ||
        (typeof headers?.get === 'function' ? headers.get('Authorization') : undefined);
      const hadSession = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
      const path = String(config.url || '').split('?')[0];
      const isPublicAuthPath = PUBLIC_AUTH_PATHS.some(
        (p) => path === p || path.startsWith(`${p}/`)
      );

      // Only a request that was actually sent with a bearer token can mean
      // "your session expired". Anonymous 401s (wrong password, bad OTP,
      //      wrong password, bad OTP, …) must not reload the page or hide the
      // error behind a redirect.
      if (hadSession && !isPublicAuthPath) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        try { localStorage.removeItem('token'); } catch { /* noop */ }
        try { localStorage.removeItem('user'); } catch { /* noop */ }
        // Avoid redirect loops when we are already on the login page.
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign('/login');
        }
      }
    }
    // Normalize FastAPI error bodies into a readable string on error.detail.
    // FastAPI 422 responses carry `detail` as an ARRAY of validation objects —
    // passing that straight to toast.error() renders an object as a React
    // child and crashes the whole app (white page). Normalizing here means
    // every catch block can safely show err.response?.data?.detail.
    const rawDetail = error.response?.data?.detail;
    if (rawDetail !== undefined && rawDetail !== null && typeof rawDetail !== 'string') {
      if (Array.isArray(rawDetail)) {
        // 422 validation array: [{type, loc, msg, input, url}, …]
        const parts = rawDetail.map((d) => {
          const loc = Array.isArray(d?.loc) ? d.loc.filter((p) => p !== 'body' && p !== 'query').join('.') : '';
          const field = loc ? `${loc}: ` : '';
          const input = d?.input !== undefined && typeof d.input !== 'object' ? ` (got "${d.input}")` : '';
          return `${field}${d?.msg || 'Invalid value'}${input}`;
        });
        error.response.data.detail = parts.join('; ');
      } else {
        error.response.data.detail = String(rawDetail);
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verifySignupOtp: (email, otp) => api.post('/auth/verify-signup-otp', { email, otp }),
  resendSignupOtp: (email) => api.post('/auth/resend-signup-otp', { email }),
  getMe: () => api.get('/auth/me'),
  getPermissions: () => api.get('/auth/permissions'),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, new_password: newPassword }),
  sendOTP: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOTP: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
};

// Restaurant APIs
export const restaurantAPI = {
  onboard: (data) => api.post('/restaurants/onboard', data),
  getMy: () => api.get('/restaurants/my'),
  updateMy: (data) => api.put('/restaurants/my', data),
  verifyLicense: (licenseNumber) => api.post('/restaurants/verify-license', { license_number: licenseNumber }),
};

// Branch APIs
export const branchAPI = {
  getAll: () => api.get('/branches'),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id, reason) => api.delete(`/branches/${id}`, { params: { reason } }),
};

// Subscription APIs
export const subscriptionAPI = {
  create: (data) => api.post('/subscriptions/create', data),
  getMy: () => api.get('/subscriptions/my'),
};

// Menu APIs
export const menuAPI = {
  getCategories: () => api.get('/menu/categories'),
  createCategory: (data) => api.post('/menu/categories', data),
  deleteCategory: (id, reason) => api.delete(`/menu/categories/${id}`, { params: { reason } }),
  getItems: (categoryId) => api.get('/menu/items', { params: categoryId ? { category_id: categoryId } : {} }),
  createItem: (data) => api.post('/menu/items', data),
  updateItem: (id, data) => api.put(`/menu/items/${id}`, data),
  deleteItem: (id, reason) => api.delete(`/menu/items/${id}`, { params: { reason } }),
};

// Order APIs
export const orderAPI = {
  create: (data) => api.post('/orders', data),
  getAll: (params) => api.get('/orders', { params }),
  getToday: () => api.get('/orders/today'),
  getRunning: () => api.get('/orders/running'),
  updateStatus: (id, status, opts = {}) => api.put(`/orders/${id}/status`, { status }, { params: { cancel_reason: opts.reason, manager_pin: opts.managerPin } }),
  addItems: (id, data) => api.post(`/orders/${id}/add-items`, data),
  pay: (id, data) => api.post(`/orders/${id}/pay`, data),
};

// Day Session APIs
export const daySessionAPI = {
  open: (cash) => api.post(`/day-session/open?opening_cash=${cash}`),
  close: (cash) => api.post(`/day-session/close?closing_cash=${cash}`),
  closeForce: (cash, force = false) => api.post(`/day-session/close?closing_cash=${cash}&force=${force}`),
  getCurrent: () => api.get('/day-session/current'),
  getHistory: () => api.get('/day-session/history'),
};

/* Offline day-opening: opening a day must work with zero connectivity (it's
 * the first thing a counter does each morning). The intent is queued in
 * localStorage and replayed by the sync engine BEFORE any queued orders —
 * the backend rejects orders without an open session, so day-open must sync
 * first. If a session is already open server-side (opened from another
 * terminal), the replay is a harmless no-op. */
const OFFLINE_DAY_KEY = 'dinedesk-offline-day-open';
export const readOfflineDayIntent = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_DAY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
export const clearOfflineDayIntent = () => {
  try { localStorage.removeItem(OFFLINE_DAY_KEY); } catch { /* noop */ }
};
export const queueOfflineDayOpen = (openingCash) => {
  try {
    localStorage.setItem(OFFLINE_DAY_KEY, JSON.stringify({ opening_cash: openingCash || 0, created_at: new Date().toISOString() }));
    return true;
  } catch { return false; }
};

// Inventory APIs
export const inventoryAPI = {
  getAll: (lowStockOnly) => api.get('/inventory', { params: lowStockOnly ? { low_stock_only: true } : {} }),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id, reason) => api.delete(`/inventory/${id}`, { params: { reason } }),
  movements: (id, days) => api.get(`/inventory/${id}/movements`, { params: { days } }),
};

// Wastage APIs
export const wastageAPI = {
  list: (days = 30) => api.get('/wastage', { params: { days } }),
  create: (data) => api.post('/wastage', data),
  summary: (days = 7) => api.get('/wastage/summary', { params: { days } }),
};

// Table APIs
export const tableAPI = {
  getAll: () => api.get('/tables'),
  create: (data) => api.post('/tables', data),
  updateStatus: (id, status) => api.put(`/tables/${id}/status?status=${status}`),
  release: (id) => api.put(`/tables/${id}/release`),
};

// Staff APIs
export const staffAPI = {
  getAll: () => api.get('/staff'),
  create: (data) => api.post('/staff', data),
  delete: (id, reason) => api.delete(`/staff/${id}`, { params: { reason } }),
  auditLogs: (params) => api.get('/audit-logs', { params }),
};

// KDS APIs
export const kdsAPI = {
  getOrders: () => api.get('/kds/orders'),
  updateStatus: (id, status) => api.put(`/kds/orders/${id}/status?new_status=${status}`),
};

// Wallet APIs
export const walletAPI = {
  getSummary: (period, date) => api.get('/wallet/summary', { params: { period, ...(date ? { date } : {}) } }),
};

// Analytics APIs
export const analyticsAPI = {
  get: (date, branchId) => api.get('/analytics', { params: { ...(date ? { date } : {}), ...(branchId && branchId !== 'all' ? { branch_id: branchId } : {}) } }),
  getAiInsights: () => api.post('/analytics/ai-insights'),
};

// DineDesk Intelligence (AI) — answers come from verified backend-computed data only
export const intelligenceAPI = {
  getInsights: () => api.post('/intelligence/insights'),
  ask: (question) => api.post('/intelligence/ask', { question }),
};

// Notification APIs
export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  sendTest: () => api.post('/notifications/test'),
  getSettings: () => api.get('/notifications/settings'),
  updateSettings: (data) => api.put('/notifications/settings', data),
};

// Admin APIs
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getRestaurants: (params) => api.get('/admin/restaurants', { params }),
  updateRestaurantStatus: (id, isActive) => api.put(`/admin/restaurants/${id}/status?is_active=${isActive}`),
  getSubscriptions: () => api.get('/admin/subscriptions'),
  getUsers: () => api.get('/admin/users'),
  getLogs: (logType) => api.get('/admin/logs', { params: logType ? { log_type: logType } : {} }),
  getAnalytics: () => api.get('/admin/analytics'),
};

// Purchase Order APIs
export const purchaseOrderAPI = {
  getAll: (status) => api.get('/purchase-orders', { params: status ? { status } : {} }),
  create: (data) => api.post('/purchase-orders', data),
  receive: (id) => api.put(`/purchase-orders/${id}/receive`),
  cancel: (id, reason) => api.put(`/purchase-orders/${id}/cancel`, null, { params: { reason } }),
};

// Receipt API
export const receiptAPI = {
  get: (orderId) => api.get(`/orders/${orderId}/receipt`),
};

// Day Session Report
export const dayReportAPI = {
  get: (sessionId) => api.get(`/day-session/${sessionId}/report`),
  getPdf: (sessionId) => api.get(`/day-session/${sessionId}/report-pdf`, { responseType: 'blob' }),
  getPdfUrl: (sessionId) => `${API_URL}/api/day-session/${sessionId}/report-pdf`,
  getAiInsights: (sessionId) => api.get(`/day-session/${sessionId}/ai-insights`),
};

// Customer CRM APIs
export const customerCRM_API = {
  getAll: (params) => api.get('/customers', { params }),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  getOrders: (id) => api.get(`/customers/${id}/orders`),
};

// Trident Coins APIs
export const coinsAPI = {
  earn: (data) => api.post('/coins/earn', data),
  redeem: (data) => api.post('/coins/redeem', data),
  topup: (data) => api.post('/coins/topup', data),
  donate: (data) => api.post('/coins/donate', data),
  getTransactions: (params) => api.get('/coins/transactions', { params }),
};

// Gift Card APIs
export const giftCardAPI = {
  purchase: (data) => api.post('/giftcards/purchase', data),
  redeem: (data) => api.post('/giftcards/redeem', data),
  get: (code) => api.get(`/giftcards/${code}`),
  getAll: () => api.get('/giftcards'),
};

// Store APIs
export const storeAPI = {
  getAddons: () => api.get('/store/addons'),
  getSubscription: () => api.get('/store/subscription'),
  subscribe: (addonId, billing) => api.post(`/store/subscribe?addon_id=${addonId}&billing=${billing}`),
  unsubscribe: (addonId) => api.post(`/store/unsubscribe?addon_id=${addonId}`),
};

// Seva APIs
export const sevaAPI = {
  getStats: () => api.get('/seva/stats'),
};

// Feedback APIs
export const feedbackAPI = {
  create: (data) => api.post('/feedback', data),
  getAll: (params) => api.get('/feedback', { params }),
};

// Customer Lookup
export const customerAPI = {
  lookup: (phone) => api.get('/customers/lookup', { params: { phone } }),
};

// File Upload
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
};

export default api;
