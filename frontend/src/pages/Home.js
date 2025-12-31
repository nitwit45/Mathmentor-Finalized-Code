import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
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
            <p>Your personal math tutoring platform</p>
            <div className="home-links">
              <Link to="/login" className="home-button">
                Login
              </Link>
              <Link to="/signup" className="home-button secondary">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;

