// File: src/app/(delivery)/verify/page.tsx
'use client';
import React, { useState } from 'react';
import client from '../../../lib/api/client';
import CenteredModal from '../../../components/common/CenteredModal';

export default function VerifyPage() {
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('+265');
  const [person, setPerson] = useState('');
  const [modal, setModal] = useState<{ show: boolean; title?: string; body?: string }>({ show: false });

  const submit = async () => {
    try {
      const res = await client.post('/api/delivery/verify', { order_id: orderId, phone, delivery_person: person || undefined });
      setModal({ show: true, title: 'Success', body: res.data?.message ?? 'Verified' });
      // reset minimal fields
      setOrderId('');
      setPhone('+265');
      setPerson('');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Verify failed';
      setModal({ show: true, title: 'Failed', body: String(msg) });
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow-sm p-4">
            <h5 className="mb-3">Delivery verification</h5>
            <div className="mb-3">
              <input value={orderId} onChange={(e)=>setOrderId(e.target.value)} className="form-control" placeholder="Order ID (e.g. ORD-20260203-ABC123)" />
            </div>
            <div className="mb-3">
              <input value={phone} onChange={(e)=>setPhone(e.target.value)} className="form-control" placeholder="Customer phone number (prefilled +265)" />
            </div>
            <div className="mb-3">
              <input value={person} onChange={(e)=>setPerson(e.target.value)} className="form-control" placeholder="Delivery person name (optional)" />
            </div>
            <button onClick={submit} className="btn btn-warning w-100">Confirm Delivery</button>
          </div>
        </div>
      </div>

      <CenteredModal
        show={modal.show}
        title={modal.title}
        body={modal.body}
        onClose={() => setModal({ show: false })}
        okLabel="OK"
      />
    </div>
  );
}
