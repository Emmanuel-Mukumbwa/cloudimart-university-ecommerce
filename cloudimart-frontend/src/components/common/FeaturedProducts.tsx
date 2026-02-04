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

  // Featured: per_page 6; pass category so products update
  const { data, isLoading, isError } = useProducts({ page: 1, per_page: 6, category });

  useEffect(() => {
    let mounted = true;
    client.get('/api/categories')
      .then((res) => {
        if (!mounted) return;
        // handle common response shapes
        const payload = res.data?.data ?? res.data?.categories ?? res.data;
        setCategories(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        // silent fallback — keep categories empty
      });
    return () => { mounted = false; };
  }, []);

  if (isLoading) {
    return (
      <section className="bg-white">
        <div className="container mx-auto px-6 py-12">
          <div className="text-center"><LoadingSpinner /></div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="bg-white">
        <div className="container mx-auto px-6 py-12">
          <div className="text-center text-red-600">Failed to load products.</div>
        </div>
      </section>
    );
  }

  const products = data?.data || [];

  return (
    <section id="products" className="bg-white">
      <div className="container mx-auto px-6 py-12">
        <div className="rounded-md bg-white shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Featured products</h2>
              <p className="text-sm text-slate-500">
                Top Stationery & Dairy picks for the Mzuzu University community and nearby neighborhoods
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* category filter */}
              <CategoryFilter categories={categories} value={category} onChange={setCategory} />
              <Link href="/products" className="text-sm text-teal-600 font-medium">View all products →</Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
