// File: cloudimart-frontend/src/app/%28auth%29/layout.tsx
import React from 'react';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6">{children}</main>
      <Footer />
    </div>
  );
}
