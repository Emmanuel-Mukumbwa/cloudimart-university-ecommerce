//src/components/common/Header.tsx
'use client';

import Link from 'next/link';
import React from 'react';

export default function Header() {
  return (
    <>
      {/* Top contact bar */}
      <div className="topbar">
        <div className="container topbar-inner">
          <div>Account &nbsp;&nbsp; Track Order &nbsp;&nbsp; Support</div>
          <div style={{ color: 'var(--brand-darkBlue)', fontWeight: 600 }}>
            Need help? Call us <span style={{ color: 'var(--brand-orange)', marginLeft: 8 }}>0992315319</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="site-header">
        <div className="container d-flex align-items-center justify-content-between">
          <div className="brand d-flex align-items-center">
            <img src="/logo.png" alt="Cloudimart" className="logo" style={{ height: 36 }} />
            <div style={{ marginLeft: 10 }}>
              <div style={{ fontWeight: 700, color: 'var(--brand-darkBlue)' }}>Cloudimart</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mzuzu University community store</div>
            </div>
          </div>

          <nav className="d-flex align-items-center gap-3">
            <Link href="/register" className="text-decoration-none text-muted mx-2">Register</Link>
            <Link href="/login" className="text-decoration-none text-muted mx-2">Login</Link>
            <Link href="/products" className="text-decoration-none text-muted mx-2">Products</Link>

            {/* small cart / icons area (placeholder) */}
            <div className="ms-3 d-flex align-items-center gap-2">
              <Link href="/cart" className="btn btn-sm btn-outline-secondary">Cart</Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Category bar (thin orange bar under header) */}
      <div className="category-bar">
        <div className="container category-inner">
          <div className="d-flex align-items-center">
            <div className="me-3"><i className="bi bi-list"></i></div>
            <div className="category-item">All Categories</div>
            <div className="ms-4 d-none d-md-flex gap-2">
              <a className="category-item" href="/products?category=stationery">Stationery</a>
              <a className="category-item" href="/products?category=dairy">Dairy</a>
            </div>
          </div>

          <div className="ms-auto d-flex align-items-center gap-3">
            <form className="d-flex" action="/products">
              <input name="q" className="form-control form-control-sm" style={{ minWidth: 180 }} placeholder="Search products..." />
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
