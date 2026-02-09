// src/app/(store)/cart/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import { useCart } from '../../../context/CartContext';
import { useRouter } from 'next/navigation';
import CenteredModal from '../../../components/common/CenteredModal';

export default function CartPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const { refreshCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // modal state to reuse CenteredModal
  const [modal, setModal] = useState<{ show: boolean; title?: string; body?: React.ReactNode; onClose?: () => void }>({ show: false });

  // whether there is a pending payment that references this cart hash
  const [pendingPaymentCount, setPendingPaymentCount] = useState<number>(0);
  const [cartHash, setCartHash] = useState<string | null>(null);
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

  // compute a simple cart hash (same algorithm as in checkout)
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

      // compute and set cartHash and then fetch any pending payments for this cart
      const hash = computeCartHash(itemsArr);
      setCartHash(hash);
      if (hash) {
        await fetchPendingPaymentsCount(hash);
      } else {
        setPendingPaymentCount(0);
      }
    } catch (err: any) {
      console.error('Failed to load cart', err);
      setError(err?.response?.data?.message ?? 'Failed to load cart');
      setItems([]);
      setTotal(0);
      setPendingPaymentCount(0);
      setCartHash(null);
    } finally {
      setLoading(false);
    }
  };

  // fetch payments referencing this cart_hash that are still pending
  const fetchPendingPaymentsCount = async (hash: string) => {
    try {
      const res = await client.get('/api/payments', {
        params: {
          cart_hash: hash,
          only_pending: 1,
          exclude_ordered: 1,
        },
      });
      const payload = res?.data?.data ?? res?.data ?? [];
      if (Array.isArray(payload)) {
        setPendingPaymentCount(payload.length);
      } else {
        setPendingPaymentCount(0);
      }
    } catch (e) {
      console.warn('Failed to fetch pending payments count', e);
      setPendingPaymentCount(0);
    }
  };

  useEffect(() => {
    loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeOneOrDelete = async (cartItem: any) => {
    // If there's a pending payment for this cart, disallow mutations
    if (pendingPaymentCount > 0) {
      setModal({
        show: true,
        title: 'Action blocked',
        body: 'There is a pending payment for items in this cart. You cannot modify the cart until admin approves or the payment is cancelled.',
      });
      return;
    }

    // avoid double clicks
    setProcessingItemId(cartItem.id);

    try {
      const price = Number(cartItem.product?.price ?? cartItem.price ?? 0);
      const qty = Number(cartItem.quantity ?? cartItem.qty ?? 0);

      if (qty > 1) {
        // decrement quantity by 1 using update endpoint
        const newQty = qty - 1;
        await client.put(`/api/cart/item/${cartItem.id}`, { quantity: newQty });
        setModal({ show: true, title: 'Updated', body: 'Item quantity reduced by 1.', onClose: () => setModal({ show: false }) });
      } else {
        // quantity === 1 -> delete the item
        await client.delete(`/api/cart/item/${cartItem.id}`);
        setModal({ show: true, title: 'Removed', body: 'Item removed from cart.', onClose: () => setModal({ show: false }) });
      }

      // refresh cart context and local view
      await refreshCart();
      await loadCart();
    } catch (err: any) {
      console.error('Failed to remove/decrement item', err);
      setModal({
        show: true,
        title: 'Failed',
        body: err?.response?.data?.message ?? err?.message ?? 'Failed to update cart item.',
      });
    } finally {
      setProcessingItemId(null);
    }
  };

  // completely remove item (existing "Remove" behaviour if you still want explicit delete)
  const removeItem = async (id: number) => {
    if (pendingPaymentCount > 0) {
      setModal({
        show: true,
        title: 'Action blocked',
        body: 'There is a pending payment for items in this cart. You cannot modify the cart until admin approves or the payment is cancelled.',
      });
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

  // helper to get product image src
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

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <CenteredModal
        show={modal.show}
        title={modal.title}
        body={modal.body}
        onClose={() => {
          if (modal.onClose) modal.onClose();
          else setModal({ show: false });
        }}
        onCancel={() => setModal({ show: false })}
      />

      <div className="bg-white rounded shadow-sm p-4">
        <h4 className="mb-4">Your Cart</h4>

        {pendingPaymentCount > 0 && (
          <div className="alert alert-info">
            You have <strong>{pendingPaymentCount}</strong> pending payment(s) for items in this cart. Cart changes are disabled until admin reviews the payment.
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        {items.length === 0 ? (
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
                    const processing = processingItemId === i.id;
                    return (
                      <tr key={i.id}>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <img src={getImageSrc(i.product)} alt={i.product?.name ?? 'product'} style={{ width: 72, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                            <div>
                              <div className="fw-semibold">{i.product?.name ?? i.name ?? '—'}</div>
                              <div className="text-muted small">{i.product?.description ?? ''}</div>
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
                              disabled={pendingPaymentCount > 0 || processing}
                              title={pendingPaymentCount > 0 ? 'Disabled while payment is pending' : 'Remove one / remove item'}
                            >
                              {processing ? 'Working...' : qty > 1 ? 'Remove 1' : 'Remove'}
                            </button>

                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeItem(i.id)}
                              disabled={pendingPaymentCount > 0 || processing}
                              title={pendingPaymentCount > 0 ? 'Disabled while payment is pending' : 'Remove all'}
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

            <div className="d-flex justify-content-between align-items-center mt-4">
              <h5>Total: MK {total.toFixed(2)}</h5>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => router.push('/checkout')}
                disabled={items.length === 0}
              >
                Continue to Checkout →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
