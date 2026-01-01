import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createInstantWebSocket, getMyProfile } from '../../services/api';
import { HiLightningBolt } from 'react-icons/hi';
import './InstantNotification.css';

function InstantNotification() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [unavailableNotifications, setUnavailableNotifications] = useState({}); // Track failed accept notifications
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const isAvailableRef = useRef(false);

  // Check if user is a tutor and if they're available
  useEffect(() => {
    async function checkAvailability() {
      if (!user || user.role !== 'TUTOR') {
        setIsAvailable(false);
        return;
      }

      try {
        const response = await getMyProfile();
        if (response.success && response.data.is_available_for_instant) {
          setIsAvailable(true);
        } else {
          setIsAvailable(false);
        }
      } catch (error) {
        console.error('Error checking availability:', error);
        setIsAvailable(false);
      }
    }

    checkAvailability();

    // Poll for availability changes every 10 seconds (in case changed elsewhere)
    const pollInterval = setInterval(checkAvailability, 10000);
    return () => clearInterval(pollInterval);
  }, [user]);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isAvailableRef.current = isAvailable;
  }, [isAvailable]);

  // When availability changes and WebSocket is connected, notify backend
  useEffect(() => {
    if (isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'toggle_availability',
        is_available: isAvailable,
      }));
    }
  }, [isAvailable, isConnected]);

  useEffect(() => {
    isMountedRef.current = true;

    // Connect if user is a tutor (always connect to receive availability updates)
    // Backend will handle whether to send requests based on availability
    if (user?.role === 'TUTOR') {
      // Small delay to ensure component is fully mounted and availability is checked
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          connectWebSocket();
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Disconnect if not a tutor
      if (wsRef.current) {
        const readyState = wsRef.current.readyState;
        if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
          wsRef.current.onopen = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    }

    return () => {
      isMountedRef.current = false;
      setIsConnecting(false);

      // Clear reconnection timeout first
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket only if it exists and is in a valid state to close
      if (wsRef.current) {
        const readyState = wsRef.current.readyState;
        // Only close if OPEN (1) or CONNECTING (0), not if already CLOSING (2) or CLOSED (3)
        if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
          // Remove event handlers to prevent them from firing after cleanup
          wsRef.current.onopen = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [user]);

  const connectWebSocket = () => {
    // Don't connect if component is unmounted, not a tutor, or already connecting
    if (!isMountedRef.current || user?.role !== 'TUTOR' || isConnecting) {
      return;
    }

    setIsConnecting(true);

    try {
      // Close existing WebSocket if it exists and is in a valid state
      if (wsRef.current) {
        const existingState = wsRef.current.readyState;
        if (existingState === WebSocket.OPEN || existingState === WebSocket.CONNECTING) {
          wsRef.current.onopen = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          wsRef.current.close();
        }
        wsRef.current = null;
      }

      wsRef.current = createInstantWebSocket();

      wsRef.current.onopen = () => {
        if (isMountedRef.current) {
          setIsConnected(true);
          setIsConnecting(false);

          // If tutor is available, tell the backend to add us to subject groups
          // This ensures we receive requests even if we connected before toggling availability
          if (isAvailableRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              action: 'toggle_availability',
              is_available: true,
            }));
          }
        }
      };

      wsRef.current.onmessage = (event) => {
        if (!isMountedRef.current) return;

        const data = JSON.parse(event.data);

        // Listen for instant_request messages from backend
        // Only show notifications if tutor is available (using ref to get current value)
        if (data.type === 'instant_request' && isAvailableRef.current) {
          // Add notification with unique id
          const notification = {
            id: Date.now() + Math.random(), // Use timestamp + random for uniqueness
            request: data.request,
            show: true,
          };
          setNotifications(prev => [...prev, notification]);

          // Auto-hide after 5 minutes (matching request expiration)
          setTimeout(() => {
            if (isMountedRef.current) {
              dismissNotification(notification.id);
            }
          }, 5 * 60 * 1000);
        } else if (data.type === 'request_accepted') {
          // If we accepted a request, dismiss all notifications and navigate
          setNotifications([]);
          if (data.session?.meeting_link) {
            window.open(data.session.meeting_link, '_blank');
          }
        } else if (data.type === 'request_cancelled') {
          // Dismiss the notification for the cancelled request
          setNotifications(prev =>
            prev.filter(n => n.request.id !== data.request_id)
          );
        } else if (data.type === 'request_taken') {
          // Dismiss the notification for the taken request
          setNotifications(prev =>
            prev.filter(n => n.request.id !== data.request_id)
          );
        } else if (data.type === 'accept_failed') {
          // Mark the notification as unavailable, show message, then slide away
          const requestId = data.request_id;
          if (requestId) {
            setUnavailableNotifications(prev => ({
              ...prev,
              [requestId]: true
            }));
            // Remove after showing the message briefly
            setTimeout(() => {
              setNotifications(prev =>
                prev.filter(n => n.request.id !== requestId)
              );
              setUnavailableNotifications(prev => {
                const newState = { ...prev };
                delete newState[requestId];
                return newState;
              });
            }, 2500); // Show unavailable message for 2.5 seconds before sliding away
          }
        } else if (data.type === 'availability_updated') {
          // Update availability state when toggled
          setIsAvailable(data.is_available);
        }
      };

      wsRef.current.onclose = () => {
        if (isMountedRef.current) {
          setIsConnected(false);
          setIsConnecting(false);
          // Attempt to reconnect after 3 seconds only if still mounted and user is tutor
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && user?.role === 'TUTOR') {
              connectWebSocket();
            }
          }, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        // Only log error if component is still mounted to avoid console noise
        if (isMountedRef.current) {
          setIsConnecting(false);
          console.error('WebSocket error:', error);
        }
      };
    } catch (error) {
      if (isMountedRef.current) {
        setIsConnecting(false);
        console.error('Failed to connect WebSocket:', error);
      }
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

  const handleAccept = (notification) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Send accept via WebSocket
      wsRef.current.send(JSON.stringify({
        action: 'accept_request',
        request_id: notification.request.id,
      }));
      // Dismiss this notification
      dismissNotification(notification.id);
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

  // Only render for tutors
  if (!user || user.role !== 'TUTOR') {
    return null;
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="instant-notifications-container">
      {notifications.map(notification => {
        const isUnavailable = unavailableNotifications[notification.request.id];
        return (
          <div 
            key={notification.id} 
            className={`instant-notification ${notification.show ? 'show' : 'hide'} ${isUnavailable ? 'unavailable' : ''}`}
          >
            {isUnavailable ? (
              <>
                <div className="notification-header unavailable-header">
                  <span className="notification-icon unavailable-icon-pulse">✕</span>
                  <span className="notification-title">Request Unavailable</span>
                </div>
                <div className="notification-body">
                  <div className="unavailable-message">
                    <p className="unavailable-main">This request is no longer available.</p>
                    <p className="unavailable-sub">The student has disconnected or found another tutor.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="notification-header">
                  <span className="notification-icon"><HiLightningBolt /></span>
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
                    <strong>{notification.request.student_name || 'Student'}</strong>
                    <span> needs help with</span>
                  </div>
                  <div className="request-details">
                    <span className="subject-badge">
                      {getSubjectLabel(notification.request.subject)}
                    </span>
                    <span className="grade-badge">
                      {getGradeLabel(notification.request.grade)}
                    </span>
                  </div>
                  {notification.request.topic && (
                    <p className="request-description">
                      "{notification.request.topic}"
                    </p>
                  )}
                  {notification.request.expires_at && (
                    <p className="request-expires" style={{ fontSize: '0.8rem', color: '#B0A69B', marginTop: '8px' }}>
                      Expires: {new Date(notification.request.expires_at).toLocaleTimeString()}
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
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default InstantNotification;

