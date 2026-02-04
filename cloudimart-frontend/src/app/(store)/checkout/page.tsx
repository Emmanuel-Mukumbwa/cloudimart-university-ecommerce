'use client';
import React, { useState } from 'react';
import client from '../../../lib/api/client';
import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [valid, setValid] = useState<boolean|null>(null);
  const router = useRouter();

  const checkLocation = async () => {
    const res = await client.post('/checkout/validate-location', { lat: parseFloat(lat), lng: parseFloat(lng) });
    setValid(res.data.valid);
  };

  const place = async () => {
    const res = await client.post('/orders', { delivery_lat: parseFloat(lat), delivery_lng: parseFloat(lng), delivery_address: address });
    if (res.data.success) {
      alert(`Order placed. Order ID: ${res.data.order_id}`);
      router.push(`/orders/${res.data.order_id}`);
    } else alert(res.data.message || 'Failed');
  };

  return (
    <div className="container py-5">
      <h3 className="mb-4">Checkout</h3>

      <div className="row">
        <div className="col-md-7">
          <div className="mb-3">
            <label className="form-label">Delivery address</label>
            <input value={address} onChange={(e)=>setAddress(e.target.value)} className="form-control" placeholder="Hostel / Office / Room" />
          </div>

          <div className="row g-2 mb-3">
            <div className="col">
              <input value={lat} onChange={(e)=>setLat(e.target.value)} className="form-control" placeholder="Latitude (e.g. -11.44)" />
            </div>
            <div className="col">
              <input value={lng} onChange={(e)=>setLng(e.target.value)} className="form-control" placeholder="Longitude (e.g. 34.01)" />
            </div>
          </div>

          <div className="mb-3 d-flex gap-2">
            <button onClick={checkLocation} className="btn btn-outline-secondary">Verify Location</button>
            <div className="align-self-center">
              {valid === null ? null : valid ? <span className="text-success">Within delivery area</span> : <span className="text-danger">Outside delivery area</span>}
            </div>
          </div>

          <div>
            <button onClick={place} className="btn btn-warning">Place Order</button>
          </div>
        </div>

        <div className="col-md-5">
          <div className="card shadow-sm p-3">
            <h6>Order summary</h6>
            <p className="small text-muted">Review before placing</p>
            {/* You can fetch cart summary via /cart for a real summary */}
          </div>
        </div>
      </div>
    </div>
  );
}
