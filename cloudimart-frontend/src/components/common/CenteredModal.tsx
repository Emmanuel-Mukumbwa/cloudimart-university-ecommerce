// src/components/common/CenteredModal.tsx
'use client';
import React from 'react';

type Props = {
  show: boolean;
  title?: string;
  body?: React.ReactNode;
  onClose: () => void;          // called for confirm / OK
  onCancel?: () => void;        // optional cancel handler
  okLabel?: string;
  cancelLabel?: string;
  size?: 'sm' | 'md' | 'lg';
};

export default function CenteredModal({
  show,
  title,
  body,
  onClose,
  onCancel,
  okLabel = 'OK',
  cancelLabel = 'Cancel',
  size = 'md',
}: Props) {
  if (!show) return null;

  const dialogClass = size === 'sm' ? 'modal-sm' : size === 'lg' ? 'modal-lg' : '';

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1050, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)' }}
      />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1060 }}>
        <div className={`modal-dialog modal-dialog-centered ${dialogClass}`} role="document">
          <div className="modal-content">
            {title && (
              <div className="modal-header">
                <h5 className="modal-title">{title}</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onCancel ?? onClose} />
              </div>
            )}
            <div className="modal-body">
              {typeof body === 'string' ? <p style={{ whiteSpace: 'pre-wrap' }}>{body}</p> : body}
            </div>
            <div className="modal-footer">
              {onCancel ? (
                <>
                  <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                    {cancelLabel}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={onClose}>
                    {okLabel}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={onClose}>
                  {okLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
