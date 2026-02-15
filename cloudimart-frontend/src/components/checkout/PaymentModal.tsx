'use client';

import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type InitiatePayload = {
  amount: number;
  mobile: string;
  network: string;
  delivery_lat?: number;
  delivery_lng?: number;
  delivery_address?: string;
  // new
  cart_hash?: string | null;
  cart_id?: number | null;
  location_id?: number | null;
};

type Props = {
  show: boolean;
  amount: number;
  onClose: () => void;
  onInitiatePayChangu: (payload: InitiatePayload) => Promise<{ checkout_url?: string; tx_ref?: string }>;
  onUploadProof: (formData: FormData) => Promise<{ tx_ref?: string }>;
  defaultMobile?: string;
  defaultNetwork?: string;
  defaultAddress?: string;
  defaultLat?: number | undefined;
  defaultLng?: number | undefined;
  // NEW optional props so the modal can prefill hidden cart values when available
  cartHash?: string | null;
  cartId?: number | null;
  locationId?: number | null;
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
  cartHash = null,
  cartId = null,
  locationId = null,
}: Props) {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;

  const [method, setMethod] = useState<'paychangu' | 'upload_proof'>('paychangu');
  const [mobile, setMobile] = useState(defaultMobile);
  const [network, setNetwork] = useState(defaultNetwork);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // reset fields whenever modal is (re)opened
    if (show) {
      setMethod('paychangu');
      setMobile(defaultMobile);
      setNetwork(defaultNetwork);
      setMessage('');
      setFile(null);
      setErr(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

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
    if (!mobile || mobile.trim().length < 3) {
      setErr('Please provide a valid mobile number to proceed.');
      return;
    }
    setLoading(true);
    try {
      const payload: InitiatePayload = {
        amount: safeAmount,
        mobile,
        network,
        delivery_lat: defaultLat,
        delivery_lng: defaultLng,
        delivery_address: defaultAddress,
        // include hidden cart values if provided
        cart_hash: cartHash ?? undefined,
        cart_id: typeof cartId === 'number' ? cartId : undefined,
        location_id: typeof locationId === 'number' ? locationId : undefined,
      };
      await onInitiatePayChangu(payload);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  const submitProof = async () => {
    setErr(null);
    if (!file) {
      setErr('Please attach a proof image (screenshot or receipt).');
      return;
    }
    if (!mobile || mobile.trim().length < 3) {
      setErr('Please provide a mobile number used to make the payment (for admin reference).');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('amount', String(safeAmount));
      fd.append('file', file, file.name);
      fd.append('mobile', mobile ?? '');
      fd.append('network', network ?? '');
      if (defaultLat !== undefined && defaultLat !== null) fd.append('delivery_lat', String(defaultLat));
      if (defaultLng !== undefined && defaultLng !== null) fd.append('delivery_lng', String(defaultLng));
      fd.append('delivery_address', defaultAddress ?? '');
      fd.append('note', message ?? '');
      // append hidden cart fields if available
      if (cartHash) fd.append('cart_hash', String(cartHash));
      if (typeof cartId === 'number') fd.append('cart_id', String(cartId));
      if (typeof locationId === 'number') fd.append('location_id', String(locationId));

      await onUploadProof(fd);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'Failed to upload proof');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1050, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)' }}
      />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1060 }}>
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Make Payment — MK {safeAmount.toFixed(2)}</h5>
              <button type="button" className="btn-close" onClick={handleClose} />
            </div>

            <div className="modal-body">
              <p className="small text-muted">
                Choose how you want to make the payment. You can either checkout via PayChangu (online)
                or upload a proof for manual verification (Airtel/Mpamba/bank).
              </p>

              <div className="mb-3">
                <label className="form-label small mb-2">Payment method</label>
                <div className="btn-group" role="group">
                  <button
                    type="button"
                    className={`btn btn-outline-primary ${method === 'paychangu' ? 'active' : ''}`}
                    onClick={() => setMethod('paychangu')}
                  >
                    Pay via PayChangu
                  </button>
                  <button
                    type="button"
                    className={`btn btn-outline-primary ${method === 'upload_proof' ? 'active' : ''}`}
                    onClick={() => setMethod('upload_proof')}
                  >
                    Upload proof (manual)
                  </button>
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
                  <select
                    className="form-select"
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                  >
                    <option value="mpamba">MPamba</option>
                    <option value="airtel">Airtel Money</option>
                    <option value="bank">Bank transfer</option>
                  </select>
                </div>

                {method === 'upload_proof' && (
                  <>
                    <div className="col-12">
                      <label className="form-label small">Upload proof (image)</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-control"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                      <div className="form-text small">
                        Attach screenshot or receipt. Admin will verify and mark payment approved.
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label small">Optional note / where you sent payment</label>
                      <input
                        className="form-control"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="e.g. Sent to Cloudimart MPamba 099xxxxxx"
                      />
                      <div className="form-text small">
                        You can mention account or transaction ID here.
                      </div>
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

              {/*
                 Hidden/diagnostic area: include cart_hash and cart_id in the modal DOM so tests
                 or debugging can easily see them. They are also appended to submissions.
              */}
              <div style={{ display: 'none' }}>
                <input type="hidden" name="cart_hash" value={cartHash ?? ''} readOnly />
                <input type="hidden" name="cart_id" value={typeof cartId === 'number' ? String(cartId) : ''} readOnly />
              </div>

              {err && <div className="alert alert-danger mt-3">{err}</div>}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
                Cancel
              </button>

              {method === 'paychangu' ? (
                <button
                  type="button"
                  className="btn btn-primary d-flex align-items-center justify-content-center gap-2"
                  style={{ minWidth: 190 }}
                  onClick={submitPayChangu}
                  disabled={loading || !mobile || mobile.trim().length < 3}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" inline />
                      <span>Processing...</span>
                    </>
                  ) : (
                    'Proceed to PayChangu'
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-success d-flex align-items-center justify-content-center gap-2"
                  style={{ minWidth: 210 }}
                  onClick={submitProof}
                  disabled={loading || !file || !mobile || mobile.trim().length < 3}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" inline />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    'Upload proof & submit'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
