// File: src/components/common/AdminTabs.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import client from '../../lib/api/client';
 
type Tab = {
  href: string;
  label: string;
  variant?: string; 
};

const DEFAULT_TABS: Tab[] = [
  { href: '/admin/dashboard', label: 'Dashboard', variant: 'outline-primary' },
  { href: '/admin/users', label: 'Users', variant: 'outline-primary' },
  { href: '/admin/products', label: 'Products', variant: 'outline-secondary' },
  { href: '/admin/orders', label: 'Orders', variant: 'outline-success' },
  { href: '/admin/payments', label: 'Payments', variant: 'outline-info' },
  { href: '/admin/notifications', label: 'Notifications', variant: 'outline-warning' },
  { href: '/admin/locations', label: 'Locations', variant: 'outline-dark' },
  { href: '/admin/terms', label: 'Terms', variant: 'outline-secondary' }, 
];

export default function AdminTabs({ tabs = DEFAULT_TABS }: { tabs?: Tab[] }) {
  const pathname = usePathname() ?? '/admin';
  const [pendingProofs, setPendingProofs] = useState<number>(0);
  const [ordersUnassigned, setOrdersUnassigned] = useState<number>(0);

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin' || pathname === '/admin/';
    return pathname.startsWith(href);
  };

  useEffect(() => {
    // fetch summary counts for badges
    let mounted = true;
    const fetchSummary = async () => {
      try {
        const res = await client.get('/api/admin/summary');
        if (!mounted) return;
        const data = res.data ?? {};
        setPendingProofs(Number(data.pending_proofs ?? 0));
        setOrdersUnassigned(Number(data.orders_unassigned ?? 0));
      } catch (err) {
        // silently ignore — we don't want UI break if summary fails
        console.warn('Failed to load admin summary:', err);
      }
    };

    fetchSummary();

    // optional: refresh counts periodically (e.g., every 60s)
    const interval = setInterval(fetchSummary, 60000);

    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap">
      <h3 className="mb-0">Admin Dashboard</h3>
      <div className="d-flex gap-2 flex-wrap" role="navigation" aria-label="Admin navigation tabs">
        {tabs.map((t) => {
          // determine badge if needed
          let badge: React.ReactNode = null;
          if (t.href === '/admin/payments' && pendingProofs > 0) {
            badge = <span className="badge bg-danger ms-2" aria-label={`${pendingProofs} payments needing review`}>{pendingProofs}</span>;
          }
          if (t.href === '/admin/orders' && ordersUnassigned > 0) {
            badge = <span className="badge bg-danger ms-2" aria-label={`${ordersUnassigned} orders without delivery`}>{ordersUnassigned}</span>;
          }

          return (
            <Link
              key={t.href}
              href={t.href}
              className={`btn btn-sm btn-${t.variant ?? 'outline-primary'} ${isActive(t.href) ? '' : ''}`}
              aria-current={isActive(t.href) ? 'page' : undefined}
            >
              <span className={isActive(t.href) ? 'fw-bold' : ''}>
                {t.label}
                {badge}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
