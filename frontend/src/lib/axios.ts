import axios from 'axios';

// Helper to get JWT from localStorage (or however you store it)
function getToken() {
  return localStorage.getItem('jwt'); // Adjust the key if you use a different one
}

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`, // Change to your backend URL/port
  // You can set other defaults here
});

// Add a request interceptor to always attach JWT
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;