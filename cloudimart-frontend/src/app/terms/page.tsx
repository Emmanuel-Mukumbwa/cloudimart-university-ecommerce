import React from 'react';
import client from '../../lib/api/client';

export default async function TermsPage() {
  // Server-side fetch (Next.js app router)
  let term = null;
  try {
    const res = await client.get('/api/public/terms');
    term = res.data?.term ?? res.data;
  } catch (e) {
    term = null;
  }

  return (
    <div className="container py-4">
      <h2>Terms &amp; Conditions</h2>
      {term ? (
        <div dangerouslySetInnerHTML={{ __html: term.content }} />
      ) : (
        <p>Terms &amp; Conditions are not available at the moment.</p>
      )}
    </div>
  );
}
