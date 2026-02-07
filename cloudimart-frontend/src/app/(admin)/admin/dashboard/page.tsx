// File: src/app/(admin)/admin/dashboard/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import AdminTabs from '../../../../components/common/AdminTabs';
import Link from 'next/link';

type TopProduct = { id: number; name: string; total_qty: number };
type OrderItem = { id: number; product: { id: number; name: string }; quantity: number; price: number };
type Order = {
  id: number;
  order_id: string;
  total: number;
  delivery_address: string;
  status: string;
  created_at: string;
  user?: { id: number; name: string; phone_number: string };
  items?: OrderItem[];
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/api/admin/dashboard');
      setData(res.data);
      setLastUpdated(new Date().toLocaleString());
    } catch (err: any) {
      console.error('Admin dashboard load error', err);
      setError(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="container py-5 text-center"><LoadingSpinner /></div>;
  if (error) return <div className="container py-5"><div className="alert alert-danger">{error}</div></div>;

  const usersByRole = data?.users_by_role ?? {};
  const orders = data?.orders ?? {};
  const payments = data?.payments ?? {};
  const topProducts: TopProduct[] = data?.top_products ?? [];
  const recentOrders: Order[] = data?.recent_orders ?? [];
  const pendingDeliveries: Order[] = data?.pending_deliveries ?? [];
  const failedPayments = data?.failed_payments ?? [];

  const totalUsers = Object.values(usersByRole).reduce((a: any, b: any) => a + b, 0);

  return (
    <div className="container py-5">
      {/* Reusable Admin Tabs + quick actions */}
      <AdminTabs />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="small text-muted">Last updated: {lastUpdated ?? '—'}</div>
        <div>
          <button
            className="btn btn-sm btn-outline-secondary me-2"
            onClick={() => load()}
            disabled={loading}
            aria-label="Refresh dashboard"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link href="/admin/orders" className="btn btn-sm btn-outline-primary">Manage orders</Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card p-3 shadow-sm">
            <div className="small text-muted">Total users</div>
            <div className="h4">{totalUsers}</div>
            <div className="small mt-2">
              {Object.keys(usersByRole).length === 0 ? (
                <div className="text-muted">No users yet</div>
              ) : (
                Object.keys(usersByRole).map((r) => (
                  <div key={r}>{r}: <strong>{usersByRole[r]}</strong></div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card p-3 shadow-sm">
            <div className="small text-muted">Orders</div>
            <div className="h4">{orders.total ?? 0}</div>
            <div className="small mt-2">
              Pending: {orders.pending ?? 0}<br />
              Pending delivery: {orders.pending_delivery ?? 0}<br />
              Delivered: {orders.delivered ?? 0}
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card p-3 shadow-sm">
            <div className="small text-muted">Payments collected</div>
            <div className="h4 text-success">MK {Number(payments.collected ?? 0).toFixed(2)}</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card p-3 shadow-sm">
            <div className="small text-muted">Pending deliveries</div>
            <div className="h4">{pendingDeliveries.length}</div>
            <div className="small mt-2 text-danger">Failed payments: {failedPayments.length}</div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="row mb-4">
        {/* Left column */}
        <div className="col-md-6">
          <div className="card p-3 mb-3 shadow-sm">
            <h6>Top selling products</h6>
            <ol className="mb-0">
              {topProducts.length === 0
                ? <li className="text-muted">No sales yet</li>
                : topProducts.map((p) => (
                    <li key={p.id}>{p.name} — {p.total_qty} sold</li>
                  ))}
            </ol>
          </div>

          <div className="card p-3 shadow-sm">
            <h6>Recent orders</h6>
            {recentOrders.length === 0 ? (
              <div className="text-muted">No recent orders</div>
            ) : (
              <table className="table table-sm mb-0">
                <thead>
                  <tr><th>Order</th><th>User</th><th>Total</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.order_id}</td>
                      <td>{o.user?.name ?? '—'}</td>
                      <td>MK {Number(o.total).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${
                          o.status === 'delivered' ? 'bg-success' :
                          o.status === 'pending_delivery' ? 'bg-warning text-dark' :
                          'bg-secondary'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="col-md-6">
          <div className="card p-3 mb-3 shadow-sm">
            <h6>Pending deliveries</h6>
            {pendingDeliveries.length === 0 ? (
              <div className="text-muted">No pending deliveries</div>
            ) : (
              <ul className="list-group list-group-flush">
                {pendingDeliveries.slice(0, 6).map((o) => (
                  <li className="list-group-item" key={o.id}>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-bold">{o.order_id}</div>
                        <div className="small text-muted">{o.user?.name ?? '—'} — {o.user?.phone_number ?? '—'}</div>
                        <div className="small">Address: {o.delivery_address}</div>
                      </div>
                      <div className="text-end small text-muted">
                        {o.created_at ? new Date(o.created_at).toLocaleString() : ''}
                        <div><span className="badge bg-warning text-dark mt-1">{o.status}</span></div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 text-end">
              <Link href="/admin/orders" className="btn btn-sm btn-outline-primary">Manage deliveries</Link>
            </div>
          </div>

          <div className="card p-3 shadow-sm">
            <h6>Recent failed payments</h6>
            {failedPayments.length === 0 ? (
              <div className="text-muted">No failed payments</div>
            ) : (
              <ul className="list-group list-group-flush">
                {failedPayments.slice(0, 8).map((p: any) => (
                  <li key={p.id} className="list-group-item">
                    <div className="d-flex justify-content-between">
                      <div>
                        <div className="fw-bold">{p.tx_ref}</div>
                        <div className="small text-muted">
                          Amount: MK {Number(p.amount).toFixed(2)} — Mobile: {p.mobile ?? '—'}
                        </div>
                      </div>
                      <div className="small text-muted">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
