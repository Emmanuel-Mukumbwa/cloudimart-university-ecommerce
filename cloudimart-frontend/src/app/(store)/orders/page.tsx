'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

type Order = {
  id: number;
  order_id: string;
  total: number;
  status: string;
  delivery_address: string;
  created_at: string;
  delivery_display?: string | null; // server-provided friendly string
  delivery_fee?: number | null;
  total_with_delivery?: number | null;
  // old shape may include nested delivery object; we don't render it directly
  delivery?: any;
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
        return 'Completed';
      default:
        return s.replace(/_/g, ' ');
    }
  };

  const statusBadgeClass = (s: string) => {
    switch (s) {
      case 'pending_delivery':
        return 'bg-warning text-dark';
      case 'pending':
        return 'bg-secondary text-white';
      case 'delivered':
      case 'completed':
        return 'bg-success';
      default:
        return 'bg-info text-white';
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/api/orders');
      const payload = res.data;
      const list = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);

      // Defensive normalization: ensure numeric fields exist and compute grand total
      const normalized = list.map((o: any) => {
        const delivery_fee = o.delivery_fee !== undefined && o.delivery_fee !== null ? Number(o.delivery_fee) : 0.0;
        const total = o.total !== undefined && o.total !== null ? Number(o.total) : 0.0;
        const total_with_delivery = Number((total + delivery_fee).toFixed(2));
        return {
          ...o,
          delivery_fee,
          total: Number(total.toFixed ? total.toFixed(2) : total),
          total_with_delivery,
        };
      });

      setOrders(normalized);
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

  // fallback display if server didn't provide delivery_display
  const deliveryFallback = (o: Order) => {
    if (o.delivery_display) return o.delivery_display;
    // defensive: try older nested shapes but produce string
    const del = o.delivery;
    if (!del) return 'Unassigned';
    // if delivery has deliveryPerson object
    const dp = del.deliveryPerson ?? del.delivery_person ?? null;
    if (dp) {
      if (typeof dp === 'string') return dp; // legacy text
      const name = dp?.name ?? null;
      const phone = dp?.phone_number ?? null;
      const parts: string[] = [];
      if (name) parts.push(name);
      if (phone) parts.push(phone);
      if (parts.length > 0) return parts.join(' — ');
      // last resort: JSON stringified (shouldn't happen)
      try {
        return JSON.stringify(dp);
      } catch {
        return 'Unassigned';
      }
    }
    return 'Unassigned';
  };

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
                <th>Delivery Fee (MK)</th>
                <th>Grand Total (MK)</th>
                <th>Delivery Address</th>
                <th>Delivery</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.order_id ?? `#${o.id}`}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(o.status)}`}>
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td>{Number(o.total ?? 0).toFixed(2)}</td>
                  <td>{Number(o.delivery_fee ?? 0).toFixed(2)}</td>
                  <td>{Number(o.total_with_delivery ?? (Number(o.total ?? 0) + Number(o.delivery_fee ?? 0))).toFixed(2)}</td>
                  <td>{o.delivery_address ?? '-'}</td>
                  <td>{deliveryFallback(o)}</td>
                  <td>{o.created_at ? new Date(o.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
