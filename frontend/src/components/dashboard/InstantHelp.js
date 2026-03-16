import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getChoices, getInstantConfig, createInstantWebSocket } from '../../services/api';
import { HiLightningBolt, HiSearch, HiSparkles, HiVideoCamera, HiCreditCard } from 'react-icons/hi';
import './InstantHelp.css';

function InstantHelp() {
  const navigate = useNavigate();
  const [choices, setChoices] = useState({ subjects: [], grades: [] });
  const [formData, setFormData] = useState({
    subject: '',
    grade: '',
    topic: '',
  });
  const [status, setStatus] = useState('idle'); // idle, searching, matched, payment_failed
  const [matchedSession, setMatchedSession] = useState(null);
  const [error, setError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [instantRate, setInstantRate] = useState(null);
  const wsRef = useRef(null);
  const requestIdRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [choicesRes, configRes] = await Promise.all([
          getChoices(),
          getInstantConfig().catch(() => null),
        ]);

        if (choicesRes?.success) {
          setChoices(choicesRes.data);
        }

        if (configRes?.success) {
          setInstantRate(configRes.data.hourly_rate);
        }
      } catch (err) {
        // Ignore and let UI work without pricing info
      }
    }

    loadData();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    return new Promise((resolve, reject) => {
      try {
        const ws = createInstantWebSocket();

        ws.onopen = () => {
          resolve(ws);
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.type === 'request_created') {
            requestIdRef.current = data.request_id;
          } else if (data.type === 'match_found') {
            setStatus('matched');
            setMatchedSession(data.session);
          } else if (data.type === 'payment_failed') {
            setStatus('payment_failed');
            setPaymentError(data.message || 'Payment failed. Please update your payment method and try again.');
            if (wsRef.current) wsRef.current.close();
          } else if (data.type === 'request_cancelled') {
            setStatus('idle');
          }
        };

        ws.onerror = (error) => {
          reject(error);
        };

        ws.onclose = () => {
          // Handle connection close
        };

        wsRef.current = ws;
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.subject || !formData.grade) {
      setError('Please select a subject and grade level');
      return;
    }

    setStatus('searching');

    try {
      const ws = await connectWebSocket();

      // Send request
      ws.send(JSON.stringify({
        action: 'request_tutor',
        subject: formData.subject,
        grade: formData.grade,
        topic: formData.topic,
      }));

      // Set timeout for request expiration
      setTimeout(() => {
        if (status === 'searching') {
          setStatus('idle');
          setError('No tutors available at the moment. Please try again later.');
          if (wsRef.current) {
            wsRef.current.close();
          }
        }
      }, 5 * 60 * 1000); // 5 minutes

    } catch (error) {
      setStatus('idle');
      setError('Failed to connect. Please try again.');
    }
  };

  const handleCancel = () => {
    if (wsRef.current && requestIdRef.current) {
      wsRef.current.send(JSON.stringify({
        action: 'cancel_request',
        request_id: requestIdRef.current,
      }));
    }
    setStatus('idle');
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const handleJoinSession = () => {
    if (matchedSession?.id) {
      navigate(`/student/sessions/${matchedSession.id}`);
    }
  };

  const handleRetryAfterPaymentFailure = () => {
    setStatus('idle');
    setPaymentError('');
    setError('');
  };

  return (
    <div className="instant-help-page">
      <div className="page-header">
        <h1><HiLightningBolt /> Get Instant Help</h1>
        <p>Connect with an available tutor right now</p>
      </div>

      {status === 'idle' && (
        <div className="instant-form-card">
          <form onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}

            {instantRate && (
              <div className="instant-pricing-note">
                <p>
                  Instant sessions are charged at <strong>£{Number(instantRate).toFixed(2)}</strong> per hour.
                </p>
              </div>
            )}

            <div className="form-group">
              <label>What subject do you need help with? *</label>
              <select
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                required
              >
                <option value="">Select a subject...</option>
                {choices.subjects.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>What grade level? *</label>
              <select
                value={formData.grade}
                onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
                required
              >
                <option value="">Select your grade...</option>
                {choices.grades.map(g => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>What topic do you need help with? (Optional)</label>
              <textarea
                value={formData.topic}
                onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                placeholder="e.g., Solving quadratic equations, Understanding derivatives..."
                rows={3}
              />
            </div>

            <button type="submit" className="action-button instant-btn">
              <HiLightningBolt /> Find Available Tutor Now
            </button>
          </form>

          <div className="instant-info">
            <h3>How it works</h3>
            <ol>
              <li>Select your subject and grade level</li>
              <li>We'll notify available tutors matching your needs</li>
              <li>When a tutor accepts, you'll be connected instantly via video call</li>
            </ol>
          </div>
        </div>
      )}

      {status === 'searching' && (
        <div className="searching-state">
          <div className="searching-animation">
            <div className="pulse-ring"></div>
            <div className="pulse-ring delay"></div>
            <span className="search-icon"><HiSearch /></span>
          </div>
          <h2>Searching for available tutors...</h2>
          <p>We're notifying tutors who teach {formData.subject} at {formData.grade} level</p>
          <p className="muted">This may take up to 5 minutes</p>
          <button onClick={handleCancel} className="action-button secondary">
            Cancel Request
          </button>
        </div>
      )}

      {status === 'matched' && matchedSession && (
        <div className="matched-state">
          <div className="match-success">
            <span className="success-icon"><HiSparkles /></span>
            <h2>Tutor Found!</h2>
            <p>A tutor has accepted your request</p>
          </div>

          <div className="session-info-card">
            <h3>Your Session</h3>
            <p><strong>Topic:</strong> {matchedSession.topic}</p>
          </div>

          <button onClick={handleJoinSession} className="action-button join-btn large">
            <HiVideoCamera /> Join Video Session Now
          </button>
        </div>
      )}

      {status === 'payment_failed' && (
        <div className="payment-failed-state">
          <div className="payment-failed-icon">
            <HiCreditCard />
          </div>
          <h2>Payment Failed</h2>
          <p className="payment-failed-message">{paymentError}</p>
          <div className="payment-failed-actions">
            <Link to="/student/payment-methods" className="action-button">
              <HiCreditCard /> Update Payment Method
            </Link>
            <button onClick={handleRetryAfterPaymentFailure} className="action-button secondary">
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstantHelp;

