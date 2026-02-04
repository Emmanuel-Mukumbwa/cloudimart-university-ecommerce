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
      localStorage.setItem('auth_token', res.data.access_token);
      alert(`Logged in successfully! Welcome ${res.data.user.name}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h3 className="mb-4 text-center">Login</h3>
              <form onSubmit={onSubmit}>
                <div className="mb-3">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    className="form-control"
                  />
                </div>

                <div className="mb-4">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    type="password"
                    className="form-control"
                  />
                </div>

                <button type="submit" className="btn btn-primary w-100">
                  Login
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
