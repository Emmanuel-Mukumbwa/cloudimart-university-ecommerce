// src/components/common/Hero.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Hero() {
  const handleScrollToProducts = (e?: React.MouseEvent) => {
    e?.preventDefault();
    const el = document.getElementById('products');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else {
      // fallback: navigate to /products if #products not present
      window.location.href = '/products';
    }
  };

  return (
    <section className="bg-light py-5">
      <div className="container py-lg-5">
        <div className="row align-items-center">
          {/* LEFT */}
          <div className="col-lg-6 text-center text-lg-start">
            <span className="badge bg-primary-subtle mb-3" style={{ color: 'var(--brand-darkBlue)' }}>
              Cloudimart · Mzuzu University Community
            </span>

            <h1 className="display-5 fw-bold mb-3" style={{ color: '#07122a' }}>
              One store for the{' '}
              <span style={{ color: 'var(--brand-darkBlue)' }}>entire community</span>
            </h1>

            <p className="lead text-secondary mb-4">
              From students and faculty to staff and nearby residents, Cloudimart delivers
              stationery, dairy, and daily essentials right to your doorstep around Mzuzu
              University — fast, affordable, and reliable.
            </p>

            <div className="d-flex flex-wrap gap-3 justify-content-center justify-content-lg-start">
              <Link href="/products" className="btn btn-lg btn-warning text-white fw-semibold shadow-sm">
                Shop Now
              </Link>

              {/* View Catalog: smooth-scroll to #products (fallback to /products) */}
              <a
                href="#products"
                onClick={handleScrollToProducts}
                className="btn btn-lg btn-outline-warning fw-semibold"
                style={{ borderColor: 'var(--brand-orange)', color: 'var(--brand-orange)' }}
              >
                View Catalog
              </a>
            </div>

            <ul className="list-inline mt-4 small text-secondary">
              <li className="list-inline-item me-3">✅ Affordable local pricing</li>
              <li className="list-inline-item me-3">🚚 Quick campus delivery</li>
              <li className="list-inline-item">🔒 Secure checkout</li>
            </ul>
          </div>

          {/* RIGHT */}
          <div className="col-lg-6 text-center mt-5 mt-lg-0">
            <div className="position-relative d-inline-block" style={{ maxWidth: 400 }}>
              <Image
                src="/cloudimart.png"
                alt="Cloudimart storefront preview"
                width={2982}
                height={1010}
                className="rounded-4 shadow-lg"
                style={{ width: '100%', height: 'auto' }}
                priority={false}
                placeholder="empty"
                onError={(e: any) => {
                  // fall back to the existing svg if something goes wrong
                  const target = e?.target as HTMLImageElement | null;
                  if (target) {
                    target.onerror = null;
                    target.src = '/file.svg';
                  }
                }}
              />

              <div
                className="position-absolute top-0 start-0 w-100 h-100 rounded-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(249,115,22,0.15))',
                  filter: 'blur(40px)',
                  zIndex: -1,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
