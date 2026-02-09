// File: src/components/admin/AssignDeliveryModal.tsx
'use client';
import React, { useEffect, useState } from 'react';
import CenteredModal from '../../components/common/CenteredModal';
import client from '../../lib/api/client';

type Person = { id: number; name: string; phone_number?: string; email?: string };
type Props = {
  show: boolean;
  deliveryId: number | null;
  onClose: (assigned?: boolean) => void; // assigned=true if assignment succeeded
};

export default function AssignDeliveryModal({ show, deliveryId, onClose }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (show) {
      setMessage(null);
      setLoading(true);
      setSelected(null);
      client.get('/api/admin/delivery-people')
        .then(res => setPeople(res.data.data ?? res.data ?? []))
        .catch(err => setMessage(err?.response?.data?.message ?? 'Failed to load delivery people'))
        .finally(() => setLoading(false));
    }
  }, [show]);

  // Called when the modal OK button is clicked (CenteredModal calls onClose)
  const handleAssign = async () => {
    if (!deliveryId) {
      setMessage('No delivery selected.');
      return;
    }
    if (!selected) {
      setMessage('Please select a delivery person.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await client.post(`/api/admin/deliveries/${deliveryId}/assign`, { delivery_person_id: selected });
      // server will create Notification rows for delivery person and customer
      setMessage('Assigned successfully.');
      // notify parent that assignment happened — parent will refresh orders
      onClose(true);
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.message ?? 'Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  // onCancel should just call parent with assigned = false (i.e. close)
  const handleCancel = () => {
    setMessage(null);
    onClose(false);
  };

  // Build the body (no action buttons here; CenteredModal renders the footer buttons)
  const body = (
    <>
      {message && <div className="alert alert-info">{message}</div>}
      {loading ? (
        <div>Loading delivery people…</div>
      ) : (
        <>
          {people.length === 0 ? (
            <div className="text-muted">No delivery people available. Create one from Users.</div>
          ) : (
            <div>
              <label className="form-label">Select delivery person</label>
              <select
                className="form-select"
                value={selected ?? ''}
                onChange={(e) => setSelected(Number(e.target.value) || null)}
              >
                <option value="">Select delivery person</option>
                {people.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.phone_number ? ` — ${p.phone_number}` : ''}
                  </option>
                ))}
              </select>
              <div className="mt-2 small text-muted">Assigning will create in-app notifications for the delivery person and the customer.</div>
            </div>
          )}
        </>
      )}
    </>
  );

  // We pass handleAssign as onClose so CenteredModal's OK button triggers the assign action.
  // onCancel closes without assigning.
  return (
    <CenteredModal
      show={show}
      title="Assign Delivery Person"
      body={body}
      onClose={handleAssign}
      onCancel={handleCancel}
      okLabel={busy ? 'Assigning…' : 'Assign'}
      cancelLabel="Cancel"
      size="md"
    />
  );
}
