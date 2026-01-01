import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import './ConfirmModal.css';

function ConfirmModal() {
  const { confirmModal, dismissConfirm } = useToast();

  if (!confirmModal) {
    return null;
  }

  const handleBackdropClick = (e) => {
    // Only dismiss if clicking directly on backdrop, not on modal content
    if (e.target === e.currentTarget) {
      dismissConfirm();
    }
  };

  return (
    <div className="confirm-modal-overlay" onClick={handleBackdropClick}>
      <div className="confirm-modal">
        <div className="confirm-modal-header">
          <h3>Confirm Action</h3>
        </div>
        <div className="confirm-modal-body">
          <p>{confirmModal.message}</p>
        </div>
        <div className="confirm-modal-actions">
          <button
            className="confirm-modal-btn confirm-modal-cancel"
            onClick={confirmModal.onCancel}
          >
            {confirmModal.cancelText}
          </button>
          <button
            className="confirm-modal-btn confirm-modal-confirm"
            onClick={confirmModal.onConfirm}
          >
            {confirmModal.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
