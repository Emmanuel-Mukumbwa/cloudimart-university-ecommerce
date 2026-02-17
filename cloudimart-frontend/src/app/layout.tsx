// File: src/app/layout.tsx
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import React from 'react';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import ReactQueryProvider from '../providers/ReactQueryProvider';
import CartProvider from '../context/CartContext';

export const metadata = {
  title: 'Cloudimart',
  description: 'Mzuzu University Community Store',
}; 

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-root min-h-screen flex flex-col bg-gray-50 text-slate-900">
        <ReactQueryProvider>
          <CartProvider>
            <Header />
            <main className="app-main flex-1 container py-4" role="main">
              {children}
            </main>
            <Footer />
          </CartProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
