// File: cloudimart-frontend/src/components/common/Footer.tsx
import Link from 'next/link';
import React from 'react';

export default function Footer() {
  return (
    <footer className="site-footer mt-auto">
      <div className="container">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 py-3">
          {/* Left: copyright */}
          <div className="small" style={{ color: 'var(--muted)' }}>
            © {new Date().getFullYear()} Cloudimart — Mzuzu University Community Store
          </div>

          {/* Center: quick links */}
          <nav aria-label="Footer quick links" className="d-flex gap-3">
            <Link href="/terms" className="text-decoration-none small" aria-label="Terms and Conditions">
              Terms &amp; Conditions
            </Link>

          </nav>

          {/* Right: contact */}
          <div className="small" style={{ color: 'var(--muted)' }}>
            <a href="mailto:support@cloudimart.example" className="text-decoration-none" style={{ color: 'inherit' }}>
              support@cloudimart.ac
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
