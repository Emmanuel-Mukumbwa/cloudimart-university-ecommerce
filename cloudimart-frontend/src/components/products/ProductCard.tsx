// File: cloudimart-frontend/src/components/products/ProductCard.tsx
'use client';

import React from 'react';
import Link from 'next/link';

export default function ProductCard({ product }: { product: any }) {
  const priceText = typeof product.price === 'number' ? product.price.toFixed(2) : product.price;

  return (
    <article className={`product-card`}>
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

      <div className="card-footer mt-3">
        <Link href={`/products/${product.id}`} className="btn btn-outline-secondary btn-sm">
          View
        </Link>
        <button
          className="btn-add"
          onClick={() => {
            // placeholder add-to-cart behaviour — replace with your hook
            const cart = localStorage.getItem('cart') ? JSON.parse(localStorage.getItem('cart')!) : [];
            cart.push({ product_id: product.id, qty: 1 });
            localStorage.setItem('cart', JSON.stringify(cart));
            alert('Added to cart (local demo)');
          }}
        >
          Add To Cart
        </button>
      </div>
    </article>
  );
}
