// File: src/app/(admin)/admin/payments/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import CenteredModal from '../../../../components/common/CenteredModal';
import AdminTabs from '../../../../components/common/AdminTabs';

type SnapshotItem = {
  product_id?: number;
  product_name?: string;
  name?: string;
  qty?: number;
  quantity?: number;
  price?: number;
};

type Payment = {
  id: number;
  tx_ref: string;
  provider_ref?: string | null;
  user_id?: number | null;
  user?: { id?: number; name?: string; email?: string } | null;
  mobile?: string;
  amount: number;
  currency?: string;
  status: string;
  created_at?: string;
  proof_url?: string | null;
  proof_url_full?: string | null;
  meta?: any;
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [message, setMessage] = useState<string | null>(null);

  // approve modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [approving, setApproving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // reject modal state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // cart detail modal state
  const [cartModal, setCartModal] = useState<{ show: boolean; title?: string; items?: SnapshotItem[] }>({ show: false });

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const url = filter === 'all' ? '/api/admin/payments' : `/api/admin/payments?status=${encodeURIComponent(filter)}`;
      const res = await client.get(url);
      // res.data is paginate object; payments in res.data.data
      const payload = res?.data?.data ?? res?.data ?? [];
      setPayments(Array.isArray(payload) ? payload : []);
    } catch (err: any) {
      console.error('Load payments error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  // Approve flow
  const openConfirm = (p: Payment) => {
    setSelectedPayment(p);
    setConfirmOpen(true);
  };

  const doApprove = async () => {
    if (!selectedPayment) return;
    setApproving(true);
    setMessage(null);
    setSuccessMessage(null);

    try {
      const res = await client.post(`/api/admin/payments/${selectedPayment.id}/approve`);
      setSuccessMessage(res.data?.message ?? 'Payment approved.');

      // Refresh list
      await load();
      setTimeout(() => {
        setConfirmOpen(false);
        setSelectedPayment(null);
        setApproving(false);
      }, 700);
    } catch (err: any) {
      console.error('Approve error', err);
      setMessage(err?.response?.data?.message ?? err?.message ?? 'Failed to approve payment');
      setApproving(false);
    }
  };

  // Reject flow
  const openReject = (p: Payment) => {
    setSelectedPayment(p);
    setRejectReason('');
    setRejectOpen(true);
  };

  const doReject = async () => {
    if (!selectedPayment) return;
    setRejecting(true);
    setMessage(null);
    try {
      const res = await client.post(`/api/admin/payments/${selectedPayment.id}/reject`, { reason: rejectReason || null });
      setSuccessMessage(res.data?.message ?? 'Payment rejected.');
      // Refresh
      await load();
      setTimeout(() => {
        setRejectOpen(false);
        setSelectedPayment(null);
        setRejecting(false);
      }, 600);
    } catch (err: any) {
      console.error('Reject error', err);
      setMessage(err?.response?.data?.message ?? err?.message ?? 'Failed to reject payment');
      setRejecting(false);
    }
  };

  const imgSrcFor = (p: Payment) => {
    if (p.proof_url_full) return p.proof_url_full;
    if (p.proof_url) return `/storage/${p.proof_url}`;
    return '/images/placeholder.png';
  };

  const hrefFor = (p: Payment) => {
    if (p.proof_url_full) return p.proof_url_full;
    if (p.proof_url) return `/storage/${p.proof_url}`;
    return null;
  };

  // Normalize meta to object (backend often decodes but be defensive)
  const parseMeta = (meta: any): any => {
    if (!meta) return {};
    if (typeof meta === 'object') return meta;
    try {
      return JSON.parse(meta);
    } catch {
      return {};
    }
  };

  // Try common snapshot shapes and return array of items
  const snapshotItems = (p: Payment): SnapshotItem[] => {
    const meta = parseMeta(p.meta);
    const candidates = meta?.cart_snapshot ?? meta?.cart_items ?? meta?.items ?? meta?.snapshot ?? null;
    if (Array.isArray(candidates)) return candidates;
    if (Array.isArray(meta?.order_items)) return meta.order_items;
    return [];
  };

  // Render small inline representation (first N) of items
  const inlineItems = (items: SnapshotItem[], limit = 2) => {
    if (!items || items.length === 0) return '—';
    return items.slice(0, limit).map(it => {
      const name = it.product_name ?? it.name ?? (it.product_id ? `Product #${it.product_id}` : 'Product');
      const qty = it.qty ?? it.quantity ?? 0;
      return `${name} × ${qty}`;
    }).join(', ');
  };

  const openCartModal = (p: Payment) => {
    const items = snapshotItems(p);
    setCartModal({ show: true, title: `Items for ${p.tx_ref}`, items });
  };

  return (
    <div className="container py-4">
      <AdminTabs />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Payments</h4>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" value={filter} onChange={(e)=>setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      {loading ? (
        <div className="text-center py-5"><LoadingSpinner /></div>
      ) : payments.length === 0 ? (
        <div className="text-muted">No payments found.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Proof</th>
                <th>TX Ref</th>
                <th>User</th>
                <th>Mobile</th>
                <th>Products</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const items = snapshotItems(p);
                return (
                  <tr key={p.id}>
                    <td style={{ width: 120 }}>
                      {p.proof_url ? (
                        <a href={hrefFor(p) ?? '#'} target="_blank" rel="noreferrer">
                          <img src={imgSrcFor(p)} alt="proof" style={{ height: 56, width: 96, objectFit: 'cover', borderRadius: 6 }} />
                        </a>
                      ) : (
                        <div className="text-muted small">No proof</div>
                      )}
                    </td>
                    <td style={{ minWidth: 160 }}>{p.tx_ref}</td>
                    <td>{p.user?.name ?? `ID ${p.user_id ?? '—'}`}</td>
                    <td>{p.mobile ?? '—'}</td>

                    {/* Products column */}
                    <td style={{ minWidth: 220 }}>
                      {items.length > 0 ? (
                        <div className="d-flex align-items-center">
                          <div className="small text-truncate" style={{ maxWidth: 240 }}>{inlineItems(items)}</div>
                          {items.length > 2 && <div className="ms-2 small text-muted">(+{items.length - 2})</div>}
                          <button className="btn btn-sm btn-link ms-3 p-0" onClick={() => openCartModal(p)}>View</button>
                        </div>
                      ) : (
                        <div className="small text-muted">
                          {p.meta?.order_id ? <>Order: <strong>{p.meta.order_id}</strong></> : '—'}
                        </div>
                      )}
                    </td>

                    <td>MK {Number(p.amount).toFixed(2)}</td>
                    <td>
                      <span className={
                        p.status === 'success' ? 'badge bg-success' :
                        p.status === 'failed' ? 'badge bg-danger' :
                        'badge bg-warning text-dark'
                      }>{p.status}</span>
                      {p.meta?.order_id && <div className="small mt-1">Order: <strong>{p.meta.order_id}</strong></div>}
                    </td>
                    <td>{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
                    <td style={{ minWidth: 180 }}>
                      {p.status === 'pending' ? (
                        <div className="d-flex gap-2">
                          <button className="btn btn-sm btn-outline-primary" onClick={()=>openConfirm(p)}>Approve</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={()=>openReject(p)}>Reject</button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={load}>Refresh</button>
                        </div>
                      ) : (
                        <div className="text-muted small">No actions</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve confirm modal */}
      <CenteredModal
        show={confirmOpen}
        title={selectedPayment ? `Approve payment ${selectedPayment.tx_ref}` : 'Approve payment'}
        body={
          selectedPayment ? (
            <div>
              <p>Are you sure you want to mark this payment as <strong>success</strong> and attempt to auto-place the order for the user?</p>
              <p className="small text-muted">TX: {selectedPayment.tx_ref} — Amount: MK {Number(selectedPayment.amount).toFixed(2)}</p>
              {selectedPayment.proof_url && (
                <div className="text-center mt-3">
                  <a href={selectedPayment.proof_url_full ?? `/storage/${selectedPayment.proof_url}`} target="_blank" rel="noreferrer">
                    <img src={selectedPayment.proof_url_full ?? `/storage/${selectedPayment.proof_url}`} alt="proof"
                         style={{ maxWidth: '320px', width: '100%', objectFit: 'contain', borderRadius: 8 }} />
                  </a>
                </div>
              )}
            </div>
          ) : 'Confirm approval'
        }
        onClose={doApprove}
        onCancel={() => { setConfirmOpen(false); setSelectedPayment(null); }}
        okLabel={approving ? 'Approving...' : 'Yes, approve'}
        size="md"
      />

      {/* Reject modal */}
      <CenteredModal
        show={rejectOpen}
        title={selectedPayment ? `Reject payment ${selectedPayment.tx_ref}` : 'Reject payment'}
        body={
          selectedPayment ? (
            <div>
              <p>Provide a reason for rejecting this payment (optional). The customer will be notified.</p>
              <p className="small text-muted">TX: {selectedPayment.tx_ref} — Amount: MK {Number(selectedPayment.amount).toFixed(2)}</p>

              <div className="mt-2">
                <textarea className="form-control" rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection (optional)"></textarea>
              </div>

              {selectedPayment.proof_url && (
                <div className="text-center mt-3">
                  <a href={selectedPayment.proof_url_full ?? `/storage/${selectedPayment.proof_url}`} target="_blank" rel="noreferrer">
                    <img src={selectedPayment.proof_url_full ?? `/storage/${selectedPayment.proof_url}`} alt="proof"
                         style={{ maxWidth: '320px', width: '100%', objectFit: 'contain', borderRadius: 8 }} />
                  </a>
                </div>
              )}
            </div>
          ) : 'Confirm rejection'
        }
        onClose={doReject}
        onCancel={() => { setRejectOpen(false); setSelectedPayment(null); }}
        okLabel={rejecting ? 'Rejecting...' : 'Yes, reject'}
        size="md"
      />

      {/* Cart details modal */}
      <CenteredModal
        show={cartModal.show}
        title={cartModal.title}
        onClose={() => setCartModal({ show: false })}
        body={
          cartModal.items && cartModal.items.length > 0 ? (
            <div>
              <ul className="list-unstyled mb-0">
                {cartModal.items!.map((it, idx) => (
                  <li key={idx} className="mb-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-bold">{it.product_name ?? it.name ?? (it.product_id ? `Product #${it.product_id}` : 'Product')}</div>
                        <div className="small text-muted">Price: {it.price ? `MK ${Number(it.price).toFixed(2)}` : '—'}</div>
                      </div>
                      <div className="ms-3"><span className="badge bg-light text-dark">× {it.qty ?? it.quantity ?? 0}</span></div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-muted">No items available</div>
          )
        }
        okLabel="Close"
      />

      {successMessage && <div className="alert alert-success mt-3">{successMessage}</div>}
    </div>
  );
}
