
// ---------------------------
// File: src/components/checkout/ProofItem.tsx
import React from 'react';

interface PaymentMeta {
  cart_hash?: string | null;
  cart_snapshot?: Array<any> | null;
  note?: string | null;
  order_id?: string | number | null;
}

interface Payment {
  id?: number;
  tx_ref: string;
  status?: 'pending' | 'success' | 'failed' | string;
  amount?: number;
  created_at?: string;
  proof_url?: string | null;
  proof_url_full?: string | null;
  meta?: PaymentMeta | any;
}

interface Props {
  payment: Payment;
  cartHash?: string | null;
}

const niceDate = (d?: string) => (d ? new Date(d).toLocaleString() : '—');

const proofHref = (p: Payment) => {
  if ((p as any).proof_url_full) return (p as any).proof_url_full;
  if (p.proof_url) return `/storage/${p.proof_url}`;
  return null;
};
const proofSrc = (p: Payment) => {
  if ((p as any).proof_url_full) return (p as any).proof_url_full;
  if (p.proof_url) return `/storage/${p.proof_url}`;
  return '/images/placeholder.png';
};

export default function ProofItem({ payment, cartHash }: Props) {
  const meta: PaymentMeta = (payment.meta as any) ?? {};
  const snapshot = Array.isArray(meta?.cart_snapshot) ? meta.cart_snapshot : [];

  return (
    <div className="list-group-item d-flex align-items-start gap-3">
      <a href={proofHref(payment) ?? '#'} target="_blank" rel="noreferrer noopener">
        <img
          src={proofSrc(payment)}
          alt={`proof ${payment.tx_ref ?? ''}`}
          style={{ width: 92, height: 64, objectFit: 'cover', borderRadius: 6 }}
        />
      </a>

      <div className="flex-fill">
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className="fw-semibold d-flex align-items-center gap-2">
              <div>{payment.tx_ref}</div>
              {meta?.cart_hash === cartHash ? (
                <span className="badge bg-info">Applies to current cart</span>
              ) : (
                <span className="badge bg-secondary">Different cart</span>
              )}
            </div>
            <div className="small text-muted">{niceDate(payment.created_at)}</div>
          </div>

          <div className="text-end">
            <div className={`badge ${payment.status === 'success' ? 'bg-success' : payment.status === 'failed' ? 'bg-danger' : 'bg-warning text-dark'}`}>
              {payment.status}
            </div>
            {meta?.order_id && <div className="small mt-1">Order: <strong>{meta.order_id}</strong></div>}
            {payment.amount !== undefined && (
              <div className="small mt-1">Paid: <strong>MK {(Number(payment.amount) || 0).toFixed(2)}</strong></div>
            )}
          </div>
        </div>

        {snapshot.length > 0 && (
          <div className="mt-2">
            <div className="small text-muted">Items snapshot:</div>
            <table className="table table-sm mt-1 mb-0">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-end">Qty</th>
                  <th className="text-end">Unit</th>
                  <th className="text-end">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.map((si: any, i: number) => {
                  const name = si.name ?? si.product_name ?? `Product ${si.product_id ?? ''}`;
                  const qty = Number(si.quantity ?? si.qty ?? 0);
                  const price = Number(si.price ?? 0);
                  return (
                    <tr key={i}>
                      <td style={{ width: '50%' }}>{name}</td>
                      <td className="text-end">{qty}</td>
                      <td className="text-end">MK {price.toFixed(2)}</td>
                      <td className="text-end">MK {(qty * price).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta?.note && <div className="small text-muted mt-2">{meta.note}</div>}
      </div>
    </div>
  );
}
