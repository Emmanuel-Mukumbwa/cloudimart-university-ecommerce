// ---------------------------
// File: src/components/checkout/OtherPendingPaymentsNotice.tsx
import React from 'react';

interface Props {
  otherPayments: any[];
  loading?: boolean;
  showOtherPayments?: boolean;
  onToggleShow?: () => void;
  onRefresh?: () => void;
}

export default function OtherPendingPaymentsNotice({ otherPayments, loading = false, showOtherPayments = false, onToggleShow, onRefresh }: Props) {
  if (loading) return <div className="mb-3 text-center">Loading…</div>;
  if (!otherPayments || otherPayments.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="alert alert-warning">
        <strong>Note:</strong> You have other pending payment(s) that were made for a different cart snapshot. These payments apply to a previous cart and will be handled separately by admin.
        <div className="mt-2">
          <button className="btn btn-sm btn-outline-secondary me-2" onClick={onToggleShow}>
            {showOtherPayments ? 'Hide' : 'Show'} other pending payments ({otherPayments.length})
          </button>
          <button className="btn btn-sm btn-outline-dark" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      {showOtherPayments && (
        <div className="list-group">
          {otherPayments.map((p) => (
            <div key={p.id ?? p.tx_ref} className="list-group-item d-flex align-items-center gap-3">
              <a href={(p.proof_url_full ?? (p.proof_url ? `/storage/${p.proof_url}` : '#'))} target="_blank" rel="noreferrer noopener">
                <img src={(p.proof_url_full ?? (p.proof_url ? `/storage/${p.proof_url}` : '/images/placeholder.png'))} alt={`proof ${p.tx_ref ?? ''}`} style={{ width: 92, height: 64, objectFit: 'cover', borderRadius: 6 }} />
              </a>
              <div className="flex-fill">
                <div className="d-flex justify-content-between">
                  <div>
                    <div className="fw-semibold">{p.tx_ref}</div>
                    <div className="small text-muted">{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</div>
                    <div className="small text-muted">Paid amount: MK {(Number(p.amount) || 0).toFixed(2)}</div>
                    <div className="small text-muted">Cart snapshot: <code className="text-break">{p.meta?.cart_hash ?? '—'}</code></div>
                  </div>
                  <div className="text-end">
                    <div className={`badge ${p.status === 'success' ? 'bg-success' : p.status === 'failed' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                      {p.status}
                    </div>
                    {p.meta?.order_id && <div className="small mt-1">Order: <strong>{p.meta.order_id}</strong></div>}
                  </div>
                </div>
                <div className="small text-muted mt-2">{p.meta?.note ?? ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

