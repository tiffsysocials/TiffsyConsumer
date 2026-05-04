import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import apiService from '../services/api.service';
import notificationStorageService from '../services/notificationStorage.service';
import { useUser } from './UserContext';

export interface NotificationData {
  _id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  entityType?: string | null;
  entityId?: string | null;
  deliveryStatus: string;
  isRead: boolean;
  readAt: string | null;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationContextType {
  notifications: NotificationData[];
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  latestUnreadNotification: NotificationData | null;
  showPopup: boolean;
  fetchNotifications: (page?: number) => Promise<void>;
  fetchLatestUnread: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  dismissPopup: () => void;
  refreshNotifications: () => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useUser();

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [latestUnreadNotification, setLatestUnreadNotification] = useState<NotificationData | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  // Fetch notifications with pagination
  const fetchNotifications = useCallback(async (page: number = 1) => {
    if (!isAuthenticated) return;

    try {
      if (page === 1) {
        setIsLoading(true);
      }

      const response = await apiService.getNotifications({
        page,
        limit: 20,
        unreadOnly: false,
      });

      if (response.success && response.data) {
        let newNotifications = response.data.notifications;

        // If first page, merge with cached notifications
        if (page === 1) {
          console.log('[NotificationContext] Merging backend notifications with cache');
          newNotifications = await notificationStorageService.mergeWithBackend(
            newNotifications
          );

          // Update sync timestamp
          await notificationStorageService.updateSyncTimestamp();

          setNotifications(newNotifications);
        } else {
          // For pagination, just append without merge
          setNotifications(prev => [...prev, ...newNotifications]);
        }

        setUnreadCount(response.data.unreadCount);

        // Sync unread count to storage
        await notificationStorageService.setUnreadCount(response.data.unreadCount);

        setCurrentPage(response.data.pagination.page);
        setTotalPages(response.data.pagination.pages);
        setHasMore(response.data.pagination.page < response.data.pagination.pages);
      }
    } catch (error) {
      console.error('[NotificationContext] Error fetching notifications:', error);

      // On error, fallback to cached notifications (offline support)
      if (page === 1) {
        console.log('[NotificationContext] Backend fetch failed, using cached notifications');
        const cached = await notificationStorageService.getStoredNotifications();
        if (cached.length > 0) {
          setNotifications(cached as NotificationData[]);
          console.log(`[NotificationContext] Loaded ${cached.length} cached notifications (offline mode)`);
        }

        // Get cached unread count
        const cachedCount = await notificationStorageService.getUnreadCount();
        setUnreadCount(cachedCount);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  // Fetch latest unread notification for popup
  const fetchLatestUnread = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await apiService.getLatestUnreadNotification();

      if (response.success && response.data.notification) {
        setLatestUnreadNotification(response.data.notification);
        setShowPopup(true);

        // Auto-dismiss after 10 seconds (increased from 5s for better UX)
        setTimeout(() => {
          setShowPopup(false);
        }, 10000);
      }
    } catch (error) {
      console.error('Error fetching latest unread notification:', error);
    }
  }, [isAuthenticated]);

  // Fetch unread count for badge
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('[NotificationContext] fetchUnreadCount: User not authenticated');
      return;
    }

    console.log('[NotificationContext] Fetching unread notification count...');
    try {
      const response = await apiService.getUnreadNotificationCount();
      console.log('[NotificationContext] Unread count response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        console.log('[NotificationContext] Setting unreadCount to:', response.data.count);
        setUnreadCount(response.data.count);
      } else {
        console.warn('[NotificationContext] Invalid response for unread count:', response);
      }
    } catch (error) {
      console.error('[NotificationContext] Error fetching unread count:', error);
    }
  }, [isAuthenticated]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await apiService.markNotificationAsRead(notificationId);

      if (response.success) {
        // Update local state
        setNotifications(prev =>
          prev.map(notif =>
            notif._id === notificationId
              ? { ...notif, isRead: true, readAt: new Date().toISOString() }
              : notif
          )
        );

        // Decrement unread count
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await apiService.markAllNotificationsAsRead();

      if (response.success) {
        // Update all notifications to read
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, isRead: true, readAt: new Date().toISOString() }))
        );

        // Reset unread count
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await apiService.deleteNotification(notificationId);

      if (response.success) {
        // Remove from local state
        const deletedNotif = notifications.find(n => n._id === notificationId);
        setNotifications(prev => prev.filter(notif => notif._id !== notificationId));

        // Update unread count if the deleted notification was unread
        if (deletedNotif && !deletedNotif.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  // Dismiss popup
  const dismissPopup = useCallback(() => {
    setShowPopup(false);
    if (latestUnreadNotification) {
      markAsRead(latestUnreadNotification._id);
    }
  }, [latestUnreadNotification, markAsRead]);

  // Refresh notifications (pull-to-refresh)
  const refreshNotifications = useCallback(async () => {
    setIsRefreshing(true);
    await fetchNotifications(1);
    await fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Load more notifications (infinite scroll)
  const loadMoreNotifications = useCallback(async () => {
    if (!isLoading && hasMore && currentPage < totalPages) {
      await fetchNotifications(currentPage + 1);
    }
  }, [isLoading, hasMore, currentPage, totalPages, fetchNotifications]);

  // Initial load when user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
    }
  }, [isAuthenticated, fetchUnreadCount]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    hasMore,
    latestUnreadNotification,
    showPopup,
    fetchNotifications,
    fetchLatestUnread,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    dismissPopup,
    refreshNotifications,
    loadMoreNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
