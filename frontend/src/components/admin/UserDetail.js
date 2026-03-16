import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAdminUser, updateAdminUser } from '../../services/api';
import './UserDetail.css';

function UserDetail() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await getAdminUser(userId);
        if (response.success) {
          setUser(response.data);
        } else {
          setError(response.message || 'Failed to load user');
        }
      } catch (err) {
        setError(err.message || 'Failed to load user');
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [userId]);

  const handleToggleActive = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const response = await updateAdminUser(user.id, {
        is_active: !user.is_active,
      });
      if (response) {
        // Backend returns the updated user object
        setUser(response);
      }
    } catch (err) {
      console.error('Failed to update user', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading user...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="dashboard-error">
        <p>{error || 'User not found.'}</p>
      </div>
    );
  }

  return (
    <div className="admin-user-detail">
      <div className="page-header">
        <h1>{user.full_name}</h1>
        <p>{user.email}</p>
      </div>

      <div className="admin-user-grid">
        <div className="admin-card">
          <h2>Account</h2>
          <div className="detail-row">
            <span className="detail-label">Role</span>
            <span className="detail-value">
              <span className={`role-badge role-${(user.role || 'unknown').toLowerCase()}`}>
                {user.role || 'UNKNOWN'}
              </span>
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status</span>
            <span className="detail-value">
              <span className={`status-pill ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Email Verified</span>
            <span className="detail-value">
              {user.is_email_verified ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Created</span>
            <span className="detail-value">
              {new Date(user.created_at).toLocaleString()}
            </span>
          </div>
          {user.last_login && (
            <div className="detail-row">
              <span className="detail-label">Last Login</span>
              <span className="detail-value">
                {new Date(user.last_login).toLocaleString()}
              </span>
            </div>
          )}
          <div className="admin-actions">
            <button
              className="primary-button"
              onClick={handleToggleActive}
              disabled={saving}
            >
              {user.is_active ? 'Deactivate User' : 'Activate User'}
            </button>
          </div>
        </div>

        <div className="admin-card">
          <h2>Session Stats</h2>
          <div className="detail-row">
            <span className="detail-label">Sessions as Tutor</span>
            <span className="detail-value">
              {user.total_tutor_sessions ?? 0}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Sessions as Student</span>
            <span className="detail-value">
              {user.total_student_sessions ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserDetail;

