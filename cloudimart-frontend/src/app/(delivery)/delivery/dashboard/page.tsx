//src/app/(delivery)/delivery/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import { useRouter } from 'next/navigation';

type Product = { id: number; name: string; price: number };
type OrderItem = { id: number; product: Product; quantity: number; price: number };
type Order = {
  id: number;
  order_id: string;
  total: number;
  delivery_address: string;
  status: string;
  created_at: string;
  user: { id: number; name: string; phone_number: string } | null;
  order_items?: OrderItem[]; // API may return order_items or orderItems
  orderItems?: OrderItem[];
};

export default function DeliveryDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyOrderId, setVerifyOrderId] = useState('');
  const [verifyPhone, setVerifyPhone] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/delivery/dashboard');
      setOrders(res.data.orders ?? []);
    } catch (err: any) {
      setMessage(err?.userMessage ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleComplete = async (orderId: number) => {
    if (!confirm('Mark this order as delivered?')) return;
    try {
      const res = await client.post(`/api/delivery/orders/${orderId}/complete`);
      if (res.data?.success) {
        setMessage(res.data.message || 'Order marked delivered');
        await loadOrders();
      } else {
        setMessage(res.data?.message ?? 'Failed to update');
      }
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to update delivery');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await client.post('/api/delivery/verify', {
        order_id: verifyOrderId,
        phone: verifyPhone,
      });
      if (res.data?.success) {
        setMessage('Delivery verified: ' + res.data.order_id);
        setVerifyOrderId('');
        setVerifyPhone('');
        await loadOrders();
      } else {
        setMessage(res.data?.message ?? 'Verification failed');
      }
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Verification error');
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'pending_delivery':
        return 'Pending delivery';
      case 'pending':
        return 'Pending';
      case 'delivered':
        return 'Delivered';
      default:
        return s;
    }
  };

  const statusBadgeClass = (s: string) => {
    switch (s) {
      case 'pending_delivery':
        return 'bg-warning text-dark';
      case 'pending':
        return 'bg-secondary';
      case 'delivered':
        return 'bg-success';
      default:
        return 'bg-info';
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>Delivery Dashboard</h4>
        <div>
          <button className="btn btn-secondary me-2" onClick={() => router.push('/')}>Back</button>
          <button className="btn btn-primary" onClick={loadOrders}>Refresh</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="card mb-4">
        <div className="card-body">
          <h6 className="mb-3">Verify delivery (OrderID + Phone)</h6>
          <form onSubmit={handleVerify} className="row g-2">
            <div className="col-md-5">
              <input className="form-control" placeholder="Order ID (e.g. ORD-20260206-ABC123)" value={verifyOrderId} onChange={(e) => setVerifyOrderId(e.target.value)} required />
            </div>
            <div className="col-md-4">
              <input className="form-control" placeholder="Customer phone" value={verifyPhone} onChange={(e) => setVerifyPhone(e.target.value)} required />
            </div>
            <div className="col-md-3">
              <button className="btn btn-success w-100" type="submit">Verify & Complete</button>
            </div>
          </form>
        </div>
      </div>

      <div>
        <h6 className="mb-3">Pending Orders</h6>

        {orders.length === 0 ? (
          <div className="text-muted">No active orders to deliver.</div>
        ) : (
          <div className="list-group">
            {orders.map((o) => {
              const items = (o as any).order_items ?? (o as any).orderItems ?? [];
              const readableStatus = statusLabel(o.status);
              const badgeClass = statusBadgeClass(o.status);

              return (
                <div key={o.id} className="list-group-item mb-2 shadow-sm">
                  <div className="d-flex justify-content-between">
                    <div>
                      <div className="fw-bold">{o.order_id}</div>
                      <div className="small text-muted">Customer: {o.user?.name ?? '—'} — {o.user?.phone_number ?? '—'}</div>
                      <div className="mt-2">Address: {o.delivery_address}</div>
                      <div className="mt-2">Total: MK {Number(o.total).toFixed(2)}</div>

                      {items && items.length > 0 && (
                        <div className="mt-2">
                          <strong>Items:</strong>
                          <ul className="small mb-0">
                            {items.map((it: any) => (
                              <li key={it.id}>
                                {(it.product?.name ?? it.product_name ?? 'Product')} × {it.quantity} — MK {Number(it.price).toFixed(2)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="text-end">
                      <div className="mb-2">
                        <span className={`badge ${badgeClass}`}>{readableStatus}</span>
                      </div>
                      <div className="mb-2 small text-muted">{new Date(o.created_at).toLocaleString()}</div>
                      <div>
                        {o.status !== 'delivered' && (
                          <button className="btn btn-sm btn-success me-2" onClick={() => handleComplete(o.id)}>Mark delivered</button>
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
    </div>
  );
}

