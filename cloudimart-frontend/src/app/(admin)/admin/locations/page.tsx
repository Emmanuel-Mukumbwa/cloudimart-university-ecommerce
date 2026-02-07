//src/app/(admin)/admin/locations/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';

type Location = {
  id:number;
  name:string;
  latitude?:number|null;
  longitude?:number|null;
  radius_km?:number|null;
  is_active?:boolean;
};

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<any>({ id:null, name:'', latitude:'', longitude:'', radius_km:'' });
  const [message, setMessage] = useState<string|null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await client.get('/api/admin/locations');
      setLocations(res.data.locations ?? res.data.data ?? res.data ?? []);
    } catch (err: any) {
      console.error('Load locations error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      // admin controller save location endpoint assumed to be POST /api/admin/locations
      await client.post('/api/admin/locations', {
        id: form.id,
        name: form.name,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        radius_km: form.radius_km || null,
      });
      setMessage('Saved');
      setFormVisible(false);
      load();
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Save failed');
    }
  };

  const toggleActive = async (id:number, active:boolean) => {
    try {
      await client.post(`/api/admin/locations/${id}/toggle`, { is_active: !active });
      setMessage('Updated');
      load();
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Update failed');
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Locations</h4>
        <div>
          <button className="btn btn-primary" onClick={() => { setForm({ id:null, name:'', latitude:'', longitude:'', radius_km:'' }); setFormVisible(true); }}>Add location</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      {loading ? <div className="text-center py-5"><LoadingSpinner /></div> : (
        <>
          <div className="list-group mb-3">
            {locations.map(loc => (
              <div key={loc.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-bold">{loc.name}</div>
                  <div className="small text-muted">Lat: {loc.latitude ?? '-'} Lng: {loc.longitude ?? '-'} Radius: {loc.radius_km ?? '-'}</div>
                </div>
                <div>
                  <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => { setForm(loc); setFormVisible(true); }}>Edit</button>
                  <button className={`btn btn-sm ${loc.is_active ? 'btn-warning' : 'btn-success'}`} onClick={() => toggleActive(loc.id, !!loc.is_active)}>
                    {loc.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {formVisible && (
        <div className="modal fade show" style={{ display:'block', backgroundColor:'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={save}>
                <div className="modal-header">
                  <h5 className="modal-title">{form.id ? 'Edit location' : 'New location'}</h5>
                  <button type="button" className="btn-close" onClick={() => setFormVisible(false)} />
                </div>
                <div className="modal-body">
                  <div className="mb-2"><input className="form-control" placeholder="Name" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} required /></div>
                  <div className="mb-2"><input className="form-control" placeholder="Latitude" value={form.latitude ?? ''} onChange={(e)=>setForm({...form, latitude: e.target.value})} /></div>
                  <div className="mb-2"><input className="form-control" placeholder="Longitude" value={form.longitude ?? ''} onChange={(e)=>setForm({...form, longitude: e.target.value})} /></div>
                  <div className="mb-2"><input className="form-control" placeholder="Radius (km)" value={form.radius_km ?? ''} onChange={(e)=>setForm({...form, radius_km: e.target.value})} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setFormVisible(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
