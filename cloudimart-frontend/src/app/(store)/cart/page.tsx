//src//app/(store)/cart/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import { useCart } from '../../../context/CartContext';
import { useRouter } from 'next/navigation';

export default function CartPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const { refreshCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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

  const loadCart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/api/cart');
      let itemsArr = normalizeItemsFromResponse(res);
      if ((!itemsArr || itemsArr.length === 0) && res?.data?.data?.items) {
        itemsArr = res.data.data.items;
      }
      setItems(itemsArr || []);
      setTotal(computeTotal(itemsArr || []));
    } catch (err: any) {
      console.error('Failed to load cart', err);
      setError(err?.response?.data?.message ?? 'Failed to load cart');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  const removeItem = async (id: number) => {
    try {
      await client.delete(`/api/cart/item/${id}`);
      await refreshCart();
      await loadCart();
    } catch (err: any) {
      console.error('Failed to remove item', err);
      alert(err?.response?.data?.message ?? 'Failed to remove item');
    }
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
      <div className="bg-white rounded shadow-sm p-4">
        <h4 className="mb-4">Your Cart</h4>

        {error && <div className="alert alert-danger">{error}</div>}

        {items.length === 0 ? (
          <div className="text-center text-muted py-5">Your cart is empty</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Product</th>
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
                    return (
                      <tr key={i.id}>
                        <td>{i.product?.name ?? i.name ?? '—'}</td>
                        <td>MK {price.toFixed(2)}</td>
                        <td>{qty}</td>
                        <td>MK {(price * qty).toFixed(2)}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeItem(i.id)}
                          >
                            Remove
                          </button>
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
