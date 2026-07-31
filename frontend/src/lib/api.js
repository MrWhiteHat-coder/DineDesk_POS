import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
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
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  getPermissions: () => api.get('/auth/permissions'),
};

// Restaurant APIs
export const restaurantAPI = {
  onboard: (data) => api.post('/restaurants/onboard', data),
  getMy: () => api.get('/restaurants/my'),
  updateMy: (data) => api.put('/restaurants/my', data),
};

// Branch APIs
export const branchAPI = {
  getAll: () => api.get('/branches'),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`),
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
  deleteCategory: (id) => api.delete(`/menu/categories/${id}`),
  getItems: (categoryId) => api.get('/menu/items', { params: categoryId ? { category_id: categoryId } : {} }),
  createItem: (data) => api.post('/menu/items', data),
  updateItem: (id, data) => api.put(`/menu/items/${id}`, data),
  deleteItem: (id) => api.delete(`/menu/items/${id}`),
};

// Order APIs
export const orderAPI = {
  create: (data) => api.post('/orders', data),
  getAll: (params) => api.get('/orders', { params }),
  getToday: () => api.get('/orders/today'),
  getRunning: () => api.get('/orders/running'),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  addItems: (id, data) => api.post(`/orders/${id}/add-items`, data),
  pay: (id, data) => api.post(`/orders/${id}/pay`, data),
};

// Day Session APIs
export const daySessionAPI = {
  open: (cash) => api.post(`/day-session/open?opening_cash=${cash}`),
  close: (cash) => api.post(`/day-session/close?closing_cash=${cash}`),
  getCurrent: () => api.get('/day-session/current'),
  getHistory: () => api.get('/day-session/history'),
};

// Inventory APIs
export const inventoryAPI = {
  getAll: (lowStockOnly) => api.get('/inventory', { params: lowStockOnly ? { low_stock_only: true } : {} }),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id) => api.delete(`/inventory/${id}`),
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
  delete: (id) => api.delete(`/staff/${id}`),
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
  cancel: (id) => api.put(`/purchase-orders/${id}/cancel`),
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
