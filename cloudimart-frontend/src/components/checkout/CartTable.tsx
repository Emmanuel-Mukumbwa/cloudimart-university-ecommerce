// src/components/checkout/CartTable.tsx
'use client';

import React from 'react';

export default function CartTable({ items, total }: { items: any[]; total: number }) {
  return (
    <>
      <table className="table table-bordered mb-3">
        <thead>
          <tr>
            <th>Product</th>
            <th style={{ width: 110 }}>Qty</th>
            <th style={{ width: 140 }}>Price</th>
            <th style={{ width: 160 }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i: any) => (
            <tr key={i.id ?? `${i.product?.id}-${Math.random()}`}>
              <td>
                <div className="d-flex align-items-center gap-3">
                  <img src={i.product?.image_url ?? '/images/placeholder.png'} alt={i.product?.name}
                    style={{ width: 72, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                  <div>
                    <div className="fw-semibold">{i.product?.name}</div>
                    <div className="text-muted small">{i.product?.short ?? ''}</div>
                  </div>
                </div>
              </td>
              <td className="align-middle">{i.quantity}</td>
              <td className="align-middle">MK {Number(i.product?.price ?? 0).toFixed(2)}</td>
              <td className="align-middle">MK {(Number(i.product?.price ?? 0) * Number(i.quantity ?? 0)).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="d-flex justify-content-end mb-3">
        <h5>Total: MK {total.toFixed(2)}</h5>
      </div>
    </>
  );
}
