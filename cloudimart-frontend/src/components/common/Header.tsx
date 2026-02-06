// src/components/common/Header.tsx
'use client';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import client from '../../lib/api/client';

export default function Header() {
  const { count } = useCart();
  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [notifCount, setNotifCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;

    const loadCounts = async () => {
      try {
        const [ordersRes, notifRes] = await Promise.all([
          client.get('/api/orders/count'),
          client.get('/api/notifications'),
        ]);

        if (!mounted) return;

        setOrdersCount(ordersRes.data?.count ?? 0);
        const unread = (notifRes.data?.notifications ?? []).filter(
          (n: any) => !n.is_read
        ).length;
        setNotifCount(unread);
      } catch {
        if (!mounted) return;
        setOrdersCount(0);
        setNotifCount(0);
      }
    };

    loadCounts();
    const interval = setInterval(loadCounts, 30000); // refresh every 30s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner d-flex justify-content-between">
          <div className="text-muted small">
            Account &nbsp;&nbsp; Track Order &nbsp;&nbsp; Support
          </div>
          <div style={{ color: 'var(--brand-darkBlue)', fontWeight: 600 }}>
            Need help? Call us{' '}
            <span style={{ color: 'var(--brand-orange)', marginLeft: 8 }}>
              0123456789
            </span>
          </div>
        </div>
      </div>

      <header
        className="site-header"
        style={{ background: 'var(--brand-orange)', color: '#fff' }}
      >
        <div className="container d-flex align-items-center justify-content-between py-3">
          <Link
            href="/"
            className="d-flex align-items-center text-white text-decoration-none"
          >
            <img
              src="/logo.png"
              alt="Cloudimart"
              className="logo"
              style={{ height: 40, marginRight: 8 }}
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Cloudimart</div>
              <div
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}
              >
                Mzuzu University community
              </div>
            </div>
          </Link>

          <nav className="d-flex align-items-center gap-3">
            <Link
              href="/"
              className="text-white text-decoration-none small d-flex align-items-center"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                style={{ marginRight: 6 }}
              >
                <path
                  d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z"
                  fill="white"
                />
              </svg>
              Home
            </Link>

            <Link href="/products" className="text-white text-decoration-none small">
              Products
            </Link>

            <Link
              href="/orders"
              className="text-white text-decoration-none small d-flex align-items-center"
            >
              Orders
              <span className="badge bg-secondary ms-2">
                {ordersCount}
              </span>
            </Link>


            <Link
              href="/cart"
              className="btn btn-light btn-sm ms-3 d-flex align-items-center"
              style={{
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                style={{ marginRight: 8 }}
              >
                <path
                  d="M7 4h-2l-1 2v1h2l3 9h8l3-8H9"
                  stroke="#1E293B"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="10" cy="20" r="1" fill="#1E293B" />
                <circle cx="18" cy="20" r="1" fill="#1E293B" />
              </svg>
              <span
                style={{
                  color: 'var(--brand-darkBlue)',
                  fontWeight: 800,
                  marginRight: 8,
                }}
              >
                Cart
              </span>
              <span
                className="badge bg-secondary ms-2"
                style={{
                  fontWeight: 700,
                  minWidth: 28,
                  textAlign: 'center',
                  borderRadius: 999,
                }}
              >
                {typeof count === 'number' ? count : 0}
              </span>
            </Link>

                        {/* Notification Bell */}
            <Link
              href="/notifications"
              className="text-white position-relative d-flex align-items-center small"
              style={{ textDecoration: 'none' }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                fill="white"
                viewBox="0 0 24 24"
              >
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
            </Link>

          </nav>
        </div>
      </header>
    </>
  );
}
