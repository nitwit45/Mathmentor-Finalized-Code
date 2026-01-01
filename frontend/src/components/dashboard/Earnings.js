import { useState, useEffect } from 'react';
import { getMyProfile, getSessions } from '../../services/api';
import { HiCurrencyPound, HiBookOpen, HiClock } from 'react-icons/hi';
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

        let totalEarnings = 0;
        let completedSessionsList = [];

        if (sessionsRes.success) {
          completedSessionsList = sessionsRes.data.filter(s => s.status === 'completed');
          // Calculate total earnings from completed sessions as fallback
          totalEarnings = completedSessionsList.reduce((sum, session) => {
            return sum + (parseFloat(session.price) || 0);
          }, 0);
        }

        if (profileRes.success) {
          const backendEarnings = parseFloat(profileRes.data.total_earnings) || 0;
          // Use backend value if available and non-zero, otherwise use calculated value
          const finalEarnings = backendEarnings > 0 ? backendEarnings : totalEarnings;
          
          setStats({
            totalEarnings: finalEarnings,
            totalSessions: parseInt(profileRes.data.total_sessions) || completedSessionsList.length,
            totalHours: parseFloat(profileRes.data.total_hours) || 0,
          });
        } else {
          // If profile fetch fails, use calculated values
          setStats({
            totalEarnings: totalEarnings,
            totalSessions: completedSessionsList.length,
            totalHours: 0,
          });
        }

        setCompletedSessions(completedSessionsList);
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
          <div className="stat-icon"><HiCurrencyPound /></div>
          <div className="stat-content">
            <span className="stat-value">£{stats.totalEarnings.toFixed(2)}</span>
            <span className="stat-label">Total Earnings</span>
          </div>
        </div>
        <div className="earnings-stat-card">
          <div className="stat-icon"><HiBookOpen /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalSessions}</span>
            <span className="stat-label">Sessions Completed</span>
          </div>
        </div>
        <div className="earnings-stat-card">
          <div className="stat-icon"><HiClock /></div>
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

