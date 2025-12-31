import { useState, useEffect } from 'react';
import { getMyProfile, getSessions } from '../../services/api';
import './Earnings.css';

function Earnings() {
  const [stats, setStats] = useState({
    totalEarnings: 0,
    totalSessions: 0,
    totalHours: 0,
  });
  const [completedSessions, setCompletedSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, sessionsRes] = await Promise.all([
          getMyProfile(),
          getSessions({ time: 'past', status: 'completed' }),
        ]);

        if (profileRes.success) {
          setStats({
            totalEarnings: parseFloat(profileRes.data.total_earnings) || 0,
            totalSessions: parseInt(profileRes.data.total_sessions) || 0,
            totalHours: parseFloat(profileRes.data.total_hours) || 0,
          });
        }

        if (sessionsRes.success) {
          setCompletedSessions(sessionsRes.data.filter(s => s.status === 'completed'));
        }
      } catch (error) {
        console.error('Error loading earnings:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading earnings...</p>
      </div>
    );
  }

  return (
    <div className="earnings-page">
      <div className="page-header">
        <h1>Earnings</h1>
        <p>Track your tutoring income</p>
      </div>

      {/* Stats cards */}
      <div className="earnings-stats">
        <div className="earnings-stat-card">
          <div className="stat-icon">💷</div>
          <div className="stat-content">
            <span className="stat-value">£{stats.totalEarnings.toFixed(2)}</span>
            <span className="stat-label">Total Earnings</span>
          </div>
        </div>
        <div className="earnings-stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalSessions}</span>
            <span className="stat-label">Sessions Completed</span>
          </div>
        </div>
        <div className="earnings-stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalHours.toFixed(1)}</span>
            <span className="stat-label">Hours Tutored</span>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="transactions-section">
        <h2>Session History</h2>
        
        {completedSessions.length > 0 ? (
          <div className="transactions-list">
            {completedSessions.map(session => (
              <div key={session.id} className="transaction-item">
                <div className="transaction-info">
                  <h4>{session.topic}</h4>
                  <p>with {session.student.full_name}</p>
                  <span className="transaction-date">{formatDate(session.scheduled_time)}</span>
                </div>
                <div className="transaction-amount">
                  +£{session.price}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state-small">
            <p>No completed sessions yet</p>
            <p className="muted">Your earnings from completed sessions will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Earnings;

