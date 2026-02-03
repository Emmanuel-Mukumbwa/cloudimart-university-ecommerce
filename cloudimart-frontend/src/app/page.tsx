// src/app/page.tsx
import React from 'react';
import Hero from '../components/common/Hero';
import FeaturedProducts from '../components/common/FeaturedProducts';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <main className="w-full">
        <Hero />
        <FeaturedProducts />
      </main>
    </div>
  );
}
