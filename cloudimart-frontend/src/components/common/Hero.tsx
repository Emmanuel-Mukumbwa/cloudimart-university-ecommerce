// src/components/common/Hero.tsx
import React from 'react';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="bg-white">
      <div className="container mx-auto max-w-6xl px-6 py-16 lg:py-24 flex flex-col-reverse lg:flex-row items-center gap-10">
        {/* Left: text */}
        <div className="w-full lg:w-1/2">
          <span className="inline-block px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium mb-4">
            Cloudimart · University store
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
            Cloudimart — Stationery & Dairy for campus life
          </h1>

          <p className="text-slate-600 mb-6 text-lg">
            Affordable stationery, daily essentials and snacks — curated for students. Mobile-first, fast checkout and campus delivery.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="#products"
              className="inline-flex items-center gap-2 px-5 py-2 rounded bg-teal-600 text-black font-medium shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5"
            >
              Shop Stationery & Dairy
            </a>

            <Link
              href="/products"
              className="inline-block px-5 py-2 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            >
              Browse full catalog
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-slate-500">
            <div>✔ Student-friendly prices</div>
            <div>✔ Quick campus delivery</div>
            <div>✔ Secure checkout</div>
          </div>
        </div>

        {/* Right: illustration */}
        <div className="w-full lg:w-1/2 flex justify-center">
          <img
            src="/file.svg"
            alt="Cloudimart hero illustration"
            className="w-full max-w-md transform transition-transform duration-300 hover:scale-[1.03] shadow-sm rounded"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
