// src/components/common/Header.tsx
'use client';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import client from '../../lib/api/client';

export default function Header() {
  const { count } = useCart();
  const [ordersCount, setOrdersCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const loadCount = async () => {
      try {
        const res = await client.get('/api/orders/count');
        if (!mounted) return;
        setOrdersCount(res.data?.count ?? 0);
      } catch (e) {
        setOrdersCount(0);
      }
    };
    loadCount();
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <div className="topbar" aria-hidden="false">
        <div className="container topbar-inner">
          <div className="text-muted small">Account &nbsp;&nbsp; Track Order &nbsp;&nbsp; Support</div>
          <div style={{ color: 'var(--brand-darkBlue)', fontWeight: 600 }}>
            Need help? Call us <span style={{ color: 'var(--brand-orange)', marginLeft: 8 }}>0123456789</span>
          </div>
        </div>
      </div>

      <header className="site-header" role="banner" style={{ background: 'var(--brand-orange)', color: '#fff' }}>
        <div className="container d-flex align-items-center justify-content-between py-3">
          <div className="d-flex align-items-center" style={{ gap: 12 }}>
            <Link href="/" className="d-flex align-items-center text-white text-decoration-none">
              <img src="/logo.png" alt="Cloudimart" className="logo" style={{ height: 40, marginRight: 8 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Cloudimart</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>Mzuzu University community</div>
              </div>
            </Link>
          </div>

          <nav aria-label="Main navigation" className="d-flex align-items-center gap-3">
            <Link href="/" className="text-white text-decoration-none small d-flex align-items-center">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z" fill="white"/></svg>
                Home
              </span>
            </Link>

            <Link href="/register" className="text-white text-decoration-none small">Register</Link>
            <Link href="/login" className="text-white text-decoration-none small">Login</Link>
            <Link href="/products" className="text-white text-decoration-none small">Products</Link>

            <Link href="/orders" className="text-white text-decoration-none small d-flex align-items-center ms-2">
              Orders
              <span className="badge bg-secondary ms-2" style={{ fontWeight: 700, minWidth: 24, textAlign: 'center', borderRadius: 999 }}>
                {ordersCount}
              </span>
            </Link>

            <Link href="/cart" className="btn btn-light btn-sm ms-3 d-flex align-items-center" style={{ borderRadius: 999, fontWeight: 700 }} aria-label="View cart">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
                <path d="M7 4h-2l-1 2v1h2l3 9h8l3-8H9" stroke="#1E293B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="20" r="1" fill="#1E293B" />
                <circle cx="18" cy="20" r="1" fill="#1E293B" />
              </svg>
              <span style={{ color: 'var(--brand-darkBlue)', fontWeight: 800, marginRight: 8 }}>Cart</span>
              <span className="badge bg-secondary ms-2" style={{ fontWeight: 700, minWidth: 28, textAlign: 'center', borderRadius: 999 }} aria-live="polite">
                {typeof count === 'number' ? count : 0}
              </span>
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
