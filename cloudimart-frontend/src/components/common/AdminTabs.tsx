//src/components/common/AdminTabs.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = {
  href: string;
  label: string;
  variant?: string; // optional for styling (bootstrap class suffix)
};

const DEFAULT_TABS: Tab[] = [
  { href: '/admin', label: 'Dashboard', variant: 'outline-primary' },
  { href: '/admin/users', label: 'Users', variant: 'outline-primary' },
  { href: '/admin/products', label: 'Products', variant: 'outline-secondary' },
  { href: '/admin/orders', label: 'Orders', variant: 'outline-success' },
  { href: '/admin/payments', label: 'Payments', variant: 'outline-info' },
  { href: '/admin/notifications', label: 'Notifications', variant: 'outline-warning' },
  { href: '/admin/locations', label: 'Locations', variant: 'outline-dark' },
];

export default function AdminTabs({ tabs = DEFAULT_TABS }: { tabs?: Tab[] }) {
  const pathname = usePathname() ?? '/admin';

  // small helper to mark active when path startsWith tab href
  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin' || pathname === '/admin/';
    return pathname.startsWith(href);
  };

  return (
    <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap">
      <h3 className="mb-0">Admin Dashboard</h3>
      <div className="d-flex gap-2 flex-wrap" role="navigation" aria-label="Admin navigation tabs">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`btn btn-sm btn-${t.variant ?? 'outline-primary'} ${isActive(t.href) ? '' : ''}`}
            aria-current={isActive(t.href) ? 'page' : undefined}
          >
            <span className={isActive(t.href) ? 'fw-bold' : ''}>{t.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
