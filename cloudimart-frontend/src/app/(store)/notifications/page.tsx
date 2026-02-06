'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../lib/api/client';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

type Notification = {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/notifications');
      setNotifications(res.data.notifications || []);
    } catch (e: any) {
      setError(e?.userMessage ?? 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await client.post(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container py-5">
      <h4 className="mb-4">Notifications</h4>

      {error && <div className="alert alert-danger">{error}</div>}

      {notifications.length === 0 ? (
        <div className="text-center text-muted py-5">
          <h5>No notifications yet.</h5>
        </div>
      ) : (
        <div className="list-group shadow-sm">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`list-group-item d-flex justify-content-between align-items-start ${
                !n.is_read ? 'bg-light' : ''
              }`}
            >
              <div>
                <h6 className="mb-1">{n.title}</h6>
                <p className="mb-1 small">{n.message}</p>
                <small className="text-muted">
                  {new Date(n.created_at).toLocaleString()}
                </small>
              </div>
              {!n.is_read && (
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => markAsRead(n.id)}
                >
                  Mark as read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
