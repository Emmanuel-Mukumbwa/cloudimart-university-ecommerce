'use client';

import React, { useEffect, useState } from 'react';
import client from '../../lib/api/client';
import Link from 'next/link';

type User = {
  id: number;
  name?: string;
  email?: string;
  phone_number?: string | null;
  location_id?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

type Order = {
  id: number;
  unique_order_id?: string;
  total?: number;
  status?: string;
  created_at?: string;
};

type Location = {
  id: number;
  name: string;
  address?: string | null;
};

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<any>({ name: '', phone_number: '', location_id: null });
  const [message, setMessage] = useState<string | null>(null);

  // change password state
  const [changingPw, setChangingPw] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [uRes, oRes, lRes] = await Promise.all([
        client.get('/api/user'),
        client.get('/api/orders'),
        client.get('/api/locations'),
      ]);

      const u = uRes.data ?? uRes.data?.user ?? null;
      const ordersPayload = oRes.data?.data ?? oRes.data ?? [];
      const locationsPayload = lRes.data?.data ?? lRes.data ?? [];

      setUser(u);
      setOrders(Array.isArray(ordersPayload) ? ordersPayload : []);
      setLocations(Array.isArray(locationsPayload) ? locationsPayload : locationsPayload?.data ?? []);

      setProfileForm({
        name: u?.name ?? '',
        phone_number: u?.phone_number ?? '',
        location_id: u?.location_id ?? null,
        latitude: (u as any)?.latitude ?? '',
        longitude: (u as any)?.longitude ?? '',
      });
    } catch (err: any) {
      console.error('Load account error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load account data');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setMessage(null);
    try {
      const payload = {
        name: String(profileForm.name).trim(),
        phone_number: profileForm.phone_number ? String(profileForm.phone_number).trim() : null,
        location_id: profileForm.location_id ?? null,
        latitude: profileForm.latitude === '' ? null : Number(profileForm.latitude),
        longitude: profileForm.longitude === '' ? null : Number(profileForm.longitude),
      };
      const res = await client.put('/api/user', payload);
      setUser(res.data?.user ?? res.data);
      setMessage('Profile saved');
    } catch (err: any) {
      console.error('Save profile error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Save failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const submitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPw(true);
    setPwMessage(null);
    try {
      await client.post('/api/user/change-password', pwForm);
      setPwMessage('Password updated');
      setPwForm({ current_password: '', new_password: '', new_password_confirmation: '' });
    } catch (err: any) {
      console.error('Change password error', err);
      setPwMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Change password failed');
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <h3>My Account</h3>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card p-3">
            <h5 className="mb-3">Profile</h5>
            <form onSubmit={saveProfile}>
              <div className="mb-2">
                <label className="form-label">Name</label>
                <input className="form-control" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required />
              </div>

              <div className="mb-2">
                <label className="form-label">Email</label>
                <input className="form-control" value={user?.email ?? ''} readOnly />
              </div>

              <div className="mb-2">
                <label className="form-label">Phone</label>
                <input className="form-control" value={profileForm.phone_number ?? ''} onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })} />
              </div>

              <div className="mb-2">
                <label className="form-label">Default Location</label>
                <select className="form-select" value={profileForm.location_id ?? ''} onChange={(e) => setProfileForm({ ...profileForm, location_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Select a location (optional)</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}{loc.address ? ` — ${loc.address}` : ''}</option>
                  ))}
                </select>
                <div className="small text-muted mt-1">This is used as the default delivery location at checkout.</div>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-primary" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save profile'}</button>
                <Link href="/account/addresses" className="btn btn-outline-secondary">Manage addresses</Link>
              </div>
            </form>
          </div>

          <div className="card p-3 mt-3">
            <h5 className="mb-3">Change password</h5>

            {pwMessage && <div className="alert alert-info">{pwMessage}</div>}

            <form onSubmit={submitChangePassword}>
              <div className="mb-2">
                <label className="form-label">Current password</label>
                <input type="password" className="form-control" value={pwForm.current_password} onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} required />
              </div>

              <div className="mb-2">
                <label className="form-label">New password</label>
                <input type="password" className="form-control" value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} required />
              </div>

              <div className="mb-2">
                <label className="form-label">Confirm new password</label>
                <input type="password" className="form-control" value={pwForm.new_password_confirmation} onChange={(e) => setPwForm({ ...pwForm, new_password_confirmation: e.target.value })} required />
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-warning" type="submit" disabled={changingPw}>{changingPw ? 'Updating...' : 'Change password'}</button>
              </div>
            </form>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card p-3">
            <h5 className="mb-3">Recent orders</h5>

            {orders.length === 0 ? (
              <p className="text-muted small">You have no orders yet.</p>
            ) : (
              <div className="list-group">
                {orders.slice(0, 10).map((o: any) => (
                  <div key={o.id} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold">{o.unique_order_id ?? `#${o.id}`}</div>
                      <div className="small text-muted">{new Date(o.created_at).toLocaleString()} · Status: {o.status}</div>
                    </div>
                    <div className="text-end">
                      <div className="small text-muted">MK {Number(o.total ?? 0).toFixed(2)}</div>
                      <Link href={`/orders/${o.id}`} className="btn btn-sm btn-outline-primary mt-2">View</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 text-end">
              <Link href="/orders" className="btn btn-sm btn-outline-secondary">All orders</Link>
            </div>
          </div>

          <div className="card p-3 mt-3">
            <h5 className="mb-3">Account actions</h5>
            <div className="d-flex gap-2">
              <Link href="/auth/logout" className="btn btn-danger">Log out</Link>
              <Link href="/support" className="btn btn-outline-secondary">Contact support</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
