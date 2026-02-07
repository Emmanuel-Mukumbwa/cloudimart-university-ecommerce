//src/app/(admin)/admin/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/api/admin/dashboard');
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="container py-5 text-center"><LoadingSpinner /></div>;

  if (error) return <div className="container py-5"><div className="alert alert-danger">{error}</div></div>;

  const usersByRole = data.users_by_role ?? {};
  const orders = data.orders ?? {};
  const payments = data.payments ?? {};
  const topProducts = data.top_products ?? [];
  const recentOrders: Order[] = data.recent_orders ?? [];
  const pendingDeliveries: Order[] = data.pending_deliveries ?? [];
  const failedPayments = data.failed_payments ?? [];

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Admin Dashboard</h3>
        <div>
          <Link href="/admin/users" className="btn btn-outline-primary me-2">Manage Users</Link>
          <Link href="/admin/products" className="btn btn-outline-secondary">Manage Products</Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card p-3">
            <div className="small text-muted">Total users</div>
            <div className="h4">{Object.values(usersByRole).reduce((a: any,b: any)=>a+b,0)}</div>
            <div className="small mt-2">
              {Object.keys(usersByRole).map((r) => (
                <div key={r}>{r}: <strong>{usersByRole[r]}</strong></div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card p-3">
            <div className="small text-muted">Orders</div>
            <div className="h4">{orders.total ?? 0}</div>
            <div className="small mt-2">
              Pending: {orders.pending ?? 0} — Pending delivery: {orders.pending_delivery ?? 0} — Delivered: {orders.delivered ?? 0}
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card p-3">
            <div className="small text-muted">Payments collected (successful)</div>
            <div className="h4">MK {Number(payments.collected ?? 0).toFixed(2)}</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card p-3">
            <div className="small text-muted">Pending deliveries</div>
            <div className="h4">{pendingDeliveries.length}</div>
            <div className="small mt-2">Failed payments: {failedPayments.length}</div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card p-3 mb-3">
            <h6>Top selling products</h6>
            <ol className="mb-0">
              {topProducts.length === 0 ? <li className="text-muted">No sales yet</li> : (
                topProducts.map((p: any) => <li key={p.id}>{p.name} — {p.total_qty} sold</li>)
              )}
            </ol>
          </div>

          <div className="card p-3">
            <h6>Recent orders</h6>
            <ul className="list-group list-group-flush">
              {recentOrders.length === 0 && <div className="text-muted p-2">No recent orders</div>}
              {recentOrders.map((o) => (
                <li className="list-group-item" key={o.id}>
                  <div className="d-flex justify-content-between">
                    <div>
                      <div className="fw-bold">{o.order_id}</div>
                      <div className="small text-muted">Customer: {o.user?.name ?? '—'} — {o.user?.phone_number ?? '—'}</div>
                      <div className="small mt-1">Total: MK {Number(o.total).toFixed(2)}</div>
                    </div>
                    <div className="text-end">
                      <div className="small text-muted">{new Date(o.created_at).toLocaleString()}</div>
                      <div className="badge bg-info mt-2">{o.status}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card p-3 mb-3">
            <h6>Pending deliveries</h6>
            {pendingDeliveries.length === 0 ? <div className="text-muted">No pending deliveries</div> : (
              <ul className="list-group list-group-flush">
                {pendingDeliveries.map((o) => (
                  <li className="list-group-item" key={o.id}>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-bold">{o.order_id}</div>
                        <div className="small text-muted">{o.user?.name ?? '—'} — {o.user?.phone_number ?? '—'}</div>
                        <div className="small">Address: {o.delivery_address}</div>
                      </div>
                      <div className="text-end">
                        <div className="small">{new Date(o.created_at).toLocaleString()}</div>
                        <div className="badge bg-warning mt-2">{o.status}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-3">
            <h6>Recent failed payments</h6>
            {failedPayments.length === 0 ? <div className="text-muted">No failed payments</div> : (
              <ul className="list-group list-group-flush">
                {failedPayments.map((p: any) => (
                  <li key={p.id} className="list-group-item">
                    <div className="d-flex justify-content-between">
                      <div>
                        <div className="fw-bold">{p.tx_ref}</div>
                        <div className="small text-muted">Amount: MK {Number(p.amount).toFixed(2)} — Mobile: {p.mobile}</div>
                      </div>
                      <div className="small text-muted">{new Date(p.created_at).toLocaleString()}</div>
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
