// File: src/app/layout.tsx
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import React from 'react';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import ReactQueryProvider from '../providers/ReactQueryProvider';

export const metadata = {
  title: 'Cloudimart',
  description: 'University e-commerce prototype',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gray-50 text-slate-900">
        <ReactQueryProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ReactQueryProvider> 
      </body> 
    </html>
  );
}
