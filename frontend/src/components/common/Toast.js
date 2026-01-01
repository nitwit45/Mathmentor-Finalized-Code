import React from 'react';
import { HiCheck, HiX, HiExclamation, HiInformationCircle } from 'react-icons/hi';
import { TOAST_TYPES } from '../../contexts/ToastContext';
import './Toast.css';

function Toast({ toast, onDismiss }) {
  const getIcon = () => {
    switch (toast.type) {
      case TOAST_TYPES.SUCCESS:
        return <HiCheck />;
      case TOAST_TYPES.ERROR:
        return <HiX />;
      case TOAST_TYPES.WARNING:
        return <HiExclamation />;
      case TOAST_TYPES.INFO:
      default:
        return <HiInformationCircle />;
    }
  };

  const getToastClass = () => {
    return `toast toast-${toast.type} ${toast.show === false ? 'hide' : 'show'}`;
  };

  return (
    <div className={getToastClass()}>
      <div className="toast-content">
        <div className="toast-icon">
          {getIcon()}
        </div>
        <div className="toast-message">
          {toast.message}
        </div>
        <button
          className="toast-close"
          onClick={() => onDismiss(toast.id)}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default Toast;
