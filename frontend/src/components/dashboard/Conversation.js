import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getConversation, sendMessage, createChatWebSocket } from '../../services/api';
import './Conversation.css';

// Message status icon component
function MessageStatusIcon({ status }) {
  if (status === 'read') {
    return (
      <svg className="message-status-icon read" width="16" height="11" viewBox="0 0 16 11">
        <path d="M11.071.653a.75.75 0 0 1 1.06 0l3.866 3.866a.75.75 0 1 1-1.06 1.06l-3.336-3.336-3.336 3.337a.75.75 0 1 1-1.06-1.061L11.071.653z" />
        <path d="M6.071.653a.75.75 0 0 1 1.06 0l3.866 3.866a.75.75 0 1 1-1.06 1.06L6.601 2.243 3.265 5.58a.75.75 0 1 1-1.06-1.061L6.071.653z" />
      </svg>
    );
  } else if (status === 'delivered') {
    return (
      <svg className="message-status-icon delivered" width="16" height="11" viewBox="0 0 16 11">
        <path d="M11.071.653a.75.75 0 0 1 1.06 0l3.866 3.866a.75.75 0 1 1-1.06 1.06l-3.336-3.336-3.336 3.337a.75.75 0 1 1-1.06-1.061L11.071.653z" />
        <path d="M6.071.653a.75.75 0 0 1 1.06 0l3.866 3.866a.75.75 0 1 1-1.06 1.06L6.601 2.243 3.265 5.58a.75.75 0 1 1-1.06-1.061L6.071.653z" />
      </svg>
    );
  } else {
    // sent - single checkmark
    return (
      <svg className="message-status-icon sent" width="16" height="11" viewBox="0 0 16 11">
        <path d="M11.071.653a.75.75 0 0 1 1.06 0l3.866 3.866a.75.75 0 1 1-1.06 1.06l-3.336-3.336-3.336 3.337a.75.75 0 1 1-1.06-1.061L11.071.653z" />
      </svg>
    );
  }
}

function Conversation() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const basePath = user?.role === 'TUTOR' ? '/tutor' : '/student';

  const connectWebSocket = useCallback(() => {
    if (!conversationId) return;

    try {
      const ws = createChatWebSocket(conversationId);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        reconnectAttempts.current = 0; // Reset reconnection attempts on successful connection
        // Mark all unread messages as read when opening conversation
        markAllAsRead();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'message') {
          const message = data.message;
          // Add message to state using functional update to ensure we have latest state
          setMessages(prev => {
            // Check if message already exists to avoid duplicates
            const exists = prev.some(m => m.id === message.id);
            if (exists) {
              return prev;
            }
            return [...prev, message];
          });

          // If message is from other user, send delivery acknowledgment
          if (message.sender_id !== user?.id && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'delivered_ack',
              message_id: message.id,
            }));

            // Also mark as read immediately since user is viewing the conversation
            ws.send(JSON.stringify({
              type: 'read',
              message_ids: [message.id],
            }));
          }
        } else if (data.type === 'status_update') {
          // Update message status in local state using functional update
          setMessages(prev => {
            return prev.map(msg => {
              const msgIdStr = String(msg.id);
              const updateIdStr = data.message_id ? String(data.message_id) : null;
              const matchesSingle = updateIdStr && msgIdStr === updateIdStr;
              const matchesMultiple = data.message_ids && data.message_ids.some(id => String(id) === msgIdStr);

              if (matchesSingle || matchesMultiple) {
                return {
                  ...msg,
                  status: data.status,
                  delivered_at: data.delivered_at || msg.delivered_at,
                  read_at: data.read_at || msg.read_at,
                };
              }
              return msg;
            });
          });
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setWsConnected(false);

        // Attempt to reconnect if not a normal closure and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff, max 30s
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        }
      };

      wsRef.current = ws;

      return ws;
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setWsConnected(false);
      return null;
    }
  }, [conversationId, user?.id]);

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
    const ws = connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  // Mark all unread messages as read
  const markAllAsRead = useCallback(() => {
    const unreadIds = messages
      .filter(msg => msg.sender_id !== user?.id && !msg.is_read)
      .map(msg => msg.id);
    
    if (unreadIds.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'read',
        message_ids: unreadIds,
      }));
    }
  }, [messages, user?.id]);

  // Mark messages as read when component mounts or messages change
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      markAllAsRead();
    }
  }, [markAllAsRead]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Try WebSocket first if connected
      if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'message',
          content,
        }));
      } else {
        // Fallback to REST API
        const response = await sendMessage(conversationId, content);
        if (response.success) {
          setMessages(prev => [...prev, response.data]);
        } else {
          throw new Error(response.message || 'Failed to send message');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(content); // Restore message on error

      // Show user-friendly error message
      let errorMessage = 'Failed to send message. Please try again.';
      if (error.message?.includes('not found')) {
        errorMessage = 'Conversation not found. It may have been deleted.';
      } else if (error.message?.includes('access')) {
        errorMessage = 'You do not have permission to send messages in this conversation.';
      } else if (error.message?.includes('content')) {
        errorMessage = 'Message cannot be empty.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Connection error. Please check your internet connection.';
      }

      showToast(errorMessage, 'error');
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
            {otherUser?.profile_image_url ? (
              <img src={otherUser.profile_image_url} alt={otherUser.full_name} />
            ) : (
              <span className="avatar-initials">
                {otherUser?.first_name?.[0]}{otherUser?.last_name?.[0]}
              </span>
            )}
          </div>
          <div>
            <h2>{otherUser?.full_name}</h2>
            <div className="user-status-row">
              <span className="user-role">{otherUser?.role}</span>
              <div className={`connection-status ${wsConnected ? 'connected' : 'disconnected'}`}>
                <div className="status-dot"></div>
                <span className="status-text">{wsConnected ? 'Connected' : 'Reconnecting...'}</span>
              </div>
            </div>
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
            {msgs.map(msg => {
              const isSent = (msg.sender?.id || msg.sender_id) === user?.id;
              const displayStatus = msg.status || 'sent';
              return (
              <div 
                key={msg.id} 
                className={`message ${isSent ? 'sent' : 'received'}`}
              >
                <div className="message-bubble">
                  <p>{msg.content}</p>
                  <div className="message-meta">
                    <span className="message-time">{formatTime(msg.created_at)}</span>
                    {isSent && (
                      <MessageStatusIcon status={displayStatus} />
                    )}
                  </div>
                </div>
              </div>
              );
            })}
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

