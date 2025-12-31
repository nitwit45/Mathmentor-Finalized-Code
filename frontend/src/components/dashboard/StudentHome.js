import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getSessions, searchTutors } from '../../services/api';
import './DashboardHome.css';

function StudentHome() {
  const { user } = useAuth();
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [recommendedTutors, setRecommendedTutors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [sessionsRes, tutorsRes] = await Promise.all([
          getSessions({ time: 'upcoming' }),
          searchTutors({ page_size: 4 }),
        ]);

        if (sessionsRes.success) {
          setUpcomingSessions(sessionsRes.data.slice(0, 3));
        }
        if (tutorsRes.success) {
          setRecommendedTutors(tutorsRes.data.results || []);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-home">
      <div className="page-header">
        <h1>Welcome back, {user?.first_name}!</h1>
        <p>Ready to learn something new today?</p>
      </div>

      {/* Quick actions */}
      <div className="quick-actions">
        <Link to="/student/find-tutor" className="quick-action-card">
          <span className="action-icon">🔍</span>
          <div>
            <h3>Find a Tutor</h3>
            <p>Browse and filter tutors</p>
          </div>
        </Link>
        <Link to="/student/instant" className="quick-action-card highlight">
          <span className="action-icon">⚡</span>
          <div>
            <h3>Get Instant Help</h3>
            <p>Connect with a tutor now</p>
          </div>
        </Link>
        <Link to="/student/messages" className="quick-action-card">
          <span className="action-icon">💬</span>
          <div>
            <h3>Messages</h3>
            <p>Chat with your tutors</p>
          </div>
        </Link>
      </div>

      <div className="dashboard-grid">
        {/* Upcoming sessions */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Upcoming Sessions</h2>
            <Link to="/student/sessions" className="view-all-link">View all →</Link>
          </div>
          {upcomingSessions.length > 0 ? (
            <div className="sessions-list">
              {upcomingSessions.map(session => (
                <Link 
                  key={session.id} 
                  to={`/student/sessions/${session.id}`}
                  className="session-item"
                >
                  <div className="session-info">
                    <h4>{session.topic}</h4>
                    <p>with {session.tutor.full_name}</p>
                    <span className="session-time">{formatDate(session.scheduled_time)}</span>
                  </div>
                  <span className={`status-badge ${session.status}`}>
                    {session.status_display}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state-small">
              <p>No upcoming sessions</p>
              <Link to="/student/find-tutor" className="action-button">
                Book a Session
              </Link>
            </div>
          )}
        </div>

        {/* Recommended tutors */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Recommended Tutors</h2>
            <Link to="/student/find-tutor" className="view-all-link">View all →</Link>
          </div>
          {recommendedTutors.length > 0 ? (
            <div className="tutors-list">
              {recommendedTutors.map(tutor => (
                <Link 
                  key={tutor.id} 
                  to={`/student/tutor/${tutor.id}`}
                  className="tutor-item"
                >
                  <div className="tutor-avatar">
                    {tutor.profile_image_url ? (
                      <img src={tutor.profile_image_url} alt={tutor.user.full_name} />
                    ) : (
                      <span>{tutor.user.first_name?.[0]}{tutor.user.last_name?.[0]}</span>
                    )}
                  </div>
                  <div className="tutor-info">
                    <h4>{tutor.user.full_name}</h4>
                    <p>{tutor.subjects_display?.slice(0, 2).map(s => s.label).join(', ')}</p>
                    <div className="tutor-meta">
                      <span className="tutor-rate">£{tutor.hourly_rate}/hr</span>
                      {parseFloat(tutor.average_rating) > 0 && (
                        <span className="tutor-rating">⭐ {parseFloat(tutor.average_rating).toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                  {tutor.is_available_for_instant && (
                    <span className="available-badge">Available Now</span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state-small">
              <p>No tutors found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentHome;

