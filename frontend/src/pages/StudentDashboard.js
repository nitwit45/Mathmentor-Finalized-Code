import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HiHome, HiSearch, HiLightningBolt, HiCalendar, HiChat, HiCog, HiLogout } from 'react-icons/hi';
import './Dashboard.css';

// Dashboard pages
import DashboardHome from '../components/dashboard/StudentHome';
import FindTutor from '../components/dashboard/FindTutor';
import TutorProfile from '../components/dashboard/TutorProfile';
import InstantHelp from '../components/dashboard/InstantHelp';
import MySessions from '../components/dashboard/MySessions';
import SessionDetail from '../components/dashboard/SessionDetail';
import Messages from '../components/dashboard/Messages';
import Conversation from '../components/dashboard/Conversation';
import Settings from '../components/dashboard/Settings';
import BookSession from '../components/booking/BookSession';

function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h1 className="logo">Mathmentor</h1>
          <p className="user-greeting">Hi, {user?.first_name || 'Student'}!</p>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/student" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><HiHome /></span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/student/find-tutor" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><HiSearch /></span>
            <span>Find Tutor</span>
          </NavLink>
          <NavLink to="/student/instant" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><HiLightningBolt /></span>
            <span>Instant Help</span>
          </NavLink>
          <NavLink to="/student/sessions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><HiCalendar /></span>
            <span>My Sessions</span>
          </NavLink>
          <NavLink to="/student/messages" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><HiChat /></span>
            <span>Messages</span>
          </NavLink>
          <NavLink to="/student/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><HiCog /></span>
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button">
            <span className="nav-icon"><HiLogout /></span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dashboard-main">
        <Routes>
          <Route index element={<DashboardHome />} />
          <Route path="find-tutor" element={<FindTutor />} />
          <Route path="tutor/:tutorId" element={<TutorProfile />} />
          <Route path="tutor/:tutorId/book" element={<BookSession />} />
          <Route path="instant" element={<InstantHelp />} />
          <Route path="sessions" element={<MySessions />} />
          <Route path="sessions/:sessionId" element={<SessionDetail />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:conversationId" element={<Conversation />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default StudentDashboard;

