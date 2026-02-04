// File: cloudimart-frontend/src/components/products/ProductCard.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';

export default function ProductCard({ product }: { product: any }) {
  const { addToCart } = useCart();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const priceText = typeof product.price === 'number' ? product.price.toFixed(2) : product.price;

  const handleAdd = async () => {
    // quick local token check to avoid calling server when no token
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setShowLoginModal(true);
      return;
    }

    try {
      setAdding(true);
      await addToCart(product.id, 1);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2000);
    } catch (err: any) {
      // if unauthorized, prompt login modal
      if (err.message === 'unauthorized') {
        setShowLoginModal(true);
        return;
      }
      alert(err.message || 'Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <article className="product-card">
        <div className="media">
          <img
            src={product.image_url || '/images/placeholder.png'}
            alt={product.name}
            style={{ maxHeight: 150, width: 'auto', maxWidth: '100%' }}
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
          <Link href={`/products/${product.id}`} className="btn btn-outline-secondary btn-sm">
            View
          </Link>

          <button
            className="btn-add"
            onClick={handleAdd}
            disabled={adding}
            aria-label={`Add ${product.name} to cart`}
          >
            {adding ? 'Adding...' : 'Add To Cart'}
          </button>
        </div>
      </article>

      {/* Not-logged-in modal */}
      {showLoginModal && (
        <div
          className="modal fade show"
          tabIndex={-1}
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title text-dark">Login required</h5>
                <button type="button" className="btn-close" onClick={() => setShowLoginModal(false)} />
              </div>
              <div className="modal-body">
                <p>Please log in to add items to your cart.</p>
              </div>
              <div className="modal-footer">
                <Link href="/login" className="btn btn-warning w-100">Go to login</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple toast for success */}
      {toastVisible && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 2000,
          background: 'var(--brand-orange)', color: '#fff', padding: '10px 16px',
          borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.12)'
        }}>
          Added to cart
        </div>
      )}
    </>
  );
}
