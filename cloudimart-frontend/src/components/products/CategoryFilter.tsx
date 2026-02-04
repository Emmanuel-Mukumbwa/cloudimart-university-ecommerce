// File: cloudimart-frontend/src/components/products/CategoryFilter.tsx
'use client';

import React from 'react';

type Category = { id: number; name: string; slug?: string; type?: string };

export default function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="mb-2 d-flex align-items-center gap-2">
      <label className="me-2 mb-0 small fw-semibold">Category:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-select form-select-sm"
        style={{ minWidth: 160 }}
      >
        <option value="">All</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug ?? c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
