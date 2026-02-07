'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';

type User = {
  id: number;
  name: string;
  email: string;
  phone_number?: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'delivery', phone_number: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);

  const load = async (p = 1) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await client.get(`/api/admin/users?page=${p}`);
      const payload = res.data;
      // Laravel paginator: data in .data
      setUsers(payload.data ?? payload);
      setMeta({
        current_page: payload.current_page ?? 1,
        last_page: payload.last_page ?? 1,
        total: payload.total ?? (payload.data?.length ?? payload.length ?? 0),
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page); }, [page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await client.post('/api/admin/users', form);
      setMessage('User created');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'delivery', phone_number: '' });
      load();
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to create user');
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    setMessage(null);
    try {
      const url = active ? `/api/admin/users/${id}/deactivate` : `/api/admin/users/${id}/activate`;
      const res = await client.post(url);
      setMessage(res.data?.message ?? 'Updated');
      load();
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Update failed');
    }
  };

  if (loading) return <div className="container py-5 text-center"><LoadingSpinner /></div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Manage Users</h4>
        <div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create user</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="card mb-3">
        <div className="card-body p-2">
          <table className="table mb-0">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Active</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.phone_number ?? '—'}</td>
                  <td>{u.role}</td>
                  <td>{u.is_active ? 'Yes' : 'No'}</td>
                  <td>{new Date(u.created_at).toLocaleString()}</td>
                  <td>
                    {u.is_active ? (
                      <button className="btn btn-sm btn-warning" onClick={() => toggleActive(u.id, true)}>Deactivate</button>
                    ) : (
                      <button className="btn btn-sm btn-success" onClick={() => toggleActive(u.id, false)}>Activate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* pagination */}
      {meta && meta.last_page > 1 && (
        <nav className="mb-4">
          <ul className="pagination">
            <li className={`page-item ${meta.current_page === 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setPage(meta.current_page - 1)}>Prev</button>
            </li>
            <li className="page-item disabled"><span className="page-link">{meta.current_page} / {meta.last_page}</span></li>
            <li className={`page-item ${meta.current_page >= meta.last_page ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setPage(meta.current_page + 1)}>Next</button>
            </li>
          </ul>
        </nav>
      )}

      {/* Create modal (simple) */}
      {showCreate && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleCreate}>
                <div className="modal-header">
                  <h5 className="modal-title">Create user</h5>
                  <button type="button" className="btn-close" onClick={() => setShowCreate(false)} />
                </div>
                <div className="modal-body">
                  <div className="mb-2">
                    <input className="form-control" placeholder="Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
                  </div>
                  <div className="mb-2">
                    <input className="form-control" placeholder="Email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
                  </div>
                  <div className="mb-2">
                    <input className="form-control" placeholder="Phone (optional)" value={form.phone_number} onChange={(e) => setForm({...form, phone_number: e.target.value})} />
                  </div>
                  <div className="mb-2">
                    <select className="form-select" value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
                      <option value="user">user</option>
                      <option value="delivery">delivery</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <input type="password" className="form-control" placeholder="Password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
