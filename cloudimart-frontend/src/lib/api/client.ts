// src/lib/api/client.ts
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const client = axios.create({
  baseURL: API_BASE || undefined,
  headers: { 'Content-Type': 'application/json' },
  // withCredentials: false, // leave as needed for your auth
});

// Attach auth header for each request if token exists
client.interceptors.request.use((cfg) => {
  try {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // ensure headers object exists
        cfg.headers = cfg.headers ?? {};
        cfg.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch (e) {
    // ignore
  }
  return cfg;
});

// Central response error handling
client.interceptors.response.use(
  (res) => res,
  (err) => {
    // Normalize and attach a userMessage
    const error = err;
    error.userMessage = err?.response?.data?.message ?? err?.message ?? 'Unknown error';

    // If unauthorized, remove token locally so future requests won't repeatedly use a bad token.
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('auth_token');
      } catch (e) {}
    }

    return Promise.reject(error);
  }
);

export default client;
