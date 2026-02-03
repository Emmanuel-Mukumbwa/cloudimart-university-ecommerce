//src/lib/api/client.ts
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const client = axios.create({
  baseURL: API_BASE || undefined,
  headers: { 'Content-Type': 'application/json' }
});

export default client;
