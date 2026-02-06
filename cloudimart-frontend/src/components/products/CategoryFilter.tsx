// src/components/products/CategoryFilter.tsx
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
  // Helper to render the "All" tab and each category tab.
  const items = [{ id: 'all', name: 'All', slug: '' }, ...categories.map(c => ({ id: c.id, name: c.name, slug: c.slug ?? String(c.id) }))];

  return (
    <nav>
      <ul className="nav nav-pills">
        {items.map((it) => {
          const val = String(it.slug ?? '');
          const active = value === val || (value === '' && val === '');
          return (
            <li className="nav-item" key={String(it.id)}>
              <button
                type="button"
                className={`nav-link ${active ? 'active' : ''}`}
                onClick={() => onChange(val)}
                style={{ cursor: 'pointer' }}
              >
                {it.name}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
