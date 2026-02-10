
// ---------------------------
// File: src/components/checkout/PaymentUploadsList.tsx
import React from 'react';
import ProofItem from './ProofItem';

interface Props {
  payments: any[];
  loading?: boolean;
  cartHash?: string | null;
  title?: string;
}

export default function PaymentUploadsList({ payments, loading = false, cartHash = null, title = 'Payment uploads' }: Props) {
  if (loading) return <div className="text-center py-3">Loading…</div>;

  if (!payments || payments.length === 0) return <div className="text-muted small">No payment uploads.</div>;

  return (
    <div className="mb-3">
      <h6>{title}</h6>
      <div className="list-group">
        {payments.map((p) => (
          <ProofItem key={p.id ?? p.tx_ref} payment={p} cartHash={cartHash} />
        ))}
      </div>
    </div>
  );
}

