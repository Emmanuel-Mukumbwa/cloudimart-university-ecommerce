// src/components/common/Header.tsx
'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import client from '../../lib/api/client';
import { useRouter } from 'next/navigation';
import CenteredModal from './CenteredModal';

type UserShape = { id?: number; name?: string; email?: string; role?: string } | null;

export default function Header() {
  const { count } = useCart();
  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [notifCount, setNotifCount] = useState<number>(0);
  const [user, setUser] = useState<UserShape>(null);

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginRedirect, setLoginRedirect] = useState<string | null>(null);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const router = useRouter();

  // Load user from localStorage
  const readUserFromStorage = () => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        setUser(parsed);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    readUserFromStorage();

    // listen for auth changes from other pages (login/logout)
    const onAuth = () => readUserFromStorage();
    const onStorage = (e: StorageEvent) => {
      if (e.key && (e.key.startsWith('user') || e.key === 'auth_token')) readUserFromStorage();
    };

    window.addEventListener('authChanged', onAuth as EventListener);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('authChanged', onAuth as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Helper role flags
  const isAdmin = !!user && user.role === 'admin';
  const isDelivery = !!user && user.role === 'delivery';
  const isCustomer = !!user && !isAdmin && !isDelivery;

  // Role-aware route mapping
  const getPathFor = (key: 'orders' | 'dashboard' | 'deliveries' | 'products' | 'cart') => {
    if (key === 'orders') {
      if (isAdmin) return '/admin/orders';
      if (isDelivery) return '/delivery/assignments';
      return '/orders';
    }
    if (key === 'dashboard') {
      if (isAdmin) return '/admin';
      return '/';
    }
    if (key === 'deliveries') return '/delivery/assignments';
    if (key === 'products') {
      if (isAdmin) return '/admin/products';
      return '/products';
    }
    if (key === 'cart') return '/cart';
    return '/';
  };

  // Fetch orders & notifications count periodically if logged in
  useEffect(() => {
    let mounted = true;
    let intervalId: number | undefined;

    const loadCounts = async () => {
      try {
        const [ordersRes, notifRes] = await Promise.all([
          client.get('/api/orders/count'),
          client.get('/api/notifications/unread-count'),
        ]);
        if (!mounted) return;
        setOrdersCount(ordersRes.data?.count ?? 0);
        setNotifCount(notifRes.data?.count ?? 0);
      } catch {
        if (!mounted) return;
        setOrdersCount(0);
        setNotifCount(0);
      }
    };

    if (user) {
      loadCounts();
      intervalId = window.setInterval(loadCounts, 30000);
    } else {
      setOrdersCount(0);
      setNotifCount(0);
    }

    return () => {
      mounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [user]);

  // Utility: protect route - if not logged in show prompt, else navigate
  const handleProtected = (path: string) => {
    if (user) {
      router.push(path);
    } else {
      setLoginRedirect(path);
      setShowLoginPrompt(true);
    }
  };

  // Logout flow: show confirm modal then logout
  const confirmLogout = () => setShowLogoutConfirm(true);

  const doLogout = async () => {
    setShowLogoutConfirm(false);
    try {
      await client.post('/api/auth/logout');
    } catch {
      // ignore server errors
    } finally {
      try {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
      } catch {}
      setUser(null);
      window.dispatchEvent(new Event('authChanged'));
      router.push('/');
    }
  };

  const goToLogin = () => {
    setShowLoginPrompt(false);
    if (loginRedirect) {
      router.push(`/login?redirect=${encodeURIComponent(loginRedirect)}`);
      setLoginRedirect(null);
    } else {
      router.push('/login');
    }
  };

  return (
    <>
      {/* Top bar */}
      <div className="topbar">
        <div className="container topbar-inner d-flex justify-content-between">
          <div className="d-flex align-items-center gap-3">
            {/* Account (clickable) */}
            <button
              type="button"
              className="btn btn-link p-0 text-decoration-none"
              onClick={() => {
                if (user) {
                  router.push('/account');
                } else {
                  setLoginRedirect(null);
                  setShowLoginPrompt(true);
                }
              }}
            >
              <strong style={{ color: 'var(--brand-darkBlue)' }}>Account</strong>
            </button>

            {/* Orders: visible only for customers (not for admin/delivery) */}
            {user && isCustomer && (
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none d-flex align-items-center"
                onClick={() => handleProtected(getPathFor('orders'))}
              >
                <span style={{ color: 'var(--muted)', marginRight: 8 }}>Orders</span>
                <span
                  className="badge bg-secondary ms-2"
                  style={{
                    fontWeight: 700,
                    minWidth: 24,
                    textAlign: 'center',
                    borderRadius: 999,
                  }}
                >
                  {ordersCount}
                </span>
              </button>
            )}

            {/* Support / link - visible to everyone 
            <Link href="/support" className="text-muted small">
              Support
            </Link> */}
          </div>

          <div style={{ color: 'var(--brand-darkBlue)', fontWeight: 600 }}>
            Need help? Call us{' '}
            <span style={{ color: 'var(--brand-orange)', marginLeft: 8 }}>0123456789</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="site-header" style={{ background: 'var(--brand-orange)', color: '#fff' }}>
        <div className="container d-flex align-items-center justify-content-between py-3">
          {/* Logo */}
          <Link href={isAdmin ? '/admin' : '/'} className="d-flex align-items-center text-white text-decoration-none">
            <div style={{ background: '#fff', borderRadius: 8, padding: 6, display: 'inline-flex', alignItems: 'center', marginRight: 8 }}>
              <img
                src="/cloudimart.png"
                alt="Cloudimart"
                className="logo"
                style={{ height: 40, width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Cloudimart</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>
                {isAdmin ? 'Admin console' : isDelivery ? 'Delivery portal' : 'Mzuzu University community'}
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="d-flex align-items-center gap-3">
            {/* Admin Dashboard link (visible only to admins) */}
            {isAdmin && (
              <Link href="/admin/dashboard" className="text-white text-decoration-none small">
                Dashboard
              </Link>
            )}

            {/* Home / Dashboard for customers */}
            {!isAdmin && !isDelivery && (
              <Link href="/" className="text-white text-decoration-none small d-flex align-items-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                  <path d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z" fill="white" />
                </svg>
                Home
              </Link>
            )}

            {/* Products: show to customers + admin (who manages products) */}
            {(isCustomer || isAdmin) && (
              <Link href={getPathFor('products')} className="text-white text-decoration-none small">
                Products
              </Link>
            )}

            {/* Notifications */}
            {user && (
              <button
                type="button"
                className="btn btn-link p-0 text-white position-relative d-flex align-items-center small"
                onClick={() => handleProtected('/notifications')}
                aria-label="Notifications"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 24 24">
                  <path d="M12 24a2.4 2.4 0 0 0 2.4-2.4h-4.8A2.4 2.4 0 0 0 12 24zM18 17v-5c0-3.07-1.63-5.64-4.5-6.32V5a1.5 1.5 0 0 0-3 0v.68C7.63 6.36 6 8.92 6 12v5l-1.29 1.29A1 1 0 0 0 6 20h12a1 1 0 0 0 .71-1.71L18 17z" />
                </svg>

                {notifCount > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{ fontSize: 10 }}
                  >
                    {notifCount}
                  </span>
                )}
              </button>
            )}

            {/* Cart: only for customers */}
            {isCustomer && (
              <button
                type="button"
                className="btn btn-light btn-sm ms-3 d-flex align-items-center"
                style={{ borderRadius: 999, fontWeight: 700 }}
                onClick={() => handleProtected(getPathFor('cart'))}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
                  <path d="M7 4h-2l-1 2v1h2l3 9h8l3-8H9" stroke="#1E293B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="10" cy="20" r="1" fill="#1E293B" />
                  <circle cx="18" cy="20" r="1" fill="#1E293B" />
                </svg>
                <span style={{ color: 'var(--brand-darkBlue)', fontWeight: 800, marginRight: 8 }}>Cart</span>
                <span className="badge bg-secondary ms-2" style={{ fontWeight: 700, minWidth: 28, textAlign: 'center', borderRadius: 999 }} aria-live="polite">
                  {typeof count === 'number' ? count : 0}
                </span>
              </button>
            )}

            {/* Auth area (right) */}
            {!user ? (
              <>
                <Link href="/login" className="text-white text-decoration-none small">Login</Link>
                <Link href="/register" className="text-white text-decoration-none small">Register</Link>
              </>
            ) : (
              <div className="d-flex align-items-center gap-2">
                <span className="text-white small">Hi, <strong>{user.name}</strong></span>
                <button className="btn btn-outline-light btn-sm" onClick={confirmLogout}>Logout</button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Login prompt modal (shows when user tries to access protected route) */}
      <CenteredModal
        show={showLoginPrompt}
        title="Sign in required"
        body="You need to sign in to continue. Would you like to sign in now?"
        onClose={goToLogin}
        onCancel={() => setShowLoginPrompt(false)}
        okLabel="Sign in"
        cancelLabel="Cancel"
      />

      {/* Logout confirm */}
      <CenteredModal
        show={showLogoutConfirm}
        title="Confirm logout"
        body="Are you sure you want to log out?"
        onClose={doLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        okLabel="Yes, log out"
        cancelLabel="Cancel"
      />
    </>
  );
}
