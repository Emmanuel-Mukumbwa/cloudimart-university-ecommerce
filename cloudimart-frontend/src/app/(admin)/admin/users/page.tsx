//src/app/(admin)/admin/users/page.tsx
// File: src/app/(admin)/admin/users/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import AdminTabs from '../../../../components/common/AdminTabs';
import CenteredModal from '../../../../components/common/CenteredModal';

type Location = { id: number; name?: string };
type User = {
  id: number;
  name: string;
  email: string;
  phone_number?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  location_id?: number | null;
  location?: Location | null;
  location_verified_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  orders_count?: number;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'delivery'>('all');
  const [creating, setCreating] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [viewUser, setViewUser] = useState<User | null>(null);

  // Confirmation modal state for activate/deactivate
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    userId?: number | null;
    action?: 'deactivate' | 'activate' | null;
    userName?: string | null;
  }>({ show: false, userId: null, action: null, userName: null });

  // Loading state for the confirm action (prevents double submit)
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Success modal for create action
  const [successModal, setSuccessModal] = useState<{ show: boolean; title?: string; body?: string }>({ show: false });

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'delivery',
    phone_number: '',
    location_id: '' as number | ''
  });

  const loadLocations = useCallback(async () => {
    try {
      const res = await client.get('/api/admin/locations');
      const payload = res.data;
      const list = payload.data ?? payload;
      setLocations(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Failed to load locations', err);
    }
  }, []);

  const load = useCallback(async (p = 1, role: string | null = null) => {
    setLoading(true);
    setMessage(null);
    try {
      const params: Record<string, any> = { page: p, exclude_admin: 1 };
      if (role && role !== 'all') params.role = role;
      const query = new URLSearchParams(params).toString();
      const res = await client.get(`/api/admin/users?${query}`);
      const payload = res.data;
      const list = payload.data ?? payload;
      setUsers(list ?? []);
      setMeta({
        current_page: payload.current_page ?? 1,
        last_page: payload.last_page ?? 1,
        total: payload.total ?? (payload.data?.length ?? payload.length ?? 0),
      });
      setPage(payload.current_page ?? p);
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.message ?? 'Failed to load users');
      setUsers([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, roleFilter);
    loadLocations();
  }, [load, loadLocations, page, roleFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setCreating(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        phone_number: form.phone_number || null,
        role: form.role,
        location_id: form.location_id || null,
      };
      const res = await client.post('/api/admin/users', payload);
      setMessage('User created successfully');

      const createdUser = res.data?.user;
      setSuccessModal({
        show: true,
        title: 'User created',
        body: `User ${createdUser?.name ?? payload.name} created successfully.`
      });

      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'delivery', phone_number: '', location_id: '' });
      load(1, roleFilter);
    } catch (err: any) {
      // try to show detailed server message
      const serverMsg = err?.response?.data?.message ?? err?.response?.data ?? err?.message;
      setMessage(typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg));
    } finally {
      setCreating(false);
    }
  };

  // Open confirm modal instead of directly toggling
  const confirmToggle = (id: number, action: 'deactivate' | 'activate', userName?: string) => {
    setConfirmModal({ show: true, userId: id, action, userName: userName ?? null });
  };

  // Called when user confirms action
