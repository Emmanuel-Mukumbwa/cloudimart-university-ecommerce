// src/app/(store)/products/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useProducts } from '../../../lib/hooks/useProducts';
import ProductCard from '../../../components/products/ProductCard';
import client from '../../../lib/api/client';
import CategoryFilter from '../../../components/products/CategoryFilter';

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string>('');
  const [categories, setCategories] = useState<{ id: number; name: string; slug?: string }[]>([]);
  const [q, setQ] = useState('');

  const { data, isLoading, isError } = useProducts({ page, per_page: 12, q, category });

  useEffect(() => {
    let mounted = true;
    client.get('/api/categories')
      .then((res) => {
        if (!mounted) return;
        setCategories(res.data.data ?? res.data.categories ?? res.data ?? []);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => setPage(1), [category, q]);

  if (isLoading) return <div className="container py-5 text-center">Loading products...</div>;
  if (isError) return <div className="container py-5 text-danger text-center">Failed loading products</div>;

  const products = data?.data ?? [];

  return (
    <div className="container py-5">
      <div className="mb-4">
        {/* Two-tone page title: black + brand blue */}
        <h1 className="mb-1" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <span style={{ color: '#07122a' }}>Our</span>{' '}
          <span style={{ color: 'var(--brand-darkBlue)' }}>Products</span>
        </h1>
        <p className="text-muted small">Browse stationery & dairy items curated for Mzuzu University community.</p>
      </div>

      <div className="bg-white rounded shadow-sm p-4 mb-4">
        <div className="row g-3 align-items-center mb-3">
          <div className="col-md-8">
            <CategoryFilter categories={categories} value={category} onChange={setCategory} />
          </div>

          <div className="col-md-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products..."
              className="form-control"
            />
          </div>
        </div>

        <div className="products-grid">
          {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
        </div>

        <div className="d-flex justify-content-between align-items-center mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={data?.meta?.current_page === 1}
            className="btn btn-outline-secondary btn-sm"
          >
            Previous
          </button>

          <div className="small text-muted">
            Page {data?.meta?.current_page ?? 1} of {data?.meta?.last_page ?? 1}
          </div>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={data?.meta?.current_page === data?.meta?.last_page}
            className="btn btn-outline-secondary btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
