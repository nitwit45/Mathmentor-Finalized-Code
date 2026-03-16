import { useEffect, useState } from 'react';
import { getAdminDashboard, getAdminInstantConfig, updateAdminInstantConfig } from '../../services/api';
import './AdminHome.css';

function AdminHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [instantRate, setInstantRate] = useState('');
  const [instantSaving, setInstantSaving] = useState(false);
  const [instantError, setInstantError] = useState('');
  const [instantSuccess, setInstantSuccess] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [dashboardRes, instantRes] = await Promise.all([
          getAdminDashboard(),
          getAdminInstantConfig().catch(() => null),
        ]);

        if (dashboardRes.success) {
          setData(dashboardRes.data);
        } else {
          setError(dashboardRes.message || 'Failed to load admin dashboard');
        }

        if (instantRes?.success) {
          setInstantRate(String(instantRes.data.hourly_rate));
        }
      } catch (err) {
        setError(err.message || 'Failed to load admin dashboard');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleSaveInstantRate = async (e) => {
    e.preventDefault();
    setInstantError('');
    setInstantSuccess('');

    const value = parseFloat(instantRate);
    if (Number.isNaN(value) || value <= 0) {
      setInstantError('Please enter a valid positive hourly rate.');
      return;
    }

    try {
      setInstantSaving(true);
      const res = await updateAdminInstantConfig({ hourly_rate: value });
      if (res.success) {
        setInstantRate(String(res.data.hourly_rate));
        setInstantSuccess('Instant tutoring rate updated.');
      } else {
        setInstantError(res.message || 'Failed to update rate.');
      }
    } catch (err) {
      setInstantError(err.message || 'Failed to update rate.');
    } finally {
      setInstantSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading admin overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const {
    total_users,
    total_students,
    total_tutors,
    total_parents,
    total_admins,
    total_sessions,
    total_completed_sessions,
    total_cancelled_sessions,
    total_in_progress_sessions,
    total_revenue,
    recent_users,
    recent_sessions,
  } = data;

  return (
    <div className="admin-home">
      <div className="page-header">
        <h1>Admin Overview</h1>
        <p>High-level view of users and sessions across Mathmentor.</p>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <h3>Total Users</h3>
          <p className="stat-value">{total_users}</p>
          <p className="stat-sub">
            {total_students} students · {total_tutors} tutors · {total_parents} parents · {total_admins} admins
          </p>
        </div>
        <div className="admin-stat-card">
          <h3>Total Sessions</h3>
          <p className="stat-value">{total_sessions}</p>
          <p className="stat-sub">
            {total_completed_sessions} completed · {total_in_progress_sessions} active · {total_cancelled_sessions} cancelled
          </p>
        </div>
        <div className="admin-stat-card">
          <h3>Total Revenue</h3>
          <p className="stat-value">£{Number(total_revenue || 0).toFixed(2)}</p>
          <p className="stat-sub">Based on completed & scheduled sessions</p>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-card">
          <div className="card-header">
            <h2>Recent Users</h2>
          </div>
          {recent_users && recent_users.length > 0 ? (
            <ul className="admin-list">
              {recent_users.map(user => (
                <li key={user.id} className="admin-list-item">
                  <div className="admin-list-main">
                    <span className="admin-list-title">{user.full_name}</span>
                    <span className="admin-list-sub">{user.email}</span>
                  </div>
                  <div className="admin-list-meta">
                    <span className={`role-badge role-${(user.role || 'unknown').toLowerCase()}`}>
                      {user.role || 'UNKNOWN'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state-small">
              <p>No recent users.</p>
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="card-header">
            <h2>Recent Sessions</h2>
          </div>
          {recent_sessions && recent_sessions.length > 0 ? (
            <ul className="admin-list">
              {recent_sessions.map(session => (
                <li key={session.id} className="admin-list-item">
                  <div className="admin-list-main">
                    <span className="admin-list-title">{session.topic}</span>
                    <span className="admin-list-sub">
                      {session.student?.full_name} → {session.tutor?.full_name}
                    </span>
                  </div>
                  <div className="admin-list-meta">
                    <span className={`status-badge ${session.status}`}>
                      {session.status_display}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state-small">
              <p>No recent sessions.</p>
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="card-header">
            <h2>Instant Tutoring Pricing</h2>
          </div>
          <form onSubmit={handleSaveInstantRate} className="instant-config-form">
            <label>
              Hourly rate (GBP)
              <input
                type="number"
                step="0.5"
                min="1"
                value={instantRate}
                onChange={(e) => setInstantRate(e.target.value)}
              />
            </label>
            <button type="submit" disabled={instantSaving}>
              {instantSaving ? 'Saving...' : 'Save'}
            </button>
            {instantError && <p className="instant-error">{instantError}</p>}
            {instantSuccess && <p className="instant-success">{instantSuccess}</p>}
            <p className="instant-help-text">
              This rate is used for all instant (Uber-style) sessions. Regular scheduled sessions still use each tutor&apos;s own hourly rate.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminHome;

