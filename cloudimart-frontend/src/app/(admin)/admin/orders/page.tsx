'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

type OrderItem = { id:number, product_name?:string, price:number, quantity:number };
type Order = {
  id:number;
  order_id:string;
  user?: { id:number, name:string, phone_number?:string };
  total:number;
  status:string;
  delivery_address:string;
  created_at:string;
  order_items?: OrderItem[];
  items?: OrderItem[];
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const url = filterStatus === 'all' ? '/api/admin/orders' : `/api/admin/orders?status=${encodeURIComponent(filterStatus)}`;
      const res = await client.get(url);
      setOrders(res.data.data ?? res.data.orders ?? res.data ?? []);
    } catch (err: any) {
      console.error('Load admin orders error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const changeStatus = async (id:number, newStatus:string) => {
    if (!confirm(`Change order status to "${newStatus}"?`)) return;
    try {
      const res = await client.post(`/api/admin/orders/${id}/status`, { status: newStatus });
      setMessage(res.data?.message ?? 'Updated');
      load();
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Update failed');
    }
  };

  if (loading) return <div className="container py-5 text-center"><LoadingSpinner /></div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between mb-3 align-items-center">
        <h4>Orders</h4>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="pending_delivery">Pending delivery</option>
            <option value="delivered">Delivered</option>
          </select>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      {orders.length === 0 ? (
        <div className="text-muted">No orders found.</div>
      ) : (
        <div className="list-group">
          {orders.map(o => {
            const items = (o.order_items ?? o.items ?? []);
            return (
              <div key={o.id} className="list-group-item mb-2 shadow-sm">
                <div className="d-flex justify-content-between">
                  <div>
                    <div className="fw-bold">{o.order_id}</div>
                    <div className="small text-muted">Customer: {o.user?.name ?? '—'} ({o.user?.phone_number ?? '—'})</div>
                    <div className="mt-2">Address: {o.delivery_address}</div>
                    <div className="mt-2">Total: MK {Number(o.total).toFixed(2)}</div>

                    {items.length > 0 && (
                      <div className="mt-2 small">
                        <strong>Items:</strong>
                        <ul className="mb-0">
                          {items.map(it => (
                            <li key={it.id}>{(it.product_name ?? it.product?.name ?? 'Product')} × {it.quantity} — MK {Number(it.price).toFixed(2)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="text-end">
                    <div className="mb-2"><span className={`badge ${o.status === 'delivered' ? 'bg-success' : o.status === 'pending_delivery' ? 'bg-warning text-dark' : 'bg-secondary'}`}>{o.status}</span></div>
                    <div className="mb-2 small text-muted">{new Date(o.created_at).toLocaleString()}</div>

                    <div className="d-flex flex-column align-items-end">
                      {o.status !== 'delivered' && (
                        <>
                          <button className="btn btn-sm btn-success mb-1" onClick={() => changeStatus(o.id, 'delivered')}>Mark delivered</button>
                          <button className="btn btn-sm btn-outline-primary mb-1" onClick={() => changeStatus(o.id, 'pending_delivery')}>Assign to delivery</button>
                          <button className="btn btn-sm btn-danger" onClick={() => changeStatus(o.id, 'failed')}>Mark failed</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
