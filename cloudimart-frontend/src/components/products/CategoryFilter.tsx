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
    <div className="mb-4 flex items-center gap-3">
      <label className="text-sm font-medium">Category:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border rounded"
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
