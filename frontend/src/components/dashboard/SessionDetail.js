import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast, TOAST_TYPES } from '../../contexts/ToastContext';
import { getSession, cancelSession, completeSession, reviewSession, getJaasToken } from '../../services/api';
import VideoRoom from '../video/VideoRoom';
import { HiStar, HiVideoCamera } from 'react-icons/hi';
import './SessionDetail.css';

function SessionDetail() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const { showToast, showConfirm } = useToast();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [jaasConfig, setJaasConfig] = useState(null);
  const [joiningVideo, setJoiningVideo] = useState(false);

  const basePath = user?.role === 'TUTOR' ? '/tutor' : '/student';

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await getSession(sessionId);
        if (response.success) {
          setSession(response.data);
        } else {
          setError('Session not found');
        }
      } catch (err) {
        setError('Failed to load session');
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [sessionId]);

  const handleCancel = async () => {
    const confirmed = await showConfirm('Are you sure you want to cancel this session?');

    if (!confirmed) return;

    try {
      const response = await cancelSession(sessionId);
      if (response.success) {
        setSession(prev => ({ ...prev, status: 'cancelled', status_display: 'Cancelled' }));
        showToast('Session cancelled successfully', TOAST_TYPES.SUCCESS);
      }
    } catch (err) {
      showToast('Failed to cancel session', TOAST_TYPES.ERROR);
    }
  };

  const handleComplete = async () => {
    try {
      const response = await completeSession(sessionId);
      if (response.success) {
        setSession(prev => ({ ...prev, status: 'completed', status_display: 'Completed' }));
        showToast('Session completed successfully', TOAST_TYPES.SUCCESS);
      }
    } catch (err) {
      showToast('Failed to complete session', TOAST_TYPES.ERROR);
    }
  };

  const handleJoinSession = async () => {
    setJoiningVideo(true);
    try {
      const response = await getJaasToken(sessionId);
      if (response.success) {
        setJaasConfig(response.data);
        setShowVideo(true);
      } else {
        showToast(response.message || 'Unable to join session', TOAST_TYPES.ERROR);
      }
    } catch (err) {
      showToast('Failed to start video session. Please try again.', TOAST_TYPES.ERROR);
    } finally {
      setJoiningVideo(false);
    }
  };

  const handleVideoClose = () => {
    setShowVideo(false);
    setJaasConfig(null);
    // Refresh session data to get updated status
    getSession(sessionId).then(response => {
      if (response.success) {
        setSession(response.data);
      }
    });
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await reviewSession(sessionId, review);
      if (response.success) {
        setShowReviewForm(false);
        showToast('Review submitted successfully!', TOAST_TYPES.SUCCESS);
      }
    } catch (err) {
      showToast('Failed to submit review', TOAST_TYPES.ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <h2>{error}</h2>
        <Link to={`${basePath}/sessions`} className="action-button">
          Back to Sessions
        </Link>
      </div>
    );
  }

  const otherUser = user?.role === 'TUTOR' ? session.student : session.tutor;

  // Show embedded video room when active
  if (showVideo && jaasConfig) {
    return (
      <VideoRoom
        jwt={jaasConfig.jwt}
        roomName={jaasConfig.room_name}
        appId={jaasConfig.app_id}
        domain={jaasConfig.domain}
        userInfo={jaasConfig.user_info}
        sessionInfo={jaasConfig.session_info}
        onClose={handleVideoClose}
      />
    );
  }

  return (
    <div className="session-detail-page">
      <Link to={`${basePath}/sessions`} className="back-link">← Back to Sessions</Link>

      <div className="session-detail-card">
        <div className="session-detail-header">
          <div>
            <h1>{session.topic}</h1>
            <p className="session-with">with {otherUser.full_name}</p>
          </div>
          <span className={`status-badge large ${session.status}`}>
            {session.status_display}
          </span>
        </div>

        <div className="session-info-grid">
          <div className="info-item">
            <span className="info-label">Date & Time</span>
            <span className="info-value">{formatDateTime(session.scheduled_time)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Duration</span>
            <span className="info-value">{session.duration} minutes</span>
          </div>
          <div className="info-item">
            <span className="info-label">Price</span>
            <span className="info-value price">£{session.price}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Session Type</span>
            <span className="info-value">{session.is_instant ? 'Instant Session' : 'Scheduled'}</span>
          </div>
        </div>

        {session.notes && (
          <div className="session-notes-section">
            <h3>Notes</h3>
            <p>{session.notes}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="session-actions">
          {session.can_join && (
            <button
              onClick={handleJoinSession}
              disabled={joiningVideo}
              className="action-button join-btn large"
            >
              {joiningVideo ? 'Connecting...' : <><HiVideoCamera /> Join Video Session</>}
            </button>
          )}

          {session.status === 'scheduled' && (
            <button onClick={handleCancel} className="action-button secondary cancel-btn">
              Cancel Session
            </button>
          )}

          {/* {session.status === 'in_progress' && user?.role === 'TUTOR' && (
            <button onClick={handleComplete} className="action-button">
              ✓ Mark as Complete
            </button>
          )} */}

          {session.status === 'completed' && user?.role === 'STUDENT' && !showReviewForm && (
            <button onClick={() => setShowReviewForm(true)} className="action-button">
              <HiStar /> Leave a Review
            </button>
          )}
        </div>

        {/* Review form */}
        {showReviewForm && (
          <form onSubmit={handleSubmitReview} className="review-form">
            <h3>Leave a Review</h3>
            <div className="form-group">
              <label>Rating</label>
              <div className="rating-select">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${review.rating >= star ? 'active' : ''}`}
                    onClick={() => setReview(prev => ({ ...prev, rating: star }))}
                  >
                    <HiStar />
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Comment (optional)</label>
              <textarea
                value={review.comment}
                onChange={(e) => setReview(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Share your experience..."
                rows={4}
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowReviewForm(false)} className="action-button secondary">
                Cancel
              </button>
              <button type="submit" className="action-button" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default SessionDetail;

