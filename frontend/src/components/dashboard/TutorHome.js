import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getSessions, getMyProfile } from '../../services/api';
import './DashboardHome.css';

function TutorHome() {
  const { user } = useAuth();
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalEarnings: 0,
    averageRating: 0,
    totalReviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [sessionsRes, profileRes] = await Promise.all([
          getSessions({ time: 'upcoming' }),
          getMyProfile(),
        ]);

        if (sessionsRes.success) {
          setUpcomingSessions(sessionsRes.data.slice(0, 5));
        }
        if (profileRes.success) {
          const profile = profileRes.data;
          setStats({
            totalSessions: parseInt(profile.total_sessions) || 0,
            totalEarnings: parseFloat(profile.total_earnings) || 0,
            averageRating: parseFloat(profile.average_rating) || 0,
            totalReviews: parseInt(profile.total_reviews) || 0,
          });
          setIsAvailable(profile.is_available_for_instant || false);
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
        <p>Here's your tutoring overview</p>
      </div>

      {/* Stats cards */}
      <div className="stats-grid">
        <div className="stat-card dashboard-card">
          <div className="stat-icon">📚</div>
          <div className="stat-value">{stats.totalSessions}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
        <div className="stat-card dashboard-card">
          <div className="stat-icon">💷</div>
          <div className="stat-value">£{stats.totalEarnings.toFixed(0)}</div>
          <div className="stat-label">Total Earnings</div>
        </div>
        <div className="stat-card dashboard-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{stats.averageRating.toFixed(1)}</div>
          <div className="stat-label">{stats.totalReviews} Reviews</div>
        </div>
        <div className="stat-card dashboard-card">
          <div className={`stat-icon ${isAvailable ? 'available' : ''}`}>
            {isAvailable ? '🟢' : '🔴'}
          </div>
          <div className="stat-value">{isAvailable ? 'Online' : 'Offline'}</div>
          <div className="stat-label">Instant Availability</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="quick-actions">
        <Link to="/tutor/requests" className="quick-action-card highlight">
          <span className="action-icon">⚡</span>
          <div>
            <h3>Instant Requests</h3>
            <p>View student requests</p>
          </div>
        </Link>
        <Link to="/tutor/sessions" className="quick-action-card">
          <span className="action-icon">📅</span>
          <div>
            <h3>Session Requests</h3>
            <p>Accept pending bookings</p>
          </div>
        </Link>
        <Link to="/tutor/messages" className="quick-action-card">
          <span className="action-icon">💬</span>
          <div>
            <h3>Messages</h3>
            <p>Chat with students</p>
          </div>
        </Link>
      </div>

      {/* Today's schedule */}
      <div className="dashboard-card">
        <div className="card-header">
          <h2>Upcoming Sessions</h2>
          <Link to="/tutor/sessions" className="view-all-link">View all →</Link>
        </div>
        {upcomingSessions.length > 0 ? (
          <div className="sessions-list">
            {upcomingSessions.map(session => (
              <Link 
                key={session.id} 
                to={`/tutor/sessions/${session.id}`}
                className="session-item"
              >
                <div className="session-info">
                  <h4>{session.topic}</h4>
                  <p>with {session.student.full_name}</p>
                  <span className="session-time">{formatDate(session.scheduled_time)}</span>
                </div>
                <div className="session-actions">
                  <span className={`status-badge ${session.status}`}>
                    {session.status_display}
                  </span>
                  {session.can_join && (
                    <a 
                      href={session.meeting_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="action-button"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Join Session
                    </a>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state-small">
            <p>No upcoming sessions scheduled</p>
            <p className="muted">Students can book sessions through your profile</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TutorHome;

