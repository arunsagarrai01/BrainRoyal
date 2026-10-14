import api from './api.js';

// ---- Auth ----
export const authService = {
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// ---- Users ----
export const userService = {
  getProfile: () => api.get('/users/profile').then((r) => r.data),
  updateProfile: (data) => api.put('/users/profile', data).then((r) => r.data),
  getPublic: (username) => api.get(`/users/${username}`).then((r) => r.data),
};

// ---- Categories ----
export const categoryService = {
  list: (search) => api.get('/categories', { params: { search } }).then((r) => r.data),
  get: (id) => api.get(`/categories/${id}`).then((r) => r.data),
  create: (data) => api.post('/categories', data).then((r) => r.data),
  update: (id, data) => api.put(`/categories/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/categories/${id}`).then((r) => r.data),
};

// ---- Questions (admin) ----
export const questionService = {
  list: (params) => api.get('/questions', { params }).then((r) => r.data),
  get: (id) => api.get(`/questions/${id}`).then((r) => r.data),
  create: (data) => api.post('/questions', data).then((r) => r.data),
  update: (id, data) => api.put(`/questions/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/questions/${id}`).then((r) => r.data),
};

// ---- Battles ----
export const battleService = {
  create: (data) => api.post('/battles', data).then((r) => r.data),
  get: (id) => api.get(`/battles/${id}`).then((r) => r.data),
  answer: (id, data) => api.post(`/battles/${id}/answer`, data).then((r) => r.data),
  finish: (id) => api.post(`/battles/${id}/finish`).then((r) => r.data),
  history: (params) => api.get('/battles', { params }).then((r) => r.data),
};

// ---- Leaderboard ----
export const leaderboardService = {
  get: (scope, categoryId) =>
    api.get('/leaderboard', { params: { scope, categoryId } }).then((r) => r.data),
};

// ---- Statistics ----
export const statisticsService = {
  get: () => api.get('/statistics').then((r) => r.data),
};

// ---- Achievements ----
export const achievementService = {
  list: () => api.get('/achievements').then((r) => r.data),
};

// ---- Admin ----
export const adminService = {
  overview: () => api.get('/admin/overview').then((r) => r.data),
  listUsers: (search) => api.get('/admin/users', { params: { search } }).then((r) => r.data),
  updateUserRole: (id, role) => api.put(`/admin/users/${id}`, { role }).then((r) => r.data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`).then((r) => r.data),
  listBattles: () => api.get('/admin/battles').then((r) => r.data),
};
