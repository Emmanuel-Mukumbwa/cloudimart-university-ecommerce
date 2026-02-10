// ---------------------------
// File: src/components/checkout/SummaryPanel.tsx
import React from 'react';

interface Props {
  total: number;
  coveredAmount: number;
  remainingToPay: number;
}

export default function SummaryPanel({ total, coveredAmount, remainingToPay }: Props) {
  return (
    <div className="mb-3">
      <div className="small text-muted">Cart total: MK {total.toFixed(2)}</div>
      <div className="small text-success">Already reserved/covered: MK {coveredAmount.toFixed(2)}</div>
      <div className="h5">Remaining to pay: {remainingToPay <= 0 ? <span className="text-success">None</span> : `MK ${remainingToPay.toFixed(2)}`}</div>
    </div>
  );
}

