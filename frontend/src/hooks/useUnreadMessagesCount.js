import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getConversations } from '../services/api';

/**
 * Hook to fetch and maintain total unread message count across conversations.
 * Used for the Messages nav badge in Student and Tutor dashboards.
 * @returns {{ unreadCount: number, isLoading: boolean, refresh: () => Promise<void> }}
 */
export function useUnreadMessagesCount() {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await getConversations();
      if (response.success && Array.isArray(response.data)) {
        const total = response.data.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
        setUnreadCount(total);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to fetch unread message count:', error);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Refresh when user returns to tab (window focus)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchUnreadCount]);

  return { unreadCount, isLoading, refresh: fetchUnreadCount };
}
