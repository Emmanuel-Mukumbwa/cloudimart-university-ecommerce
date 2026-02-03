// File: cloudimart-frontend/src/components/common/Footer.tsx
export default function Footer() {
  return (
    <footer className="w-full bg-white border-t mt-8">
      <div className="container py-4 text-center text-sm text-gray-600">
        © {new Date().getFullYear()} Cloudimart
      </div>
    </footer>
  );
}
