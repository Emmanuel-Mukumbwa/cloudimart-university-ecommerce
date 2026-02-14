'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import AdminTabs from '../../../../components/common/AdminTabs';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';

type Term = {
  id: number;
  slug?: string;
  title: string;
  content: string;
  version: number;
  last_edited_by?: number | null;
  created_at?: string;
  updated_at?: string;
};

export default function AdminTermsPage() {
  const [term, setTerm] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadLatest = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await client.get('/api/admin/terms/latest');
      const payload = res.data?.term ?? res.data;
      setTerm(payload ?? null);
      if (payload) {
        setForm({ title: payload.title ?? '', content: payload.content ?? '' });
      } else {
        setForm({ title: '', content: '' });
      }
    } catch (err: any) {
      console.error('Load terms error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load terms');
      setTerm(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (term && term.id) {
        const res = await client.put(`/api/admin/terms/${term.id}`, { title: form.title, content: form.content });
        setTerm(res.data?.term ?? res.data);
        setMessage('Terms updated');
      } else {
        const res = await client.post('/api/admin/terms', { title: form.title, content: form.content });
        setTerm(res.data?.term ?? res.data);
        setMessage('Terms created');
      }
      setEditing(false);
    } catch (err: any) {
      console.error('Save terms error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container py-4">
      <AdminTabs />
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Terms &amp; Conditions</h4>
        <div>
          <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit Terms</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      {loading ? (
        <div className="text-center py-5"><LoadingSpinner /></div>
      ) : (
        <>
          {!editing ? (
            <div className="card mb-4">
              <div className="card-body">
                {term ? (
                  <>
                    <h5 className="card-title">{term.title} <small className="text-muted">v{term.version}</small></h5>
                    <div dangerouslySetInnerHTML={{ __html: term.content }} />
                    <div className="small text-muted mt-3">Last updated: {term.updated_at ?? term.created_at}</div>
                  </>
                ) : (
                  <p>No terms defined yet. Use the Edit button to create the first version.</p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={save}>
              <div className="mb-3">
                <label className="form-label">Title</label>
                <input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="mb-3">
                <label className="form-label">Content (HTML allowed)</label>
                <textarea className="form-control" rows={12} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
                <small className="text-muted">Tip: paste HTML or use a WYSIWYG in a future iteration.</small>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-secondary" type="button" onClick={() => { setEditing(false); setMessage(null); }}>Cancel</button>
                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
