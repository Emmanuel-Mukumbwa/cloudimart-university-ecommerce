//src/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
      <main className="w-full max-w-2xl p-8">
        <section className="rounded-lg bg-white p-8 shadow-sm text-center">
          <h1 className="text-2xl font-semibold mb-4">Welcome to Cloudimart</h1>
          <p className="mb-6 text-gray-600">A small storefront demo. Use the buttons below to register or login and try the app.</p>

          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <a className="inline-block px-6 py-2 rounded bg-blue-600 text-white">Register</a>
            </Link>
            <Link href="/login">
              <a className="inline-block px-6 py-2 rounded border border-gray-300">Login</a>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
