import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getConversations } from '../../services/api';
import { HiChat } from 'react-icons/hi';
import './Messages.css';

function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const basePath = user?.role === 'TUTOR' ? '/tutor' : '/student';

  useEffect(() => {
    async function loadConversations() {
      try {
        const response = await getConversations();
        if (response.success) {
          setConversations(response.data);
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setLoading(false);
      }
    }

    loadConversations();
  }, []);

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString('en-GB', { weekday: 'short' });
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="messages-page">
      <div className="page-header">
        <h1>Messages</h1>
        <p>Chat with your {user?.role === 'TUTOR' ? 'students' : 'tutors'}</p>
      </div>

      {conversations.length > 0 ? (
        <div className="conversations-list">
          {conversations.map(conv => (
            <Link 
              key={conv.id} 
              to={`${basePath}/messages/${conv.id}`}
              className={`conversation-item ${conv.unread_count > 0 ? 'unread' : ''}`}
            >
              <div className="conversation-avatar">
                {conv.other_participant?.first_name?.[0]}
                {conv.other_participant?.last_name?.[0]}
              </div>
              <div className="conversation-content">
                <div className="conversation-header">
                  <span className="conversation-name">
                    {conv.other_participant?.full_name}
                  </span>
                  <span className="conversation-time">
                    {conv.last_message ? formatTime(conv.last_message.created_at) : ''}
                  </span>
                </div>
                <div className="conversation-preview">
                  {conv.last_message ? (
                    <p>{conv.last_message.content}</p>
                  ) : (
                    <p className="no-messages">No messages yet</p>
                  )}
                  {conv.unread_count > 0 && (
                    <span className="unread-badge">{conv.unread_count}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><HiChat /></div>
          <h3>No conversations yet</h3>
          <p>
            {user?.role === 'STUDENT'
              ? 'Find a tutor and send them a message to start a conversation'
              : 'Students will message you when they want to connect'
            }
          </p>
          {user?.role === 'STUDENT' && (
            <Link to="/student/find-tutor" className="action-button">
              Find a Tutor
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default Messages;


