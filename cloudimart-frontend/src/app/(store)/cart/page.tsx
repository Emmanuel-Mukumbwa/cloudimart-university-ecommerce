// src/app/(store)/cart/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import { useCart } from '../../../context/CartContext';
import { useRouter } from 'next/navigation';
import CenteredModal from '../../../components/common/CenteredModal';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

export default function CartPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const { refreshCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [modal, setModal] = useState<{ show: boolean; title?: string; body?: React.ReactNode }>({ show: false });
  const [cartHash, setCartHash] = useState<string | null>(null);

  // pending payments (all pending)
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  // map product_id => reservedQty (sum across pending payments)
  const [reservedByProduct, setReservedByProduct] = useState<Record<number, number>>({});

  const [processingItemId, setProcessingItemId] = useState<number | null>(null);

  const normalizeItemsFromResponse = (res: any) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    const maybeItems = res?.data?.items ?? res?.items ?? res?.data?.data?.items ?? res?.data ?? null;
    if (Array.isArray(maybeItems)) return maybeItems;
    if (res?.data?.data?.items) return res.data.data.items;
    return [];
  };

  const computeTotal = (itemsArr: any[]) => {
    try {
      return itemsArr.reduce((sum: number, it: any) => {
        const price = Number(it.product?.price ?? it.price ?? 0) || 0;
        const qty = Number(it.quantity ?? it.qty ?? 0) || 0;
        return sum + price * qty;
      }, 0);
    } catch (e) {
      console.error('Failed computing total', e);
      return 0;
    }
  };

  const computeCartHash = (itemsArr: any[]) => {
    try {
      const arr = itemsArr.map((i) => ({
        id: Number(i.product?.id ?? i.product_id ?? 0),
        q: Number(i.quantity ?? 1),
        p: Number(i.product?.price ?? 0),
      }));
      const s = JSON.stringify(arr);
      let h = 5381;
      for (let i = 0; i < s.length; i++) {
        h = (h * 33) ^ s.charCodeAt(i);
      }
      return 'ch_' + (h >>> 0).toString(36);
    } catch {
      return null;
    }
  };

  const loadCart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/api/cart');
      let itemsArr = normalizeItemsFromResponse(res);
      if ((!itemsArr || itemsArr.length === 0) && res?.data?.data?.items) {
        itemsArr = res.data.data.items;
      }
      itemsArr = itemsArr || [];
      setItems(itemsArr);
      setTotal(computeTotal(itemsArr));
      const hash = computeCartHash(itemsArr);
      setCartHash(hash);
      // fetch pending payments after we have cart items
      await loadPendingPayments();
    } catch (err: any) {
      console.error('Failed to load cart', err);
      setError(err?.response?.data?.message ?? 'Failed to load cart');
      setItems([]);
      setTotal(0);
      setReservedByProduct({});
      setPendingPayments([]);
      setCartHash(null);
    } finally {
      setLoading(false);
    }
  };

  // load all pending payments for the user (exclude ordered), then compute reserved map
  const loadPendingPayments = async () => {
    try {
      const res = await client.get('/api/payments', {
        params: { only_pending: 1, exclude_ordered: 1 },
      });
      const payload = res?.data?.data ?? res?.data ?? [];
      const payments = Array.isArray(payload) ? payload : [];
      setPendingPayments(payments);

      // build reserved map
      const reservedMap: Record<number, number> = {};
      payments.forEach((p: any) => {
        const snapshot = p.meta?.cart_snapshot ?? null;
        if (Array.isArray(snapshot)) {
          snapshot.forEach((si: any) => {
            const pid = Number(si.product_id ?? si.productId ?? 0);
            const qty = Number(si.quantity ?? 0);
            if (!pid || qty <= 0) return;
            reservedMap[pid] = (reservedMap[pid] ?? 0) + qty;
          });
        } else {
          // fallback: if payment.meta.cart_hash matches current cartHash, you could increment something
          // but prefer snapshot approach
        }
      });
      setReservedByProduct(reservedMap);
    } catch (e) {
      console.warn('Failed to load pending payments', e);
      setPendingPayments([]);
      setReservedByProduct({});
    }
  };

  useEffect(() => {
    loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // compute covered amount (how much of current cart is already reserved by pending payments)
  const computeCoveredAmount = (): number => {
    try {
      let covered = 0;
      items.forEach((it) => {
        const pid = Number(it.product?.id ?? it.product_id ?? 0);
        const itemQty = Number(it.quantity ?? it.qty ?? 0);
        const price = Number(it.product?.price ?? it.price ?? 0) || 0;
        const reservedQty = reservedByProduct[pid] ?? 0;
        const applicable = Math.min(itemQty, reservedQty);
        covered += applicable * price;
      });
      return covered;
    } catch (e) {
      return 0;
    }
  };

  const coveredAmount = computeCoveredAmount();
  const remainingToPay = Math.max(0, total - coveredAmount);

  const getImageSrc = (product: any) => {
    if (!product) return '/images/placeholder.png';
    if (product.image_url_full) return product.image_url_full;
    if (typeof product.image_url === 'string' && product.image_url.length > 0) {
      const url = product.image_url;
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return url;
      return `/storage/${url.replace(/^\/+/, '')}`;
    }
    return '/images/placeholder.png';
  };

  const removeOneOrDelete = async (cartItem: any) => {
    // determine reserved qty for this product
    const pid = Number(cartItem.product?.id ?? cartItem.product_id ?? 0);
    const reservedQty = reservedByProduct[pid] ?? 0;
    const itemQty = Number(cartItem.quantity ?? cartItem.qty ?? 0);

    // If quantity is reserved (one or more) we should block editing for those reserved units.
    // Decide policy: disallow any modification to item if reservedQty >= itemQty (fully reserved),
    // otherwise allow reducing non-reserved units (but implementing partial decrement on server is complex).
    // For now block any change if reservedQty > 0 (safe).
    if (reservedQty > 0) {
      setModal({
        show: true,
        title: 'Action blocked',
        body: `This item (or some of its units) is reserved by a pending payment. Please wait for admin review.`,
      });
      return;
    }

    setProcessingItemId(cartItem.id);
    try {
      const qty = Number(cartItem.quantity ?? cartItem.qty ?? 0);
      if (qty > 1) {
        const newQty = qty - 1;
        await client.put(`/api/cart/item/${cartItem.id}`, { quantity: newQty });
        setModal({ show: true, title: 'Updated', body: 'Item quantity reduced by 1.' });
      } else {
        await client.delete(`/api/cart/item/${cartItem.id}`);
        setModal({ show: true, title: 'Removed', body: 'Item removed from cart.' });
      }
      await refreshCart();
      await loadCart();
    } catch (err: any) {
      console.error('Failed to update cart item', err);
      setModal({ show: true, title: 'Failed', body: err?.response?.data?.message ?? 'Failed to update cart item' });
    } finally {
      setProcessingItemId(null);
    }
  };

  const removeItem = async (id: number, cartItem: any) => {
    const pid = Number(cartItem.product?.id ?? cartItem.product_id ?? 0);
    if ((reservedByProduct[pid] ?? 0) > 0) {
      setModal({ show: true, title: 'Action blocked', body: 'This item is reserved by a pending payment. Wait for admin action.' });
      return;
    }

    setProcessingItemId(id);
    try {
      await client.delete(`/api/cart/item/${id}`);
      await refreshCart();
      await loadCart();
      setModal({ show: true, title: 'Removed', body: 'Item removed from cart.' });
    } catch (err: any) {
      console.error('Failed to remove item', err);
      setModal({ show: true, title: 'Failed', body: err?.response?.data?.message ?? 'Failed to remove item' });
    } finally {
      setProcessingItemId(null);
    }
  };

  return (
    <div className="container py-5">
      <CenteredModal
        show={modal.show}
        title={modal.title}
        body={modal.body}
        onClose={() => setModal({ show: false })}
      />

      <div className="bg-white rounded shadow-sm p-4">
        <h4 className="mb-4">Your Cart</h4>

        {/* Pending payments summary - show only when not loading */}
        {!loading && pendingPayments.length > 0 && (
          <div className="mb-3">
            <div className="alert alert-info">
              You have <strong>{pendingPayments.length}</strong> pending payment(s).
              <div className="small mt-2">Some items may be reserved by these payments — those item controls are disabled.</div>
            </div>

            <div className="mb-2">
              <strong>Pending payments summary</strong>
            </div>

            <div className="list-group mb-3">
              {pendingPayments.map((p) => (
                <div key={p.tx_ref} className="list-group-item">
                  <div className="d-flex justify-content-between">
                    <div>
                      <div className="fw-semibold">{p.tx_ref} — MK {Number(p.amount).toFixed(2)}</div>
                      <div className="small text-muted">Created: {p.created_at ?? ''}</div>
                    </div>
                    <div className="text-end small">
                      <div className={`badge ${p.status === 'pending' ? 'bg-warning text-dark' : p.status === 'success' ? 'bg-success' : 'bg-danger'}`}>
                        {p.status}
                      </div>
                    </div>
                  </div>

                  {Array.isArray(p.meta?.cart_snapshot) && (
                    <div className="small text-muted mt-2">
                      <div>Items in that snapshot:</div>
                      <ul className="mb-0">
                        {p.meta.cart_snapshot.map((s: any) => (
                          <li key={`${p.tx_ref}-${s.product_id}`}>{s.name ?? `#${s.product_id}`} — {s.quantity} × MK {Number(s.price).toFixed(2)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        {/* Show spinner while loading; otherwise show cart or empty message */}
        {loading ? (
          <div className="text-center py-5">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-muted py-5">Your cart is empty</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Product</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const price = Number(i.product?.price ?? i.price ?? 0);
                    const qty = Number(i.quantity ?? i.qty ?? 0);
                    const pid = Number(i.product?.id ?? i.product_id ?? 0);
                    const reservedQty = reservedByProduct[pid] ?? 0;
                    const isLocked = reservedQty > 0;
                    const processing = processingItemId === i.id;

                    return (
                      <tr key={i.id}>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <img src={getImageSrc(i.product)} alt={i.product?.name ?? 'product'} style={{ width: 72, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                            <div>
                              <div className="fw-semibold">{i.product?.name ?? i.name ?? '—'}</div>
                              <div className="text-muted small">{i.product?.description ?? ''}</div>
                              {isLocked && <div className="small text-danger">Reserved: {reservedQty}</div>}
                            </div>
                          </div>
                        </td>
                        <td>MK {price.toFixed(2)}</td>
                        <td>{qty}</td>
                        <td>MK {(price * qty).toFixed(2)}</td>
                        <td>
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => removeOneOrDelete(i)}
                              disabled={isLocked || processing}
                              title={isLocked ? 'Reserved by pending payment' : 'Remove one / remove item'}
                            >
                              {processing ? 'Working...' : qty > 1 ? 'Remove 1' : 'Remove'}
                            </button>

                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeItem(i.id, i)}
                              disabled={isLocked || processing}
                              title={isLocked ? 'Reserved by pending payment' : 'Remove all'}
                            >
                              {processing ? 'Working...' : 'Remove All'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="small text-muted">Cart Total</div>
                  <div className="h5">MK {total.toFixed(2)}</div>
                </div>

                <div>
                  <div className="small text-muted">Amount already reserved / covered</div>
                  <div className="h5 text-success">MK {coveredAmount.toFixed(2)}</div>
                </div>

                <div>
                  <div className="small text-muted">Remaining to pay</div>
                  <div className="h5">{remainingToPay <= 0 ? <span className="text-success">No payment required</span> : `MK ${remainingToPay.toFixed(2)}`}</div>
                </div>
              </div>

              <div className="d-flex justify-content-end mt-4">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => router.push('/checkout')}
                  disabled={loading || items.length === 0}
                >
                  Continue to Checkout →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
