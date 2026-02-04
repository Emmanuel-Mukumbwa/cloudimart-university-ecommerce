// src/components/common/Hero.tsx
'use client';

import React from 'react';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="bg-gray-50">
      <div className="container mx-auto max-w-7xl px-6 py-20 flex flex-col-reverse lg:flex-row items-center gap-12">
        {/* LEFT: Text Content */}
        <div className="w-full lg:w-1/2">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold mb-4">
            Cloudimart · Mzuzu University Community Store
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-5">
            Your campus. <span className="text-blue-600">Your store.</span><br />
            Stationery & Dairy delivered fast.
          </h1>

          <p className="text-slate-600 text-lg mb-8 leading-relaxed">
            Cloudimart makes daily life easier for the entire Mzuzu University community —
            from students to staff. Shop affordable stationery, dairy, and essentials with
            trusted campus delivery and seamless checkout.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 transition-transform duration-200 hover:-translate-y-0.5"
            >
              Shop Now
            </Link>

            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md border-2 border-orange-500 text-orange-600 font-semibold hover:bg-orange-500 hover:text-white transition-all duration-200"
            >
              View Catalog
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">✅ Student-friendly prices</div>
            <div className="flex items-center gap-2">🚚 Quick campus delivery</div>
            <div className="flex items-center gap-2">🔒 Secure checkout</div>
          </div>
        </div>

        {/* RIGHT: Hero Image */}
        <div className="w-full lg:w-1/2 flex justify-center">
          <div className="relative">
            <div className="absolute -inset-3 bg-blue-100 rounded-3xl blur-2xl opacity-40"></div>
            <img
              src="/file.svg"
              alt="Cloudimart delivery illustration"
              className="relative w-full max-w-md rounded-3xl shadow-lg transform transition-transform duration-500 hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
