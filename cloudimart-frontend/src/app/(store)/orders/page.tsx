// src/app/(store)/orders/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import CenteredModal from '../../../components/common/CenteredModal';

type OrderItem = {
  id: number;
  order_id?: number;
  product_id: number;
  product?: {
    id: number;
    name: string;
    image_url?: string | null;
    image_url_full?: string | null;
    price?: number;
    description?: string | null;
  };
  quantity: number;
  price: number;
};

type Order = {
  id: number;
  order_id: string;
  total: number;
  status: string;
  delivery_address: string;
  created_at: string;
  delivery_display?: string | null;
  delivery_fee?: number;
  total_with_delivery?: number;
  payment_ref?: string | null;
  items?: OrderItem[]; // server should include this via with('items.product')
  delivery?: any;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // modal state for showing order details
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

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
      // ensure numeric fields are numbers (defensive)
      const normalized = list.map((o: any) => ({
        ...o,
        total: Number(o.total ?? 0),
        delivery_fee: Number(o.delivery_fee ?? o.delivery_fee ?? 0),
        total_with_delivery: Number(o.total_with_delivery ?? (Number(o.total ?? 0) + Number(o.delivery_fee ?? 0))),
        items: Array.isArray(o.items) ? o.items : [],
      }));
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
    const del = o.delivery;
    if (!del) return 'Unassigned';
    const dp = del.deliveryPerson ?? del.delivery_person ?? null;
    if (dp) {
      if (typeof dp === 'string') return dp;
      const name = dp?.name ?? null;
      const phone = dp?.phone_number ?? null;
      const parts: string[] = [];
      if (name) parts.push(name);
      if (phone) parts.push(phone);
      if (parts.length > 0) return parts.join(' — ');
      try {
        return JSON.stringify(dp);
      } catch {
        return 'Unassigned';
      }
    }
    return 'Unassigned';
  };

  // small helper for product image src with defensive fallbacks
  const getImageSrc = (p: any) => {
    if (!p) return '/images/placeholder.png';
    if (p.image_url_full) return p.image_url_full;
    if (p.image_url && typeof p.image_url === 'string') {
      const url = p.image_url;
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return url;
      return `/storage/${url.replace(/^\/+/, '')}`;
    }
    return '/images/placeholder.png';
  };

  // when user clicks an order row, open modal with order details
  const openOrderModal = (o: Order) => {
    setSelectedOrder(o);
    setOrderModalOpen(true);
  };

  const closeOrderModal = () => {
    setOrderModalOpen(false);
    setSelectedOrder(null);
  };

  // render order details JSX (passed into CenteredModal body)
  const renderOrderDetails = (o: Order | null) => {
    if (!o) return <div />;

    const items = Array.isArray(o.items) ? o.items : [];

    const itemsTotal = items.reduce((s: number, it: OrderItem) => s + Number(it.price ?? 0) * Number(it.quantity ?? 0), 0);
    const deliveryFee = Number(o.delivery_fee ?? 0);
    const grandTotal = Number(o.total_with_delivery ?? (Number(o.total ?? 0) + deliveryFee));

    return (
      <div>
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="small text-muted">Order</div>
              <div className="fw-semibold">{o.order_id}</div>
            </div>

            <div className="text-end">
              <div className={`badge ${statusBadgeClass(o.status)}`}>{statusLabel(o.status)}</div>
              <div className="small text-muted mt-2">Created: {o.created_at ? new Date(o.created_at).toLocaleString() : '—'}</div>
              {o.payment_ref && <div className="small mt-1">Payment: <strong>{o.payment_ref}</strong></div>}
            </div>
          </div>
        </div>

        <div className="mb-3">
          <h6 className="mb-2">Delivery</h6>
          <div className="small text-muted">Address</div>
          <div>{o.delivery_address || '—'}</div>
          <div className="small text-muted mt-2">Delivery person</div>
          <div>{deliveryFallback(o)}</div>
        </div>

        <div className="mb-3">
          <h6 className="mb-2">Items</h6>

          {items.length === 0 ? (
            <div className="text-muted small">No items recorded for this order.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Product</th>
                    <th>Unit price (MK)</th>
                    <th>Qty</th>
                    <th>Subtotal (MK)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const product = it.product ?? null;
                    const unitPrice = Number(it.price ?? (product?.price ?? 0));
                    const qty = Number(it.quantity ?? 0);
                    const subtotal = unitPrice * qty;
                    return (
                      <tr key={it.id}>
                        <td>
                          <div className="d-flex gap-3 align-items-center">
                            <img src={getImageSrc(product)} alt={product?.name ?? ''} style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                            <div>
                              <div className="fw-semibold">{product?.name ?? `#${it.product_id}`}</div>
                              {product?.description && <div className="small text-muted">{product.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td>MK {unitPrice.toFixed(2)}</td>
                        <td>{qty}</td>
                        <td>MK {subtotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="d-flex justify-content-end gap-4">
            <div className="text-end">
              <div className="small text-muted">Items total</div>
              <div className="fw-semibold">MK {itemsTotal.toFixed(2)}</div>
            </div>

            <div className="text-end">
              <div className="small text-muted">Delivery fee</div>
              <div className="fw-semibold">MK {deliveryFee.toFixed(2)}</div>
            </div>

            <div className="text-end">
              <div className="small text-muted">Grand total</div>
              <div className="fw-bold h5">MK {grandTotal.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    );
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
                <th>Delivery Address</th>
                <th>Delivery</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => openOrderModal(o)}
                  title="Click for details"
                >
                  <td>{o.order_id}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(o.status)}`}>
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td>{Number(o.total).toFixed(2)}</td>
                  <td>{o.delivery_address}</td>
                  <td>{deliveryFallback(o)}</td>
                  <td>{o.created_at ? new Date(o.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order details modal */}
      <CenteredModal
        show={orderModalOpen}
        title={selectedOrder ? `Order details — ${selectedOrder.order_id}` : 'Order details'}
        body={renderOrderDetails(selectedOrder)}
        onClose={() => closeOrderModal()}
      />
    </div>
  );
}
