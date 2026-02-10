// src/app/(auth)/login/page.tsx
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
  const [showModal, setShowModal] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  // field-level errors (improve messages under inputs)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectQuery = searchParams?.get('redirect') ?? '/';

  // basic client-side validation helpers
  const validateBeforeSubmit = (): boolean => {
    const errs: typeof fieldErrors = {};
    if (!email) errs.email = 'Please enter your email';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Please enter a valid email address';
    if (!password) errs.password = 'Please enter your password';
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setShowModal(false);

    if (!validateBeforeSubmit()) return;

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

      // Success modal
      setRedirectUrl(redirect_url || '/');
      setShowModal(true);
    } catch (err: any) {
      console.error('Login error', err?.response ?? err);

      const resp = err?.response?.data ?? null;
      // Validation errors (422) - map to fields
      if (resp && resp.errors && typeof resp.errors === 'object') {
        const newFieldErrs: typeof fieldErrors = {};
        Object.keys(resp.errors).forEach((k) => {
          const v = resp.errors[k];
          if (Array.isArray(v) && v.length) newFieldErrs[k as keyof typeof newFieldErrs] = v[0];
          else if (typeof v === 'string') newFieldErrs[k as keyof typeof newFieldErrs] = v;
        });
        setFieldErrors(newFieldErrs);
        return;
      }

      // Auth failure messages
      if (err?.response?.status === 401) {
        setFieldErrors({ general: 'Incorrect email or password. Please try again.' });
      } else if (err?.response?.status === 403) {
        // e.g. deactivated account
        setFieldErrors({ general: resp?.message ?? 'Your account is not allowed to login. Contact support.' });
      } else if (err?.response?.status === 429) {
        setFieldErrors({ general: 'Too many attempts. Try again later.' });
      } else if (resp && resp.message) {
        setFieldErrors({ general: resp.message });
      } else {
        setFieldErrors({ general: 'Login failed. Please check your credentials and try again.' });
      }
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

              {/* general error */}
              {fieldErrors.general && <div className="alert alert-danger">{fieldErrors.general}</div>}

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <input
                    type="email"
                    className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    aria-invalid={!!fieldErrors.email}
                  />
                  {fieldErrors.email && <div className="invalid-feedback">{fieldErrors.email}</div>}
                </div>

                <div className="mb-4">
                  <input
                    type="password"
                    className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    aria-invalid={!!fieldErrors.password}
                  />
                  {fieldErrors.password && <div className="invalid-feedback">{fieldErrors.password}</div>}
                </div>

                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? (
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

      {/* Success modal */}
      <CenteredModal
        show={showModal}
        title="Login successful"
        body={
          <div className="text-center">
            <p>Welcome back to <strong>Cloudimart</strong>!</p>
            <p className="small text-muted">You’ll be redirected shortly.</p>
          </div>
        }
        onClose={handleModalOk}
        okLabel="Continue"
      />
    </div>
  );
}
