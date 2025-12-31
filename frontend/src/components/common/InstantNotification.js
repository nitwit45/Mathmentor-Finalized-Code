import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInstantWebSocket, acceptInstantRequest } from '../../services/api';
import './InstantNotification.css';

function InstantNotification() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectWebSocket = () => {
    try {
      wsRef.current = createInstantWebSocket();

      wsRef.current.onopen = () => {
        console.log('Instant notification WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_request') {
          // Add notification with unique id
          const notification = {
            id: Date.now(),
            request: data.request,
            show: true,
          };
          setNotifications(prev => [...prev, notification]);

          // Auto-hide after 30 seconds if not interacted
          setTimeout(() => {
            dismissNotification(notification.id);
          }, 30000);
        }
      };

      wsRef.current.onclose = () => {
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  const dismissNotification = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, show: false } : n)
    );
    // Remove from DOM after animation
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 300);
  };

  const handleAccept = async (notification) => {
    try {
      const response = await acceptInstantRequest(notification.request.id);
      if (response.success) {
        dismissNotification(notification.id);
        // Navigate to the session or open Jitsi link
        if (response.data.meeting_link) {
          window.open(response.data.meeting_link, '_blank');
        }
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleViewAll = () => {
    navigate('/tutor/requests');
  };

  const getSubjectLabel = (subject) => {
    const subjects = {
      'algebra': 'Algebra',
      'geometry': 'Geometry',
      'calculus': 'Calculus',
      'statistics': 'Statistics',
      'trigonometry': 'Trigonometry',
      'number_theory': 'Number Theory',
      'arithmetic': 'Arithmetic',
      'pre_algebra': 'Pre-Algebra',
      'pre_calculus': 'Pre-Calculus',
      'linear_algebra': 'Linear Algebra',
    };
    return subjects[subject] || subject;
  };

  const getGradeLabel = (grade) => {
    const grades = {
      'primary': 'Primary (KS1-2)',
      'ks3': 'KS3 (Years 7-9)',
      'gcse': 'GCSE',
      'a_level': 'A-Level',
      'university': 'University',
    };
    return grades[grade] || grade;
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="instant-notifications-container">
      {notifications.map(notification => (
        <div 
          key={notification.id} 
          className={`instant-notification ${notification.show ? 'show' : 'hide'}`}
        >
          <div className="notification-header">
            <span className="notification-icon">⚡</span>
            <span className="notification-title">New Instant Request!</span>
            <button 
              className="notification-close"
              onClick={() => dismissNotification(notification.id)}
            >
              ×
            </button>
          </div>
          
          <div className="notification-body">
            <div className="student-info">
              <strong>{notification.request.student?.full_name || 'Student'}</strong>
              <span> needs help with</span>
            </div>
            <div className="request-details">
              <span className="subject-badge">
                {getSubjectLabel(notification.request.subject)}
              </span>
              <span className="grade-badge">
                {getGradeLabel(notification.request.grade_level)}
              </span>
            </div>
            {notification.request.description && (
              <p className="request-description">
                "{notification.request.description}"
              </p>
            )}
          </div>

          <div className="notification-actions">
            <button 
              className="accept-btn"
              onClick={() => handleAccept(notification)}
            >
              Accept & Start Session
            </button>
            <button 
              className="view-btn"
              onClick={handleViewAll}
            >
              View All
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default InstantNotification;

