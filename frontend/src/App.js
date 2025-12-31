import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { initializeCsrf } from './services/api';

// Auth pages
import Login from './components/Login';
import SignUp from './components/SignUp';
import SignUpTutor from './components/SignUpTutor';
import SignUpStudent from './components/SignUpStudent';
import SignUpParent from './components/SignUpParent';
import EmailVerification from './components/EmailVerification';

// Profile completion
import ProfileCompletion from './pages/ProfileCompletion';

// Dashboard pages
import StudentDashboard from './pages/StudentDashboard';
import TutorDashboard from './pages/TutorDashboard';

// Public pages
import Home from './pages/Home';

import './App.css';

// Protected Route wrapper
function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, loading, user, isProfileComplete } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if profile completion is required
  if (!isProfileComplete && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />;
  }

  // Check role requirement
  if (requiredRole && user?.role !== requiredRole) {
    const redirectPath = user?.role === 'TUTOR' ? '/tutor' : '/student';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}

// Public Route wrapper (redirect if already authenticated)
function PublicRoute({ children }) {
  const { isAuthenticated, loading, user, isProfileComplete } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    if (!isProfileComplete) {
      return <Navigate to="/complete-profile" replace />;
    }
    const redirectPath = user?.role === 'TUTOR' ? '/tutor' : '/student';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}

// Loading Screen component
function LoadingScreen() {
  return (
    <div className="app-container">
      <div className="split-container">
        <div 
          className="split-left"
          style={{
            backgroundImage: `url(${process.env.PUBLIC_URL}/welcome_background.svg)`
          }}
        ></div>
        <div className="split-right">
          <div className="home-container">
            <div className="home-content">
              <div className="loading-spinner"></div>
              <h2>Loading...</h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Auth navigation wrapper for legacy components
function AuthPageWrapper({ Component, ...props }) {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleNavigate = (page, email = '') => {
    const routes = {
      'home': '/',
      'login': '/login',
      'signup': '/signup',
      'signup-tutor': '/signup/tutor',
      'signup-student': '/signup/student',
      'signup-parent': '/signup/parent',
      'verify-email': '/verify-email',
    };
    
    if (page === 'verify-email' && email) {
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } else {
      navigate(routes[page] || '/');
    }
  };

  const handleLoginSuccess = (userData) => {
    login(userData);
  };

  return <Component onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} {...props} />;
}

// Email verification wrapper
function EmailVerificationWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const params = new URLSearchParams(location.search);
  const email = params.get('email') || '';

  const handleNavigate = (page) => {
    if (page === 'login') {
      navigate('/login');
    } else {
      navigate('/');
    }
  };

  const handleVerificationSuccess = (userData) => {
    login(userData);
    navigate('/complete-profile');
  };

  return (
    <EmailVerification
      email={email}
      onNavigate={handleNavigate}
      onVerificationSuccess={handleVerificationSuccess}
    />
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={
        <PublicRoute>
          <Home />
        </PublicRoute>
      } />
      <Route path="/login" element={
        <PublicRoute>
          <AuthPageWrapper Component={Login} />
        </PublicRoute>
      } />
      <Route path="/signup" element={
        <PublicRoute>
          <AuthPageWrapper Component={SignUp} />
        </PublicRoute>
      } />
      <Route path="/signup/tutor" element={
        <PublicRoute>
          <AuthPageWrapper Component={SignUpTutor} />
        </PublicRoute>
      } />
      <Route path="/signup/student" element={
        <PublicRoute>
          <AuthPageWrapper Component={SignUpStudent} />
        </PublicRoute>
      } />
      <Route path="/signup/parent" element={
        <PublicRoute>
          <AuthPageWrapper Component={SignUpParent} />
        </PublicRoute>
      } />
      <Route path="/verify-email" element={
        <EmailVerificationWrapper />
      } />

      {/* Profile completion */}
      <Route path="/complete-profile" element={
        <ProtectedRoute>
          <ProfileCompletion />
        </ProtectedRoute>
      } />

      {/* Student dashboard routes */}
      <Route path="/student/*" element={
        <ProtectedRoute requiredRole="STUDENT">
          <StudentDashboard />
        </ProtectedRoute>
      } />

      {/* Tutor dashboard routes */}
      <Route path="/tutor/*" element={
        <ProtectedRoute requiredRole="TUTOR">
          <TutorDashboard />
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const [csrfReady, setCsrfReady] = useState(false);

  useEffect(() => {
    initializeCsrf().then(() => setCsrfReady(true));
  }, []);

  if (!csrfReady) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-container">
          <AppRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
