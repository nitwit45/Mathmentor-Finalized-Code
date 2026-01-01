import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getSessions, updateSessionStatus, completeSession, endSession } from '../../services/api';
import { HiInbox, HiCalendar, HiBookOpen, HiCheck, HiX, HiFlag, HiCreditCard } from 'react-icons/hi';
import PaymentModal from './PaymentModal';
import './MySessions.css';

function MySessions() {
  const { user } = useAuth();
  const { showConfirm, showSuccess } = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(user?.role === 'TUTOR' ? 'pending' : 'upcoming');
  const [actionLoading, setActionLoading] = useState(null);
  const [paymentSession, setPaymentSession] = useState(null);
  const basePath = user?.role === 'TUTOR' ? '/tutor' : '/student';

  useEffect(() => {
    loadSessions();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSessions() {
    setLoading(true);
    try {
      const params = activeTab === 'pending' 
        ? { status: 'pending_tutor' }
        : { time: activeTab };
      const response = await getSessions(params);
      if (response.success) {
        setSessions(response.data);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleAccept = async (e, sessionId) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoading(sessionId);
    try {
      const response = await updateSessionStatus(sessionId, 'confirmed');
      if (response.success) {
        // Reload sessions
        loadSessions();
      }
    } catch (error) {
      console.error('Error accepting session:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (e, sessionId) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = await showConfirm('Are you sure you want to decline this booking request?');
    if (!confirmed) return;

    setActionLoading(sessionId);
    try {
      const response = await updateSessionStatus(sessionId, 'cancelled');
      if (response.success) {
        loadSessions();
      }
    } catch (error) {
      console.error('Error declining session:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (e, sessionId) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = await showConfirm('Mark this session as completed?');
    if (!confirmed) return;

    setActionLoading(sessionId);
    try {
      const response = await completeSession(sessionId);
      if (response.success) {
        loadSessions();
      }
    } catch (error) {
      console.error('Error completing session:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndSession = async (e, sessionId, status) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmMessage = status === 'in_progress'
      ? 'Mark this session as completed?'
      : 'Are you sure you want to end this session?';

    const confirmed = await showConfirm(confirmMessage);
    if (!confirmed) return;

    setActionLoading(sessionId);
    try {
      const response = await endSession(sessionId);
      if (response.success) {
        loadSessions();
      }
    } catch (error) {
      console.error('Error ending session:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePayNow = (e, session) => {
    e.preventDefault();
    e.stopPropagation();
    setPaymentSession(session);
  };

  const handlePaymentSuccess = (message) => {
    setPaymentSession(null);
    showSuccess(message);
    loadSessions();
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="my-sessions-page">
      <div className="page-header">
        <h1>My Sessions</h1>
        <p>View and manage your tutoring sessions</p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {user?.role === 'TUTOR' && (
          <button
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <HiInbox /> Pending Requests
          </button>
        )}
        <button
          className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <HiCalendar /> Upcoming
        </button>
        <button
          className={`tab ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <HiBookOpen /> Past Sessions
        </button>
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading sessions...</p>
        </div>
      ) : sessions.length > 0 ? (
        <div className="sessions-list-full">
          {sessions.map(session => (
            <Link 
              key={session.id} 
              to={`${basePath}/sessions/${session.id}`}
              className="session-card"
            >
              <div className="session-date-column">
                <div className="session-date">{formatDate(session.scheduled_time)}</div>
                <div className="session-time">{formatTime(session.scheduled_time)}</div>
                <div className="session-duration">{session.duration} min</div>
              </div>

              <div className="session-details">
                <h3>{session.topic}</h3>
                <p className="session-with">
                  with {user?.role === 'TUTOR' 
                    ? session.student.full_name 
                    : session.tutor.full_name
                  }
                </p>
                {session.notes && (
                  <p className="session-notes">{session.notes.substring(0, 100)}...</p>
                )}
              </div>

              <div className="session-meta">
                <span className={`status-badge ${session.status}`}>
                  {session.status_display}
                </span>
                <span className="session-price">£{session.price}</span>
                
                {/* Tutor accept/decline buttons for pending sessions */}
                {user?.role === 'TUTOR' && session.status === 'pending_tutor' && (
                  <div className="session-actions-inline">
                    <button
                      className="action-button accept-btn"
                      onClick={(e) => handleAccept(e, session.id)}
                      disabled={actionLoading === session.id}
                    >
                      {actionLoading === session.id ? '...' : <><HiCheck /> Accept</>}
                    </button>
                    <button
                      className="action-button decline-btn"
                      onClick={(e) => handleDecline(e, session.id)}
                      disabled={actionLoading === session.id}
                    >
                      <HiX /> Decline
                    </button>
                  </div>
                )}
                
                {/* Student Pay Now button for confirmed sessions */}
                {user?.role === 'STUDENT' && session.status === 'confirmed' && (
                  <div className="session-actions-inline">
                    <button
                      className="action-button pay-btn"
                      onClick={(e) => handlePayNow(e, session)}
                    >
                      <HiCreditCard /> Pay Now
                    </button>
                  </div>
                )}
                
                {session.can_join && session.meeting_link && (
                  <div className="session-actions-inline">
                    <button
                      className="action-button join-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(session.meeting_link, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Join Now
                    </button>

                    {/* Tutor can complete in-progress sessions */}
                    {user?.role === 'TUTOR' && session.status === 'in_progress' && (
                      <button
                        className="action-button complete-btn"
                        onClick={(e) => handleComplete(e, session.id)}
                        disabled={actionLoading === session.id}
                      >
                        {actionLoading === session.id ? '...' : <><HiCheck /> Complete</>}
                      </button>
                    )}
                  </div>
                )}

              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            {activeTab === 'pending' ? <HiInbox /> : activeTab === 'upcoming' ? <HiCalendar /> : <HiBookOpen />}
          </div>
          <h3>
            {activeTab === 'pending'
              ? 'No pending requests'
              : `No ${activeTab} sessions`
            }
          </h3>
          <p>
            {activeTab === 'pending'
              ? 'New booking requests from students will appear here'
              : activeTab === 'upcoming' 
                ? user?.role === 'TUTOR'
                  ? 'Confirmed sessions will appear here'
                  : 'Find a tutor and book your first session'
                : 'Your completed sessions will appear here'
            }
          </p>
          {activeTab === 'upcoming' && user?.role === 'STUDENT' && (
            <Link to="/student/find-tutor" className="action-button">
              Find a Tutor
            </Link>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {paymentSession && (
        <PaymentModal
          session={paymentSession}
          onClose={() => setPaymentSession(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

export default MySessions;

