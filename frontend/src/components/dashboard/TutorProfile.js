import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTutorProfile, startConversation } from '../../services/api';
import './TutorProfile.css';

function TutorProfile() {
  const { tutorId } = useParams();
  const navigate = useNavigate();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTutor() {
      try {
        const response = await getTutorProfile(tutorId);
        if (response.success) {
          setTutor(response.data);
        } else {
          setError('Tutor not found');
        }
      } catch (err) {
        setError('Failed to load tutor profile');
      } finally {
        setLoading(false);
      }
    }

    loadTutor();
  }, [tutorId]);

  const handleMessage = async () => {
    try {
      const response = await startConversation(tutor.user.id);
      if (response.success) {
        navigate(`/student/messages/${response.data.id}`);
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <h2>{error}</h2>
        <Link to="/student/find-tutor" className="action-button">
          Back to Search
        </Link>
      </div>
    );
  }

  return (
    <div className="tutor-profile-page">
      <Link to="/student/find-tutor" className="back-link">← Back to Search</Link>

      <div className="profile-layout">
        {/* Main profile */}
        <div className="profile-main">
          <div className="profile-header">
            <div className="profile-avatar">
              {tutor.profile_image_url ? (
                <img src={tutor.profile_image_url} alt={tutor.user.full_name} />
              ) : (
                <span>{tutor.user.first_name?.[0]}{tutor.user.last_name?.[0]}</span>
              )}
            </div>
            <div className="profile-info">
              <h1>{tutor.user.full_name}</h1>
              <div className="profile-rating">
                {parseFloat(tutor.average_rating) > 0 ? (
                  <>
                    <span className="stars">{'⭐'.repeat(Math.round(parseFloat(tutor.average_rating)))}</span>
                    <span className="rating-value">{parseFloat(tutor.average_rating).toFixed(1)}</span>
                    <span className="review-count">({tutor.total_reviews} reviews)</span>
                  </>
                ) : (
                  <span className="no-reviews">New Tutor</span>
                )}
              </div>
              <div className="profile-stats">
                <span>📚 {tutor.total_sessions} sessions completed</span>
                {tutor.is_available_for_instant && (
                  <span className="available-badge">🟢 Available for Instant Tutoring</span>
                )}
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h2>About</h2>
            <p>{tutor.bio}</p>
          </div>

          <div className="profile-section">
            <h2>Subjects</h2>
            <div className="tags-list">
              {tutor.subjects_display?.map(s => (
                <span key={s.key} className="tag">{s.label}</span>
              ))}
            </div>
          </div>

          <div className="profile-section">
            <h2>Grade Levels</h2>
            <div className="tags-list">
              {tutor.grades_display?.map(g => (
                <span key={g.key} className="tag">{g.label}</span>
              ))}
            </div>
          </div>

          {tutor.qualifications && (
            <div className="profile-section">
              <h2>Qualifications</h2>
              <p>{tutor.qualifications}</p>
            </div>
          )}

          {/* Reviews section */}
          {tutor.reviews?.length > 0 && (
            <div className="profile-section">
              <h2>Reviews</h2>
              <div className="reviews-list">
                {tutor.reviews.map(review => (
                  <div key={review.id} className="review-item">
                    <div className="review-header">
                      <span className="review-rating">
                        {'⭐'.repeat(review.rating)}
                      </span>
                      <span className="review-author">{review.student_name}</span>
                      <span className="review-date">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="review-comment">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="profile-sidebar">
          <div className="booking-card">
            <div className="price-display">
              <span className="price-amount">£{tutor.hourly_rate}</span>
              <span className="price-period">/hour</span>
            </div>

            <div className="booking-actions">
              <Link to={`/student/tutor/${tutorId}/book`} className="action-button book-btn">
                📅 Book a Session
              </Link>
              <button onClick={handleMessage} className="action-button secondary">
                💬 Send Message
              </button>
              {tutor.is_available_for_instant && (
                <Link to="/student/instant" className="action-button instant-btn">
                  ⚡ Request Instant Session
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TutorProfile;