const performToggle = async () => {
  if (!confirmModal.userId || !confirmModal.action) return;
  setConfirmLoading(true);
  setMessage(null);

  try {
    const { userId: id, action } = confirmModal;
    const url = action === 'deactivate'
      ? `/api/admin/users/${id}/deactivate`
      : `/api/admin/users/${id}/activate`;

    // fire the request and wait for it to finish
    const res = await client.post(url, {});
    setMessage(res.data?.message ?? 'User updated');
    
    // reload after response
    await load(page, roleFilter);
  } catch (err: any) {
    const msg = err?.response?.data?.message ?? err?.message ?? 'Action failed';
    setMessage(msg);
  } finally {
    // only close the modal AFTER everything finishes
    setConfirmModal({ show: false, userId: null, action: null, userName: null });
    setConfirmLoading(false);
  }
};


  if (loading) return <div className="container py-5 text-center"><LoadingSpinner /></div>;

  return (
    <div className="container py-4">
      <AdminTabs />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Manage Users</h4>
        <div className="d-flex gap-2 align-items-center">
          <div>
            <select
              className="form-select form-select-sm"
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value as any); setPage(1); }}
              aria-label="Filter by role"
            >
              <option value="all">All customers & delivery (admins hidden)</option>
              <option value="user">Customers (user)</option>
              <option value="delivery">Delivery personnel</option>
            </select>
          </div>

          <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>Create user</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="card mb-3">
        <div className="card-body p-2">
          <div className="table-responsive">
            <table className="table mb-0 table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Orders</th>
                  <th>Location verified</th>
                  <th>Active</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={10} className="text-center text-muted">No users found</td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.phone_number ?? '—'}</td>
                    <td>{u.role}</td>
                    <td>{u.location?.name ?? (u.location_id ? `#${u.location_id}` : '—')}</td>
                    <td>{typeof u.orders_count !== 'undefined' ? u.orders_count : '—'}</td>
                    <td>{u.location_verified_at ? new Date(u.location_verified_at).toLocaleString() : 'No'}</td>
                    <td>{u.is_active ? 'Yes' : 'No'}</td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                    <td className="text-end">
                      <div className="d-flex gap-2 justify-content-end">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setViewUser(u)}>View</button>
                        {u.is_active ? (
                          <button className="btn btn-sm btn-warning" onClick={() => confirmToggle(u.id, 'deactivate', u.name)}>Deactivate</button>
                        ) : (
                          <button className="btn btn-sm btn-success" onClick={() => confirmToggle(u.id, 'activate', u.name)}>Activate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* Create modal */}
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
                    <input className="form-control" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="mb-2">
                    <input type="email" className="form-control" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="mb-2">
                    <input className="form-control" placeholder="Phone (optional)" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
                  </div>

                  <div className="mb-2">
                    <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      <option value="user">user</option>
                      <option value="delivery">delivery</option>
                      <option value="admin">admin (created admin won't be listed here)</option>
                    </select>
                  </div>

                  <div className="mb-2">
                    <select className="form-select" value={String(form.location_id)} onChange={(e) => setForm({ ...form, location_id: e.target.value ? Number(e.target.value) : '' })}>
                      <option value="">No location</option>
                      {locations.map((l) => <option key={l.id} value={l.id}>{l.name ?? `#${l.id}`}</option>)}
                    </select>
                  </div>

                  <div className="mb-2">
                    <input type="password" className="form-control" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                  </div>

                  <div className="small text-muted">
                    Tip: Admin accounts are powerful. Use the admin role only for trusted users.
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View user modal */}
      {viewUser && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">User details — {viewUser.name}</h5>
                <button type="button" className="btn-close" onClick={() => setViewUser(null)} />
              </div>
              <div className="modal-body">
                <dl className="row">
                  <dt className="col-sm-4">Name</dt><dd className="col-sm-8">{viewUser.name}</dd>
                  <dt className="col-sm-4">Email</dt><dd className="col-sm-8">{viewUser.email}</dd>
                  <dt className="col-sm-4">Phone</dt><dd className="col-sm-8">{viewUser.phone_number ?? '—'}</dd>
                  <dt className="col-sm-4">Role</dt><dd className="col-sm-8">{viewUser.role}</dd>
                  <dt className="col-sm-4">Location</dt><dd className="col-sm-8">{viewUser.location?.name ?? (viewUser.location_id ? `#${viewUser.location_id}` : '—')}</dd>
                  <dt className="col-sm-4">Latitude / Longitude</dt><dd className="col-sm-8">{viewUser.latitude ?? '—'} / {viewUser.longitude ?? '—'}</dd>
                  <dt className="col-sm-4">Orders</dt><dd className="col-sm-8">{viewUser.orders_count ?? 0}</dd>
                  <dt className="col-sm-4">Location verified</dt><dd className="col-sm-8">{viewUser.location_verified_at ? new Date(viewUser.location_verified_at).toLocaleString() : 'No'}</dd>
                  <dt className="col-sm-4">Active</dt><dd className="col-sm-8">{viewUser.is_active ? 'Yes' : 'No'}</dd>
                  <dt className="col-sm-4">Created</dt><dd className="col-sm-8">{viewUser.created_at ? new Date(viewUser.created_at).toLocaleString() : '—'}</dd>
                  <dt className="col-sm-4">Updated</dt><dd className="col-sm-8">{viewUser.updated_at ? new Date(viewUser.updated_at).toLocaleString() : '—'}</dd>
                </dl>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setViewUser(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal for activate/deactivate */}
      <CenteredModal
        show={confirmModal.show}
        title={confirmModal.action === 'deactivate' ? 'Confirm deactivate' : 'Confirm activate'}
        body={`Are you sure you want to ${confirmModal.action === 'deactivate' ? 'deactivate' : 'activate'} user "${confirmModal.userName ?? ''}"?`}
        onClose={performToggle}
        onCancel={() => setConfirmModal({ show: false, userId: null, action: null, userName: null })}
        okLabel={confirmModal.action === 'deactivate' ? (confirmLoading ? 'Deactivating…' : 'Deactivate') : (confirmLoading ? 'Activating…' : 'Activate')}
        cancelLabel="Cancel"
        size="sm"
      />

      {/* Success modal for creation */}
      <CenteredModal
        show={successModal.show}
        title={successModal.title}
        body={successModal.body}
        onClose={() => setSuccessModal({ show: false })}
        okLabel="OK"
      />
    </div>
  );
}
