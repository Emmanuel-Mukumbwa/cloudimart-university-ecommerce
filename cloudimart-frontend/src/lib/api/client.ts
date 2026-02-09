// src/lib/api/client.ts
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const client = axios.create({
  baseURL: API_BASE || undefined,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth header for each request if token exists
client.interceptors.request.use((cfg) => {
  try {
    if (typeof window !== 'undefined') { 
      const token = localStorage.getItem('auth_token');
      if (token) cfg.headers = { ...cfg.headers, Authorization: `Bearer ${token}` };
    }
  } catch (e) {
    // ignore
  }
  return cfg;
});

// Optional: central response error handling (let callers handle specifics)
client.interceptors.response.use(
  (res) => res,
  (err) => {
    // normalize error object for callers
    const error = err;
    error.userMessage = err?.response?.data?.message ?? err?.message ?? 'Unknown error';
    return Promise.reject(error);
  }
);

export default client;
