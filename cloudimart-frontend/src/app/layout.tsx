//src/app/layout.tsx
import './globals.css';
import React from 'react';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';

export const metadata = {
  title: 'Cloudimart',
  description: 'University e-commerce prototype',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gray-50 text-slate-900">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
