// src/app/(store)/checkout/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import { useRouter } from 'next/navigation';
import CenteredModal from '../../../components/common/CenteredModal';

type Loc = {
  id: number;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
};

type ModalState = {
  show: boolean;
  title?: string;
  body?: React.ReactNode;
};

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  const [gps, setGps] = useState<{ lat?: number; lng?: number }>({});
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [detectedArea, setDetectedArea] = useState<{ id?: number; name?: string } | null>(null);
  const [address, setAddress] = useState(''); // delivery address text user must enter
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<Loc[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');
  const [showFallbackChoice, setShowFallbackChoice] = useState(false);

  const [modal, setModal] = useState<ModalState>({ show: false, title: '', body: '' });

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

  const loadLocationsAndUser = async () => {
    try {
      const res = await client.get('/api/locations');
      const payload = res.data.locations ?? res.data.data ?? res.data;
      if (Array.isArray(payload)) setLocations(payload);
      else if (Array.isArray(res.data)) setLocations(res.data);
    } catch (e) {
      setLocations([]);
    }

    // Try to set user's registered location if available
    try {
      const u = await client.get('/api/user');
      const user = u.data?.user ?? u.data;
      if (user && user.location_id) {
        setSelectedLocationId(user.location_id);
      } else if (!selectedLocationId && locations.length > 0) {
        setSelectedLocationId(locations[0].id);
      }
    } catch (e) {
      // not logged or error, just default later
      if (!selectedLocationId && locations.length > 0) setSelectedLocationId(locations[0].id);
    }
  };

  useEffect(() => {
    loadCart();
    loadLocationsAndUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validatePointAndSet = async (lat: number, lng: number, location_id?: number | '') => {
    setError(null);
    setDetectedArea(null);
    setVerified(false);

    try {
      const res = await client.post('/api/locations/validate', { lat, lng, location_id });
      const data = res.data;
      const insideAny = !!data?.inside_any_area;
      const detected = data?.detected_location ?? null;

      setDetectedArea(detected);
      setVerified(insideAny);

      if (insideAny) {
        setModal({
          show: true,
          title: 'Location verified',
          body: detected && detected.name
            ? `You are inside: ${detected.name}\nLat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`
            : `Location verified (inside delivery area).\nLat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`,
        });
      } else {
        setModal({
          show: true,
          title: 'Outside delivery area',
          body: `The coordinates you provided are outside our configured delivery zones.\nLat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`,
        });
      }
    } catch (err: any) {
      console.error('Validation error', err);
      setError(err?.response?.data?.message ?? 'Validation failed');
      setDetectedArea(null);
      setVerified(false);
      setModal({ show: true, title: 'Validation error', body: err?.response?.data?.message ?? 'Validation failed' });
    }
  };

  // GPS request with 30s timeout & automatic fallback
  const requestGps = async () => {
    setError(null);
    setDetectedArea(null);
    setVerified(false);
    setShowFallbackChoice(false);

    if (!navigator.geolocation) {
      setError('GPS is not supported on this device/browser.');
      return;
    }

    setVerifying(true);

    const success = async (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setGps({ lat, lng });

      try {
        await validatePointAndSet(lat, lng, selectedLocationId);
      } finally {
        setVerifying(false);
      }
    };

    const errorCb = async (err: GeolocationPositionError) => {
      console.warn('Geolocation error', err);
      setVerifying(false);
      setShowFallbackChoice(true);

      switch (err.code) {
        case err.PERMISSION_DENIED:
          setError('Location permission denied. Falling back to your selected location (if available).');
          break;
        case err.POSITION_UNAVAILABLE:
          setError('Position unavailable. Falling back to your selected location (if available).');
          break;
        case err.TIMEOUT:
        default:
          setError('GPS timeout. Falling back to your selected location (if available).');
          break;
      }

      if (selectedLocationId) {
        // automatic fallback when selected location exists
        await useSelectedLocationFallback(true);
      } else {
        setModal({
          show: true,
          title: 'GPS failed',
          body: 'Unable to get GPS coordinates. Please select a fallback location from the dropdown or try again with a device that has GPS.',
        });
      }
    };

    const options: PositionOptions = { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 };

    try {
      navigator.geolocation.getCurrentPosition(success, errorCb, options);
    } catch (err) {
      console.error('getCurrentPosition threw', err);
      setVerifying(false);
      setError('Unexpected geolocation error. Please try again.');
      setShowFallbackChoice(true);
    }
  };

  const useSelectedLocationFallback = async (autoFallback = false) => {
    setError(null);
    setDetectedArea(null);
    setVerified(false);

    if (!selectedLocationId) {
      setError('Please select a fallback location from the dropdown.');
      if (!autoFallback) setModal({ show: true, title: 'No location selected', body: 'Please select a fallback location.' });
      return;
    }

    let loc = locations.find((l) => Number(l.id) === Number(selectedLocationId));

    if (!loc || loc.latitude === undefined || loc.longitude === undefined || loc.latitude === null || loc.longitude === null) {
      try {
        const res = await client.get(`/api/locations/${selectedLocationId}`);
        loc = res.data?.location ?? res.data ?? loc;
      } catch (e) {
        console.warn('Failed to fetch location details', e);
      }
    }

    if (!loc) {
      setError('Selected location details are not available. Try another location or contact support.');
      setModal({ show: true, title: 'Location not available', body: 'Selected location details are not available.' });
      return;
    }

    if (loc.latitude === undefined || loc.longitude === undefined || loc.latitude === null || loc.longitude === null) {
      setError('Selected location does not have coordinates to use as fallback.');
      setModal({ show: true, title: 'No coordinates', body: 'Selected location does not have coordinates to use as fallback.' });
      return;
    }

    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    setGps({ lat, lng });
    setVerifying(true);

    try {
      await validatePointAndSet(lat, lng, selectedLocationId);
    } catch (err: any) {
      console.error('Fallback validation error', err);
      setError(err?.response?.data?.message ?? 'Fallback validation failed');
      setDetectedArea(null);
      setVerified(false);
      setModal({ show: true, title: 'Fallback failed', body: err?.response?.data?.message ?? 'Fallback validation failed' });
    } finally {
      setVerifying(false);
      setShowFallbackChoice(false);
    }
  };

  const placeOrder = async () => {
    setError(null);

    if (!cartItems.length) {
      setModal({ show: true, title: 'Cart empty', body: 'Your cart is empty.' });
      return;
    }

    if (!verified) {
      setModal({ show: true, title: 'Not verified', body: 'Please verify your delivery location (GPS or fallback) before placing the order.' });
      return;
    }

    if (!gps.lat || !gps.lng) {
      setModal({ show: true, title: 'Missing coordinates', body: 'GPS coordinates missing. Please verify location or use the fallback.' });
      return;
    }

    if (!address || address.trim().length < 3) {
      setModal({ show: true, title: 'Missing address', body: 'Please enter a delivery address (hostel/room/office).' });
      return;
    }

    try {
      const payload = {
        delivery_lat: gps.lat,
        delivery_lng: gps.lng,
        delivery_address: address.trim(),
        // default payment choice for now
        payment_method: 'cod',
      };

      const res = await client.post('/api/checkout/place-order', payload);

      if (res.data?.success) {
        setModal({ show: true, title: 'Order placed', body: `Order placed — Order ID: ${res.data.order_id ?? '(check orders page)'}` });
      } else {
        setModal({ show: true, title: 'Order failed', body: res.data?.message ?? 'Failed to place order' });
      }
    } catch (err: any) {
      console.error('Place order error', err);
      setModal({ show: true, title: 'Order failed', body: err?.response?.data?.message ?? 'Failed to place order' });
    }
  };

  const handleCloseModal = () => {
    // If order placed modal, redirect to orders page
    if (modal.title === 'Order placed') {
      setModal({ show: false });
      router.push('/orders');
      return;
    }
    setModal({ show: false });
  };

  // disable place-order until verified and address supplied
  const placeOrderDisabled = !verified || address.trim().length < 3;

  return (
    <div className="container py-5">
      <CenteredModal show={modal.show} title={modal.title} body={modal.body} onClose={handleCloseModal} />

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

              <div className="mb-3">
                <label className="form-label small">Select location</label>
                <select
                  className="form-select"
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : '')}
                  disabled={verified}
                >
                  <option value="">Choose location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <div className="form-text small mt-1">
                  If GPS fails we will automatically use this selected location as fallback.
                </div>
              </div>

              <div className="d-flex gap-2 align-items-center">
                <button className="btn btn-outline-primary" onClick={requestGps} disabled={verifying}>
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

                {!selectedLocationId && showFallbackChoice && (
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => useSelectedLocationFallback(false)}
                    disabled={!selectedLocationId || verifying}
                  >
                    Use selected location as fallback
                  </button>
                )}
              </div>

              <div className="mt-2">
                {detectedArea ? (
                  <div className="alert alert-success mb-0 p-2">Detected area: <strong>{detectedArea.name}</strong></div>
                ) : (
                  !verifying && gps.lat && gps.lng && !verified && (
                    <div className="alert alert-warning mb-0 p-2">Coordinates are outside delivery zones.</div>
                  )
                )}
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="d-flex justify-content-end">
              <button className="btn btn-success btn-lg" onClick={placeOrder} disabled={placeOrderDisabled}>
                Place Order
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
