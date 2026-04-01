import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE
});

// Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (username, password) =>
  api.post('/auth/login', { username, password });

export const getMe = () => api.get('/auth/me');
export const getUsers = () => api.get('/auth/users');
export const createUser = (data) => api.post('/auth/users', data);
export const updateUser = (id, data) => api.put(`/auth/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/auth/users/${id}`);

// Calls
export const getCalls = (params) => api.get('/calls', { params });
export const getCallDetails = (id) => api.get(`/calls/${id}`);
export const updateFollowUp = (id, data) => api.put(`/calls/${id}/followup`, data);
export const getQueues = () => api.get('/calls/meta/queues');
export const getDashboardStats = (params) => api.get('/calls/stats/dashboard', { params });
export const getAlerts = () => api.get('/calls/alerts/pending');
export const triggerSync = () => api.post('/sync');

// Export
export const getExportUrl = (params) => {
  const query = new URLSearchParams(params).toString();
  return `${API_BASE}/calls/export/csv?${query}`;
};

export default api;