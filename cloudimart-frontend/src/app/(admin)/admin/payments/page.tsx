'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

type Payment = {
  id:number;
  tx_ref:string;
  provider_ref?:string;
  user_id?:number;
  mobile?:string;
  amount:number;
  currency?:string;
  status:string;
  created_at?:string;
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const url = filter === 'all' ? '/api/admin/payments' : `/api/admin/payments?status=${encodeURIComponent(filter)}`;
      const res = await client.get(url);
      setPayments(res.data.data ?? res.data.payments ?? res.data ?? []);
    } catch (err: any) {
      console.error('Load payments error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Payments</h4>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" value={filter} onChange={(e)=>setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      {loading ? (
        <div className="text-center py-5"><LoadingSpinner /></div>
      ) : payments.length === 0 ? (
        <div className="text-muted">No payments found.</div>
      ) : (
        <table className="table">
          <thead>
            <tr><th>TX Ref</th><th>User</th><th>Mobile</th><th>Amount</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id}>
                <td>{p.tx_ref}</td>
                <td>{p.user_id ?? '—'}</td>
                <td>{p.mobile ?? '—'}</td>
                <td>MK {Number(p.amount).toFixed(2)}</td>
                <td>{p.status}</td>
                <td>{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
