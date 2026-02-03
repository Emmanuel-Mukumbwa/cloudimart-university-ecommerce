//src/components/common/Header.tsx
import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full bg-white border-b">
      <div className="container flex items-center justify-between py-4 px-4">
        <Link href="/" className="text-lg font-semibold">
          Cloudimart
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/register">Register</Link>
          <Link href="/login">Login</Link>
          <Link href="/products">Products</Link>
        </nav>
      </div>
    </header>
  );
} 
