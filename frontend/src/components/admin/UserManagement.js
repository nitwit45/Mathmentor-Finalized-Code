import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminUsers } from '../../services/api';
import './UserManagement.css';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      try {
        const params = {};
        if (roleFilter !== 'ALL') {
          params.role = roleFilter;
        }
        if (search.trim()) {
          params.search = search.trim();
        }
        const response = await getAdminUsers(params);
        if (response.success) {
          setUsers(response.data);
        } else {
          setError(response.message || 'Failed to load users');
        }
      } catch (err) {
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    }

    // Debounce search slightly via timeout
    const timeout = setTimeout(() => {
      loadUsers();
    }, 200);

    return () => clearTimeout(timeout);
  }, [roleFilter, search]);

  const handleRowClick = (userId) => {
    navigate(`/admin/users/${userId}`);
  };

  return (
    <div className="admin-users">
      <div className="page-header">
        <h1>Users</h1>
        <p>Browse and filter all users on the platform.</p>
      </div>

      <div className="admin-filters">
        <div className="filter-group">
          <label htmlFor="role-filter">Role</label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            <option value="STUDENT">Student</option>
            <option value="TUTOR">Tutor</option>
            <option value="PARENT">Parent</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="user-search">Search</label>
          <input
            id="user-search"
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading users...</p>
        </div>
      ) : error ? (
        <div className="dashboard-error">
          <p>{error}</p>
        </div>
      ) : users.length === 0 ? (
        <div className="empty-state-small">
          <p>No users found.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => handleRowClick(user.id)}
                  className="clickable-row"
                >
                  <td>{user.full_name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge role-${(user.role || 'unknown').toLowerCase()}`}>
                      {user.role || 'UNKNOWN'}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-pill ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default UserManagement;

