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
        setCategories(res.data.data ?? res.data.categories ?? res.data);
      })
      .catch(() => {
        // fallback: leave categories empty
      });
    return () => { mounted = false; };
  }, []);

  // When category changes reset page
  useEffect(() => setPage(1), [category, q]);

  if (isLoading) return <div className="p-6">Loading products...</div>;
  if (isError) return <div className="p-6 text-red-600">Failed loading products</div>;

  const products = data?.data ?? [];

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CategoryFilter categories={categories} value={category} onChange={setCategory} />
        </div>

        <div className="w-full sm:w-1/3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products..."
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={data?.meta?.current_page === 1}
          className="px-3 py-2 border rounded disabled:opacity-50"
        >
          Previous
        </button>

        <div>Page {data?.meta?.current_page ?? 1} / {data?.meta?.last_page ?? 1}</div>

        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={data?.meta?.current_page === data?.meta?.last_page}
          className="px-3 py-2 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
