import React from 'react';

export default function ProductCard({ product }: { product: any }) {
  return (
    <article className="border rounded p-4">
      <img src={product.image_url || '/images/placeholder.png'} alt={product.name} className="h-36 w-full object-cover mb-3 rounded" />
      <h3 className="font-semibold">{product.name}</h3>
      <p className="text-sm text-gray-600 mb-2">{product.description}</p>
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold">MK {product.price.toFixed(2)}</div>
        <div className="text-sm text-gray-500">Stock: {product.stock}</div>
      </div>
    </article>
  );
}
