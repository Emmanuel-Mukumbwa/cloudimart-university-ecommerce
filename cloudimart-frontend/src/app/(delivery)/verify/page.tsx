//src/app/(delivery)/verify/page.tsx
'use client';
import React, { useState } from 'react';
import client from '../../../lib/api/client';

export default function VerifyPage() {
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [person, setPerson] = useState('');

  const submit = async () => {
    try {
      const res = await client.post('/delivery/verify', { order_id: orderId, phone, delivery_person: person });
      alert(res.data.message || 'Verified');
    } catch (err:any) {
      alert(err.response?.data?.message || 'Verify failed');
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
              <input value={phone} onChange={(e)=>setPhone(e.target.value)} className="form-control" placeholder="Customer phone number" />
            </div>
            <div className="mb-3">
              <input value={person} onChange={(e)=>setPerson(e.target.value)} className="form-control" placeholder="Delivery person name (optional)" />
            </div>
            <button onClick={submit} className="btn btn-warning w-100">Confirm Delivery</button>
          </div>
        </div>
      </div>
    </div> 
  );
}
