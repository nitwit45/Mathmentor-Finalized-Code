import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

// Dashboard pages
import DashboardHome from '../components/dashboard/TutorHome';
import InstantRequests from '../components/dashboard/InstantRequests';
import MySessions from '../components/dashboard/MySessions';
import SessionDetail from '../components/dashboard/SessionDetail';
import Messages from '../components/dashboard/Messages';
import Conversation from '../components/dashboard/Conversation';
import Earnings from '../components/dashboard/Earnings';
import Settings from '../components/dashboard/Settings';
import InstantNotification from '../components/common/InstantNotification';

function TutorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="dashboard-layout">
      {/* Global instant request notifications */}
      <InstantNotification />
      
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h1 className="logo">Mathmentor</h1>
          <p className="user-greeting">Hi, {user?.first_name || 'Tutor'}!</p>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/tutor" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">🏠</span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/tutor/requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⚡</span>
            <span>Instant Requests</span>
          </NavLink>
          <NavLink to="/tutor/sessions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">📅</span>
            <span>My Sessions</span>
          </NavLink>
          <NavLink to="/tutor/messages" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">💬</span>
            <span>Messages</span>
          </NavLink>
          <NavLink to="/tutor/earnings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">💰</span>
            <span>Earnings</span>
          </NavLink>
          <NavLink to="/tutor/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⚙️</span>
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button">
            <span className="nav-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dashboard-main">
        <Routes>
          <Route index element={<DashboardHome />} />
          <Route path="requests" element={<InstantRequests />} />
          <Route path="sessions" element={<MySessions />} />
          <Route path="sessions/:sessionId" element={<SessionDetail />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:conversationId" element={<Conversation />} />
          <Route path="earnings" element={<Earnings />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default TutorDashboard;

