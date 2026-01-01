import React, { createContext, useContext, useState, useCallback } from 'react';

// Create the context
const ToastContext = createContext();

// Toast types
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
};

// Default toast duration (in milliseconds)
const TOAST_DURATION = {
  [TOAST_TYPES.SUCCESS]: 5000,
  [TOAST_TYPES.ERROR]: 7000,
  [TOAST_TYPES.INFO]: 5000,
  [TOAST_TYPES.WARNING]: 6000
};

// Provider component
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);

  // Add a new toast
  const showToast = useCallback((message, type = TOAST_TYPES.INFO, duration = null) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      message,
      type,
      duration: duration || TOAST_DURATION[type] || 5000
    };

    setToasts(prev => [...prev, toast]);

    // Auto-dismiss after duration
    setTimeout(() => {
      dismissToast(id);
    }, toast.duration);

    return id;
  }, []);

  // Remove a toast
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.map(toast =>
      toast.id === id ? { ...toast, show: false } : toast
    ));

    // Remove from DOM after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 300);
  }, []);

  // Show confirmation modal
  const showConfirm = useCallback((message, onConfirm, onCancel = null, confirmText = 'Confirm', cancelText = 'Cancel') => {
    return new Promise((resolve) => {
      const modal = {
        message,
        confirmText,
        cancelText,
        onConfirm: () => {
          setConfirmModal(null);
          if (onConfirm) onConfirm();
          resolve(true);
        },
        onCancel: () => {
          setConfirmModal(null);
          if (onCancel) onCancel();
          resolve(false);
        }
      };

      setConfirmModal(modal);
    });
  }, []);

  // Dismiss confirmation modal
  const dismissConfirm = useCallback(() => {
    setConfirmModal(null);
  }, []);

  const contextValue = {
    toasts,
    confirmModal,
    showToast,
    dismissToast,
    showConfirm,
    dismissConfirm
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
}

// Hook to use the toast context
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default ToastContext;
