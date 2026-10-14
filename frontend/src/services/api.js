import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
});

// Attach the JWT from localStorage on every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qba_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize API errors to a readable message.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Something went wrong';
    const details = error.response?.data?.details;
    return Promise.reject({ message, details, status: error.response?.status });
  }
);

export default api;
