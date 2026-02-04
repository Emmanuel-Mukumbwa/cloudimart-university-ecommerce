// src/components/common/Hero.tsx
'use client';

import React from 'react';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="bg-light py-5">
      <div className="container py-lg-5">
        <div className="row align-items-center">
          {/* LEFT */}
          <div className="col-lg-6 text-center text-lg-start">
            <span className="badge bg-primary-subtle text-primary mb-3">
              Cloudimart · Mzuzu University Community
            </span>

            <h1 className="display-5 fw-bold mb-3 text-dark">
              One store for the <span className="text-primary">entire community</span>
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
              <Link href="/products" className="btn btn-lg btn-outline-warning fw-semibold">
                View Catalog
              </Link>
            </div>

            <ul className="list-inline mt-4 small text-secondary">
              <li className="list-inline-item me-3">✅ Affordable local pricing</li>
              <li className="list-inline-item me-3">🚚 Quick campus delivery</li>
              <li className="list-inline-item">🔒 Secure checkout</li>
            </ul>
          </div>

          {/* RIGHT */}
          <div className="col-lg-6 text-center mt-5 mt-lg-0">
            <div className="position-relative d-inline-block">
              <img
                src="/file.svg"
                alt="Cloudimart illustration"
                className="img-fluid rounded-4 shadow-lg"
                style={{ maxWidth: '400px' }}
              />
              <div
                className="position-absolute top-0 start-0 w-100 h-100 rounded-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(249,115,22,0.15))',
                  filter: 'blur(40px)',
                  zIndex: -1,
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
