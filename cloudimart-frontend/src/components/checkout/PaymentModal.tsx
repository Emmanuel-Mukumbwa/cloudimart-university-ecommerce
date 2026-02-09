// src/components/checkout/PaymentModal.tsx
'use client';

import React, { useState } from 'react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type Props = {
  show: boolean;
  amount: number;
  onClose: () => void; // simply closes modal
  onInitiatePayChangu: (payload: { amount: number; mobile: string; network: string; delivery_lat?: number; delivery_lng?: number; delivery_address?: string }) => Promise<{ checkout_url?: string; tx_ref?: string }>;
  onUploadProof: (formData: FormData) => Promise<{ tx_ref?: string }>;
  defaultMobile?: string;
  defaultNetwork?: string;
  defaultAddress?: string;
  defaultLat?: number | undefined;
  defaultLng?: number | undefined;
};

export default function PaymentModal({
  show,
  amount,
  onClose,
  onInitiatePayChangu,
  onUploadProof,
  defaultMobile = '',
  defaultNetwork = 'mpamba',
  defaultAddress = '',
  defaultLat,
  defaultLng,
}: Props) {
  // Defensive amount handling
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;

  const [method, setMethod] = useState<'paychangu' | 'upload_proof'>('paychangu');
  const [mobile, setMobile] = useState(defaultMobile);
  const [network, setNetwork] = useState(defaultNetwork);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!show) return null;

  const reset = () => {
    setMethod('paychangu');
    setMobile(defaultMobile);
    setNetwork(defaultNetwork);
    setMessage('');
    setFile(null);
    setErr(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submitPayChangu = async () => {
    setErr(null);

    // basic client-side validation
    if (!mobile || mobile.trim().length < 3) {
      setErr('Please provide a valid mobile number to proceed.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: safeAmount,
        mobile,
        network,
        delivery_lat: defaultLat,
        delivery_lng: defaultLng,
        delivery_address: defaultAddress,
      };
      const r = await onInitiatePayChangu(payload);
      setLoading(false);
      // caller will handle checkout_url / tx_ref / polling
      return r;
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to initiate payment');
      setLoading(false);
      throw e;
    }
  };

  const submitProof = async () => {
    setErr(null);
    if (!file) {
      setErr('Please attach a proof image (screenshot or receipt).');
      return;
    }

    // optional: require mobile when uploading proof so admins can contact payer
    if (!mobile || mobile.trim().length < 3) {
      setErr('Please provide a mobile number used to make the payment (for admin reference).');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      // Use safeAmount and include filename for the file entry
      fd.append('amount', String(safeAmount));
      fd.append('file', file, file.name);
      fd.append('mobile', mobile ?? '');
      fd.append('network', network ?? '');
      fd.append('delivery_lat', defaultLat !== undefined ? String(defaultLat) : '');
      fd.append('delivery_lng', defaultLng !== undefined ? String(defaultLng) : '');
      fd.append('delivery_address', defaultAddress ?? '');
      fd.append('note', message ?? '');

      const r = await onUploadProof(fd);
      setLoading(false);
      // caller will process tx_ref/polling
      return r;
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to upload proof');
      setLoading(false);
      throw e;
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1060 }}>
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Make Payment — MK {safeAmount.toFixed(2)}</h5>
              <button type="button" className="btn-close" onClick={handleClose} />
            </div>

            <div className="modal-body">
              <p className="small text-muted">Choose how you want to make the payment. You can either checkout via PayChangu (online) or upload a proof for manual verification (Airtel/Mpamba/bank).</p>

              <div className="mb-3">
                <label className="form-label small mb-2">Payment method</label>
                <div className="btn-group" role="group">
                  <button type="button" className={`btn btn-outline-primary ${method === 'paychangu' ? 'active' : ''}`} onClick={() => setMethod('paychangu')}>Pay via PayChangu</button>
                  <button type="button" className={`btn btn-outline-primary ${method === 'upload_proof' ? 'active' : ''}`} onClick={() => setMethod('upload_proof')}>Upload proof (manual)</button>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small">Mobile number</label>
                  <input
                    className="form-control"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. 0991234567"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small">Network</label>
                  <select className="form-select" value={network} onChange={(e) => setNetwork(e.target.value)}>
                    <option value="mpamba">MPamba</option>
                    <option value="airtel">Airtel Money</option>
                    <option value="bank">Bank transfer</option>
                  </select>
                </div>

                {method === 'upload_proof' && (
                  <>
                    <div className="col-12">
                      <label className="form-label small">Upload proof (image)</label>
                      <input type="file" accept="image/*" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                      <div className="form-text small">Attach screenshot or receipt. Admin will verify and mark payment approved.</div>
                    </div>

                    <div className="col-12">
                      <label className="form-label small">Optional note / where you sent payment</label>
                      <input className="form-control" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Sent to Cloudimart MPamba 099xxxxxx" />
                      <div className="form-text small">You can mention account or transaction ID here.</div>
                    </div>

                    <div className="col-12">
                      <div className="alert alert-info small mb-0">
                        You can send payment to one of (placeholders):
                        <ul className="mb-0">
                          <li>MPamba: 099-XXX-XXXX</li>
                          <li>Airtel Money: 088-XXX-XXXX</li>
                          <li>National Bank: Account 123456789 (Cloudimart)</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {err && <div className="alert alert-danger mt-3">{err}</div>}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>Cancel</button>

              {method === 'paychangu' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      await submitPayChangu();
                      // parent handles checkout/polling
                    } catch (e) {
                      // error already set
                    }
                  }}
                  disabled={loading || !mobile || mobile.trim().length < 3}
                >
                  {loading ? <LoadingSpinner /> : 'Proceed to PayChangu'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={async () => {
                    try {
                      await submitProof();
                      // parent handles tx_ref & polling
                    } catch (e) {
                      // error already set
                    }
                  }}
                  disabled={loading || !file || !mobile || mobile.trim().length < 3}
                >
                  {loading ? <LoadingSpinner /> : 'Upload proof & submit'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
