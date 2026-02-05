// File: src/app/(store)/checkout/page.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  const router = useRouter();

  // Cart + totals
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  // Location / GPS
  const [gps, setGps] = useState<{ lat?: number; lng?: number }>({});
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [detectedArea, setDetectedArea] = useState<{ id?: number; name?: string } | null>(null);

  // Address + UI
  const [address, setAddress] = useState(''); // delivery address text user must enter
  const [error, setError] = useState<string | null>(null);

  // Locations dropdown + fallback behavior
  const [locations, setLocations] = useState<Loc[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');
  const [showFallbackChoice, setShowFallbackChoice] = useState(false);

  // Modal
  const [modal, setModal] = useState<ModalState>({ show: false, title: '', body: '' });

  // Payment state & polling
  const [paymentTxRef, setPaymentTxRef] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    loadCart();
    loadLocationsAndUser();

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load cart items and totals
  const loadCart = async () => {
    try {
      const res = await client.get('/api/cart');
      const items = res.data.items || res.data.data?.items || [];
      setCartItems(items);
      setTotal(items.reduce((sum: number, i: any) => sum + Number(i.product?.price ?? 0) * (i.quantity ?? 1), 0));
    } catch (e) {
      setCartItems([]);
      setTotal(0);
    }
  };

  // Load locations and (optionally) user to set default selected location
  const loadLocationsAndUser = async () => {
    try {
      const res = await client.get('/api/locations');
      const payload = res.data.locations ?? res.data.data ?? res.data;
      if (Array.isArray(payload)) setLocations(payload);
      else if (Array.isArray(res.data)) setLocations(res.data);
    } catch (e) {
      setLocations([]);
    }

    try {
      const u = await client.get('/api/user');
      const user = u.data?.user ?? u.data;
      if (user && user.location_id) {
        setSelectedLocationId(user.location_id);
      } else if (!selectedLocationId && (locations && locations.length > 0)) {
        setSelectedLocationId(locations[0].id);
      }
    } catch (e) {
      // ignore if unauthenticated
      if (!selectedLocationId && (locations && locations.length > 0)) {
        setSelectedLocationId(locations[0].id);
      }
    }
  };

  // Validate coordinates via backend and set detected/verified state
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
          body:
            detected && detected.name
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

  // Request GPS with options and automatic fallback
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
        // automatic fallback when a selected location exists
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

  // Use selected location as fallback (fetch coords if missing)
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

  // --- PAYMENT: initiate (calls your backend) ---
  const getUserPhone = async (): Promise<string | null> => {
    try {
      const res = await client.get('/api/user');
      const user = res.data?.user ?? res.data;
      return user?.phone_number ?? null;
    } catch (e) {
      return null;
    }
  };

  const initiatePayment = async () => {
    setError(null);
    if (!verified) {
      setModal({ show: true, title: 'Need verification', body: 'Please verify location first before making payment.' });
      return;
    }
    if (!address || address.trim().length < 3) {
      setModal({ show: true, title: 'Address required', body: 'Please enter a delivery address before payment.' });
      return;
    }

    try {
      const payload = {
        amount: total,
        mobile: (await getUserPhone()) || '',
        network: 'mpamba',
        delivery_lat: gps.lat,
        delivery_lng: gps.lng,
        delivery_address: address.trim(),
      };

      const res = await client.post('/api/payment/initiate', payload);
      const checkoutUrl = res.data.checkout_url;
      const txRef = res.data.tx_ref ?? res.data.data?.tx_ref ?? null;

      if (!checkoutUrl || !txRef) {
        setModal({ show: true, title: 'Payment error', body: 'Payment initiation failed (no URL or tx_ref).' });
        return;
      }

      setPaymentTxRef(txRef);
      setPaymentStatus('pending');

      // open checkout in a new tab so user can complete payment
      window.open(checkoutUrl, '_blank');

      // start polling payment status
      startPollingPaymentStatus(txRef);

      setModal({ show: true, title: 'Payment started', body: 'Payment started. Complete the payment in the opened tab. This page will enable Place Order once payment completes.' });
    } catch (err: any) {
      setModal({ show: true, title: 'Payment failed', body: err?.response?.data?.error ?? err?.message ?? 'Failed to initiate payment.' });
    }
  };

  // Polling payment status
  const startPollingPaymentStatus = (txRef: string) => {
    if (pollingRef.current) window.clearInterval(pollingRef.current);

    const start = Date.now();
    const timeoutMs = 5 * 60 * 1000; // 5 minutes
    const intervalMs = 3000; // 3s

    // use window.setInterval id (number)
    pollingRef.current = window.setInterval(async () => {
      try {
        const res = await client.get('/api/payment/status', { params: { tx_ref: txRef } });
        const status = res.data?.status ?? res.data?.payment?.status ?? null;

        if (status === 'success') {
          setPaymentStatus('success');
          if (pollingRef.current) { window.clearInterval(pollingRef.current); pollingRef.current = null; }
          setModal({ show: true, title: 'Payment confirmed', body: `Payment ${txRef} confirmed. You can now place the order.` });
        } else if (status === 'failed') {
          setPaymentStatus('failed');
          if (pollingRef.current) { window.clearInterval(pollingRef.current); pollingRef.current = null; }
          setModal({ show: true, title: 'Payment failed', body: 'Payment failed or was cancelled.' });
        } else {
          setPaymentStatus('pending');
        }
      } catch (e) {
        console.warn('Payment poll error', e);
      }

      if (Date.now() - start > timeoutMs) {
        if (pollingRef.current) { window.clearInterval(pollingRef.current); pollingRef.current = null; }
        setPaymentStatus('failed');
        setModal({ show: true, title: 'Payment timeout', body: 'Payment not confirmed within 5 minutes. Please try again.' });
      }
    }, intervalMs);
  };

  // Place Order: requires paymentStatus === 'success'
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

    // Enforce that payment was completed before allowing order placement
    if (!paymentTxRef || paymentStatus !== 'success') {
      setModal({ show: true, title: 'Payment required', body: 'Please make and confirm a payment first.' });
      return;
    }

    try {
      const payload: any = {
        tx_ref: paymentTxRef,
        delivery_lat: gps.lat,
        delivery_lng: gps.lng,
        delivery_address: address.trim(),
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
    if (modal.title === 'Order placed') {
      setModal({ show: false });
      router.push('/orders');
      return;
    }
    setModal({ show: false });
  };

  // Place order disabled until payment confirmed + address present
  const placeOrderDisabled = !(paymentStatus === 'success' && address.trim().length >= 3);

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

                <div className="small text-muted ms-3">
                  {gps.lat && gps.lng ? (
                    <>
                      Lat: <strong>{gps.lat.toFixed(6)}</strong>, Lng: <strong>{gps.lng.toFixed(6)}</strong>
                    </>
                  ) : (
                    <>No coordinates yet</>
                  )}
                </div>

                {showFallbackChoice && (
                  <button
                    className="btn btn-outline-secondary ms-3"
                    onClick={() => useSelectedLocationFallback(false)}
                    disabled={!selectedLocationId || verifying}
                  >
                    Use selected location as fallback
                  </button>
                )}

                {paymentTxRef && (
                  <div className="ms-3 small">
                    Payment: <strong>{paymentStatus}</strong> {paymentTxRef ? `(tx: ${paymentTxRef})` : null}
                  </div>
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

            <div className="d-flex justify-content-end gap-3">
              {/* Make Payment button */}
              <button
                className="btn btn-primary"
                onClick={initiatePayment}
                disabled={!verified || address.trim().length < 3 || paymentStatus === 'pending'}
              >
                {paymentStatus === 'pending' ? 'Payment pending...' : 'Make Payment'}
              </button>

              {/* Place Order button (only enabled after successful payment) */}
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
