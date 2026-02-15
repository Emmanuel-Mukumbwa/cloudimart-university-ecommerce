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

  // q is the debounced query used by the data hook (only updates after typing pauses)
  const [q, setQ] = useState('');
  // qInput is the immediate value bound to the input (so typing never causes reload)
  const [qInput, setQInput] = useState('');

  // useProducts will re-run when page, per_page, q, or category change
  const { data, isLoading, isError } = useProducts({ page, per_page: 12, q, category });

  // load categories once
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

  // debounce qInput -> q so the hook does not fire on every keystroke
  useEffect(() => {
    const handle = setTimeout(() => {
      // only update q (and therefore trigger data reload) after user pauses typing
      setQ(qInput.trim());
    }, 300); // 300ms debounce; adjust if you prefer longer/shorter

    return () => clearTimeout(handle);
  }, [qInput]);

  // reset page when filters/search change (q is debounced search param)
  useEffect(() => setPage(1), [category, q]);

  // Defensive helper: extract pagination meta from varying API shapes
  function extractMeta(raw: any) {
    const metaFrom =
      raw?.meta ??
      raw?.data?.meta ??
      (raw && typeof raw === 'object' && ('current_page' in raw || 'last_page' in raw) ? raw : null) ??
      null;

    const current_page =
      metaFrom?.current_page ??
      metaFrom?.page ??
      raw?.current_page ??
      raw?.page ??
      1;

    const per_page =
      metaFrom?.per_page ??
      metaFrom?.perPage ??
      raw?.per_page ??
      raw?.perPage ??
      12;

    const total =
      metaFrom?.total ??
      metaFrom?.count ??
      raw?.total ??
      (Array.isArray(raw?.data) ? raw.data.length : undefined) ??
      (Array.isArray(raw) ? raw.length : undefined) ??
      0;

    let last_page =
      metaFrom?.last_page ??
      metaFrom?.lastPage ??
      raw?.last_page ??
      raw?.lastPage ??
      Math.max(1, Math.ceil((total || 0) / (per_page || 12)));

    const cp = Number(current_page) || 1;
    const pp = Number(per_page) || 12;
    const tot = Number(total) || 0;
    const lp = Number(last_page) || Math.max(1, Math.ceil(tot / pp || 1));

    return {
      current_page: cp,
      last_page: lp,
      per_page: pp,
      total: tot,
    };
  }

  // Products may be at data.data or data (depending on API/serializer)
  const products = data?.data ?? data ?? [];

  // get safe meta (compute before any conditional returns)
  const meta = extractMeta(data);

  // If page state somehow exceeds last_page, clamp it.
  useEffect(() => {
    if (page > meta.last_page) setPage(meta.last_page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.last_page]);

  // handleChange for category -- keep page resets handled by effect above
  const onCategoryChange = (val: string) => {
    setCategory(val);
  };

  // The input is wrapped in a form to prevent Enter from causing a page reload/navigation.
  // onSubmit prevents default; Enter now behaves like "do nothing" (or you can choose to apply it).
  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // apply immediately when user presses Enter (optional). Uncomment line below if you want Enter to submit immediately:
    // setQ(qInput.trim());
  };

  // Now safe to return loading/error UI (after all hooks declared)
  if (isLoading) return <div className="container py-5 text-center">Loading products...</div>;
  if (isError) return <div className="container py-5 text-danger text-center">Failed loading products</div>;

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
            <CategoryFilter categories={categories} value={category} onChange={onCategoryChange} />
          </div>

          <div className="col-md-4">
            <form onSubmit={onSearchSubmit}>
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search products..."
                className="form-control"
                // prevent Enter from doing anything surprising — form prevents default
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    // allow escape to clear current input quickly
                    setQInput('');
                  }
                }}
                aria-label="Search products"
              />
            </form>
          </div>
        </div>

        <div className="products-grid" role="list">
          {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
        </div>

        {/* Show pagination only when there's more than 1 page */}
        {meta.last_page > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.current_page <= 1}
              className="btn btn-outline-secondary btn-sm"
            >
              Previous
            </button>

            <div className="small text-muted">
              Page {meta.current_page} of {meta.last_page} · {meta.total} items
            </div>

            <button
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={meta.current_page >= meta.last_page}
              className="btn btn-outline-secondary btn-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
