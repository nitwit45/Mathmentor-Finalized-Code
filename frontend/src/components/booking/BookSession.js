import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTutorProfile, createBooking, getChoices } from '../../services/api';
import { HiCheck, HiMail } from 'react-icons/hi';
import TimePicker from '../common/TimePicker';
import './BookSession.css';

function BookSession() {
  const { tutorId } = useParams();
  const navigate = useNavigate();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [choices, setChoices] = useState({ subjects: [] });

  const [formData, setFormData] = useState({
    date: '',
    time: '',
    duration: 60,
    topic: '',
    notes: '',
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [tutorRes, choicesRes] = await Promise.all([
          getTutorProfile(tutorId),
          getChoices(),
        ]);
        
        if (tutorRes.success) {
          setTutor(tutorRes.data);
        }
        
        if (choicesRes.success) {
          setChoices(choicesRes.data);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [tutorId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const calculatePrice = () => {
    if (!tutor) return 0;
    return (tutor.hourly_rate * formData.duration / 60).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.date || !formData.time) {
      setError('Please select a date and time');
      return;
    }
    if (!formData.topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setSubmitting(true);
    try {
      const scheduledTime = new Date(`${formData.date}T${formData.time}`);
      
      const response = await createBooking({
        tutor_id: parseInt(tutorId),
        scheduled_time: scheduledTime.toISOString(),
        duration: formData.duration,
        topic: formData.topic,
        notes: formData.notes,
      });

      if (response.success) {
        setSuccess(true);
        // Redirect to sessions after 3 seconds
        setTimeout(() => {
          navigate('/student/sessions');
        }, 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="error-state">
        <h2>Tutor not found</h2>
        <Link to="/student/find-tutor" className="action-button">
          Back to Search
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="booking-success">
        <div className="success-icon"><HiCheck /></div>
        <h2>Booking Request Sent!</h2>
        <p>Your booking request has been sent to {tutor.user.full_name}.</p>
        <p className="success-note">The tutor will review and accept your request shortly. You'll be notified once confirmed.</p>
        <Link to="/student/sessions" className="action-button">
          View My Sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="book-session-page">
      <Link to={`/student/tutor/${tutorId}`} className="back-link">← Back to Profile</Link>

      <div className="booking-layout">
        <div className="booking-form-section">
          <h1>Book a Session</h1>
          <p className="booking-subtitle">with {tutor.user.full_name}</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Select Date *</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                min={getMinDate()}
                required
              />
            </div>

            <div className="form-group">
              <label>Select Time *</label>
              <TimePicker
                value={formData.time}
                onChange={handleChange}
                placeholder="Choose a time"
              />
            </div>

            <div className="form-group">
              <label>Session Duration</label>
              <select name="duration" value={formData.duration} onChange={handleChange}>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>

            <div className="form-group">
              <label>Topic *</label>
              <select
                name="topic"
                value={formData.topic}
                onChange={handleChange}
                required
              >
                <option value="">Select a topic...</option>
                {choices.subjects.map(subject => (
                  <option key={subject.key} value={subject.key}>
                    {subject.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Additional Notes (Optional)</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any specific questions or topics you'd like to cover..."
                rows={4}
                maxLength={500}
              />
            </div>

            <button type="submit" className="action-button book-btn" disabled={submitting}>
              {submitting ? 'Sending Request...' : 'Send Booking Request'}
            </button>
          </form>
        </div>

        <div className="booking-summary">
          <div className="summary-card">
            <h3>Booking Summary</h3>
            
            <div className="tutor-summary">
              <div className="tutor-avatar">
                {tutor.profile_image_url ? (
                  <img src={tutor.profile_image_url} alt={tutor.user.full_name} />
                ) : (
                  <span>{tutor.user.first_name?.[0]}{tutor.user.last_name?.[0]}</span>
                )}
              </div>
              <div>
                <h4>{tutor.user.full_name}</h4>
                <p>£{tutor.hourly_rate}/hour</p>
              </div>
            </div>

            <div className="summary-details">
              <div className="summary-row">
                <span>Session length</span>
                <span>{formData.duration} minutes</span>
              </div>
              <div className="summary-row">
                <span>Rate</span>
                <span>£{tutor.hourly_rate}/hr</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span>£{calculatePrice()}</span>
              </div>
            </div>

            <div className="payment-info">
              <p><HiMail /> Request sent to tutor for approval</p>
              <p><HiCheck /> Free cancellation anytime before session</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookSession;

