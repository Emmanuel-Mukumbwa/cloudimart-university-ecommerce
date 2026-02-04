// src/components/common/FeaturedProducts.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useProducts } from '../../lib/hooks/useProducts';
import ProductCard from '../products/ProductCard';
import LoadingSpinner from './LoadingSpinner';
import Link from 'next/link';
import CategoryFilter from '../products/CategoryFilter';
import client from '../../lib/api/client';

export default function FeaturedProducts() {
  const [category, setCategory] = useState<string>('');
  const [categories, setCategories] = useState<{ id: number; name: string; slug?: string }[]>([]);

  // featured: per_page 6; pass category so products update
  const { data, isLoading, isError } = useProducts({ page: 1, per_page: 6, category });

  useEffect(() => {
    let mounted = true;
    client.get('/api/categories')
      .then((res) => {
        if (!mounted) return;
        const payload = res.data?.data ?? res.data?.categories ?? res.data;
        setCategories(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        // silent fallback
      });
    return () => { mounted = false; };
  }, []);

  if (isLoading) {
    return (
      <section className="hero-section">
        <div className="container">
          <div className="text-center"><LoadingSpinner /></div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="hero-section">
        <div className="container">
          <div className="text-center text-danger">Failed to load products.</div>
        </div>
      </section>
    );
  }

  const products = data?.data || [];

  return (
    <section id="products" className="py-5">
      <div className="container">
        <div className="bg-white rounded p-4 shadow-sm">
          <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between mb-3 gap-3">
            <div>
              <h2 className="h4 mb-1">Featured products</h2>
              <p className="small text-muted mb-0">
                Top Stationery & Dairy picks for the Mzuzu University community and nearby neighborhoods
              </p>
            </div>

            <div className="d-flex align-items-center gap-3">
              <CategoryFilter categories={categories} value={category} onChange={setCategory} />
              <Link href="/products" className="small text-decoration-none text-primary">View all products →</Link>
            </div>
          </div>

          <div className="products-grid">
            {products.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
