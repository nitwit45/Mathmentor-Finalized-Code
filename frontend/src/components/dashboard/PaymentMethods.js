import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { 
  getStripeConfig, 
  getPaymentMethods, 
  createSetupIntent, 
  savePaymentMethod, 
  deletePaymentMethod,
  setDefaultPaymentMethod 
} from '../../services/api';
import { useToast, TOAST_TYPES } from '../../contexts/ToastContext';
import { HiCreditCard, HiTrash, HiCheck, HiPlus, HiStar } from 'react-icons/hi';
import './PaymentMethods.css';

// Card element styling
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#e8e6e1',
      fontFamily: '"DM Sans", -apple-system, sans-serif',
      '::placeholder': {
        color: '#8a8a8a',
      },
      backgroundColor: 'transparent',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
};

// Add Card Form Component
function AddCardForm({ onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create SetupIntent
      const setupResponse = await createSetupIntent();
      if (!setupResponse.success) {
        setError(setupResponse.message || 'Failed to initialize card setup');
        setLoading(false);
        return;
      }

      const { client_secret } = setupResponse.data;

      // Confirm card setup
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        client_secret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      // Save payment method to backend
      const saveResponse = await savePaymentMethod(setupIntent.payment_method, true);
      if (saveResponse.success) {
        showToast('Card added successfully!', TOAST_TYPES.SUCCESS);
        onSuccess();
      } else {
        setError(saveResponse.message || 'Failed to save card');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-card-form">
      <h3><HiPlus /> Add New Card</h3>
      
      <div className="card-element-wrapper">
        <CardElement options={cardElementOptions} />
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-actions">
        <button 
          type="button" 
          onClick={onCancel} 
          className="action-button secondary"
          disabled={loading}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="action-button"
          disabled={!stripe || loading}
        >
          {loading ? 'Saving...' : 'Save Card'}
        </button>
      </div>
    </form>
  );
}

// Card brand icons (simplified)
function CardBrandIcon({ brand }) {
  const brandColors = {
    visa: '#1A1F71',
    mastercard: '#EB001B',
    amex: '#006FCF',
    discover: '#FF6000',
  };
  
  return (
    <div 
      className="card-brand-icon" 
      style={{ backgroundColor: brandColors[brand] || '#666' }}
    >
      {brand?.toUpperCase().slice(0, 4) || 'CARD'}
    </div>
  );
}

// Main Payment Methods Component
function PaymentMethodsContent() {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const { showConfirm, showToast } = useToast();

  const loadPaymentMethods = async () => {
    try {
      const response = await getPaymentMethods();
      if (response.success) {
        setPaymentMethods(response.data);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const handleDelete = async (pmId) => {
    const confirmed = await showConfirm('Are you sure you want to remove this card?');
    if (!confirmed) return;

    setActionLoading(pmId);
    try {
      const response = await deletePaymentMethod(pmId);
      if (response.success) {
        showToast('Card removed', TOAST_TYPES.SUCCESS);
        loadPaymentMethods();
      } else {
        showToast(response.message || 'Failed to remove card', TOAST_TYPES.ERROR);
      }
    } catch (error) {
      showToast('Failed to remove card', TOAST_TYPES.ERROR);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefault = async (pmId) => {
    setActionLoading(pmId);
    try {
      const response = await setDefaultPaymentMethod(pmId);
      if (response.success) {
        showToast('Default card updated', TOAST_TYPES.SUCCESS);
        loadPaymentMethods();
      } else {
        showToast(response.message || 'Failed to update default card', TOAST_TYPES.ERROR);
      }
    } catch (error) {
      showToast('Failed to update default card', TOAST_TYPES.ERROR);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCardAdded = () => {
    setShowAddForm(false);
    loadPaymentMethods();
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading payment methods...</p>
      </div>
    );
  }

  return (
    <div className="payment-methods-page">
      <div className="page-header">
        <h1>Payment Methods</h1>
        <p>Manage your saved cards for quick checkout</p>
      </div>

      {/* Saved Cards List */}
      <div className="saved-cards-section">
        {paymentMethods.length > 0 ? (
          <div className="cards-list">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className={`card-item ${pm.is_default ? 'default' : ''}`}>
                <div className="card-info">
                  <CardBrandIcon brand={pm.card_brand} />
                  <div className="card-details">
                    <span className="card-number">•••• •••• •••• {pm.card_last4}</span>
                    <span className="card-expiry">Expires {pm.card_exp_month}/{pm.card_exp_year}</span>
                  </div>
                  {pm.is_default && (
                    <span className="default-badge"><HiStar /> Default</span>
                  )}
                </div>
                <div className="card-actions">
                  {!pm.is_default && (
                    <button
                      className="action-btn set-default-btn"
                      onClick={() => handleSetDefault(pm.id)}
                      disabled={actionLoading === pm.id}
                      title="Set as default"
                    >
                      <HiCheck />
                    </button>
                  )}
                  <button
                    className="action-btn delete-btn"
                    onClick={() => handleDelete(pm.id)}
                    disabled={actionLoading === pm.id}
                    title="Remove card"
                  >
                    <HiTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><HiCreditCard /></div>
            <h3>No saved cards</h3>
            <p>Add a card to enable quick payments</p>
          </div>
        )}
      </div>

      {/* Add Card Section */}
      {showAddForm ? (
        <AddCardForm 
          onSuccess={handleCardAdded} 
          onCancel={() => setShowAddForm(false)} 
        />
      ) : (
        <button 
          className="action-button add-card-btn"
          onClick={() => setShowAddForm(true)}
        >
          <HiPlus /> Add New Card
        </button>
      )}

      {/* Test Card Info */}
      <div className="test-cards-info">
        <h4>Test Cards (Stripe Test Mode)</h4>
        <ul>
          <li><strong>4242 4242 4242 4242</strong> - Visa (Success)</li>
          <li><strong>5555 5555 5555 4444</strong> - Mastercard (Success)</li>
          <li><strong>4000 0000 0000 0002</strong> - Declined</li>
        </ul>
        <p>Use any future expiry date and any 3-digit CVC</p>
      </div>
    </div>
  );
}

// Wrapper with Stripe Elements Provider
function PaymentMethods() {
  const [stripePromise, setStripePromise] = useState(null);
  const [stripeConfigured, setStripeConfigured] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initStripe() {
      try {
        const response = await getStripeConfig();
        if (response.success && response.data.is_configured) {
          setStripePromise(loadStripe(response.data.publishable_key));
          setStripeConfigured(true);
        } else {
          setStripeConfigured(false);
        }
      } catch (error) {
        console.error('Error loading Stripe config:', error);
        setStripeConfigured(false);
      } finally {
        setLoading(false);
      }
    }
    initStripe();
  }, []);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!stripeConfigured) {
    return (
      <div className="payment-methods-page">
        <div className="page-header">
          <h1>Payment Methods</h1>
          <p>Manage your saved cards</p>
        </div>
        <div className="stripe-not-configured">
          <HiCreditCard className="big-icon" />
          <h3>Stripe Not Configured</h3>
          <p>Payment functionality requires Stripe API keys to be configured in the backend.</p>
          <p>Please add your Stripe test keys to the <code>.env</code> file:</p>
          <pre>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
          </pre>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <PaymentMethodsContent />
    </Elements>
  );
}

export default PaymentMethods;

