// src/components/common/FeaturedProducts.tsx
'use client';

import React from 'react';
import { useProducts } from '../../lib/hooks/useProducts';
import ProductCard from '../products/ProductCard';
import LoadingSpinner from './LoadingSpinner';
import Link from 'next/link';

export default function FeaturedProducts() {
  const { data, isLoading, isError } = useProducts({ page: 1, per_page: 6 });

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
        {/* optional inner sheet to visually separate the band */}
        <div className="rounded-md bg-white shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Featured products</h2>
              <p className="text-sm text-slate-500">Stationery & Dairy picks for students this week</p>
            </div>
            <Link href="/products" className="text-sm text-teal-600 font-medium">View all products →</Link>
          </div>

          {/* Grid: side-by-side cards */}
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
