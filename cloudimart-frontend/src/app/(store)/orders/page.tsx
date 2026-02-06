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
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/api/orders');
      const data = res.data?.data ?? res.data ?? [];
      setOrders(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e: any) {
      setError(e?.userMessage ?? 'Failed to load orders');
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
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.order_id}</td>
                  <td>
                    <span
                      className={`badge ${
                        o.status === 'completed'
                          ? 'bg-success'
                          : o.status === 'pending'
                          ? 'bg-warning text-dark'
                          : 'bg-info'
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td>{Number(o.total).toFixed(2)}</td>
                  <td>{o.delivery_address}</td>
                  <td>{new Date(o.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
