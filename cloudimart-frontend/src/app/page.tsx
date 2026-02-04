// src/app/page.tsx
import React from 'react';
import Hero from '../components/common/Hero';
import FeaturedProducts from '../components/common/FeaturedProducts';

export default function Home() {
  return (
    <main className="bg-light">
      <Hero />
      <FeaturedProducts />
    </main>
  );
}
