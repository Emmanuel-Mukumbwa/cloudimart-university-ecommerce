//src/app/(store)/checkout/page.tsx
'use client';
import React, { useState } from 'react';
import client from '../../../lib/api/client';
import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [valid, setValid] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [placing, setPlacing] = useState(false);
  const router = useRouter();

  // Validate GPS location before placing order
  const checkLocation = async () => {
    try {
      setChecking(true);
      const res = await client.post('/checkout/validate-location', {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      });
      setValid(res.data.valid ?? false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to verify location');
      setValid(false);
    } finally {
      setChecking(false);
    }
  };

  // Place order only if location valid
  const placeOrder = async () => {
    if (valid === false) {
      alert('Your location is outside the delivery zone.');
      return;
    }
    if (valid === null) {
      const confirmCheck = confirm(
        'You have not verified your location. Verify before placing order?'
      );
      if (confirmCheck) {
        await checkLocation();
        return;
      }
    }

    try {
      setPlacing(true);
      const res = await client.post('/orders', {
        delivery_lat: parseFloat(lat),
        delivery_lng: parseFloat(lng),
        delivery_address: address,
      });

      if (res.data.success) {
        alert(`Order placed successfully! Order ID: ${res.data.order_id}`);
        router.push(`/orders/${res.data.order_id}`);
      } else {
        alert(res.data.message || 'Failed to place order.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="container py-5">
      <h3 className="mb-4">Checkout</h3>

      <div className="row">
        <div className="col-md-7">
          <div className="mb-3">
            <label className="form-label">Delivery address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="form-control"
              placeholder="Hostel / Office / Room"
            />
          </div>

          <div className="row g-2 mb-3">
            <div className="col">
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="form-control"
                placeholder="Latitude (e.g. -11.44)"
              />
            </div>
            <div className="col">
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="form-control"
                placeholder="Longitude (e.g. 34.01)"
              />
            </div>
          </div>

          <div className="mb-3 d-flex gap-2 align-items-center">
            <button
              onClick={checkLocation}
              className="btn btn-outline-primary"
              disabled={checking}
            >
              {checking ? 'Verifying...' : 'Verify Location'}
            </button>
            {valid !== null && (
              <div>
                {valid ? (
                  <span className="text-success fw-semibold">
                    ✅ Within delivery area
                  </span>
                ) : (
                  <span className="text-danger fw-semibold">
                    ❌ Outside delivery area
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <button
              onClick={placeOrder}
              className="btn btn-warning"
              disabled={placing}
            >
              {placing ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </div>

        <div className="col-md-5">
          <div className="card shadow-sm p-3">
            <h6>Order summary</h6>
            <p className="small text-muted mb-2">
              Please verify your address and coordinates before submitting your
              order.
            </p>
            {/* Optionally fetch cart summary via /cart */}
          </div>
        </div>
      </div>
    </div>
  );
}
