'use client';
import React from 'react';
import { useState } from 'react';
import { useProducts } from '../../../lib/hooks/useProducts';
import ProductCard from '../../../components/products/ProductCard';

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProducts({ page });

  if (isLoading) return <div>Loading...</div>;

  const products = data?.data || [];

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={data.meta.current_page === 1}>Previous</button>
        <div>Page {data.meta.current_page} / {data.meta.last_page}</div>
        <button onClick={() => setPage(p => p + 1)} disabled={data.meta.current_page === data.meta.last_page}>Next</button>
      </div>
    </div>
  );
}
