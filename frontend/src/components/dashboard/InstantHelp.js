import { useState, useEffect, useRef } from 'react';
import { getChoices, createInstantWebSocket } from '../../services/api';
import './InstantHelp.css';

function InstantHelp() {
  const [choices, setChoices] = useState({ subjects: [], grades: [] });
  const [formData, setFormData] = useState({
    subject: '',
    grade: '',
    topic: '',
  });
  const [status, setStatus] = useState('idle'); // idle, searching, matched, error
  const [matchedSession, setMatchedSession] = useState(null);
  const [error, setError] = useState('');
  const wsRef = useRef(null);
  const requestIdRef = useRef(null);

  useEffect(() => {
    getChoices().then(res => {
      if (res.success) {
        setChoices(res.data);
      }
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    return new Promise((resolve, reject) => {
      try {
        const ws = createInstantWebSocket();
        
        ws.onopen = () => {
          console.log('Instant WebSocket connected');
          resolve(ws);
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log('Received:', data);

          if (data.type === 'request_created') {
            requestIdRef.current = data.request_id;
          } else if (data.type === 'match_found') {
            setStatus('matched');
            setMatchedSession(data.session);
          } else if (data.type === 'request_cancelled') {
            setStatus('idle');
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        ws.onclose = () => {
          console.log('Instant WebSocket disconnected');
        };

        wsRef.current = ws;
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.subject || !formData.grade) {
      setError('Please select a subject and grade level');
      return;
    }

    setStatus('searching');

    try {
      const ws = await connectWebSocket();
      
      // Send request
      ws.send(JSON.stringify({
        action: 'request_tutor',
        subject: formData.subject,
        grade: formData.grade,
        topic: formData.topic,
      }));

      // Set timeout for request expiration
      setTimeout(() => {
        if (status === 'searching') {
          setStatus('idle');
          setError('No tutors available at the moment. Please try again later.');
          if (wsRef.current) {
            wsRef.current.close();
          }
        }
      }, 5 * 60 * 1000); // 5 minutes

    } catch (error) {
      setStatus('idle');
      setError('Failed to connect. Please try again.');
    }
  };

  const handleCancel = () => {
    if (wsRef.current && requestIdRef.current) {
      wsRef.current.send(JSON.stringify({
        action: 'cancel_request',
        request_id: requestIdRef.current,
      }));
    }
    setStatus('idle');
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const handleJoinSession = () => {
    if (matchedSession?.meeting_link) {
      window.open(matchedSession.meeting_link, '_blank');
    }
  };

  return (
    <div className="instant-help-page">
      <div className="page-header">
        <h1>⚡ Get Instant Help</h1>
        <p>Connect with an available tutor right now</p>
      </div>

      {status === 'idle' && (
        <div className="instant-form-card">
          <form onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label>What subject do you need help with? *</label>
              <select
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                required
              >
                <option value="">Select a subject...</option>
                {choices.subjects.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>What grade level? *</label>
              <select
                value={formData.grade}
                onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
                required
              >
                <option value="">Select your grade...</option>
                {choices.grades.map(g => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>What topic do you need help with? (Optional)</label>
              <textarea
                value={formData.topic}
                onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                placeholder="e.g., Solving quadratic equations, Understanding derivatives..."
                rows={3}
              />
            </div>

            <button type="submit" className="action-button instant-btn">
              ⚡ Find Available Tutor Now
            </button>
          </form>

          <div className="instant-info">
            <h3>How it works</h3>
            <ol>
              <li>Select your subject and grade level</li>
              <li>We'll notify available tutors matching your needs</li>
              <li>When a tutor accepts, you'll be connected instantly via video call</li>
            </ol>
          </div>
        </div>
      )}

      {status === 'searching' && (
        <div className="searching-state">
          <div className="searching-animation">
            <div className="pulse-ring"></div>
            <div className="pulse-ring delay"></div>
            <span className="search-icon">🔍</span>
          </div>
          <h2>Searching for available tutors...</h2>
          <p>We're notifying tutors who teach {formData.subject} at {formData.grade} level</p>
          <p className="muted">This may take up to 5 minutes</p>
          <button onClick={handleCancel} className="action-button secondary">
            Cancel Request
          </button>
        </div>
      )}

      {status === 'matched' && matchedSession && (
        <div className="matched-state">
          <div className="match-success">
            <span className="success-icon">🎉</span>
            <h2>Tutor Found!</h2>
            <p>A tutor has accepted your request</p>
          </div>

          <div className="session-info-card">
            <h3>Your Session</h3>
            <p><strong>Topic:</strong> {matchedSession.topic}</p>
          </div>

          <button onClick={handleJoinSession} className="action-button join-btn large">
            🎥 Join Video Session Now
          </button>
        </div>
      )}
    </div>
  );
}

export default InstantHelp;

