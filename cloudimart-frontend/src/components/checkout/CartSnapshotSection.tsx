import React from 'react';
import DeliveryVerification from './DeliveryVerification';
import PaymentUploadsList from './PaymentUploadsList';
import SummaryPanel from './SummaryPanel';
import PaymentButtons from './PaymentButtons';
import ProofItem from './ProofItem';

type SnapshotItem = {
  product_id?: number;
  name?: string;
  price?: number;
  quantity?: number;
};

interface Props {
  // cart snapshot info (array of items)
  snapshot: SnapshotItem[];
  cartHash: string | null;
  isCurrentCart?: boolean;
  // delivery state (optional, only used for current cart typically)
  gps?: { lat?: number; lng?: number };
  verifying?: boolean;
  verified?: boolean;
  detectedArea?: { id?: number; name?: string } | null;
  address?: string;
  selectedLocationId?: number | '';
  locations?: any[];
  showFallbackChoice?: boolean;

  // payments (all payments attached to this cartHash) - includes pending/failed
  paymentsForCart: any[];

  // computed numbers for this snapshot (computed by parent)
  totalForSnapshot: number;
  coveredForSnapshot: number;
  remainingForSnapshot: number;

  // actions
  onRequestGps?: () => Promise<void>;
  onUseFallback?: (autoFallback?: boolean) => Promise<void>;
  onAddressChange?: (v: string) => void;
  onSelectLocation?: (id: number | '') => void;

  // payment actions (pass through)
  onInitiatePayChanguForCart?: (opts: { cart_hash: string | null; amount?: number; mobile: string; network: string; delivery_lat?: number; delivery_lng?: number; delivery_address?: string }) => Promise<any>;
  onUploadProofForCart?: (formData: FormData) => Promise<any>;

  // UI flags
  loadingPayments?: boolean;
  paymentLoading?: boolean;
  paymentStatus?: string;
  paymentTxRef?: string | null;
  placeOrderDisabled?: boolean; // only relevant for current cart
  onPlaceOrder?: () => Promise<void>;
}

export default function CartSnapshotSection({
  snapshot,
  cartHash,
  isCurrentCart = false,
  gps,
  verifying,
  verified,
  detectedArea,
  address,
  selectedLocationId,
  locations = [],
  showFallbackChoice = false,
  paymentsForCart,
  totalForSnapshot,
  coveredForSnapshot,
  remainingForSnapshot,
  onRequestGps,
  onUseFallback,
  onAddressChange,
  onSelectLocation,
  onInitiatePayChanguForCart,
  onUploadProofForCart,
  loadingPayments,
  paymentLoading,
  paymentStatus,
  paymentTxRef,
  placeOrderDisabled,
  onPlaceOrder,
}: Props) {
  return (
    <div className="border rounded p-3 mb-3">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <h6 className="mb-0">{isCurrentCart ? 'Current cart' : `Cart snapshot: ${cartHash ?? '(no hash)'}`}</h6>
        <div className="text-end small">
          <div>Snapshot total: <strong>MK {totalForSnapshot.toFixed(2)}</strong></div>
          <div className="text-success small">Covered: MK {coveredForSnapshot.toFixed(2)}</div>
          <div className="h6 mt-1">{remainingForSnapshot <= 0 ? <span className="text-success">None</span> : `Remaining: MK ${remainingForSnapshot.toFixed(2)}`}</div>
        </div>
      </div>

      {/* snapshot items table */}
      <div className="mb-3">
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-end">Qty</th>
              <th className="text-end">Unit</th>
              <th className="text-end">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.map((si, idx) => {
              const qty = Number(si.quantity ?? 0);
              const price = Number(si.price ?? 0);
              return (
                <tr key={idx}>
                  <td>{si.name ?? `Product ${si.product_id ?? ''}`}</td>
                  <td className="text-end">{qty}</td>
                  <td className="text-end">MK {price.toFixed(2)}</td>
                  <td className="text-end">MK {(qty * price).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delivery verification block - only meaningful for current cart */}
      {isCurrentCart && (
        <DeliveryVerification
          gps={gps ?? {}}
          verifying={!!verifying}
          verified={!!verified}
          detectedArea={detectedArea ?? null}
          address={address ?? ''}
          showFallbackChoice={showFallbackChoice}
          selectedLocationId={selectedLocationId ?? ''}
          locations={locations ?? []}
          paymentTxRef={paymentTxRef ?? null}
          paymentStatus={paymentStatus ?? 'idle'}
          onRequestGps={onRequestGps ?? (async () => {})}
          onUseFallback={onUseFallback ?? (async () => {})}
          onAddressChange={onAddressChange ?? (() => {})}
          onSelectLocation={onSelectLocation ?? (() => {})}
        />
      )}

      {/* Payments for this snapshot */}
      <div className="mb-3">
        <h6 className="mb-2">Payments for this cart</h6>
        <PaymentUploadsList payments={paymentsForCart} loading={loadingPayments} cartHash={cartHash} title="" />
      </div>

      {/* Actions: pay or place order (for current cart) */}
      <div className="d-flex justify-content-end gap-2">
        <button
          className="btn btn-outline-primary"
          onClick={() => {
            // default to paying the remaining amount for this cart snapshot
            if (onInitiatePayChanguForCart) {
              onInitiatePayChanguForCart({
                cart_hash: cartHash,
                amount: remainingForSnapshot <= 0 ? totalForSnapshot : remainingForSnapshot,
                mobile: '',
                network: 'mpamba',
                delivery_lat: gps?.lat,
                delivery_lng: gps?.lng,
                delivery_address: address ?? '',
              }).catch(() => {});
            }
          }}
          disabled={paymentLoading}
        >
          {paymentLoading ? 'Processing…' : remainingForSnapshot <= 0 ? 'Pay (optional)' : `Pay MK ${remainingForSnapshot.toFixed(2)}`}
        </button>

        {isCurrentCart && (
          <button className="btn btn-success" onClick={() => onPlaceOrder && onPlaceOrder()} disabled={placeOrderDisabled}>
            Place Order
          </button>
        )}
      </div>
    </div>
  );
}
