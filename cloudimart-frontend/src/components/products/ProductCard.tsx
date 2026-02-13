'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import CenteredModal from '../common/CenteredModal';
import client from '../../lib/api/client';

export default function ProductCard({ product }: { product: any }) {
  const { addToCart } = useCart();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAddedModal, setShowAddedModal] = useState(false);
  const [adding, setAdding] = useState(false);

  // NEW: state for pending payments blocking add-to-cart
  const [hasPending, setHasPending] = useState(false);
  const [pendingHash, setPendingHash] = useState<string | null>(null);
  const [checkingPending, setCheckingPending] = useState(true);

  const router = useRouter();

  const priceText = typeof product.price === 'number' ? product.price.toFixed(2) : product.price;

  const getImageSrc = (p: any) => {
    if (!p) return '/images/placeholder.png';
    // Prefer full absolute url from backend
    if (p.image_url_full) return p.image_url_full;
    if (typeof p.image_url === 'string' && p.image_url.length > 0) {
      const url = p.image_url;
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
        return url;
      }
      // stored path -> use public storage route
      return `/storage/${url.replace(/^\/+/, '')}`;
    }
    return '/images/placeholder.png';
  };

  const imgSrc = getImageSrc(product);

  // Check for pending payment(s) on mount
  useEffect(() => {
    let mounted = true;
    setCheckingPending(true);

    (async () => {
      try {
        const res = await client.get('/api/payments', { params: { only_pending: 1, exclude_ordered: 1 } });
        const payload = res.data?.data ?? res.data ?? [];
        const arr = Array.isArray(payload) ? payload : [];

        if (!mounted) return;
        if (arr.length > 0) {
          // there is at least one pending non-ordered payment
          setHasPending(true);
          const first = arr[0];
          const meta = first?.meta ?? null;
          const h = meta?.cart_hash ?? null;
          setPendingHash(h ?? null);
        } else {
          setHasPending(false);
          setPendingHash(null);
        }
      } catch (e) {
        // network error -> treat as no pending (fail open), log for debugging
        console.warn('Failed to check pending payments', e);
        setHasPending(false);
        setPendingHash(null);
      } finally {
        if (mounted) setCheckingPending(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // Updated handleAdd: don't rely on localStorage existence; wait for pending check; handle 401/409
  const handleAdd = async () => {
    // If pending check still running, don't attempt yet — button is disabled while checkingPending,
    // but defend against accidental calls by returning early.
    if (checkingPending) return;

    // If server previously indicated a pending payment, show modal
    if (hasPending) {
      setShowPendingModal();
      return;
    }

    try {
      setAdding(true);
      await addToCart(product.id, 1);
      setShowAddedModal(true);
    } catch (err: any) {
      const status = err?.response?.status ?? null;
      if (status === 401) {
        // Unauthorized — token likely expired/invalid. Clear local token and prompt login.
        if (typeof window !== 'undefined') {
          try { localStorage.removeItem('auth_token'); } catch (e) {}
        }
        setShowLoginModal(true);
      } else if (status === 409) {
        // Server-side guard: pending payment exists
        const pendingHashServer = err?.response?.data?.pending_cart_hash ?? null;
        setPendingHash(pendingHashServer ?? pendingHash);
        setHasPending(true);
        setShowPendingModal();
      } else {
        console.error('Add to cart failed', err);
        // fallback: prompt login (catch-all)
        setShowLoginModal(true);
      }
    } finally {
      setAdding(false);
    }
  };

  // small helper to show a pending-payment modal (re-uses login modal UI)
  const setShowPendingModal = () => {
    setShowLoginModal(false);
    setShowAddedModal(false);
    setShowViewModal(false);
    // reuse login modal to show pending-payment message
    setShowLoginModal(true);
  };

  const openView = () => setShowViewModal(true);

  // Updated handleViewAdd: same behavior as handleAdd but closes view modal on 401 so login modal can show
  const handleViewAdd = async () => {
    if (checkingPending) {
      // still verifying pending payments — do nothing (button should be disabled)
      return;
    }

    if (hasPending) {
      setShowViewModal(false);
      setShowPendingModal();
      return;
    }

    try {
      setAdding(true);
      await addToCart(product.id, 1);
      setShowViewModal(false);
      setShowAddedModal(true);
    } catch (err: any) {
      const status = err?.response?.status ?? null;
      if (status === 401) {
        // Unauthorized
        if (typeof window !== 'undefined') {
          try { localStorage.removeItem('auth_token'); } catch (e) {}
        }
        setShowViewModal(false);
        setShowLoginModal(true);
      } else if (status === 409) {
        const pendingHashServer = err?.response?.data?.pending_cart_hash ?? null;
        setPendingHash(pendingHashServer ?? pendingHash);
        setHasPending(true);
        setShowPendingModal();
      } else {
        setShowViewModal(false);
        setShowLoginModal(true);
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <article className="product-card card p-3 h-100">
        <div className="media text-center" style={{ cursor: 'pointer' }} onClick={openView}>
          <img
            src={imgSrc}
            alt={product?.name ?? 'product'}
            style={{ maxHeight: 150, width: 'auto', maxWidth: '100%' }}
            loading="lazy"
          />
        </div>

        <div className="mt-3">
          <div className="title">{product.name}</div>
          <div className="meta">{product.description}</div>
          <div className="d-flex align-items-center justify-content-between mt-3">
            <div className="price">MK {priceText}</div>
            <div className="meta">Stock: {product.stock}</div>
          </div>
        </div>

        <div className="card-footer mt-3 d-flex justify-content-between">
          <button className="btn btn-outline-secondary btn-sm" onClick={openView}>
            View
          </button>

          <button
            className="btn-add btn btn-primary btn-sm"
            onClick={handleAdd}
            disabled={adding || (product.stock ?? 0) <= 0 || hasPending || checkingPending}
            title={hasPending ? `You have a pending payment${pendingHash ? ` (${pendingHash})` : ''}. Resolve before adding.` : undefined}
          >
            {product.stock <= 0 ? 'Out of stock' : hasPending ? 'Pending payment' : adding ? 'Adding...' : 'Add To Cart'}
          </button>
        </div>
      </article>

      {/* View modal */}
      <CenteredModal
        show={showViewModal}
        title={product.name}
        body={
          <div className="container-fluid">
            <div className="row gx-3">
              <div className="col-12 col-md-6 text-center">
                <img
                  src={imgSrc}
                  alt={product.name}
                  className="img-fluid rounded mb-3"
                  style={{ maxHeight: 260, objectFit: 'contain' }}
                  loading="lazy"
                />
              </div>
              <div className="col-12 col-md-6">
                <p className="text-muted">{product.description}</p>
                <div className="mt-3">
                  <div className="h4 fw-bold">MK {priceText}</div>
                  <div className="text-sm text-muted">Stock: {product.stock}</div>
                </div>
              </div>
            </div>
          </div>
        }
        onClose={handleViewAdd}
        onCancel={() => setShowViewModal(false)}
        okLabel={adding ? 'Adding...' : 'Add to cart'}
        cancelLabel="Close"
      />

      {/* pending/login modal (uses same modal component but worded differently) */}
      <CenteredModal
        show={showLoginModal}
        title={hasPending ? 'Pending payment exists' : 'Login required'}
        body={
          hasPending
            ? (
              <div>
                <p className="mb-2">You have a pending payment{pendingHash ? ` (cart ${pendingHash})` : ''}. Please wait for admin approval or cancel the pending payment before adding new items.</p>
                <p className="small text-muted">If you believe this is an error contact support.</p>
              </div>
            )
            : 'Please sign in to add items to your cart or view protected pages. Would you like to sign in now?'
        }
        onClose={() => {
          if (!hasPending) {
            const redirect = `/products/${product.id}`;
            router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
          } else {
            // simply close modal when it's a pending-notice
            setShowLoginModal(false);
          }
        }}
        onCancel={() => setShowLoginModal(false)}
        okLabel={hasPending ? 'Okay' : 'Sign in'}
        cancelLabel="Cancel"
      />

      {/* added success modal */}
      <CenteredModal
        show={showAddedModal}
        title="Added to cart"
        body={
          <div className="text-center">
            <img
              src={imgSrc}
              alt={product.name}
              className="img-fluid rounded mb-2"
              style={{ maxHeight: 140, objectFit: 'contain' }}
              loading="lazy"
            />
            <div className="fw-semibold mb-1">{product.name}</div>
            <div className="text-muted">MK {priceText} — added to your cart.</div>
          </div>
        }
        onClose={() => {
          setShowAddedModal(false);
          router.push('/cart');
        }}
        onCancel={() => setShowAddedModal(false)}
        okLabel="View cart"
        cancelLabel="Continue shopping"
      />
    </>
  );
}
