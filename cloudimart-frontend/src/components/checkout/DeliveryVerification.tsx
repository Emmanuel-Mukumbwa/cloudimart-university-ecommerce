// ---------------------------
// File: src/components/checkout/DeliveryVerification.tsx
import React from 'react';
import type { Loc } from './types';

type GPS = { lat?: number; lng?: number };

interface Props {
  gps: GPS;
  verifying: boolean;
  verified: boolean;
  detectedArea: { id?: number; name?: string } | null;
  address: string;
  showFallbackChoice?: boolean;
  selectedLocationId: number | '';
  locations: Loc[];
  paymentTxRef?: string | null;
  paymentStatus?: string | null;
  onRequestGps: () => void;
  onUseFallback: (autoFallback?: boolean) => void;
  onAddressChange: (v: string) => void;
  onSelectLocation: (id: number | '') => void;
}

export default function DeliveryVerification({
  gps,
  verifying,
  verified,
  detectedArea,
  address,
  showFallbackChoice = false,
  selectedLocationId,
  locations,
  paymentTxRef,
  paymentStatus,
  onRequestGps,
  onUseFallback,
  onAddressChange,
  onSelectLocation,
}: Props) {
  return (
    <div className="border rounded p-3 mb-3">
      <h6>Delivery Location Verification</h6>

      <div className="mb-3">
        <label className="form-label small">Delivery address (hostel/office/room)</label>
        <input
          type="text"
          className="form-control"
          placeholder="e.g. Hostel A, Room 12"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          disabled={verified}
        />
      </div>

      <div className="mb-3">
        <label className="form-label small">Select location</label>
        <select
          className="form-select"
          value={selectedLocationId}
          onChange={(e) => onSelectLocation(e.target.value ? Number(e.target.value) : '')}
          disabled={verified}
        >
          <option value="">Choose location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <div className="form-text small mt-1">If GPS fails we will automatically use this selected location as fallback.</div>
      </div>

      <div className="d-flex gap-2 align-items-center">
        <button className="btn btn-outline-primary" onClick={onRequestGps} disabled={verifying}>
          {verifying ? 'Verifying...' : verified ? 'Location Verified ✓' : 'Verify via GPS'}
        </button>

        <div className="small text-muted ms-3">
          {gps.lat && gps.lng ? (
            <>
              Lat: <strong>{gps.lat.toFixed(6)}</strong>, Lng: <strong>{gps.lng.toFixed(6)}</strong>
            </>
          ) : (
            <>No coordinates yet</>
          )}
        </div>

        {showFallbackChoice && (
          <button className="btn btn-outline-secondary ms-3" onClick={() => onUseFallback(false)} disabled={!selectedLocationId || verifying}>
            Use selected location as fallback
          </button>
        )}

        {paymentTxRef && (
          <div className="ms-3 small">
            Payment: <strong>{paymentStatus}</strong> {paymentTxRef ? `(tx: ${paymentTxRef})` : null}
          </div>
        )}
      </div>

      <div className="mt-2">
        {detectedArea ? (
          <div className="alert alert-success mb-0 p-2">Detected area: <strong>{detectedArea.name}</strong></div>
        ) : (
          !verifying && gps.lat && gps.lng && !verified && (
            <div className="alert alert-warning mb-0 p-2">Coordinates are outside delivery zones.</div>
          )
        )}
      </div>
    </div>
  );
}
