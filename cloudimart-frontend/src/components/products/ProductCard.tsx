'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import CenteredModal from '../common/CenteredModal';

export default function ProductCard({ product }: { product: any }) {
  const { addToCart } = useCart();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAddedModal, setShowAddedModal] = useState(false);
  const [adding, setAdding] = useState(false);

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

  const handleAdd = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setShowLoginModal(true);
      return;
    }

    try {
      setAdding(true);
      await addToCart(product.id, 1);
      setShowAddedModal(true);
    } catch (err: any) {
      setShowLoginModal(true);
    } finally {
      setAdding(false);
    }
  };

  const openView = () => setShowViewModal(true);

  const handleViewAdd = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setShowViewModal(false);
      setShowLoginModal(true);
      return;
    }

    try {
      setAdding(true);
      await addToCart(product.id, 1);
      setShowViewModal(false);
      setShowAddedModal(true);
    } catch (err: any) {
      setShowLoginModal(true);
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
            disabled={adding || (product.stock ?? 0) <= 0}
          >
            {product.stock <= 0 ? 'Out of stock' : adding ? 'Adding...' : 'Add To Cart'}
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

      {/* login modal */}
      <CenteredModal
        show={showLoginModal}
        title="Login required"
        body="Please sign in to add items to your cart or view protected pages. Would you like to sign in now?"
        onClose={() => {
          const redirect = `/products/${product.id}`;
          router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
        }}
        onCancel={() => setShowLoginModal(false)}
        okLabel="Sign in"
        cancelLabel="Cancel"
      />

      {/* added */}
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
 