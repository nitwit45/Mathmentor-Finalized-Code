import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile } from '../services/api';
import { HiHome, HiSearch, HiLightningBolt, HiCalendar, HiChat, HiCog, HiLogout, HiCreditCard } from 'react-icons/hi';
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
import PaymentMethods from '../components/dashboard/PaymentMethods';

function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await getMyProfile();
        if (response.success) {
          setProfile(response.data);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    }

    loadProfile();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/');
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <h1 className="logo">Mathmentor</h1>
        <button 
          className={`hamburger-btn ${mobileMenuOpen ? 'open' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </header>

      {/* Mobile Backdrop */}
      <div 
        className={`sidebar-backdrop ${mobileMenuOpen ? 'visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="logo">Mathmentor</h1>
          <div className="user-profile-section">
            {profile?.profile_image_url ? (
              <img
                src={profile.profile_image_url}
                alt="Profile"
                className="sidebar-profile-picture"
              />
            ) : (
              <div className="sidebar-profile-placeholder">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
            )}
            <p className="user-greeting">Hi, {user?.first_name || 'Student'}!</p>
          </div>
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
          <NavLink to="/student/payment-methods" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><HiCreditCard /></span>
            <span>Payment Methods</span>
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
          <Route path="payment-methods" element={<PaymentMethods />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default StudentDashboard;

