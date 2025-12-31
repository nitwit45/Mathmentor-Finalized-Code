import { useState, useRef, useEffect } from 'react';
import { verifyEmail, resendVerificationCode } from '../services/api';
import './Login.css';
import './EmailVerification.css';

function EmailVerification({ email, onNavigate, onVerificationSuccess }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');
    setResendSuccess(false);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const newCode = pastedData.split('');
      setCode(newCode);
      // Focus last input
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResendSuccess(false);

    const codeString = code.join('');
    if (codeString.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await verifyEmail(email, codeString);
      if (response.success) {
        if (onVerificationSuccess) {
          onVerificationSuccess(response.data);
        } else {
          onNavigate('login');
        }
      }
    } catch (err) {
      setError(err.message || 'Invalid verification code. Please try again.');
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setResendSuccess(false);
    try {
      const response = await resendVerificationCode(email);
      if (response.success) {
        setResendSuccess(true);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError(err.message || 'Failed to resend verification code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="split-container">
      <div 
        className="split-left"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/welcome_background.svg)`
        }}
      ></div>
      <div className="split-right">
        <div className="auth-container">
          <div className="auth-card">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="back-button"
              aria-label="Go back"
            >
              ← Back
            </button>
            <h1>Verify Your Email</h1>
            <p className="auth-subtitle">
              We've sent a 6-digit code to <strong>{email}</strong>
            </p>
            
            {error && <div className="error-message">{error}</div>}
            {resendSuccess && (
              <div className="success-message">
                Verification code sent! Please check your email.
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="verification-code-inputs">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className="code-input"
                    disabled={loading}
                    required
                  />
                ))}
              </div>
              
              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>
            </form>
            
            <div className="resend-section">
              <p className="resend-text">Didn't receive the code?</p>
              <button
                type="button"
                onClick={handleResend}
                className="resend-button"
                disabled={resending || loading}
              >
                {resending ? 'Sending...' : 'Resend Code'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailVerification;

