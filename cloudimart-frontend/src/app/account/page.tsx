'use client';

import React, { useEffect, useState } from 'react';
import client from '../../lib/api/client';
import Link from 'next/link';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type User = {
  id: number;
  name?: string;
  email?: string;
  phone_number?: string | null;
  location_id?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

type Location = {
  id: number;
  name: string;
  address?: string | null;
};

type PaymentSnapshotItem = {
  product_id?: number;
  name?: string;
  price?: number;
  quantity?: number;
};

type Payment = {
  id: number;
  tx_ref: string;
  provider_ref?: string | null;
  mobile?: string | null;
  network?: string | null;
  amount: number;
  currency?: string;
  status: 'pending' | 'success' | 'failed' | string;
  proof_url?: string | null;
  proof_url_full?: string | null;
  meta?: any;
  created_at?: string | null;
};

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<any>({ name: '', phone_number: '', location_id: null });
  const [message, setMessage] = useState<string | null>(null);

  // change password state
  const [changingPw, setChangingPw] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  // payments
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [uRes, lRes, pRes] = await Promise.all([
        client.get('/api/user'),
        client.get('/api/locations'),
        client.get('/api/payments', { params: { per_page: 50, exclude_ordered: 0 } }), // fetch user's payments; server should return only auth user's
      ]);

      const u = uRes.data?.user ?? uRes.data ?? null;
      const locationsPayload = lRes.data?.data ?? lRes.data ?? [];

      // normalize payments response (defensive)
      let paymentsPayload: any[] = [];
      if (Array.isArray(pRes.data?.data)) paymentsPayload = pRes.data.data;
      else if (Array.isArray(pRes.data)) paymentsPayload = pRes.data;
      else if (Array.isArray(pRes.data?.payments)) paymentsPayload = pRes.data.payments;
      else paymentsPayload = [];

      const normalizedPayments: Payment[] = paymentsPayload.map((p: any) => {
        // ensure types and fallbacks
        const meta = (p.meta && typeof p.meta === 'object') ? p.meta : (() => {
          try {
            return p.meta ? JSON.parse(p.meta) : {};
          } catch {
            return {};
          }
        })();

        return {
          id: Number(p.id),
          tx_ref: String(p.tx_ref ?? ''),
          provider_ref: p.provider_ref ?? null,
          mobile: p.mobile ?? null,
          network: p.network ?? null,
          amount: Number(p.amount ?? 0),
          currency: p.currency ?? 'MWK',
          status: p.status ?? 'pending',
          proof_url: p.proof_url ?? null,
          proof_url_full: p.proof_url_full ?? null,
          meta,
          created_at: p.created_at ?? p.created_at ?? null,
        };
      });

      setUser(u);
      setLocations(Array.isArray(locationsPayload) ? locationsPayload : locationsPayload?.data ?? []);
      setProfileForm({
        name: u?.name ?? '',
        phone_number: u?.phone_number ?? '',
        location_id: u?.location_id ?? null,
        latitude: (u as any)?.latitude ?? '',
        longitude: (u as any)?.longitude ?? '',
      });

      setPayments(normalizedPayments.sort((a, b) => {
        // newest first
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      }));
    } catch (err: any) {
      console.error('Load account error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load account data');
      setPayments([]);
      setPaymentsError(null);
    } finally {
      setLoading(false);
      setPaymentsLoading(false);
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

  // Helpers for UI
  const getProofSrc = (p: Payment) => {
    if (p.proof_url_full) return p.proof_url_full;
    if (p.proof_url) return `/storage/${String(p.proof_url).replace(/^\/+/, '')}`;
    return '/images/placeholder.png';
  };

  const statusBadgeClass = (s: string) => {
    switch (s) {
      case 'success':
        return 'bg-success';
      case 'failed':
        return 'bg-danger';
      case 'pending':
      default:
        return 'bg-warning text-dark';
    }
  };

  const niceDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : '—');

  const renderPaymentItems = (p: Payment) => {
    const meta = p.meta ?? {};
    const snapshot: PaymentSnapshotItem[] = Array.isArray(meta?.cart_snapshot) ? meta.cart_snapshot : [];

    if (!snapshot || snapshot.length === 0) {
      return <div className="small text-muted">No item snapshot available</div>;
    }

    return (
      <ul className="mb-0">
        {snapshot.map((it: PaymentSnapshotItem, idx: number) => (
          <li key={idx} className="small">
            <div className="d-flex justify-content-between">
              <div>
                <strong>{it.name ?? `#${it.product_id ?? '—'}`}</strong>
                <div className="text-muted small">{it.quantity ?? 0} × MK {Number(it.price ?? 0).toFixed(2)}</div>
              </div>
              <div className="text-end small">{((it.quantity ?? 0) * (Number(it.price ?? 0))).toFixed(2)}</div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container py-4">
      <h3>My Account</h3>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card p-3 mb-3">
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

          <div className="card p-3">
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

        {/* Right column: Payments history (replaced Account actions) */}
        <div className="col-lg-4">
          <div className="card p-3 mb-3">
            <h5 className="mb-3">Payments</h5>

            {paymentsLoading ? (
              <div className="text-center py-3"><LoadingSpinner /></div>
            ) : payments.length === 0 ? (
              <div className="text-muted small">You have no recorded payments yet.</div>
            ) : (
              <div className="list-group">
                {payments.map((p) => (
                  <div key={p.id} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-semibold">{p.tx_ref}</div>
                        <div className="small text-muted">{niceDate(p.created_at)}</div>

                        <div className="mt-2 d-flex align-items-center gap-2">
                          <span className={`badge ${statusBadgeClass(p.status)}`}>{p.status}</span>
                          <div className="small text-muted">MK {Number(p.amount).toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="text-end">
                        {p.proof_url || p.proof_url_full ? (
                          <a href={getProofSrc(p)} target="_blank" rel="noreferrer noopener" className="d-inline-block">
                            <img src={getProofSrc(p)} alt={`proof ${p.tx_ref}`} style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                          </a>
                        ) : (
                          <div style={{ width: 72, height: 48 }} className="d-flex align-items-center justify-content-center bg-light text-muted small rounded">No proof</div>
                        )}
                      </div>
                    </div>

                    {/* collapse / items snapshot */}
                    <div className="mt-3">
                      <div className="small text-muted mb-1">Items paid (snapshot)</div>
                      {renderPaymentItems(p)}
                    </div>

                    {/* optional meta: mobile / network / provider_ref */}
                    <div className="mt-2 small text-muted">
                      {p.mobile ? <>Mobile: <strong>{p.mobile}</strong> {p.network ? <>({p.network})</> : null}<br/></> : null}
                      {p.provider_ref ? <>Provider ref: <strong>{p.provider_ref}</strong></> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Small helper card — quick balance summary (optional) */}
          <div className="card p-3">
            <h6 className="mb-2">Payments summary</h6>
            <div className="small text-muted">Total payments recorded</div>
            <div className="h5">{payments.length}</div>
            <div className="small text-muted mt-2">Total amount (successful)</div>
            <div className="h6 text-success">
              MK {payments.reduce((s, p) => s + ((p.status === 'success' ? Number(p.amount ?? 0) : 0)), 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
