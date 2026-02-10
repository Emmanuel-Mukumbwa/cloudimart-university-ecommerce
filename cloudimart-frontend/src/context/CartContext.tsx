'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import client from '../lib/api/client';

type CartContextType = {
  count: number;
  refreshCart: () => Promise<void>;
  addToCart: (productId: number, qty?: number) => Promise<void>;
  syncGuestCart?: () => Promise<void>;
};

const CartContext = createContext<CartContextType>({
  count: 0,
  refreshCart: async () => {}, 
  addToCart: async () => {},
});

export const useCart = () => useContext(CartContext);

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState<number>(0);

  /**
   * Refresh cart by fetching /api/cart and summing quantities.
   * This avoids needing a separate /cart/count endpoint.
   */
  const refreshCart = async () => {
    try {
      const res = await client.get('/api/cart'); // existing endpoint
      // expected shape: { success: true, data: { cart: {...}, items: [...] } }
      const items = res.data?.data?.items ?? res.data?.items ?? [];
      // if items have 'quantity' property, sum them; otherwise use length
      const total = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || items.length || 0;
      setCount(total);
    } catch (err: any) {
      // Unauthorized or not found -> set 0; log for debugging
      if (err?.response?.status === 401) {
        setCount(0);
      } else if (err?.response?.status === 404) {
        // Route missing — set 0 and log
        console.warn('Cart endpoint not found (404).', err);
        setCount(0);
      } else {
        console.error('Failed refreshing cart', err);
        setCount(0);
      }
    }
  };

  /**
   * Add to cart via POST /api/cart/add (uses client with auth header)
   * Throws errors upward so caller UI can react.
   */
  const addToCart = async (productId: number, qty = 1) => {
    try {
      const res = await client.post('/api/cart/add', { product_id: productId, quantity: qty });
      await refreshCart();
      return res.data;
    } catch (err: any) {
      // normalize common cases
      if (err?.response?.status === 401) throw new Error('unauthorized');
      const msg = err?.response?.data?.message ?? err?.userMessage ?? 'Failed to add to cart';
      throw new Error(msg);
    }
  };

  // Optional: merge guest cart into server cart on login (not automatically called)
  const syncGuestCart = async () => {
    try {
      const guestJson = typeof window !== 'undefined' ? localStorage.getItem('guest_cart') : null;
      if (!guestJson) return;
      const items = JSON.parse(guestJson);
      for (const it of items) {
        try {
          await addToCart(it.product_id, it.qty || 1);
        } catch (e) {
          // ignore per-item failures
        }
      }
      localStorage.removeItem('guest_cart');
    } catch (e) {
      console.error('Failed syncing guest cart', e);
    }
  };

  useEffect(() => {
    refreshCart();
    // Optionally: listen to storage events to react to logins in other tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === 'user') {
        refreshCart();
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <CartContext.Provider value={{ count, refreshCart, addToCart, syncGuestCart }}>
      {children}
    </CartContext.Provider>
  );
}
