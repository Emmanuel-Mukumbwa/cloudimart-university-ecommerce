//src/app/(admin)/admin/payments/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import CenteredModal from '../../../../components/common/CenteredModal';

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
      const order = res.data?.order ?? null;
      setSuccessMessage(res.data?.message ?? 'Payment approved.');

      // Refresh list
      await load();
      // keep confirm modal open a short moment to show success, then close
      setTimeout(() => {
        setConfirmOpen(false);
        setSelectedPayment(null);
        setApproving(false);
      }, 800);
    } catch (err: any) {
      console.error('Approve error', err);
      setMessage(err?.response?.data?.message ?? err?.message ?? 'Failed to approve payment');
      setApproving(false);
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

  return (
    <div className="container py-4">
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
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
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
                  <td style={{ minWidth: 140 }}>
                    {p.status === 'pending' ? (
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-outline-primary" onClick={()=>openConfirm(p)}>Approve</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={load}>Refresh</button>
                      </div>
                    ) : (
                      <div className="text-muted small">No actions</div>
                    )}
                  </td>
                </tr>
              ))}
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

      {successMessage && <div className="alert alert-success mt-3">{successMessage}</div>}
    </div>
  );
}
 