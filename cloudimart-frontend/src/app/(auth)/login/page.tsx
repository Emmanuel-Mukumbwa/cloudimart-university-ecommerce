// src/app/(auth)/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import client from '../../../lib/api/client';
import CenteredModal from '../../../components/common/CenteredModal';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // field-level errors (email, password) and a general/top error
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
    // reset errors (preserve UX by clearing before server roundtrip)
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

      // 1) If backend returned structured validation errors (422 with errors object),
      //    map each field key exactly to the corresponding input.
      if (resp && resp.errors && typeof resp.errors === 'object') {
        const newFieldErrs: typeof fieldErrors = {};

        // if the server returned field specific errors for email/password, use them directly
        if (resp.errors.email) {
          const v = resp.errors.email;
          newFieldErrs.email = Array.isArray(v) && v.length ? v[0] : String(v);
        }
        if (resp.errors.password) {
          const v = resp.errors.password;
          newFieldErrs.password = Array.isArray(v) && v.length ? v[0] : String(v);
        }

        // any other non-field errors — pick first and show as general
        const otherKeys = Object.keys(resp.errors).filter(k => k !== 'email' && k !== 'password');
        if (otherKeys.length) {
          const k = otherKeys[0];
          const v = resp.errors[k];
          newFieldErrs.general = Array.isArray(v) && v.length ? v[0] : String(v);
        }

        setFieldErrors(newFieldErrs);
        setLoading(false);
        return;
      }

      // 2) If server responds with a typical auth failure status (401) — show a clear general message
      if (err?.response?.status === 401) {
        setFieldErrors({ general: 'Incorrect email or password. Please try again.' });
        setLoading(false);
        return;
      }

      // 3) Forbidden / Deactivated
      if (err?.response?.status === 403) {
        setFieldErrors({ general: resp?.message ?? 'Your account is not allowed to login. Contact support.' });
        setLoading(false);
        return;
      }

      // 4) Rate limit
      if (err?.response?.status === 429) {
        setFieldErrors({ general: 'Too many attempts. Try again later.' });
        setLoading(false);
        return;
      }

      // 5) If backend returned a generic message string, display it as general.
      if (resp && resp.message) {
        setFieldErrors({ general: String(resp.message) });
        setLoading(false);
        return;
      }

      // Fallback
      setFieldErrors({ general: 'Login failed. Please check your credentials and try again.' });
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

              {/* general/top error */}
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
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  />
                  {fieldErrors.email && <div id="email-error" className="invalid-feedback">{fieldErrors.email}</div>}
                </div>

                <div className="mb-4">
                  {/* Use bootstrap input-group so the toggle sits inside the input */}
                  <div className={`input-group ${fieldErrors.password ? 'is-invalid' : ''}`}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPassword((s) => !s)}
                      onMouseDown={(e) => e.preventDefault()} // keep focus on input
                      aria-pressed={showPassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        // simple "eye-off" SVG
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
                          <path d="M13.359 11.238l1.292 1.292a.5.5 0 0 1-.708.708l-1.3-1.3A8.13 8.13 0 0 1 8 13.5c-3.135 0-5.7-1.788-7.166-3.5A9.71 9.71 0 0 1 2.222 8c.42-.558 1.007-1.234 1.702-1.82L.646 1.94a.5.5 0 1 1 .708-.708l13 13a.5.5 0 0 1-.708.708l-1.287-1.287z"/>
                          <path d="M10.58 7.718a2 2 0 0 1-2.298 2.298l2.298-2.298z"/>
                        </svg>
                      ) : (
                        // simple "eye" SVG
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
                          <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM8 12.5A4.5 4.5 0 1 1 8 3.5a4.5 4.5 0 0 1 0 9z"/>
                          <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>
                        </svg>
                      )}
                    </button>
                  </div>

                  {fieldErrors.password && <div id="password-error" className="invalid-feedback d-block">{fieldErrors.password}</div>}
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
