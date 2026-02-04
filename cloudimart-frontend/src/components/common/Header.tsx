//src/components/common/Header.tsx
import Link from 'next/link';
import React from 'react';

export default function Header() {
  return (
    <>
      {/* thin top contact strip */}
      <div className="topbar" aria-hidden="false">
        <div className="container topbar-inner">
          <div className="text-muted small">Account &nbsp;&nbsp; Track Order &nbsp;&nbsp; Support</div>
          <div style={{ color: 'var(--brand-darkBlue)', fontWeight: 600 }}>
            Need help? Call us <span style={{ color: 'var(--brand-orange)', marginLeft: 8 }}>0123456789</span>
          </div>
        </div>
      </div>

      {/* main header (orange) */}
      <header
        className="site-header"
        role="banner"
        style={{ background: 'var(--brand-orange)', color: '#fff' }}
      >
        <div className="container d-flex align-items-center justify-content-between py-3">
          {/* Brand */}
          <div className="d-flex align-items-center" style={{ gap: 12 }}>
            <Link href="/" className="d-flex align-items-center text-white text-decoration-none">
              <img src="/logo.png" alt="Cloudimart" className="logo" style={{ height: 40, marginRight: 8 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Cloudimart</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>Mzuzu University community</div>
              </div>
            </Link>
          </div>

          {/* Nav + Cart */}
          <nav aria-label="Main navigation" className="d-flex align-items-center gap-3">
            <Link href="/register" className="text-white text-decoration-none small">Register</Link>
            <Link href="/login" className="text-white text-decoration-none small">Login</Link>
            <Link href="/products" className="text-white text-decoration-none small">Products</Link>

            {/* Cart button */}
            <Link
              href="/cart"
              className="btn btn-light btn-sm ms-3"
              style={{ borderRadius: 999, fontWeight: 700 }}
              aria-label="View cart"
            >
              Cart <span className="badge bg-secondary ms-2" style={{ fontWeight: 700 }}>0</span>
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
