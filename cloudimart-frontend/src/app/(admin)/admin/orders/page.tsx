// File: src/app/(admin)/admin/orders/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import AdminTabs from '../../../../components/common/AdminTabs';
import CenteredModal from '../../../../components/common/CenteredModal';
import AssignDeliveryModal from '../../../../components/admin/AssignDeliveryModal';

type OrderItem = { id: number; product_name?: string; price: number; quantity: number };
type Delivery = {
  id?: number;
  delivery_person?: string | null;
  delivery_person_id?: number | null;
  status?: string | null;
  verification_code?: string | null;
};
type Order = {
  id: number;
  order_id: string;
  user?: { id: number; name: string; phone_number?: string };
  total: number;
  status: string;
  delivery_address: string;
  created_at: string;
  order_items?: OrderItem[];
  items?: OrderItem[];
  delivery?: Delivery | null;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState<string | null>(null);

  // Confirm modal state for status changes
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    orderId?: number | null;
    newStatus?: string | null;
    orderRef?: string | null;
  }>({ show: false, orderId: null, newStatus: null, orderRef: null });

  // Result / info modal
  const [resultModal, setResultModal] = useState<{ show: boolean; title?: string; body?: string }>({ show: false });

  // Assign delivery modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignDeliveryId, setAssignDeliveryId] = useState<number | null>(null);
  const [assignOrderId, setAssignOrderId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const url = filterStatus === 'all' ? '/api/admin/orders' : `/api/admin/orders?status=${encodeURIComponent(filterStatus)}`;
      const res = await client.get(url);
      // backend sometimes returns { data: [...] } or { orders: [...] } etc.
      const payload = res.data;
      const list = payload.data ?? payload.orders ?? payload;
      setOrders(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Load admin orders error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  // open confirm modal instead of native confirm()
  const confirmChangeStatus = (orderId: number, orderRef: string, newStatus: string) => {
    setConfirmModal({ show: true, orderId, newStatus, orderRef });
  };

  const performChangeStatus = async () => {
    if (!confirmModal.orderId || !confirmModal.newStatus) {
      setConfirmModal({ show: false, orderId: null, newStatus: null, orderRef: null });
      return;
    }
    setMessage(null);
    try {
      const res = await client.post(`/api/admin/orders/${confirmModal.orderId}/status`, { status: confirmModal.newStatus });
      const info = res.data?.message ?? 'Updated';
      setResultModal({ show: true, title: 'Success', body: String(info) });
      await load();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message ?? err?.message ?? 'Update failed';
      setResultModal({ show: true, title: 'Failed', body: String(errMsg) });
    } finally {
      setConfirmModal({ show: false, orderId: null, newStatus: null, orderRef: null });
    }
  };

  // Attempt to create a delivery record for an order if missing (optional endpoint).
  // If your backend doesn't provide this endpoint, this will show a helpful message.
  const createDeliveryForOrder = async (order: Order) => {
    setMessage(null);
    try {
      const res = await client.post(`/api/admin/orders/${order.id}/create-delivery`);
      const d = res.data?.delivery ?? res.data;
      setResultModal({ show: true, title: 'Delivery Created', body: `Delivery record created (ID: ${d?.id ?? '—'})` });
      // refresh orders to pick up new delivery
      await load();
      return d;
    } catch (err: any) {
      // show clear message if endpoint missing or creation failed
      const status = err?.response?.status;
      if (status === 404) {
        setResultModal({
          show: true,
          title: 'Not available',
          body: 'Endpoint to create a delivery for an order was not found on the server. Create a delivery via payment approval flow or add the `createDeliveryForOrder` endpoint on the backend.'
        });
      } else {
        setResultModal({ show: true, title: 'Failed', body: err?.response?.data?.message ?? err?.message ?? 'Failed to create delivery' });
      }
      return null;
    }
  };

  // Open assignment modal for an order: ensures there is a delivery record first.
  const openAssignModal = async (order: Order) => {
    setMessage(null);

    // If we already have delivery record and an id — use it
    if (order.delivery && order.delivery.id) {
      setAssignDeliveryId(order.delivery.id);
      setAssignOrderId(order.id);
      setAssignModalOpen(true);
      return;
    }

    // otherwise try to create delivery for order via optional endpoint
    const created = await createDeliveryForOrder(order);
    if (created && created.id) {
      setAssignDeliveryId(created.id);
      setAssignOrderId(order.id);
      setAssignModalOpen(true);
    }
  };

  // Called when AssignDeliveryModal closes
  const onAssignModalClose = (assigned?: boolean) => {
    setAssignModalOpen(false);
    setAssignDeliveryId(null);
    setAssignOrderId(null);
    if (assigned) {
      // refresh so UI shows assignee
      load();
      setResultModal({ show: true, title: 'Assigned', body: 'Delivery person assigned successfully.' });
    }
  };

  if (loading) return <div className="container py-5 text-center"><LoadingSpinner /></div>;

  return (
    <div className="container py-4">
      <AdminTabs />

      <div className="d-flex justify-content-between mb-3 align-items-center">
        <h4>Orders</h4>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
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
            const delivery = o.delivery ?? null;
            return (
              <div key={o.id} className="list-group-item mb-2 shadow-sm">
                <div className="d-flex justify-content-between">
                  <div>
                    <div className="fw-bold">{o.order_id}</div>
                    <div className="small text-muted">Customer: {o.user?.name ?? '—'} ({o.user?.phone_number ?? '—'})</div>
                    <div className="mt-2">Address: {o.delivery_address ?? '—'}</div>
                    <div className="mt-2">Total: MK {Number(o.total).toFixed(2)}</div>

                    {items.length > 0 && (
                      <div className="mt-2 small">
                        <strong>Items:</strong>
                        <ul className="mb-0">
                          {items.map(it => (
                            <li key={it.id}>{(it.product_name ?? (it as any).product?.name ?? 'Product')} × {it.quantity} — MK {Number(it.price).toFixed(2)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-2 small">
                      <strong>Delivery:</strong>{' '}
                      {delivery
                        ? (delivery.delivery_person ?? 'Unassigned')
                        : <span className="text-muted">No delivery record</span>
                      }
                      {delivery?.verification_code && <span className="ms-2 badge bg-light text-dark small">Code: {delivery.verification_code}</span>}
                    </div>
                  </div>

                  <div className="text-end">
                    <div className="mb-2">
                      <span className={`badge ${o.status === 'delivered' ? 'bg-success' : o.status === 'pending_delivery' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                        {o.status}
                      </span>
                    </div>
                    <div className="mb-2 small text-muted">{new Date(o.created_at).toLocaleString()}</div>

                    <div className="d-flex flex-column align-items-end">
                      {o.status !== 'delivered' && (
                        <>
                          {/*<button className="btn btn-sm btn-success mb-1" onClick={() => confirmChangeStatus(o.id, o.order_id, 'delivered')}>Mark delivered</button>*/}

                          <button className="btn btn-sm btn-outline-primary mb-1" onClick={() => openAssignModal(o)}>
                            Assign to delivery
                          </button>

                         {/* <button className="btn btn-sm btn-danger" onClick={() => confirmChangeStatus(o.id, o.order_id, 'failed')}>Mark failed</button>*/}
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

      {/* Assign delivery modal */}
      <AssignDeliveryModal
        show={assignModalOpen}
        deliveryId={assignDeliveryId}
        onClose={(assigned?: boolean) => onAssignModalClose(assigned)}
      />

      {/* Confirm modal for status changes */}
      <CenteredModal
        show={confirmModal.show}
        title="Confirm change"
        body={`Change order ${confirmModal.orderRef ?? ''} status to "${confirmModal.newStatus ?? ''}"?`}
        onClose={performChangeStatus}
        onCancel={() => setConfirmModal({ show: false, orderId: null, newStatus: null, orderRef: null })}
        okLabel="Yes, change"
        cancelLabel="Cancel"
        size="sm"
      />

      {/* Result modal (success / failure messages) */}
      <CenteredModal
        show={resultModal.show}
        title={resultModal.title}
        body={resultModal.body}
        onClose={() => setResultModal({ show: false })}
        okLabel="OK"
      />
    </div>
  );
} 
