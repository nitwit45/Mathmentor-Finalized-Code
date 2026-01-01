import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPaymentMethods, payWithSavedCard, getStripeConfig } from '../../services/api';
import { HiCreditCard, HiCheck, HiX, HiPlus } from 'react-icons/hi';
import './PaymentModal.css';

function PaymentModal({ session, onClose, onSuccess }) {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethodId, setSelectedMethodId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [stripeConfigured, setStripeConfigured] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [configResponse, methodsResponse] = await Promise.all([
          getStripeConfig(),
          getPaymentMethods()
        ]);
        
        setStripeConfigured(configResponse.success && configResponse.data.is_configured);
        
        if (methodsResponse.success) {
          setPaymentMethods(methodsResponse.data);
          // Select default card
          const defaultCard = methodsResponse.data.find(pm => pm.is_default);
          if (defaultCard) {
            setSelectedMethodId(defaultCard.id);
          } else if (methodsResponse.data.length > 0) {
            setSelectedMethodId(methodsResponse.data[0].id);
          }
        }
      } catch (err) {
        setError('Failed to load payment methods');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handlePay = async () => {
    if (!selectedMethodId) {
      setError('Please select a payment method');
      return;
    }

    setPaying(true);
    setError('');

    try {
      const response = await payWithSavedCard(session.id, selectedMethodId);
      if (response.success) {
        onSuccess(response.message || 'Payment successful!');
      } else {
        setError(response.message || 'Payment failed');
      }
    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  // Get card brand display
  const getCardBrandDisplay = (brand) => {
    const brands = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'American Express',
      discover: 'Discover',
    };
    return brands[brand] || brand?.toUpperCase() || 'Card';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <HiX />
        </button>

        <div className="modal-header">
          <HiCreditCard className="modal-icon" />
          <h2>Complete Payment</h2>
        </div>

        <div className="session-summary">
          <div className="summary-row">
            <span>Session</span>
            <span>{session.topic}</span>
          </div>
          <div className="summary-row">
            <span>Duration</span>
            <span>{session.duration} minutes</span>
          </div>
          <div className="summary-row">
            <span>Tutor</span>
            <span>{session.tutor?.full_name}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>£{session.price}</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-cards">
            <div className="loading-spinner"></div>
            <p>Loading payment methods...</p>
          </div>
        ) : !stripeConfigured ? (
          <div className="stripe-error">
            <p>Stripe is not configured. Please contact support.</p>
          </div>
        ) : paymentMethods.length === 0 ? (
          <div className="no-cards">
            <p>You don't have any saved cards.</p>
            <Link to="/student/payment-methods" className="action-button add-card-link">
              <HiPlus /> Add a Card
            </Link>
          </div>
        ) : (
          <>
            <div className="select-card-section">
              <h3>Select Payment Method</h3>
              <div className="cards-list">
                {paymentMethods.map((pm) => (
                  <label 
                    key={pm.id} 
                    className={`card-option ${selectedMethodId === pm.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={pm.id}
                      checked={selectedMethodId === pm.id}
                      onChange={() => setSelectedMethodId(pm.id)}
                    />
                    <div className="card-option-content">
                      <div className="card-brand">{getCardBrandDisplay(pm.card_brand)}</div>
                      <div className="card-number">•••• {pm.card_last4}</div>
                      <div className="card-expiry">{pm.card_exp_month}/{pm.card_exp_year}</div>
                    </div>
                    {selectedMethodId === pm.id && (
                      <HiCheck className="check-icon" />
                    )}
                  </label>
                ))}
              </div>
              <Link to="/student/payment-methods" className="add-another-link">
                <HiPlus /> Use a different card
              </Link>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button 
                className="action-button secondary" 
                onClick={onClose}
                disabled={paying}
              >
                Cancel
              </button>
              <button 
                className="action-button pay-btn"
                onClick={handlePay}
                disabled={paying || !selectedMethodId}
              >
                {paying ? 'Processing...' : `Pay £${session.price}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentModal;

