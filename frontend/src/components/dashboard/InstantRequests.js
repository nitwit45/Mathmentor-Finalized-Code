import { useState, useEffect, useRef } from 'react';
import { getMyProfile, updateMyProfile, createInstantWebSocket } from '../../services/api';
import { HiLightningBolt, HiVideoCamera, HiCheck, HiX, HiEye } from 'react-icons/hi';
import './InstantRequests.css';

function InstantRequests() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailableRequests, setUnavailableRequests] = useState({}); // Track requests that are no longer available
  const wsRef = useRef(null);
  const timeoutRefs = useRef({}); // Track timeouts to prevent multiple for same request

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await getMyProfile();
        if (response.success) {
          setIsAvailable(response.data.is_available_for_instant || false);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!isAvailable) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    // Connect to WebSocket when available
    try {
      const ws = createInstantWebSocket();

      ws.onopen = () => {
        console.log('Instant WebSocket connected');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received:', data);


        if (data.type === 'instant_request') {
          setRequests(prev => [data.request, ...prev]);
          // Auto-remove after expiration
          setTimeout(() => {
            setRequests(prev => prev.filter(r => r.id !== data.request.id));
          }, 5 * 60 * 1000);
        } else if (data.type === 'request_accepted') {
          setActiveSession(data.session);
          setRequests([]);
        } else if (data.type === 'request_cancelled') {
          // Remove the cancelled request from the list
          setRequests(prev => prev.filter(r => r.id !== data.request_id));
        } else if (data.type === 'request_taken') {
          // Remove the taken request from the list
          setRequests(prev => prev.filter(r => r.id !== data.request_id));
        } else if (data.type === 'accept_failed') {
          // Mark the request as unavailable with a message, then slide it away
          const requestId = data.request_id;

          if (requestId) {
            // Clear any existing timeout for this request
            if (timeoutRefs.current[requestId]) {
              clearTimeout(timeoutRefs.current[requestId]);
            }

            setUnavailableRequests(prev => ({
              ...prev,
              [requestId]: data.message || 'This request is no longer available'
            }));

            // Remove after slide-out animation completes
            const timeoutId = setTimeout(() => {
              setRequests(prev => prev.filter(r => r.id !== requestId));
              setUnavailableRequests(prev => {
                const newState = { ...prev };
                delete newState[requestId];
                return newState;
              });
              // Clean up the timeout reference
              delete timeoutRefs.current[requestId];
            }, 500);

            // Store the timeout reference
            timeoutRefs.current[requestId] = timeoutId;
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }, [isAvailable]);

  const handleToggleAvailability = async () => {
    const newValue = !isAvailable;
    try {
      const response = await updateMyProfile({ is_available_for_instant: newValue });
      if (response.success) {
        setIsAvailable(newValue);
        
        // Notify WebSocket
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            action: 'toggle_availability',
            is_available: newValue,
          }));
        }
      }
    } catch (error) {
      console.error('Error updating availability:', error);
    }
  };

  const handleAccept = (requestId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'accept_request',
        request_id: requestId,
      }));
    }
  };

  const handleDecline = (requestId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'decline_request',
        request_id: requestId,
      }));
    }
    setRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const handleJoinSession = () => {
    if (activeSession?.meeting_link) {
      window.open(activeSession.meeting_link, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="instant-requests-page">
      <div className="page-header">
        <h1><HiLightningBolt /> Instant Requests</h1>
        <p>Receive and respond to instant tutoring requests from students</p>
      </div>

      {/* Availability toggle */}
      <div className="availability-card">
        <div className="availability-info">
          <div className={`availability-status ${isAvailable ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            <span>{isAvailable ? 'You\'re Available' : 'You\'re Offline'}</span>
          </div>
          <p>
            {isAvailable 
              ? 'Students can send you instant tutoring requests'
              : 'Toggle to start receiving instant requests'
            }
          </p>
        </div>
        <button 
          onClick={handleToggleAvailability}
          className={`toggle-btn ${isAvailable ? 'on' : 'off'}`}
        >
          <span className="toggle-slider"></span>
        </button>
      </div>

      {/* Active session */}
      {activeSession && (
        <div className="active-session-card">
          <h3><HiVideoCamera /> Active Session</h3>
          <p>{activeSession.topic}</p>
          <button onClick={handleJoinSession} className="action-button join-btn">
            Join Video Session
          </button>
        </div>
      )}

      {/* Requests list */}
      {isAvailable && !activeSession && (
        <div className="requests-section">
          <h2>Incoming Requests</h2>
          
          {requests.length > 0 ? (
            <div className="requests-list">
              {requests.map(request => {
                const isUnavailable = unavailableRequests[request.id];
                return (
                  <div 
                    key={request.id} 
                    className={`request-card ${isUnavailable ? 'unavailable' : ''}`}
                  >
                    {isUnavailable ? (
                      <div className="request-unavailable-message">
                        <div className="unavailable-icon">
                          <HiX />
                        </div>
                        <div className="unavailable-text">
                          <h4>Request No Longer Available</h4>
                          <p>The student has disconnected or found another tutor.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="request-info">
                          <h3>{request.student_name}</h3>
                          <p className="request-subject">{request.subject} - {request.grade}</p>
                          {request.topic && (
                            <p className="request-topic">{request.topic}</p>
                          )}
                          <p className="request-expires">
                            Expires: {new Date(request.expires_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="request-actions">
                          <button
                            onClick={() => handleAccept(request.id)}
                            className="action-button accept-btn"
                          >
                            <HiCheck /> Accept
                          </button>
                          <button
                            onClick={() => handleDecline(request.id)}
                            className="action-button secondary decline-btn"
                          >
                            <HiX /> Decline
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-small">
              <span className="waiting-icon"><HiEye /></span>
              <p>Waiting for student requests...</p>
              <p className="muted">You'll receive notifications when students need help</p>
            </div>
          )}
        </div>
      )}

      {!isAvailable && !activeSession && (
        <div className="offline-message">
          <p>Toggle your availability to start receiving instant tutoring requests from students.</p>
        </div>
      )}
    </div>
  );
}

export default InstantRequests;

