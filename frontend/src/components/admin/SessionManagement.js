import { useEffect, useState } from 'react';
import { getAdminSessions } from '../../services/api';
import './SessionManagement.css';

function SessionManagement() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    async function loadSessions() {
      setLoading(true);
      try {
        const params = {};
        if (statusFilter !== 'ALL') {
          params.status = statusFilter;
        }
        const response = await getAdminSessions(params);
        if (response.success) {
          setSessions(response.data);
        } else {
          setError(response.message || 'Failed to load sessions');
        }
      } catch (err) {
        setError(err.message || 'Failed to load sessions');
      } finally {
        setLoading(false);
      }
    }

    loadSessions();
  }, [statusFilter]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="admin-sessions">
      <div className="page-header">
        <h1>Sessions</h1>
        <p>View all tutoring sessions across the platform.</p>
      </div>

      <div className="admin-filters">
        <div className="filter-group">
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            <option value="pending_tutor">Pending Tutor</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading sessions...</p>
        </div>
      ) : error ? (
        <div className="dashboard-error">
          <p>{error}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty-state-small">
          <p>No sessions found.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Topic</th>
                <th>Student</th>
                <th>Tutor</th>
                <th>Time</th>
                <th>Status</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td className="mono">
                    {String(session.id).slice(0, 8)}…
                  </td>
                  <td>{session.topic}</td>
                  <td>{session.student?.full_name}</td>
                  <td>{session.tutor?.full_name}</td>
                  <td>{formatDate(session.scheduled_time)}</td>
                  <td>
                    <span className={`status-badge ${session.status}`}>
                      {session.status_display}
                    </span>
                  </td>
                  <td>£{Number(session.price || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SessionManagement;

