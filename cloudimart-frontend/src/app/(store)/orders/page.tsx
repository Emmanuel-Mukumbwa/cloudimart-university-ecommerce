//src/app/(store)/orders/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

type DeliveryPerson = {
  id?: number;
  name?: string | null;
  phone_number?: string | null;
};

type Delivery = {
  id?: number;
  delivery_person?: string | null; // legacy text
  delivery_person_id?: number | null;
  deliveryPerson?: DeliveryPerson | null; // relation
};

type Order = {
  id: number;
  order_id: string;
  total: number;
  status: string;
  delivery_address: string;
  created_at: string;
  delivery?: Delivery | null;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = (s: string) => {
    switch (s) {
      case 'pending_delivery':
        return 'Pending delivery';
      case 'pending':
        return 'Pending';
      case 'delivered':
        return 'Delivered';
      case 'completed':
        // backwards-compat: if any legacy rows exist
        return 'Completed';
      default:
        // fallback: convert snake-case to spaced words (simple)
        return s.replace(/_/g, ' ');
    }
  };

  const statusBadgeClass = (s: string) => {
    switch (s) {
      case 'pending_delivery':
        return 'bg-warning text-dark'; // waiting for delivery
      case 'pending':
        return 'bg-secondary text-white'; // waiting stage
      case 'delivered':
        return 'bg-success';
      case 'completed':
        return 'bg-success'; // treat completed as success if present
      default:
        return 'bg-info text-white';
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/api/orders');
      // Laravel paginate returns { data: [...], ...meta }
      const payload = res.data;
      const list = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      setOrders(list);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container py-5">
      <h4 className="mb-4">My Orders</h4>

      {error && <div className="alert alert-danger">{error}</div>}

      {orders.length === 0 ? (
        <div className="text-center text-muted py-5">
          <h5>You have no orders yet.</h5>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped align-middle">
            <thead className="table-light">
              <tr>
                <th>Order #</th>
                <th>Status</th>
                <th>Total (MK)</th>
                <th>Delivery Address</th>
                <th>Delivery</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                // Determine delivery display
                const dp = o.delivery?.deliveryPerson ?? null; // prefer relation
                const legacy = o.delivery?.delivery_person ?? null; // fallback text
                let deliveryDisplay = 'Unassigned';
                if (dp && (dp.name || dp.phone_number)) {
                  const pieces = [];
                  if (dp.name) pieces.push(dp.name);
                  if (dp.phone_number) pieces.push(dp.phone_number);
                  deliveryDisplay = pieces.join(' — ');
                } else if (legacy) {
                  deliveryDisplay = legacy;
                }

                return (
                  <tr key={o.id}>
                    <td>{o.order_id}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(o.status)}`}>
                        {statusLabel(o.status)}
                      </span>
                    </td>
                    <td>{Number(o.total).toFixed(2)}</td>
                    <td>{o.delivery_address}</td>
                    <td>{deliveryDisplay}</td>
                    <td>{new Date(o.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
