// src/components/common/CenteredModal.tsx
'use client';
import React from 'react';

type Props = {
  show: boolean;
  title?: string;
  body?: React.ReactNode;
  onClose: () => void;
  okLabel?: string;
};

export default function CenteredModal({ show, title, body, onClose, okLabel = 'OK' }: Props) {
  if (!show) return null;

  return (
    // overlay
    <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} />

    /* We render both backdrop and centered dialog */
  );
}
