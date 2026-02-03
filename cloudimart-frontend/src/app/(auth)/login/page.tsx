// File: cloudimart-frontend/src/app/%28auth%29/login/page.tsx
'use client';

import { useState } from 'react';
import axios from 'axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = API ? `${API}/api/auth/login` : '/api/auth/login';
      const res = await axios.post(url, { email, password });

      // Save token in localStorage for future API calls
      localStorage.setItem('auth_token', res.data.access_token);

      alert(`Logged in successfully! Welcome ${res.data.user.name}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Login</h2>

        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full p-2 border rounded mb-2"
        /> 

        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          className="w-full p-2 border rounded mb-4"
        />

        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
          Login
        </button>
      </form>
    </div>
  );
}
