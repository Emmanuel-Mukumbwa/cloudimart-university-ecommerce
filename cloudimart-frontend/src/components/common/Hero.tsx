// src/components/common/Hero.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Hero() {
  const [greeting, setGreeting] = useState<string>('');
  const [userName, setUserName] = useState<string | null>(null);

  // Try common places to find logged-in user name (non-blocking)
  const readUserName = () => {
    try {
      // 1) window global (if your app exposes it)
      // @ts-ignore
      const globalUser = typeof window !== 'undefined' ? window.__USER || window.user : null;
      if (globalUser) {
        if (typeof globalUser === 'string') return globalUser;
        return globalUser.name || globalUser.fullName || globalUser.full_name || globalUser.firstName || null;
      }

      // 2) localStorage common keys
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys = ['user', 'profile', 'auth', 'currentUser'];
        for (const k of keys) {
          const raw = window.localStorage.getItem(k);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed) {
              const candidate =
                parsed.name ||
                parsed.fullName ||
                parsed.full_name ||
                parsed.firstName ||
                parsed.given_name ||
                parsed.username ||
                null;
              if (candidate) return candidate;
            }
          } catch {
            // raw string like a username
            if (raw && raw.length < 60) return raw;
          }
        }
      }
    } catch (err) {
      // ignore
    }
    return null;
  };

  useEffect(() => {
    // determine Malawi time hour using Intl with Africa/Blantyre tz (client-only)
    const dtf = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Africa/Blantyre',
    });
    const hourStr = dtf.format(new Date());
    const hour = Number(hourStr);
    let g = 'Good evening';
    if (hour >= 5 && hour < 12) g = 'Good morning';
    else if (hour >= 12 && hour < 18) g = 'Good afternoon';
    else g = 'Good evening';

    const name = readUserName();
    setUserName(name);
    setGreeting(name ? `${g}, ${name}` : g);
  }, []);

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
    <section className="bg-light py-3" style={{ position: 'relative' }}>
      <div className="container py-lg-4">
        <div className="row align-items-center">
          {/* LEFT */}
          <div className="col-lg-6 text-center text-lg-start">
            <span className="badge bg-primary-subtle mb-2" style={{ color: 'var(--brand-darkBlue)' }}>
              Cloudimart · Mzuzu University Community
            </span>

            <h1 className="display-5 fw-bold mb-3" style={{ color: '#07122a' }}>
              One store for the{' '}
              <span style={{ color: 'var(--brand-darkBlue)' }}>entire community</span>
            </h1>

            <p className="lead text-secondary mb-3">
              Whether you're a student, lecturer, staff member, or nearby resident, Cloudimart brings
              stationery, dairy, and everyday essentials right to your door; anywhere in the Mzuzu
              University community. No trips to town. No delays. Just convenience.
            </p>

            <div className="d-flex flex-wrap gap-2 justify-content-center justify-content-lg-start">
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

            <ul className="list-inline mt-3 small text-secondary">
              <li className="list-inline-item me-3">✅ Affordable local pricing</li>
              <li className="list-inline-item me-3">🚚 Quick delivery</li>
              <li className="list-inline-item">🔒 Secure checkout</li>
            </ul>
          </div>

          {/* RIGHT */}
          <div className="col-lg-6 text-center mt-3 mt-lg-0">
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
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(249,115,22,0.12))',
                  filter: 'blur(36px)',
                  zIndex: -1,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* sticky/absolute greeting placed as a corner element of the hero */}
      {greeting && (
        <div className="greeting-sticky-wrapper" aria-hidden>
          <div className="greeting-badge d-inline-flex align-items-center px-3 py-2 rounded-3 shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="me-2"
              aria-hidden
              focusable="false"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>
            </svg>

            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#07122a' }}>{greeting}</div>
              <div style={{ fontSize: 11, color: 'var(--bs-secondary-color, #6c757d)' }}>
                Welcome to Cloudimart
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* place greeting in top-right corner of the hero */
        .greeting-sticky-wrapper {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          pointer-events: auto;
        }

        .greeting-badge {
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(11, 22, 45, 0.04);
          backdrop-filter: blur(6px);
          transform: translateY(6px);
          opacity: 0;
          animation: greetingFadeUp 560ms ease forwards;
          box-shadow: 0 6px 18px rgba(7,18,42,0.06);
        }

        @keyframes greetingFadeUp {
          from { transform: translateY(6px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }

        /* ensure the greeting doesn't overflow on small screens:
           convert to normal flow with margin so it doesn't overlap the image */
        @media (max-width: 991.98px) {
          .greeting-sticky-wrapper {
            position: static;
            margin-bottom: 0.75rem;
            justify-content: flex-end;
            padding-right: 0;
          }
          .greeting-badge {
            transform: none;
            animation: none;
            opacity: 1;
            width: auto;
          }
        }

        /* when hero is short, reduce padding for visual balance */
        @media (min-width: 1200px) {
          .greeting-sticky-wrapper { top: 20px; right: 24px; }
        }
      `}</style>
    </section>
  );
}
