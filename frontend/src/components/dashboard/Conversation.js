import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getConversation, sendMessage, createChatWebSocket } from '../../services/api';
import './Conversation.css';

function Conversation() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const basePath = user?.role === 'TUTOR' ? '/tutor' : '/student';

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    async function loadConversation() {
      try {
        const response = await getConversation(conversationId);
        if (response.success) {
          setConversation(response.data);
          setMessages(response.data.messages || []);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      } finally {
        setLoading(false);
      }
    }

    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // WebSocket connection
  useEffect(() => {
    if (!conversationId) return;

    try {
      const ws = createChatWebSocket(conversationId);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          setMessages(prev => [...prev, data.message]);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };

      wsRef.current = ws;

      return () => {
        ws.close();
      };
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }, [conversationId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Try WebSocket first
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'message',
          content,
        }));
      } else {
        // Fallback to REST API
        const response = await sendMessage(conversationId, content);
        if (response.success) {
          setMessages(prev => [...prev, response.data]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(content); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach(msg => {
      const date = new Date(msg.created_at).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading conversation...</p>
      </div>
    );
  }

  const otherUser = conversation?.other_participant;
  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="conversation-page">
      {/* Header */}
      <div className="conversation-header-bar">
        <Link to={`${basePath}/messages`} className="back-btn">←</Link>
        <div className="conversation-user-info">
          <div className="user-avatar">
            {otherUser?.first_name?.[0]}{otherUser?.last_name?.[0]}
          </div>
          <div>
            <h2>{otherUser?.full_name}</h2>
            <span className="user-role">{otherUser?.role}</span>
          </div>
        </div>
        {user?.role === 'STUDENT' && (
          <Link to={`/student/tutor/${conversation?.other_participant?.id}/book`} className="action-button">
            Book Session
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="messages-container">
        {Object.entries(messageGroups).map(([date, msgs]) => (
          <div key={date} className="message-group">
            <div className="date-divider">
              <span>{formatDate(msgs[0].created_at)}</span>
            </div>
            {msgs.map(msg => (
              <div 
                key={msg.id} 
                className={`message ${msg.sender_id === user?.id ? 'sent' : 'received'}`}
              >
                <div className="message-bubble">
                  <p>{msg.content}</p>
                  <span className="message-time">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="message-input-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
        />
        <button type="submit" disabled={!newMessage.trim() || sending}>
          {sending ? '...' : '→'}
        </button>
      </form>
    </div>
  );
}

export default Conversation;

