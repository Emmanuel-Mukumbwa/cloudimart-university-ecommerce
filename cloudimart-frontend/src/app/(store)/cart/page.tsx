'use client';
import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import Link from 'next/link';

export default function CartPage() {
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try {
      const res = await client.get('/cart');
      setCart(res.data.data);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const updateQty = async (itemId: number, qty: number) => {
    await client.put(`/cart/item/${itemId}`, { quantity: qty });
    fetch();
  };

  const removeItem = async (itemId: number) => {
    await client.delete(`/cart/item/${itemId}`);
    fetch();
  };

  if (loading) return <div className="container py-5 text-center">Loading...</div>;
  const items = cart?.items ?? [];

  return (
    <div className="container py-5">
      <h3 className="mb-4">Your cart</h3>
      {items.length === 0 && (
        <div className="alert alert-light">Your cart is empty. <Link href="/products">Shop products</Link></div>
      )}
      <div className="row">
        <div className="col-md-8">
          {items.map((it:any) => (
            <div key={it.id} className="d-flex gap-3 align-items-center bg-white rounded p-3 mb-3 shadow-sm">
              <img src={it.product.image_url || '/images/placeholder.png'} style={{width:100, height:80, objectFit:'contain'}} />
              <div className="flex-grow-1">
                <div className="fw-bold">{it.product.name}</div>
                <div className="small text-muted">MK {it.product.price.toFixed(2)}</div>
                <div className="mt-2 d-flex gap-2 align-items-center">
                  <button className="btn btn-sm btn-outline-secondary" onClick={()=> updateQty(it.id, Math.max(1, it.quantity-1))}>-</button>
                  <div>{it.quantity}</div>
                  <button className="btn btn-sm btn-outline-secondary" onClick={()=> updateQty(it.id, it.quantity+1)}>+</button>
                  <button className="btn btn-sm btn-danger ms-3" onClick={()=> removeItem(it.id)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5>Summary</h5>
              <p className="small text-muted">Items: {items.length}</p>
              <div className="fw-bold mb-3">Total: MK { (items.reduce((s:any,i:any)=> s + (i.product.price*i.quantity),0)).toFixed(2) }</div>
              <Link href="/checkout" className="btn btn-warning w-100">Proceed to Checkout</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
