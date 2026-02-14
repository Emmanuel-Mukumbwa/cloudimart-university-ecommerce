//src/app/(admin)/admin/locations/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import AdminTabs from '../../../../components/common/AdminTabs';

type Location = {
  id: number;
  name: string;
  slug?: string | null;
  type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
  delivery_fee?: number | null;
  description?: string | null;
  address?: string | null;
  is_active?: boolean;
  polygon_coordinates?: any;
};

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<any>({
    id: null,
    name: '',
    slug: '',
    type: '',
    latitude: '',
    longitude: '',
    radius_km: '',
    delivery_fee: '',
    description: '',
    address: '',
    is_active: true,
    polygon_coordinates: null,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await client.get('/api/admin/locations'); // handles both paginated and non-paginated
      // response might be paginated (res.data.data) or direct array (res.data.data when returned wrapped) or res.data
      const payload = res.data?.data ?? res.data?.locations ?? res.data;
      // payload could be either an array or an object with data
      const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      // If we got an object directly (when controller returned $paginated) it will already be the paginated object;
      // prefer the inner data if available
      if (Array.isArray(payload)) {
        setLocations(payload);
      } else if (Array.isArray(res.data?.data)) {
        setLocations(res.data.data);
      } else if (Array.isArray(res.data)) {
        setLocations(res.data);
      } else if (Array.isArray(list)) {
        setLocations(list);
      } else {
        setLocations([]);
      }
    } catch (err: any) {
      console.error('Load locations error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load locations');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({
      id: null,
      name: '',
      slug: '',
      type: '',
      latitude: '',
      longitude: '',
      radius_km: '',
      delivery_fee: '',
      description: '',
      address: '',
      is_active: true,
      polygon_coordinates: null,
    });
    setFormVisible(true);
    setMessage(null);
  };

  const openEdit = (loc: Location) => {
    setForm({
      id: loc.id ?? null,
      name: loc.name ?? '',
      slug: loc.slug ?? '',
      type: loc.type ?? '',
      latitude: loc.latitude ?? '',
      longitude: loc.longitude ?? '',
      radius_km: loc.radius_km ?? '',
      delivery_fee: loc.delivery_fee ?? '',
      description: loc.description ?? '',
      address: loc.address ?? '',
      is_active: typeof loc.is_active === 'undefined' ? true : !!loc.is_active,
      polygon_coordinates: loc.polygon_coordinates ?? null,
    });
    setFormVisible(true);
    setMessage(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    // prepare payload
    const payload: any = {
      name: String(form.name).trim(),
      slug: form.slug ? String(form.slug).trim() : null,
      type: form.type ? String(form.type).trim() : null,
      latitude: form.latitude !== '' ? Number(form.latitude) : null,
      longitude: form.longitude !== '' ? Number(form.longitude) : null,
      radius_km: form.radius_km !== '' ? Number(form.radius_km) : null,
      delivery_fee: form.delivery_fee !== '' ? Number(form.delivery_fee) : 0.0,
      description: form.description ?? null,
      address: form.address ?? null,
      is_active: !!form.is_active,
    };

    // polygon_coordinates: accept a JSON string or null
    if (form.polygon_coordinates) {
      payload.polygon_coordinates = form.polygon_coordinates;
    }

    try {
      if (!form.id) {
        // create
        await client.post('/api/admin/locations', payload);
        setMessage('Location created');
      } else {
        // update
        await client.put(`/api/admin/locations/${form.id}`, payload);
        setMessage('Location updated');
      }
      setFormVisible(false);
      await load();
    } catch (err: any) {
      console.error('Save location error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    setMessage(null);
    try {
      await client.put(`/api/admin/locations/${id}`, { is_active: !active });
      setMessage('Updated');
      await load();
    } catch (err: any) {
      console.error('Toggle active error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Update failed');
    }
  };

  const deleteLocation = async (id: number) => {
    setMessage(null);
    const ok = window.confirm('Delete this location? This action cannot be undone.');
    if (!ok) return;
    try {
      await client.delete(`/api/admin/locations/${id}`);
      setMessage('Deleted');
      await load();
    } catch (err: any) {
      console.error('Delete location error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Delete failed');
    }
  };

  return (
    <div className="container py-4">
      <AdminTabs />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Locations</h4>
        <div>
          <button className="btn btn-primary" onClick={openCreate}>Add location</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      {loading ? (
        <div className="text-center py-5"><LoadingSpinner /></div>
      ) : (
        <>
          <div className="list-group mb-3">
            {locations.map(loc => (
              <div key={loc.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-bold">{loc.name} {loc.slug ? <small className="text-muted">({loc.slug})</small> : null}</div>
                  <div className="small text-muted">
                    {loc.address ? `${loc.address} · ` : ''}
                    Lat: {loc.latitude ?? '-'} Lng: {loc.longitude ?? '-'} · Radius: {loc.radius_km ?? '-'} km
                  </div>
                  <div className="small text-muted">Fee: MK {Number(loc.delivery_fee ?? 0).toFixed(2)} · {loc.type ?? '—'}</div>
                </div>

                <div className="d-flex gap-2 align-items-center">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(loc)}>Edit</button>
                  <button
                    className={`btn btn-sm ${loc.is_active ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => toggleActive(loc.id, !!loc.is_active)}
                  >
                    {loc.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteLocation(loc.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {formVisible && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <form onSubmit={save}>
                <div className="modal-header">
                  <h5 className="modal-title">{form.id ? 'Edit location' : 'New location'}</h5>
                  <button type="button" className="btn-close" onClick={() => setFormVisible(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-2">
                    <div className="col-12"><input className="form-control" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                    <div className="col-md-6"><input className="form-control" placeholder="Slug (optional)" value={form.slug ?? ''} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
                    <div className="col-md-6"><input className="form-control" placeholder="Type (optional)" value={form.type ?? ''} onChange={(e) => setForm({ ...form, type: e.target.value })} /></div>

                    <div className="col-md-4"><input className="form-control" placeholder="Latitude" value={form.latitude ?? ''} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></div>
                    <div className="col-md-4"><input className="form-control" placeholder="Longitude" value={form.longitude ?? ''} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></div>
                    <div className="col-md-4"><input className="form-control" placeholder="Radius (km)" value={form.radius_km ?? ''} onChange={(e) => setForm({ ...form, radius_km: e.target.value })} /></div>

                    <div className="col-md-6"><input className="form-control" placeholder="Delivery fee (MK)" value={form.delivery_fee ?? ''} onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })} /></div>
                    <div className="col-md-6"><input className="form-control" placeholder="Address (optional)" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>

                    <div className="col-12">
                      <textarea className="form-control" rows={3} placeholder="Description (optional)" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>

                    <div className="col-12">
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} id="loc-active" />
                        <label className="form-check-label" htmlFor="loc-active">Active</label>
                      </div>
                    </div>

                    <div className="col-12">
                      <small className="text-muted">Polygon coordinates can be added via CSV/GeoJSON in a separate import tool. (Optional)</small>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setFormVisible(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div> 
  );
}
