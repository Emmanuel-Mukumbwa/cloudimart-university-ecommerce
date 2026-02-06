// File: cloudimart-frontend/src/app/%28auth%29/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import client from '../../../lib/api/client';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // ✅ Send login request to API
      const res = await client.post('/api/auth/login', { email, password });
      const { token, user, redirect_url } = res.data;

      // ✅ Store authentication details in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('user_id', user.id);
        localStorage.setItem('user_name', user.name);
        localStorage.setItem('user_email', user.email);
        localStorage.setItem('user_role', user.role);
      }

      // Save redirect URL to navigate after modal confirmation
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

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner /> : 'Login'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Success Modal */}
      {showModal && (
        <div
          className="modal fade show"
          tabIndex={-1}
          role="dialog"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">Login Successful</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleModalOk}
                ></button>
              </div>
              <div className="modal-body text-center">
                <p>
                  Welcome back to <strong>Cloudimart</strong>!
                </p>
                <p>
                  You’ll be redirected to your dashboard shortly.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-success w-100"
                  onClick={handleModalOk}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
