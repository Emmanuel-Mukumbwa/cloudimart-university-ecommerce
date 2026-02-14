'use client';

import React, { useEffect, useState, useRef } from 'react';
import client from '../../../lib/api/client';
import { useRouter } from 'next/navigation';
import CenteredModal from '../../../components/common/CenteredModal';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import PaymentModal from '../../../components/checkout/PaymentModal';
import PaymentButtons from '../../../components/checkout/PaymentButtons';

type Loc = {
  id: number;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
  delivery_fee?: number | null; // optional
};

export default function CheckoutPage() {
  const router = useRouter();

  // Loading flags
  const [initialLoading, setInitialLoading] = useState(true);

  // Cart + totals
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [cartHash, setCartHash] = useState<string | null>(null);

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
  const [deliveryFee, setDeliveryFee] = useState<number>(0); // NEW: selected location fee
  const [showFallbackChoice, setShowFallbackChoice] = useState(false);

  // Modal (generic messages)
  const [modal, setModal] = useState<{ show: boolean; title?: string; body?: React.ReactNode }>({ show: false });

  // Payment state & polling
  const [paymentTxRef, setPaymentTxRef] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const pollingRef = useRef<number | null>(null);

  // Modal navigation-on-close flag: when true, closing success modal navigates to /orders
  const [modalNavigateToOrders, setModalNavigateToOrders] = useState(false);

  // Payment modal & loading
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Payment modal context (which snapshot/cart the modal is currently targeting)
  const [paymentModalContext, setPaymentModalContext] = useState<{ cart_hash?: string | null; amount?: number } | null>(null);

  // all non-ordered payments (pending + failed) — used to group by cart_hash
  const [allNonOrderedPayments, setAllNonOrderedPayments] = useState<any[]>([]);
  const [loadingAllPayments, setLoadingAllPayments] = useState(false);

  // User payments for current cart (all statuses)
  const [userPayments, setUserPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Pending-reservation diagnostics
  const [reservedByProduct, setReservedByProduct] = useState<Record<string, number>>({});
  const [coveredAmount, setCoveredAmount] = useState<number>(0);
  const [remainingToPay, setRemainingToPay] = useState<number>(0);

  // Verification TTL (1 hour)
  const VERIFICATION_TTL_MS = 1000 * 60 * 60;

  // --- lifecycle: initial load ---
  useEffect(() => {
    let mounted = true;

    (async () => {
      setInitialLoading(true);
      try {
        // Load cart first (so we compute a cartHash), then locations/user, then payments filtered by cartHash
        const computed = await loadCart(); // now returns snapshot
        const itemsSnapshot = computed?.items ?? [];
        const hash = computed?.hash ?? null;

        await loadLocationsAndUser(hash ?? null);
        await fetchUserPayments(hash ?? null);
        await fetchAllNonOrderedPayments();

        // Important: compute global reservations after cart loaded — pass snapshot to avoid race
        await loadAllPendingPayments(hash ?? null, itemsSnapshot);
      } finally {
        if (mounted) setInitialLoading(false);
      }
    })();

    return () => {
      mounted = false;
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

  // --- CART HASH HELPERS ---
  const computeCartHash = (items: any[]) => {
    try {
      const arr = items.map((i) => ({
        id: Number(i.product?.id ?? i.product_id ?? 0),
        q: Number(i.quantity ?? 1),
        p: Number(i.product?.price ?? 0),
      }));
      const s = JSON.stringify(arr);
      // quick non-crypto hash (djb2-like)
      let h = 5381;
      for (let i = 0; i < s.length; i++) {
        h = (h * 33) ^ s.charCodeAt(i);
      }
      return 'ch_' + (h >>> 0).toString(36);
    } catch {
      return null;
    }
  };

  // Load cart items and totals (returns computed snapshot: { hash, items, total })
  const loadCart = async (): Promise<{ hash: string | null; items: any[]; total: number } | null> => {
    try {
      const res = await client.get('/api/cart');
      const items = extractArrayFromResponse(res);
      const computedTotal = items.reduce((sum: number, i: any) => sum + Number(i.product?.price ?? 0) * (i.quantity ?? 1), 0);
      const hash = computeCartHash(items);

      // update state (non-blocking) but also return the immediate computed snapshot
      setCartItems(items);
      setTotal(computedTotal);
      setCartHash(hash);

      return { hash, items, total: computedTotal };
    } catch (e) {
      setCartItems([]);
      setTotal(0);
      setCartHash(null);
      return { hash: null, items: [], total: 0 };
    }
  };

  // Fetch user's payment uploads & statuses (optionally filtered by cartHash)
  const fetchUserPayments = async (filterHash: string | null = null) => {
    setLoadingPayments(true);
    try {
      const effectiveHash = filterHash ?? cartHash ?? null;
      const params: any = {};
      if (effectiveHash) params.cart_hash = effectiveHash;
      // don't force only_pending here; we want pending+failed+success for display
      params.exclude_ordered = 1;
      const res = await client.get('/api/payments', { params });
      const payload = res.data?.data ?? res.data ?? [];
      setUserPayments(Array.isArray(payload) ? payload : []);
    } catch (e) {
      setUserPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Fetch all non-ordered payments (pending + failed) for grouping & display
  const fetchAllNonOrderedPayments = async () => {
    setLoadingAllPayments(true);
    try {
      const res = await client.get('/api/payments', { params: { exclude_ordered: 1 } });
      const payload = res.data?.data ?? res.data ?? [];
      const arr = Array.isArray(payload) ? payload : [];
      setAllNonOrderedPayments(arr);
    } catch (e) {
      setAllNonOrderedPayments([]);
    } finally {
      setLoadingAllPayments(false);
    }
  };

  // Helper: composite key for snapshot item
  const keyForSnapshotItem = (si: any) => {
    const pid = si?.product_id ?? si?.productId ?? si?.id ?? null;
    if (pid && Number(pid) > 0) return `id:${Number(pid)}`;
    const name = (si?.name ?? si?.product_name ?? si?.title ?? '').toString().trim().toLowerCase();
    if (name) return `name:${name}`;
    return null;
  };

  // --- IMPORTANT CHANGE ---
  // Fetch all pending payments for the user (global) and compute reservation map,
  // but only count reservations from payments that apply to the current cart (matching cart_hash).
  // Reservations are keyed by composite keys (id:<id> or name:<normalized-name>) to avoid accidental mixing.
  const loadAllPendingPayments = async (currentHash: string | null = null, cartItemsForCalc: any[] | null = null) => {
    try {
      const res = await client.get('/api/payments', { params: { only_pending: 1, exclude_ordered: 1 } });
      const payload = res.data?.data ?? res.data ?? [];
      const payments = Array.isArray(payload) ? payload : [];

      const reservedMap: Record<string, number> = {};

      // Only include payments whose meta.cart_hash equals currentHash (strict equality),
      // otherwise treat them as other pending payments.
      payments.forEach((p: any) => {
        const meta = p.meta ?? {};
        const ph = meta?.cart_hash ?? null;
        if (currentHash && ph !== currentHash) return; // skip reservations for other carts
        // only count pending payments (server filter should already ensure status pending, but double-check)
        if ((p.status ?? '').toString() !== 'pending') return;

        const snapshot = Array.isArray(meta?.cart_snapshot) ? meta.cart_snapshot : [];
        snapshot.forEach((si: any) => {
          const key = keyForSnapshotItem(si);
          if (!key) return;
          const qty = Number(si.quantity ?? si.qty ?? 0);
          if (!qty || qty <= 0) return;
          reservedMap[key] = (reservedMap[key] ?? 0) + qty;
        });
      });

      setReservedByProduct(reservedMap);

      // choose the provided snapshot or fall back to state
      const itemsToUse = Array.isArray(cartItemsForCalc) ? cartItemsForCalc : cartItems;

      // compute covered amount only from reservations that belong to current cart using composite keys
      const covered = (itemsToUse ?? []).reduce((acc: number, it: any) => {
        const snapItem = {
          product_id: Number(it.product?.id ?? it.product_id ?? 0),
          name: it.product?.name ?? it.name ?? '',
          price: Number(it.product?.price ?? it.price ?? 0),
          quantity: Number(it.quantity ?? it.qty ?? 0),
        };
        const key = keyForSnapshotItem(snapItem);
        if (!key) return acc;
        const r = reservedMap[key] ?? 0;
        const applicable = Math.min(snapItem.quantity ?? 0, r);
        return acc + applicable * (snapItem.price ?? 0);
      }, 0);
      setCoveredAmount(covered);

      const currentTotal = itemsToUse?.reduce((s: number, i: any) => s + Number(i.product?.price ?? 0) * (i.quantity ?? 1), 0) ?? total;

      // REMEMBER: coveredAmount here is item-level reserved money; remainingToPay should include delivery fee
      const fee = Number(deliveryFee ?? 0);
      setRemainingToPay(Math.max(0, currentTotal + fee - covered));
    } catch (e) {
      setReservedByProduct({});
      setCoveredAmount(0);
      setRemainingToPay(total + Number(deliveryFee ?? 0));
    }
  };

  // Grouping & snapshot helpers
  const groupPaymentsByCartHash = (payments: any[]) => {
    const map = new Map<string, any[]>();
    payments.forEach((p) => {
      const hash = p?.meta?.cart_hash ? String(p.meta.cart_hash) : '__no_hash__' + (p.tx_ref ?? 'unknown');
      const arr = map.get(hash) ?? [];
      arr.push(p);
      map.set(hash, arr);
    });
    return map;
  };

  const snapshotTotal = (snapshot: any[]) => {
    if (!Array.isArray(snapshot)) return 0;
    return snapshot.reduce((s: number, it: any) => s + (Number(it.price ?? 0) * Number(it.quantity ?? 0)), 0);
  };

  // Only pending payments count as a reservation; use composite keys for safety
  const computeCoveredForSnapshot = (snapshot: any[], paymentsForCart: any[]) => {
    if (!Array.isArray(snapshot) || snapshot.length === 0) return 0;
    const reservedByKey: Record<string, number> = {};
    (paymentsForCart ?? []).forEach((p) => {
      if ((p.status ?? '').toString() !== 'pending') return; // only pending
      const snap = Array.isArray(p.meta?.cart_snapshot) ? p.meta.cart_snapshot : [];
      snap.forEach((si: any) => {
        const key = keyForSnapshotItem(si);
        if (!key) return;
        const qty = Number(si.quantity ?? si.qty ?? 0);
        if (!qty || qty <= 0) return;
        reservedByKey[key] = (reservedByKey[key] ?? 0) + qty;
      });
    });

    const covered = snapshot.reduce((acc: number, it: any) => {
      const key = keyForSnapshotItem(it);
      if (!key) return acc;
      const qty = Number(it.quantity ?? 0);
      const price = Number(it.price ?? 0);
      const r = reservedByKey[key] ?? 0;
      const applicable = Math.min(qty, r);
      return acc + applicable * price;
    }, 0);

    return covered;
  };

  // Load locations and (optionally) user to set default selected location
  // Now accepts computedCartHash to avoid race with setState timing
  const loadLocationsAndUser = async (computedCartHash: string | null = null) => {
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

      if (user) {
        // restore selected location from user if present
        if (user.location_id) setSelectedLocationId(user.location_id);

        // restore server-trusted verification
        if (user.delivery_verified_at) {
          const verifiedAt = new Date(user.delivery_verified_at).getTime();
          const now = Date.now();
          // parse meta (could be array/object or JSON string)
          let meta: any = null;
          try {
            if (user.delivery_verified_meta && typeof user.delivery_verified_meta === 'string') {
              meta = JSON.parse(user.delivery_verified_meta);
            } else {
              meta = user.delivery_verified_meta ?? null;
            }
          } catch (e) {
            meta = user.delivery_verified_meta ?? null;
          }

          // 1) TTL check
          if (now - verifiedAt <= VERIFICATION_TTL_MS) {
            // 2) Optionally check cart_hash matches (recommended)
            const savedCartHash = meta?.cart_hash ?? null;
            const checkHash = computedCartHash ?? cartHash ?? null;
            if (!savedCartHash || savedCartHash === checkHash) {
              setVerified(true);
              if (meta?.lat && meta?.lng) setGps({ lat: Number(meta.lat), lng: Number(meta.lng) });
              if (meta?.detected_location?.name)
                setDetectedArea({ id: meta?.detected_location?.id, name: meta?.detected_location?.name });
              // restore address if saved
              if (meta?.delivery_address) setAddress(String(meta.delivery_address));
            } else {
              // cart changed — clear server verification client-side
              setVerified(false);
            }
          } else {
            // expired
            setVerified(false);
          }
        }
      } else {
        // fallback if user not found
        if (!selectedLocationId && locations.length > 0) {
          setSelectedLocationId(locations[0].id);
        }
      }
    } catch (e) {
      // silent fallback
      if (!selectedLocationId && locations.length > 0) {
        setSelectedLocationId(locations[0].id);
      }
    }
  };

  // effect: whenever locations or selectedLocationId change, compute deliveryFee and recalc totals
  useEffect(() => {
    const loc = locations.find((l) => Number(l.id) === Number(selectedLocationId));
    const fee = loc && typeof loc.delivery_fee !== 'undefined' && loc.delivery_fee !== null ? Number(loc.delivery_fee) : 0;
    setDeliveryFee(fee);

    // Recompute reservations/remaining to include updated fee
    // pass cartItems snapshot to avoid async state race
    loadAllPendingPayments(cartHash, cartItems).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId, locations]);

  // Validate coordinates via backend and set detected/verified state
  const validatePointAndSet = async (lat: number, lng: number, location_id?: number | '') => {
    setError(null);
    setDetectedArea(null);
    setVerified(false);

    try {
      // include cart_hash and delivery_address so backend can persist verification for this cart
      const payload: any = { lat, lng };
      if (location_id) payload.location_id = location_id;
      if (cartHash) payload.cart_hash = cartHash;
      if (address && address.trim().length > 0) payload.delivery_address = address.trim();

      const res = await client.post('/api/locations/validate', payload);
      const data = res.data;
      const insideAny = !!data?.inside_any_area;
      const detected = data?.detected_location ?? null;

      setDetectedArea(detected);
      setVerified(insideAny);

      // If the server returned persisted meta and it contains an address, restore it too
      const savedMeta = data?.delivery_verified_meta ?? null;
      if (savedMeta && savedMeta.delivery_address) {
        setAddress(String(savedMeta.delivery_address));
      }

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

          // ensure modal will navigate to orders when closed
          setModalNavigateToOrders(true);

          // refresh payments/reservations so UI recalculates remainingToPay
          await fetchUserPayments(cartHash);
          await fetchAllNonOrderedPayments();
          await loadAllPendingPayments(cartHash);

          // If server attached order_id inside payment.meta, show it
          const meta = payment?.meta ?? null;
          const orderId =
            meta?.order_id ??
            (typeof meta === 'string' ? (() => { try { return JSON.parse(meta)?.order_id ?? null; } catch { return null; } })() : null);

          if (orderId) {
            setModal({ show: true, title: 'Payment confirmed', body: `Payment confirmed and order created: ${orderId}` });
            // refresh cart & payments (use cartHash + filters)
            await fetchUserPayments(cartHash);
            await fetchAllNonOrderedPayments();
            await loadAllPendingPayments(cartHash);
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

          // refresh so failed payment no longer contributes to reservedByProduct
          await fetchUserPayments(cartHash);
          await fetchAllNonOrderedPayments();
          await loadAllPendingPayments(cartHash);

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

  // Shared function to open PaymentModal for a specific cart snapshot
  const openPaymentModalForCart = (targetCartHash: string | null, amount: number) => {
    setPaymentModalContext({ cart_hash: targetCartHash, amount });
    setShowPaymentModal(true);
  };

  // Open payment options modal (main checkout button) — opens modal for the current cart snapshot
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

    // compute current remaining for current snapshot + delivery fee
    const currentSnapshot = (cartItems || []).map((ci: any) => ({
      product_id: Number(ci.product?.id ?? ci.product_id ?? 0),
      name: ci.product?.name ?? ci.name ?? '',
      price: Number(ci.product?.price ?? 0),
      quantity: Number(ci.quantity ?? 0),
    }));
    const currentTotal = snapshotTotal(currentSnapshot);
    const fee = Number(deliveryFee ?? 0);
    const expectedTotal = currentTotal + fee;

    // payments for current cart
    const paymentsForCurrent = allNonOrderedPayments.filter((p) => String(p.meta?.cart_hash ?? '') === String(cartHash ?? ''));
    // consider only pending+success as "covered" money
    const coveredMoney = paymentsForCurrent
      .filter((p) => (p.status === 'pending' || p.status === 'success'))
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const currentRemaining = Math.max(0, expectedTotal - Math.min(coveredMoney, expectedTotal));

    openPaymentModalForCart(cartHash, currentRemaining <= 0 ? expectedTotal : currentRemaining);
  };

  // On PayChangu initiation (now includes cart_hash and location_id) — use amount from payload or modal context
  const handleInitiatePayChangu = async (payload: { amount?: number; mobile: string; network: string; delivery_lat?: number; delivery_lng?: number; delivery_address?: string; cart_hash?: string | null; location_id?: number | null }) => {
    setPaymentLoading(true);
    try {
      // prefer payload.amount, otherwise prefer modal context amount, otherwise remainingToPay
      const modalAmount = paymentModalContext?.amount;
      const amountToSend = typeof payload.amount === 'number' ? payload.amount : (typeof modalAmount === 'number' ? modalAmount : (remainingToPay ?? (total + Number(deliveryFee ?? 0))));
      const targetCartHash = payload.cart_hash ?? paymentModalContext?.cart_hash ?? cartHash;
      const body = {
        ...payload,
        amount: amountToSend,
        cart_hash: targetCartHash,
        delivery_address: payload.delivery_address ?? address ?? '',
        location_id: payload.location_id ?? selectedLocationId ?? null, // include location_id so server picks correct fee
      };

      const res = await client.post('/api/payment/initiate', body);
      const checkoutUrl = res.data?.checkout_url ?? res.data?.data?.checkout_url;
      const txRef = res.data?.tx_ref ?? res.data?.data?.tx_ref ?? res.data?.payment?.tx_ref ?? null;

      if (!checkoutUrl || !txRef) {
        throw new Error('Payment initiation failed (no checkout URL or tx_ref returned)');
      }

      window.open(checkoutUrl, '_blank');

      setPaymentTxRef(txRef);
      setPaymentStatus('pending');
      startPollingPaymentStatus(txRef);
      setModal({ show: true, title: 'Payment started', body: 'PayChangu checkout started in a new tab. Complete payment there. This page will detect confirmation automatically.' });
      setShowPaymentModal(false);
      setPaymentModalContext(null);

      // refresh payments but filtered to cartHash and also global pending list
      await fetchUserPayments(body.cart_hash ?? cartHash);
      await fetchAllNonOrderedPayments();
      await loadAllPendingPayments(body.cart_hash ?? cartHash);

      return { checkout_url: checkoutUrl, tx_ref: txRef };
    } catch (err: any) {
      // refresh payments so UI shows accurate remaining after failure
      try {
        await fetchUserPayments(payload.cart_hash ?? cartHash);
        await fetchAllNonOrderedPayments();
        await loadAllPendingPayments(payload.cart_hash ?? cartHash);
      } catch (_) {}
      setModal({ show: true, title: 'Payment failed', body: err?.response?.data?.error ?? err?.message ?? 'Failed to initiate PayChangu payment.' });
      throw err;
    } finally {
      setPaymentLoading(false);
    }
  };

  // handleUploadProof (updated) - ensure location_id & cart_hash appended
  const handleUploadProof = async (formData: FormData) => {
    setPaymentLoading(true);
    try {
      // If modal context exists and caller didn't set cart_hash, append it
      if (!formData.get('cart_hash') && paymentModalContext?.cart_hash) formData.append('cart_hash', String(paymentModalContext.cart_hash));
      if (!formData.get('delivery_address') && address && address.trim().length > 0) formData.append('delivery_address', address.trim());
      if (!formData.get('location_id') && selectedLocationId) formData.append('location_id', String(selectedLocationId));

      // IMPORTANT: ensure axios does NOT force a Content-Type (so browser can add boundary)
      // Passing Content-Type: undefined will override default application/json if it's set globally.
      const res = await client.post('/api/payment/upload-proof', formData, {
        // Do not set multipart Content-Type here. Setting to undefined instructs axios
        // to let the browser set the header with the boundary.
        headers: { 'Content-Type': undefined as unknown as string },
      });

      const txRef = res.data?.tx_ref ?? res.data?.data?.tx_ref ?? res.data?.payment?.tx_ref ?? null;
      if (!txRef) throw new Error('Upload succeeded but no tx_ref returned. Contact support.');

      setPaymentTxRef(txRef);
      setPaymentStatus('pending');
      startPollingPaymentStatus(txRef);

      setModal({ show: true, title: 'Proof uploaded', body: 'Your proof of payment was uploaded. Payment is pending admin approval.' });
      setShowPaymentModal(false);
      setPaymentModalContext(null);

      await fetchUserPayments(cartHash);
      await fetchAllNonOrderedPayments();
      await loadAllPendingPayments(cartHash);

      return { tx_ref: txRef };
    } catch (err: any) {
      // Improved logging for debugging
      console.error('upload-proof error (full err):', err);
      console.error('upload-proof error (response):', err?.response);
      console.error('upload-proof error (response.data):', err?.response?.data);

      // Extract server validation messages (Laravel-style: response.data.errors or response.data.message)
      const respData = err?.response?.data ?? null;
      let userMessage = err?.message ?? 'Failed to upload proof.';

      if (respData) {
        // If Laravel returns validation errors object: { errors: { file: ["The file field is required."] } }
        if (respData.errors && typeof respData.errors === 'object') {
          const flat: string[] = [];
          Object.keys(respData.errors).forEach((k) => {
            const val = respData.errors[k];
            if (Array.isArray(val)) flat.push(...val);
            else if (typeof val === 'string') flat.push(val);
          });
          if (flat.length > 0) userMessage = flat.join(' — ');
        } else if (respData.message && typeof respData.message === 'string') {
          userMessage = respData.message;
        } else {
          // fallback: show JSON string of respData (short)
          try {
            userMessage = JSON.stringify(respData).slice(0, 400);
          } catch {
            userMessage = String(respData);
          }
        }
      }

      setModal({
        show: true,
        title: 'Upload failed',
        body: userMessage,
      });

      // ensure reservations are recalculated (in case server changed)
      try {
        await fetchUserPayments(cartHash);
        await fetchAllNonOrderedPayments();
        await loadAllPendingPayments(cartHash);
      } catch (_) {}

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
        const computed = await loadCart();
        const itemsSnapshot = computed?.items ?? [];
        await fetchUserPayments(null);
        await fetchAllNonOrderedPayments();
        await loadAllPendingPayments(null, itemsSnapshot);
      } else {
        setModal({ show: true, title: 'Order failed', body: res.data?.message ?? 'Failed to place order' });
      }
    } catch (err: any) {
      console.error('Place order error', err);
      setModal({ show: true, title: 'Order failed', body: err?.response?.data?.message ?? err?.message ?? 'Failed to place order' });
    }
  };

  const handleCloseModal = () => {
    // If the modal was opened because payment succeeded, navigate to orders
    if (modalNavigateToOrders) {
      // reset the flag and close modal, then navigate
      setModal({ show: false });
      setModalNavigateToOrders(false);
      router.push('/orders');
      return;
    }

    // existing behavior: if order placed we also navigate
    if (modal.title === 'Order placed') {
      setModal({ show: false });
      router.push('/orders');
      return;
    }

    setModal({ show: false });
  };

  const placeOrderDisabled = !(paymentStatus === 'success' && address.trim().length >= 3);

  // Determine if we should show the full verification UI
  const showVerificationBlock = !(verified && (paymentTxRef || (userPayments.length > 0)));

  // helper for proof image href/src (prefer absolute proof_url_full)
  const proofHref = (p: any) => {
    if (p.proof_url_full) return p.proof_url_full;
    if (p.proof_url) return `/storage/${p.proof_url}`;
    return null;
  };
  const proofSrc = (p: any) => {
    if (p.proof_url_full) return p.proof_url_full;
    if (p.proof_url) return `/storage/${p.proof_url}`;
    return '/images/placeholder.png';
  };

  // small UI helper: truncated time
  const niceDate = (d?: string) => (d ? new Date(d).toLocaleString() : '—');

  // Derived banners & coverage calculation
  const pendingPayments = allNonOrderedPayments.filter((p) => (p.status ?? '') === 'pending');
  const pendingForCurrent = pendingPayments.find((p) => String(p.meta?.cart_hash ?? '') === String(cartHash ?? '')) ?? null;
  const failedForCurrent = allNonOrderedPayments.find((p) => (p.status ?? '') === 'failed' && String(p.meta?.cart_hash ?? '') === String(cartHash ?? '')) ?? null;
  const pendingForOthers = pendingPayments.filter((p) => String(p.meta?.cart_hash ?? '') !== String(cartHash ?? ''));

  // Compute covered amount display more simply if userPayments include pending entries for current cart
  const computeCoveredFromUserPayments = () => {
    try {
      if (!Array.isArray(userPayments)) return 0;
      let covered = 0;
      userPayments.forEach((p) => {
        if (String(p.meta?.cart_hash ?? '') !== String(cartHash ?? '')) return;
        if ((p.status ?? '') !== 'success' && (p.status ?? '') !== 'pending') return;
        if (!Array.isArray(p.meta?.cart_snapshot)) return;
        // for manual proof or gateway payments, prefer counting money amount (safer)
        // fallback to snapshot-based coverage if no amount present
        const pAmount = Number(p.amount ?? 0);
        if (pAmount > 0) {
          covered += pAmount;
          return;
        }
        p.meta.cart_snapshot.forEach((si: any) => {
          const pid = Number(si.product_id ?? si.productId ?? 0);
          const qty = Number(si.quantity ?? 0);
          const price = Number(si.price ?? 0);
          // match product in current cart items by id
          const match = cartItems.find((it) => Number(it.product?.id ?? it.product_id ?? 0) === pid);
          if (match) {
            const applicable = Math.min(Number(match.quantity ?? 0), qty);
            covered += applicable * price;
          }
        });
      });
      // cap covered to expected total
      const snapshot = (cartItems || []).map((ci: any) => ({ price: Number(ci.product?.price ?? 0), quantity: Number(ci.quantity ?? 0) }));
      const itemsTotal = snapshot.reduce((s: number, it: any) => s + (it.price * it.quantity), 0);
      const expectedTotal = itemsTotal + Number(deliveryFee ?? 0);
      return Math.min(covered, expectedTotal);
    } catch {
      return 0;
    }
  };

  const coveredFromUserPayments = computeCoveredFromUserPayments();
  const remaining = Math.max(0, total + Number(deliveryFee ?? 0) - coveredFromUserPayments);

  // UI render
  return (
    <div className="container py-5">
      <CenteredModal show={modal.show} title={modal.title} body={modal.body} onClose={handleCloseModal} />

      <PaymentModal
        show={showPaymentModal}
        amount={paymentModalContext?.amount ?? remainingToPay} // <-- prefill with remaining to pay (for current cart)
        defaultMobile={''}
        defaultNetwork={'mpamba'}
        defaultAddress={address}
        defaultLat={gps.lat}
        defaultLng={gps.lng}
        onClose={() => { setShowPaymentModal(false); setPaymentModalContext(null); }}
        onInitiatePayChangu={async (payload) => {
          // ensure the cart_hash is passed from modal context if caller doesn't
          const body = {
            ...payload,
            cart_hash: payload.cart_hash ?? paymentModalContext?.cart_hash ?? cartHash,
            location_id: payload.location_id ?? paymentModalContext?.location_id ?? selectedLocationId ?? null,
          };
          return handleInitiatePayChangu(body);
        }}
        onUploadProof={async (formData) => {
          // ensure modal's cart_hash & location_id are applied if present
          if (!formData.get('cart_hash') && paymentModalContext?.cart_hash) formData.append('cart_hash', String(paymentModalContext.cart_hash));
          if (!formData.get('location_id') && selectedLocationId) formData.append('location_id', String(selectedLocationId));
          return handleUploadProof(formData);
        }}
      />

      <div className="bg-white rounded shadow-sm p-4">
        <h4 className="mb-4">Checkout</h4>

        {/* Show spinner while initial data is loading */}
        {initialLoading ? (
          <div className="text-center py-5">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {cartItems.length === 0 ? (
              <div className="text-center text-muted py-5">
                <h5>Your cart is empty</h5>
              </div>
            ) : (
              <>
                {/* Pending banners (MVP) */}
                {pendingForCurrent && (
                  <div className="alert alert-warning">
                    <strong>Pending payment for this cart:</strong> {pendingForCurrent.meta?.cart_hash ?? pendingForCurrent.tx_ref}
                    <div className="small mt-1">Awaiting admin approval. You cannot start another payment for this cart while it's pending.</div>
                  </div>
                )}

                {failedForCurrent && !pendingForCurrent && (
                  <div className="alert alert-danger">
                    <strong>Previous payment failed for this cart:</strong> {failedForCurrent.tx_ref}
                    <div className="small mt-1">You may try again by using the Make Payment button below.</div>
                  </div>
                )}

                {pendingForOthers.length > 0 && (
                  <div className="alert alert-info">
                    <strong>Note:</strong> You have {pendingForOthers.length} pending payment(s) for previous cart(s). These apply to earlier carts and will be handled separately by admin.
                  </div>
                )}

                {/* Simple cart table (single-cart UI) */}
                <div className="table-responsive mb-3">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 220 }}>Product</th>
                        <th>Price</th>
                        <th>Qty</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartItems.map((i) => {
                        const price = Number(i.product?.price ?? i.price ?? 0);
                        const qty = Number(i.quantity ?? i.qty ?? 0);
                        return (
                          <tr key={i.id ?? `${i.product?.id}-${Math.random()}`}>
                            <td>
                              <div className="d-flex align-items-center gap-3">
                                <img
                                  src={
                                    i.product?.image_url_full ??
                                    (i.product?.image_url ? `/storage/${String(i.product.image_url).replace(/^\/+/, '')}` : '/images/placeholder.png')
                                  }
                                  alt={i.product?.name ?? i.name ?? 'product'}
                                  style={{ width: 72, height: 56, objectFit: 'cover', borderRadius: 6 }}
                                />
                                <div>
                                  <div className="fw-semibold">{i.product?.name ?? i.name ?? '—'}</div>
                                  <div className="text-muted small">{i.product?.description ?? ''}</div>
                                </div>
                              </div>
                            </td>
                            <td>MK {price.toFixed(2)}</td>
                            <td>{qty}</td>
                            <td>MK {(price * qty).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* DELIVERY LOCATION VERIFICATION UI - restored */}
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
                      disabled={verified}
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
                          {l.name}{l.delivery_fee ? ` — MK ${Number(l.delivery_fee).toFixed(2)} delivery` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="form-text small mt-1">
                      If GPS fails we will automatically use this selected location as fallback.
                    </div>
                  </div>

                  <div className="d-flex gap-2 align-items-center">
                    <button className="btn btn-outline-primary" onClick={requestGps} disabled={verifying || verified}>
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
                {/* END verification block */}

                {/* Summary row */}
                <div className="mb-3">
                  <div className="small text-muted">Cart total: MK {total.toFixed(2)}</div>
                  <div className="small text-muted">Delivery fee: {deliveryFee > 0 ? `MK ${deliveryFee.toFixed(2)}` : 'Free'}</div>
                  <div className="small text-success">Already reserved/covered (this cart): MK {coveredFromUserPayments.toFixed(2)}</div>
                  <div className="h5">Remaining to pay: {remaining <= 0 ? <span className="text-success">None</span> : `MK ${remaining.toFixed(2)}`}</div>
                </div>

                {/* User uploaded proofs for this cart */}
                <div className="mb-3">
                  <h6>Your payment uploads for this cart</h6>

                  {loadingPayments ? (
                    <div className="text-center py-3"><LoadingSpinner /></div>
                  ) : userPayments.length === 0 ? (
                    <div className="text-muted small">No payment uploads yet for this cart.</div>
                  ) : (
                    <div className="list-group">
                      {userPayments.map((p) => (
                        <div key={p.id ?? p.tx_ref} className="list-group-item d-flex align-items-center gap-3">
                          <a href={proofHref(p) ?? '#'} target="_blank" rel="noreferrer noopener">
                            <img
                              src={proofSrc(p)}
                              alt={`proof ${p.tx_ref ?? ''}`}
                              style={{ width: 92, height: 64, objectFit: 'cover', borderRadius: 6 }}
                            />
                          </a>
                          <div className="flex-fill">
                            <div className="d-flex justify-content-between">
                              <div>
                                <div className="fw-semibold">{p.tx_ref}</div>
                                <div className="small text-muted">{niceDate(p.created_at)}</div>
                              </div>
                              <div className="text-end">
                                <div className={`badge ${p.status === 'success' ? 'bg-success' : p.status === 'failed' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                  {p.status}
                                </div>
                                {p.meta?.order_id && <div className="small mt-1">Order: <strong>{p.meta.order_id}</strong></div>}
                              </div>
                            </div>
                            <div className="small text-muted mt-2">{p.meta?.note ?? ''}</div>

                            {/* optional items snapshot display */}
                            {Array.isArray(p.meta?.cart_snapshot) && (
                              <div className="small text-muted mt-2">
                                <div>Items snapshot:</div>
                                <ul className="mb-0">
                                  {p.meta.cart_snapshot.map((s: any, idx: number) => (
                                    <li key={idx}>{s.name ?? `#${s.product_id}`} — {s.quantity} × MK {Number(s.price ?? 0).toFixed(2)}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                {/* bottom: main payment/place-order buttons (same behaviour as before) */}
                <div className="d-flex justify-content-end gap-3">
                  <button
                    className="btn btn-primary"
                    onClick={onOpenPaymentOptions}
                    disabled={!!pendingForCurrent || paymentLoading || !verified || (address.trim().length < 3)}
                  >
                    {paymentLoading ? <LoadingSpinner /> : (pendingForCurrent ? 'Payment pending — awaiting approval' : (paymentStatus === 'pending' ? 'Payment pending...' : 'Make Payment'))}
                  </button>

                  <button className="btn btn-success btn-lg" onClick={placeOrder} disabled={placeOrderDisabled}>
                    Place Order
                  </button>
                </div>
              </>
            )}
          </>
        )} 
      </div>
    </div>
  );
}
