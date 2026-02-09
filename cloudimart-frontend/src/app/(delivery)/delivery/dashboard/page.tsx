// File: src/app/(delivery)/delivery/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import CenteredModal from '../../../../components/common/CenteredModal';
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
  items?: OrderItem[]; // items relation
  order_items?: OrderItem[]; // fallback
  orderItems?: OrderItem[]; // alternate fallback
};
type DeliveryWithOrder = {
  id: number;
  order: Order;
  delivery_person?: string | null;
  delivery_person_id?: number | null;
  status?: string | null;
  verification_code?: string | null;
  created_at?: string | null;
};

export default function DeliveryDashboardPage() {
  const [deliveries, setDeliveries] = useState<DeliveryWithOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // verify form
  const [verifyOrderId, setVerifyOrderId] = useState('');
  const [verifyPhone, setVerifyPhone] = useState('+265'); // prefill +265
  const [verifyPerson, setVerifyPerson] = useState('');

  // modal for results (success/failure/info)
  const [modal, setModal] = useState<{ show: boolean; title?: string; body?: React.ReactNode }>({ show: false });

  const router = useRouter();

  const loadDeliveries = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/delivery/dashboard');
      const payload = res.data;
      const list = payload?.deliveries ?? [];
      setDeliveries(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to load deliveries', err);
      setModal({ show: true, title: 'Load failed', body: err?.response?.data?.message ?? err?.message ?? 'Failed to load deliveries' });
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, []);

  // Handle verification form submission
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setModal({ show: false });
    try {
      const payload = {
        order_id: verifyOrderId,
        phone: verifyPhone,
        delivery_person: verifyPerson || undefined,
      };
      const res = await client.post('/api/delivery/verify', payload);
      if (res.data?.success) {
        setModal({ show: true, title: 'Verified', body: `Delivery confirmed for ${res.data.order_id}` });
        setVerifyOrderId('');
        setVerifyPhone('+265');
        setVerifyPerson('');
        await loadDeliveries();
      } else {
        setModal({ show: true, title: 'Verification failed', body: res.data?.message ?? 'Verification failed' });
      }
    } catch (err: any) {
      console.error('Verify error', err);
      const msg = err?.response?.data?.message ?? err?.message ?? 'Verification error';
      setModal({ show: true, title: 'Error', body: String(msg) });
    }
  };

  // small helpers for status labels
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
          <button className="btn btn-primary" onClick={loadDeliveries}>Refresh</button>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h6 className="mb-3">Verify delivery (Order ID + Phone)</h6>
          <form onSubmit={handleVerify} className="row g-2">
            <div className="col-md-4">
              <input
                className="form-control"
                placeholder="Order ID (e.g. ORD-20260206-ABC123)"
                value={verifyOrderId}
                onChange={(e) => setVerifyOrderId(e.target.value)}
                required
              />
            </div>
            <div className="col-md-3">
              <input
                className="form-control"
                placeholder="Customer phone (prefilled +265)"
                value={verifyPhone}
                onChange={(e) => setVerifyPhone(e.target.value)}
                required
              />
            </div>
            <div className="col-md-3">
              <input
                className="form-control"
                placeholder="Delivery person name (optional)"
                value={verifyPerson}
                onChange={(e) => setVerifyPerson(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <button className="btn btn-success w-100" type="submit">Verify & Complete</button>
            </div>
          </form>
          <div className="small text-muted mt-2">Tip: Enter the order ID and customer phone exactly as recorded (you can edit the phone if needed).</div>
        </div>
      </div>

      <div>
        <h6 className="mb-3">Assigned Deliveries (pending)</h6>

        {deliveries.length === 0 ? (
          <div className="text-muted">No deliveries assigned to you at the moment.</div>
        ) : (
          <div className="list-group">
            {deliveries.map((d) => {
              const o = d.order;
              const items = (o.items ?? o.order_items ?? o.orderItems ?? []);
              const readableStatus = statusLabel(o.status);
              const badgeClass = statusBadgeClass(o.status);

              return (
                <div key={d.id} className="list-group-item mb-2 shadow-sm">
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
                        {/* removed Mark delivered button: verification happens via the form above */}
                        <div className="small text-muted">Verify with Order ID & customer phone (see form above)</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CenteredModal
        show={modal.show}
        title={modal.title}
        body={modal.body}
        onClose={() => setModal({ show: false })}
        okLabel="OK"
      />
    </div>
  );
}
