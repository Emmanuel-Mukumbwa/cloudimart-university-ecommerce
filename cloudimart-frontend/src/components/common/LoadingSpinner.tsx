//src/components/common/LoadingSpinner.tsx
export default function LoadingSpinner() {
  return (
    <div className="d-flex justify-content-center align-items-center py-5" role="status">
      <div className="spinner-border text-primary" style={{ width: '2rem', height: '2rem' }} />
    </div>
  );
}
