import { useState, useEffect } from 'react';
import { initializeCsrf } from './services/api';
import Login from './components/Login';
import SignUp from './components/SignUp';
import SignUpTutor from './components/SignUpTutor';
import SignUpStudent from './components/SignUpStudent';
import SignUpParent from './components/SignUpParent';
import EmailVerification from './components/EmailVerification';
import './App.css';

// Page constants
const PAGES = {
  HOME: 'home',
  LOGIN: 'login',
  SIGNUP: 'signup',
  SIGNUP_TUTOR: 'signup-tutor',
  SIGNUP_STUDENT: 'signup-student',
  SIGNUP_PARENT: 'signup-parent',
  VERIFY_EMAIL: 'verify-email',
};

function Home({ onNavigate }) {
  return (
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
            <h1>Welcome to Mathmentor</h1>
            <p>Your tutoring platform</p>
            <div className="home-links">
              <button onClick={() => onNavigate(PAGES.LOGIN)} className="home-button">
                Login
              </button>
              <button onClick={() => onNavigate(PAGES.SIGNUP)} className="home-button secondary">
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState(PAGES.HOME);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [csrfReady, setCsrfReady] = useState(false);

  // Fetch CSRF token on mount
  useEffect(() => {
    initializeCsrf().then(() => setCsrfReady(true));
  }, []);

  const handleNavigate = (page, email = '') => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(page);
      if (email) {
        setVerificationEmail(email);
      }
      setIsTransitioning(false);
    }, 150);
  };

  const handleVerificationSuccess = (userData) => {
    // After successful verification, navigate to login
    handleNavigate(PAGES.LOGIN);
  };

  if (!csrfReady) {
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
                <h1>Loading...</h1>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case PAGES.HOME:
        return <Home onNavigate={handleNavigate} />;
      case PAGES.LOGIN:
        return <Login onNavigate={handleNavigate} />;
      case PAGES.SIGNUP:
        return <SignUp onNavigate={handleNavigate} />;
      case PAGES.SIGNUP_TUTOR:
        return <SignUpTutor onNavigate={handleNavigate} />;
      case PAGES.SIGNUP_STUDENT:
        return <SignUpStudent onNavigate={handleNavigate} />;
      case PAGES.SIGNUP_PARENT:
        return <SignUpParent onNavigate={handleNavigate} />;
      case PAGES.VERIFY_EMAIL:
        return (
          <EmailVerification
            email={verificationEmail}
            onNavigate={handleNavigate}
            onVerificationSuccess={handleVerificationSuccess}
          />
        );
      default:
        return <Home onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app-container">
      <div className={`page-wrapper ${isTransitioning ? 'fade-out' : 'fade-in'}`}>
        {renderPage()}
      </div>
    </div>
  );
}

export default App;
