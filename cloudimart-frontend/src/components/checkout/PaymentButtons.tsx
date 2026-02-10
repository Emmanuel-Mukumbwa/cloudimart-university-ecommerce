// ---------------------------
// File: src/components/checkout/PaymentButtons.tsx
import React from 'react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

interface Props {
  onOpenPaymentOptions: () => void;
  placeOrder: () => void;
  paymentStatus: 'idle' | 'pending' | 'success' | 'failed' | string;
  paymentLoading: boolean;
  placeOrderDisabled: boolean;
}

export default function PaymentButtons({ onOpenPaymentOptions, placeOrder, paymentStatus, paymentLoading, placeOrderDisabled }: Props) {
  return (
    <div className="d-flex justify-content-end gap-3">
      <button className="btn btn-primary" onClick={onOpenPaymentOptions} disabled={paymentLoading}>
        {paymentLoading ? <LoadingSpinner /> : (paymentStatus === 'pending' ? 'Payment pending...' : 'Make Payment')}
      </button>

      <button className="btn btn-success btn-lg" onClick={placeOrder} disabled={placeOrderDisabled}>
        Place Order
      </button>
    </div>
  );
}
