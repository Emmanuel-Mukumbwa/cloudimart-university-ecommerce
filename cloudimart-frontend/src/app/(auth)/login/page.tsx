// File: cloudimart-frontend/src/app/%28auth%29/login/page.tsx
'use client';
import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = API ? `${API}/api/auth/login` : '/api/auth/login';
      const res = await axios.post(url, { email, password });

      // ✅ Store user + token in localStorage
      localStorage.setItem('auth_token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      localStorage.setItem('user_id', res.data.user.id);
      localStorage.setItem('user_name', res.data.user.name);
      localStorage.setItem('user_email', res.data.user.email);

      setShowModal(true); // show modal on success
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalOk = () => {
    setShowModal(false);
    router.push('/'); // redirect to home
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h3 className="mb-4 text-center">Login</h3>

              {error && <div className="alert alert-danger">{error}</div>}

              <form onSubmit={onSubmit}>
                <div className="mb-3">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    className="form-control"
                    required
                  />
                </div>

                <div className="mb-4">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    type="password"
                    className="form-control"
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
                <p>Welcome back to <strong>Cloudimart</strong>!</p>
                <p>You can now browse products and add items to your cart.</p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-success w-100"
                  onClick={handleModalOk}
                >
                  Continue to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
