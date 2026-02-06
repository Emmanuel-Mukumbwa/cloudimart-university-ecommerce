// src/app/(auth)/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import client from '../../../lib/api/client';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import CenteredModal from '../../../components/common/CenteredModal';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectQuery = searchParams?.get('redirect') ?? '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await client.post('/api/auth/login', { email, password });

      const token =
        res.data?.token ??
        res.data?.access_token ??
        res.data?.accessToken ??
        res.data?.data?.token ??
        null;

      const user = res.data?.user ?? res.data?.data?.user ?? null;
      const redirect_url = res.data?.redirect_url ?? redirectQuery ?? '/';

      // Save to localStorage
      if (typeof window !== 'undefined') {
        if (token) localStorage.setItem('auth_token', token);
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
          localStorage.setItem('user_id', String(user.id));
          localStorage.setItem('user_name', user.name);
          localStorage.setItem('user_email', user.email);
          localStorage.setItem('user_role', user.role ?? '');
        }
      }

      // Inform other windows/components
      window.dispatchEvent(new Event('authChanged'));

      // Save redirect, show success modal
      setRedirectUrl(redirect_url || '/');
      setShowModal(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || err?.userMessage || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalOk = () => {
    setShowModal(false);
    router.push(redirectUrl || '/');
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h3 className="mb-4 text-center fw-bold">Login</h3>

              {error && <div className="alert alert-danger">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                  />
                </div>

                <div className="mb-4">
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? (
                    // small spinner inline for button
                    <span className="d-inline-flex align-items-center gap-2">
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      Signing in...
                    </span>
                  ) : (
                    'Login'
                  )}
                </button>
              </form>

              <div className="text-center mt-3">
                <p className="small mb-0">
                  Don't have an account?{' '}
                  <a href="/register" className="fw-semibold">
                    Register
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success modal (re-using CenteredModal) */}
      <CenteredModal
        show={showModal}
        title="Login Successful"
        body={
          <div className="text-center">
            <p>Welcome back to <strong>Cloudimart</strong>!</p>
            <p>You’ll be redirected shortly.</p>
          </div>
        }
        onClose={handleModalOk}
        okLabel="Continue"
      />
    </div>
  );
}
