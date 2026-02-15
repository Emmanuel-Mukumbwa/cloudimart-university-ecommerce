import React from 'react';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
};

export default function LoadingSpinner({ size = 'md', inline = false }: Props) {
  // size -> pixel dims
  const dims = size === 'sm' ? '1rem' : size === 'lg' ? '2.5rem' : '2rem';
  const wrapperClass = inline ? 'd-inline-block align-middle' : 'd-flex justify-content-center align-items-center py-5';

  return (
    <div className={wrapperClass} role="status" aria-live="polite" aria-busy="true">
      <div className="spinner-border text-primary" style={{ width: dims, height: dims }} />
    </div>
  );
}
