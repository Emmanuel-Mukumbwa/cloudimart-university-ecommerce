// File: cloudimart-frontend/src/app/(auth)/layout.tsx
import React from 'react';
import Header from '../../components/common/Header';
import Footer from '../../components/common/Footer';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="d-flex flex-column min-vh-100 bg-light">
     
      <main className="flex-grow-1 d-flex justify-content-center align-items-center py-5">
        {children}
      </main>
     
    </div>
  );
}
