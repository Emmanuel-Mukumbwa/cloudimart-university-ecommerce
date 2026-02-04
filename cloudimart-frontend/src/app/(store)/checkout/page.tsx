//src/app/(store)/checkout/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  const [gps, setGps] = useState<{ lat?: number; lng?: number }>({});
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [detectedArea, setDetectedArea] = useState<{ id?: number; name?: string } | null>(null);
  const [address, setAddress] = useState(''); // delivery address text user must enter
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const loadCart = async () => {
    try {
      const res = await client.get('/api/cart');
      const items = res.data.items || res.data.data?.items || [];
      setCartItems(items);
      const total = items.reduce(
        (sum: number, i: any) => sum + Number(i.product?.price ?? 0) * (i.quantity ?? 1),
        0
      );
      setTotal(total);
    } catch (e) {
      setCartItems([]);
      setTotal(0);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  // Request GPS, validate with backend and display coords + detected area
  const requestGps = async () => {
    setError(null);
    if (!navigator.geolocation) {
      setError('GPS is not supported on this device/browser.');
      return;
    }

    setVerifying(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGps({ lat, lng });

        try {
          // Call the server validation endpoint that returns:
          // { inside_any_area: bool, matches_selected: bool|null, detected_location: {id,name}|null }
          // NOTE: backend endpoint here is /api/locations/validate (it returns the detected area)
          const res = await client.post('/api/locations/validate', { lat, lng });
          const data = res.data;

          // server shape guard
          const insideAny = !!data?.inside_any_area;
          const detected = data?.detected_location ?? null;

          setDetectedArea(detected);
          setVerified(insideAny);

          if (insideAny) {
            // friendly message
            if (detected && detected.name) {
              alert(`Location verified — you are inside: ${detected.name}\nLat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
            } else {
              alert(`Location verified (inside delivery area).\nLat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
            }
          } else {
            setDetectedArea(null);
            setVerified(false);
            alert(`Point is outside our delivery zones.\nLat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
          }
        } catch (err: any) {
          console.error('Validation error', err);
          setError(err?.response?.data?.message ?? 'Validation failed');
          setDetectedArea(null);
          setVerified(false);
        } finally {
          setVerifying(false);
        }
      },
      (err) => {
        console.warn('Geolocation error', err);
        setVerifying(false);
        setError('GPS permission denied or timed out.');
      },
      { timeout: 15000 }
    );
  };

  // Place order — include coords and address. Backend must re-validate.
  const placeOrder = async () => {
    setError(null);

    if (!cartItems.length) {
      setError('Your cart is empty.');
      return;
    }

    if (!verified) {
      setError('Please verify your delivery location before placing the order.');
      return;
    }

    if (!gps.lat || !gps.lng) {
      setError('GPS coordinates missing. Please re-run verification.');
      return;
    }

    if (!address || address.trim().length < 3) {
      setError('Please enter a delivery address (hostel/room/office).');
      return;
    }

    try {
      // Backend expects delivery_lat, delivery_lng, delivery_address
      const payload = {
        delivery_lat: gps.lat,
        delivery_lng: gps.lng,
        delivery_address: address.trim(),
      };

      const res = await client.post('/api/checkout/place-order', payload);
      if (res.data?.success) {
        alert(`Order placed — Order ID: ${res.data.order_id ?? '(check orders page)'}`);
        // optional: clear state / redirect
        router.push('/orders');
      } else {
        // backend may return success:false with message
        setError(res.data?.message ?? 'Failed to place order');
      }
    } catch (err: any) {
      console.error('Place order error', err);
      setError(err?.response?.data?.message ?? 'Failed to place order');
    }
  };

  // UI: show coords and area after verification
  return (
    <div className="container py-5">
      <div className="bg-white rounded shadow-sm p-4">
        <h4 className="mb-4">Checkout</h4>

        {cartItems.length === 0 ? (
          <div className="text-center text-muted py-5">
            <h5>Your cart is empty</h5>
          </div>
        ) : (
          <>
            <table className="table table-bordered mb-3">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((i) => (
                  <tr key={i.id}>
                    <td>{i.product?.name}</td>
                    <td>{i.quantity}</td>
                    <td>MK {Number(i.product?.price ?? 0).toFixed(2)}</td>
                    <td>MK {(Number(i.product?.price ?? 0) * Number(i.quantity ?? 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="d-flex justify-content-end mb-3">
              <h5>Total: MK {total.toFixed(2)}</h5>
            </div>

            <div className="border rounded p-3 mb-3">
              <h6>Delivery Location Verification</h6>

              <div className="mb-3">
                <label className="form-label small">Delivery address (hostel/office/room)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Hostel A, Room 12"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="d-flex gap-2 align-items-center">
                <button
                  className="btn btn-outline-primary"
                  onClick={requestGps}
                  disabled={verifying}
                >
                  {verifying ? 'Verifying...' : verified ? 'Location Verified ✓' : 'Verify via GPS'}
                </button>

                <div className="small text-muted">
                  {gps.lat && gps.lng ? (
                    <>
                      Lat: <strong>{gps.lat.toFixed(6)}</strong>, Lng: <strong>{gps.lng.toFixed(6)}</strong>
                    </>
                  ) : (
                    <>No coordinates yet</>
                  )}
                </div>
              </div>

              <div className="mt-2">
                {detectedArea ? (
                  <div className="alert alert-success mb-0 p-2">
                    Detected area: <strong>{detectedArea.name}</strong>
                  </div>
                ) : (
                  detectedArea === null && gps.lat && gps.lng && (
                    <div className="alert alert-warning mb-0 p-2">
                      Coordinates are outside delivery zones.
                    </div>
                  )
                )}
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="d-flex justify-content-end">
              <button
                className="btn btn-success btn-lg"
                onClick={placeOrder}
                disabled={!verified}
              >
                Place Order
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
