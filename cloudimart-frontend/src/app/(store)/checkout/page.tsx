// src/app/(store)/checkout/page.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import client from '../../../lib/api/client';
import { useRouter } from 'next/navigation';
import CenteredModal from '../../../components/common/CenteredModal';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import CartTable from '../../../components/checkout/CartTable';
import PaymentModal from '../../../components/checkout/PaymentModal';

type Loc = {
  id: number;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
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
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Locations dropdown + fallback
  const [locations, setLocations] = useState<Loc[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');
  const [showFallbackChoice, setShowFallbackChoice] = useState(false);

  // Modal (generic messages)
  const [modal, setModal] = useState<{ show: boolean; title?: string; body?: React.ReactNode }>({ show: false });

  // Payment state & polling
  const [paymentTxRef, setPaymentTxRef] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const pollingRef = useRef<number | null>(null);

  // Payment modal & loading
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Uploaded proofs (user's payments)
  const [userPayments, setUserPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    loadCart();
    loadLocationsAndUser();
    fetchPayments();

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Helper: safely extract an array of items from various API shapes
   * Avoid mixing `||` and `??` in one expression to keep parsers happy.
   */
  const extractArrayFromResponse = (res: any): any[] => {
    const payload = res?.data ?? null;
    if (!payload) return [];
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    return [];
  };

  // Load cart items and totals (fixed: no mixed || + ?? usage)
  const loadCart = async () => {
    try {
      const res = await client.get('/api/cart');
      const items = extractArrayFromResponse(res);
      setCartItems(items);
      setTotal(items.reduce((sum: number, i: any) => sum + Number(i.product?.price ?? 0) * (i.quantity ?? 1), 0));
    } catch (e) {
      setCartItems([]);
      setTotal(0);
    }
  };

  // Fetch user's payment uploads & statuses
  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const res = await client.get('/api/payments');
      // safe extraction: prefer res.data.data then res.data
      const payload = res.data?.data ?? res.data ?? [];
      setUserPayments(Array.isArray(payload) ? payload : []);
    } catch (e) {
      setUserPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Load locations and (optionally) user to set default selected location
  const loadLocationsAndUser = async () => {
    try {
      const res = await client.get('/api/locations');
      const payload = res.data?.locations ?? res.data?.data ?? res.data ?? [];
      if (Array.isArray(payload)) setLocations(payload);
      else if (Array.isArray(res.data)) setLocations(res.data);
    } catch (e) {
      setLocations([]);
    }

    try {
      const u = await client.get('/api/user');
      const user = u.data?.user ?? u.data ?? null;
      if (user && user.location_id) {
        setSelectedLocationId(user.location_id);
      } else if (!selectedLocationId && locations.length > 0) {
        setSelectedLocationId(locations[0].id);
      }
    } catch (e) {
      if (!selectedLocationId && locations.length > 0) {
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
        await useSelectedLocationFallback(true);
      } else {
        setModal({
          show: true,
          title: 'GPS failed',
          body: 'Unable to get GPS coordinates. Please select a fallback location from the dropdown or try again with a device that has GPS.',
        });
      }
    };

    const options: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

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

  // --- PAYMENT helpers (polling) ---

  const startPollingPaymentStatus = (txRef: string) => {
    if (pollingRef.current) window.clearInterval(pollingRef.current);

    const start = Date.now();
    const timeoutMs = 10 * 60 * 1000; // 10 minutes
    const intervalMs = 4000;

    pollingRef.current = window.setInterval(async () => {
      try {
        const res = await client.get('/api/payment/status', { params: { tx_ref: txRef } });
        const status = res.data?.status ?? res.data?.payment?.status ?? null;
        const payment = res.data?.payment ?? null;

        if (status === 'success') {
          setPaymentStatus('success');
          // If server attached order_id inside payment.meta, show it
          const meta = payment?.meta ?? null;
          const orderId =
            meta?.order_id ??
            (typeof meta === 'string' ? (() => { try { return JSON.parse(meta)?.order_id ?? null; } catch { return null; } })() : null);

          if (orderId) {
            setModal({ show: true, title: 'Payment confirmed', body: `Payment confirmed and order created: ${orderId}` });
            // refresh payments and cart
            fetchPayments();
            await loadCart();
            // stop polling
            if (pollingRef.current) { window.clearInterval(pollingRef.current); pollingRef.current = null; }
            return;
          }

          // else just notify
          setModal({ show: true, title: 'Payment confirmed', body: 'Payment confirmed. You can now place the order.' });
          if (pollingRef.current) { window.clearInterval(pollingRef.current); pollingRef.current = null; }
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
        setModal({ show: true, title: 'Payment timeout', body: 'Payment not confirmed within expected time. Please contact support.' });
      }
    }, intervalMs);
  };

  // Open payment options modal
  const onOpenPaymentOptions = () => {
    if (!cartItems.length) {
      setModal({ show: true, title: 'Cart empty', body: 'Your cart is empty.' });
      return;
    }
    if (!verified) {
      setModal({ show: true, title: 'Not verified', body: 'Please verify your delivery location first.' });
      return;
    }
    if (!address || address.trim().length < 3) {
      setModal({ show: true, title: 'Address required', body: 'Please enter a delivery address before making payment.' });
      return;
    }

    setShowPaymentModal(true);
  };

  // On PayChangu initiation
  const handleInitiatePayChangu = async (payload: { amount: number; mobile: string; network: string; delivery_lat?: number; delivery_lng?: number; delivery_address?: string }) => {
    setPaymentLoading(true);
    try {
      const res = await client.post('/api/payment/initiate', payload);
      const checkoutUrl = res.data?.checkout_url ?? res.data?.data?.checkout_url;
      const txRef = res.data?.tx_ref ?? res.data?.data?.tx_ref ?? null;

      if (!checkoutUrl || !txRef) {
        throw new Error('Payment initiation failed (no checkout URL or tx_ref returned)');
      }

      window.open(checkoutUrl, '_blank');

      setPaymentTxRef(txRef);
      setPaymentStatus('pending');
      startPollingPaymentStatus(txRef);
      setModal({ show: true, title: 'Payment started', body: 'PayChangu checkout started in a new tab. Complete payment there. This page will detect confirmation automatically.' });
      setShowPaymentModal(false);

      return { checkout_url: checkoutUrl, tx_ref: txRef };
    } catch (err: any) {
      setModal({ show: true, title: 'Payment failed', body: err?.response?.data?.error ?? err?.message ?? 'Failed to initiate PayChangu payment.' });
      throw err;
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle upload proof
  const handleUploadProof = async (formData: FormData) => {
    setPaymentLoading(true);
    try {
      const res = await client.post('/api/payment/upload-proof', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const txRef = res.data?.tx_ref ?? res.data?.data?.tx_ref ?? null;

      if (!txRef) {
        throw new Error('Upload succeeded but no tx_ref returned. Contact support.');
      }

      setPaymentTxRef(txRef);
      setPaymentStatus('pending');

      // start polling for admin approval
      startPollingPaymentStatus(txRef);

      setModal({ show: true, title: 'Proof uploaded', body: 'Your proof of payment was uploaded. Payment is pending admin approval.' });
      setShowPaymentModal(false);

      // refresh list
      fetchPayments();

      return { tx_ref: txRef };
    } catch (err: any) {
      setModal({ show: true, title: 'Upload failed', body: err?.response?.data?.message ?? err?.message ?? 'Failed to upload proof.' });
      throw err;
    } finally {
      setPaymentLoading(false);
    }
  };

  // Place Order (client triggered; server may auto-place when admin approves)
  const placeOrder = async () => {
    setError(null);

    if (!cartItems.length) {
      setModal({ show: true, title: 'Cart empty', body: 'Your cart is empty' });
      return;
    }

    if (!verified) {
      setModal({ show: true, title: 'Not verified', body: 'Please verify your delivery location before placing the order.' });
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
        const returnedStatus = res.data.order?.status ?? 'pending_delivery';
        const statusLabel = returnedStatus === 'pending_delivery' ? 'Pending delivery' : returnedStatus;

        setModal({ show: true, title: 'Order placed', body: `Order placed — Order ID: ${res.data.order_id ?? '(check orders page)'}\nStatus: ${statusLabel}` });

        // refresh cart & payments
        await loadCart();
        fetchPayments();
      } else {
        setModal({ show: true, title: 'Order failed', body: res.data?.message ?? 'Failed to place order' });
      }
    } catch (err: any) {
      console.error('Place order error', err);
      setModal({ show: true, title: 'Order failed', body: err?.response?.data?.message ?? err?.message ?? 'Failed to place order' });
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

  const placeOrderDisabled = !(paymentStatus === 'success' && address.trim().length >= 3);

  return (
    <div className="container py-5">
      <CenteredModal show={modal.show} title={modal.title} body={modal.body} onClose={handleCloseModal} />

      <PaymentModal
        show={showPaymentModal}
        amount={total}
        defaultMobile={''}
        defaultNetwork={'mpamba'}
        defaultAddress={address}
        defaultLat={gps.lat}
        defaultLng={gps.lng}
        onClose={() => setShowPaymentModal(false)}
        onInitiatePayChangu={handleInitiatePayChangu}
        onUploadProof={handleUploadProof}
      />

      <div className="bg-white rounded shadow-sm p-4">
        <h4 className="mb-4">Checkout</h4>

        {cartItems.length === 0 ? (
          <div className="text-center text-muted py-5">
            <h5>Your cart is empty</h5>
          </div>
        ) : (
          <>
            <CartTable items={cartItems} total={total} />

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

            {/* Uploaded proofs list */}
            <div className="mb-3">
              <h6>Your payment uploads</h6>
              {loadingPayments ? (
                <div className="text-center py-3"><LoadingSpinner /></div>
              ) : userPayments.length === 0 ? (
                <div className="text-muted small">No payment uploads yet.</div>
              ) : (
                <div className="list-group">
                  {userPayments.map((p) => (
                    <div key={p.id ?? p.tx_ref} className="list-group-item d-flex align-items-center gap-3">
                      <a href={(p.proof_url ? `/storage/${p.proof_url}` : (p.proof_url_full ?? '#'))} target="_blank" rel="noreferrer">
                        <img src={p.proof_url ? `/storage/${p.proof_url}` : '/images/placeholder.png'} alt="proof" style={{ width: 92, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                      </a>
                      <div className="flex-fill">
                        <div className="d-flex justify-content-between">
                          <div>
                            <div className="fw-semibold">{p.tx_ref}</div>
                            <div className="small text-muted">{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</div>
                          </div>
                          <div className="text-end">
                            <div className={`badge ${p.status === 'success' ? 'bg-success' : p.status === 'failed' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                              {p.status}
                            </div>
                            {p.meta?.order_id && <div className="small mt-1">Order: <strong>{p.meta.order_id}</strong></div>}
                          </div>
                        </div>
                        <div className="small text-muted mt-2">{p.meta?.note ?? ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="d-flex justify-content-end gap-3">
              <button
                className="btn btn-primary"
                onClick={onOpenPaymentOptions}
                disabled={!verified || address.trim().length < 3 || paymentLoading}
              >
                {paymentLoading ? <LoadingSpinner /> : (paymentStatus === 'pending' ? 'Payment pending...' : 'Make Payment')}
              </button>

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




