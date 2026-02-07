//src/app/(admin)/admin/notifications/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';

type Notification = { id:number, user_id?:number, title:string, message:string, is_read:boolean, created_at?:string };

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ user_id: '', title: '', message: '' });
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // There's no canonical admin notifications list endpoint in earlier code;
      // try admin notifications endpoint first, else fall back to /api/notifications (may be user-scoped).
      const res = await client.get('/api/admin/notifications').catch(async () => {
        return client.get('/api/notifications');
      });
      const payload = res.data.notifications ?? res.data.data ?? res.data;
      setNotifications(payload);
    } catch (err: any) {
      console.error('Load notifications error', err);
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const payload: any = { title: form.title, message: form.message };
      if (form.user_id) payload.user_id = Number(form.user_id);
      await client.post('/api/admin/notify', payload);
      setMessage('Notification sent');
      setForm({ user_id: '', title: '', message: '' });
      load();
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to send notification');
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Notifications</h4>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}>Refresh</button>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="card mb-3 p-3">
        <h6>Send notification</h6>
        <form className="row g-2" onSubmit={send}>
          <div className="col-md-3">
            <input className="form-control" value={form.user_id} placeholder="User ID (leave blank for global)" onChange={(e)=>setForm({...form, user_id: e.target.value})} />
          </div>
          <div className="col-md-3">
            <input className="form-control" value={form.title} placeholder="Title" onChange={(e)=>setForm({...form, title: e.target.value})} required />
          </div>
          <div className="col-md-4">
            <input className="form-control" value={form.message} placeholder="Message" onChange={(e)=>setForm({...form, message: e.target.value})} required />
          </div>
          <div className="col-md-2">
            <button className="btn btn-primary w-100" type="submit">Send</button>
          </div>
        </form>
      </div>

      <div className="card p-3">
        <h6>Recent notifications</h6>
        {loading ? <div className="text-center py-3"><LoadingSpinner /></div> : (
          <ul className="list-unstyled mb-0">
            {notifications.length === 0 && <li className="text-muted">No notifications found</li>}
            {notifications.map(n => (
              <li key={n.id} className="border-bottom py-2">
                <div className="d-flex justify-content-between">
                  <div>
                    <div className="fw-bold">{n.title}</div>
                    <div className="small text-muted">{new Date(n.created_at ?? Date.now()).toLocaleString()}</div>
                    <div className="mt-1">{n.message}</div>
                  </div>
                  <div className="text-end small">
                    {n.user_id ? <div>User: {n.user_id}</div> : <div>Global</div>}
                    <div className="mt-2">{n.is_read ? 'Read' : 'Unread'}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
