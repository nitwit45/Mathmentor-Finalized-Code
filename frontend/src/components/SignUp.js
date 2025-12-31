import './Login.css';
import './SignUp.css';

function SignUp({ onNavigate }) {
  return (
    <div className="split-container">
      <div 
        className="split-left"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/welcome_background.svg)`
        }}
      ></div>
      <div className="split-right">
        <div className="auth-container">
          <div className="auth-card">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="back-button"
              aria-label="Go back"
            >
              ← Back
            </button>
            <h1>Sign Up</h1>
            <p className="auth-subtitle">Choose your account type</p>
        
        <div className="role-selection">
          <button
            onClick={() => onNavigate('signup-tutor')}
            className="role-button tutor"
          >
            <div className="role-icon tutor-icon">⚔</div>
            <h2>Tutor</h2>
            <p>Offer your tutoring services</p>
          </button>
          
          <button
            onClick={() => onNavigate('signup-student')}
            className="role-button student"
          >
            <div className="role-icon student-icon">✦</div>
            <h2>Student</h2>
            <p>Book sessions and learn</p>
          </button>
          
          <button
            onClick={() => onNavigate('signup-parent')}
            className="role-button parent"
          >
            <div className="role-icon parent-icon">⚜</div>
            <h2>Parent</h2>
            <p>Track your child's progress</p>
          </button>
        </div>
        
        <p className="auth-link">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="link-button"
          >
            Login
          </button>
        </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
