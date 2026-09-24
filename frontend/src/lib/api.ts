/**
 * Axios API client for the BhoomiAI Land Record backend.
 * Automatically attaches the Bearer token from localStorage if present.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  timeout: 60000,
});

// Attach auth token to every request if available
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('bhoomi_token') ?? localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 globally — clear all stale tokens and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('bhoomi_token');
        localStorage.removeItem('user');
        // Don't clear citizen_token here — citizen auth is independent
      }
    }
    return Promise.reject(error);
  }
);

export default api;
