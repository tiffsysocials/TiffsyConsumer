/**
 * Notification Storage Service
 *
 * Handles local persistence of notifications using AsyncStorage.
 * Provides offline support and deduplication strategies.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Partial NotificationData interface for cached notifications
export interface CachedNotificationData {
  _id: string;
  userId?: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  entityType?: string | null;
  entityId?: string | null;
  deliveryStatus?: string;
  isRead: boolean;
  readAt?: string | null;
  sentAt?: string;
  createdAt: string;
  updatedAt?: string;
  source?: 'FCM_BACKGROUND' | 'FCM_FOREGROUND' | 'BACKEND'; // Track notification origin
}

// Storage keys
const STORAGE_KEY = '@notifications_cache';
const COUNT_KEY = '@notification_unread_count';
const SYNC_TIMESTAMP_KEY = '@notification_last_sync';

// Configuration
const MAX_CACHE_SIZE = 100;        // Maximum notifications to store
const CACHE_EXPIRY_DAYS = 30;      // Days before old notifications are cleaned

class NotificationStorageService {
  /**
   * Save a notification to AsyncStorage
   * Handles deduplication and cache size limits
   */
  async saveNotification(notification: Partial<CachedNotificationData>): Promise<void> {
    try {
      const notifications = await this.getStoredNotifications();

      // Check for duplicates (by _id or messageId in data)
      const exists = notifications.some(
        n => n._id === notification._id ||
             (notification.data?.messageId && n.data?.messageId === notification.data.messageId)
      );

      if (exists) {
        console.log('[NotificationStorage] Duplicate notification detected, skipping save:', notification._id);
        return;
      }

      // Create full notification object with defaults
      const fullNotification: CachedNotificationData = {
        _id: notification._id || `temp_${Date.now()}`,
        userId: notification.userId || '',
        type: notification.type || 'UNKNOWN',
        title: notification.title || 'New Notification',
        body: notification.body || '',
        data: notification.data || {},
        entityType: notification.entityType || null,
        entityId: notification.entityId || null,
        deliveryStatus: notification.deliveryStatus || 'DELIVERED',
        isRead: notification.isRead !== undefined ? notification.isRead : false,
        readAt: notification.readAt || null,
        sentAt: notification.sentAt || new Date().toISOString(),
        createdAt: notification.createdAt || new Date().toISOString(),
        updatedAt: notification.updatedAt || new Date().toISOString(),
        source: notification.source || 'FCM_BACKGROUND',
      };

      // Add to cache (prepend - newest first)
      notifications.unshift(fullNotification);

      // Enforce size limit (FIFO - remove oldest)
      if (notifications.length > MAX_CACHE_SIZE) {
        notifications.splice(MAX_CACHE_SIZE);
        console.log(`[NotificationStorage] Cache size limit reached, removed ${notifications.length - MAX_CACHE_SIZE} old notifications`);
      }

      // Save back to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
      console.log('[NotificationStorage] Notification saved successfully:', fullNotification._id);
    } catch (error) {
      console.error('[NotificationStorage] Failed to save notification:', error);
    }
  }

  /**
   * Get all stored notifications from AsyncStorage
   * Automatically filters out expired notifications
   */
  async getStoredNotifications(): Promise<CachedNotificationData[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) {
        console.log('[NotificationStorage] No cached notifications found');
        return [];
      }

      const notifications = JSON.parse(stored) as CachedNotificationData[];

      // Filter out expired notifications
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - CACHE_EXPIRY_DAYS);

      const validNotifications = notifications.filter(n => {
        const createdDate = new Date(n.createdAt);
        return createdDate > cutoffDate;
      });

      console.log(`[NotificationStorage] Retrieved ${validNotifications.length} cached notifications (${notifications.length - validNotifications.length} expired)`);
      return validNotifications;
    } catch (error) {
      console.error('[NotificationStorage] Failed to get stored notifications:', error);
      return [];
    }
  }

  /**
   * Merge backend notifications with cached notifications
   * Backend is source of truth - deduplicates and returns unified list
   */
  async mergeWithBackend(backendNotifications: CachedNotificationData[]): Promise<CachedNotificationData[]> {
    try {
      const cachedNotifications = await this.getStoredNotifications();
      console.log(`[NotificationStorage] Merging ${backendNotifications.length} backend + ${cachedNotifications.length} cached notifications`);

      // Create a map of backend notifications by ID
      const backendMap = new Map<string, CachedNotificationData>();
      backendNotifications.forEach(n => {
        // Only add real IDs (not temp)
        if (!n._id.startsWith('temp_')) {
          backendMap.set(n._id, n);
        }
      });

      // Filter cached notifications to keep only those not in backend
      const uniqueCached = cachedNotifications.filter(cached => {
        // Remove temp notifications if backend has a matching real one
        if (cached._id.startsWith('temp_')) {
          // Check if backend has a notification with same type, time, and data
          const matchInBackend = backendNotifications.some(backend =>
            backend.type === cached.type &&
            Math.abs(new Date(backend.createdAt).getTime() - new Date(cached.createdAt).getTime()) < 5000 && // Within 5 seconds
            JSON.stringify(backend.data) === JSON.stringify(cached.data)
          );
          return !matchInBackend; // Keep cached if no match in backend
        }

        // Keep cached notification if not in backend
        return !backendMap.has(cached._id);
      });

      console.log(`[NotificationStorage] After deduplication: ${uniqueCached.length} unique cached notifications`);

      // Combine: backend first (source of truth), then unique cached
      const merged = [...backendNotifications, ...uniqueCached];

      // Sort by date descending (newest first)
      merged.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Update cache with merged list
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      console.log(`[NotificationStorage] Merged list saved: ${merged.length} total notifications`);

      return merged;
    } catch (error) {
      console.error('[NotificationStorage] Failed to merge notifications:', error);
      // On error, return backend notifications as fallback
      return backendNotifications;
    }
  }

  /**
   * Increment the unread notification count
   */
  async incrementUnreadCount(): Promise<void> {
    try {
      const count = await this.getUnreadCount();
      await AsyncStorage.setItem(COUNT_KEY, (count + 1).toString());
      console.log(`[NotificationStorage] Unread count incremented to ${count + 1}`);
    } catch (error) {
      console.error('[NotificationStorage] Failed to increment unread count:', error);
    }
  }

  /**
   * Get the current unread count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem(COUNT_KEY);
      const count = stored ? parseInt(stored, 10) : 0;
      return count;
    } catch (error) {
      console.error('[NotificationStorage] Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Set the unread count (typically from backend sync)
   */
  async setUnreadCount(count: number): Promise<void> {
    try {
      await AsyncStorage.setItem(COUNT_KEY, count.toString());
      console.log(`[NotificationStorage] Unread count set to ${count}`);
    } catch (error) {
      console.error('[NotificationStorage] Failed to set unread count:', error);
    }
  }

  /**
   * Update the last sync timestamp
   */
  async updateSyncTimestamp(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      await AsyncStorage.setItem(SYNC_TIMESTAMP_KEY, timestamp);
      console.log(`[NotificationStorage] Sync timestamp updated to ${timestamp}`);
    } catch (error) {
      console.error('[NotificationStorage] Failed to update sync timestamp:', error);
    }
  }

  /**
   * Get the last sync timestamp
   */
  async getLastSyncTimestamp(): Promise<Date | null> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_TIMESTAMP_KEY);
      if (!stored) return null;
      return new Date(stored);
    } catch (error) {
      console.error('[NotificationStorage] Failed to get sync timestamp:', error);
      return null;
    }
  }

  /**
   * Clear all cached notifications and related data
   * Should be called on logout
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEY,
        COUNT_KEY,
        SYNC_TIMESTAMP_KEY,
      ]);
      console.log('[NotificationStorage] Cache cleared successfully');
    } catch (error) {
      console.error('[NotificationStorage] Failed to clear cache:', error);
    }
  }

  /**
   * Cleanup old notifications beyond expiry date
   * Run periodically to prevent unbounded growth
   */
  async cleanup(): Promise<void> {
    try {
      const notifications = await this.getStoredNotifications();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - CACHE_EXPIRY_DAYS);

      const filtered = notifications.filter(n => {
        const createdDate = new Date(n.createdAt);
        return createdDate > cutoffDate;
      });

      if (filtered.length < notifications.length) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        const cleaned = notifications.length - filtered.length;
        console.log(`[NotificationStorage] Cleaned up ${cleaned} old notifications`);
      } else {
        console.log('[NotificationStorage] No old notifications to clean up');
      }
    } catch (error) {
      console.error('[NotificationStorage] Failed to cleanup old notifications:', error);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  async getStats(): Promise<{
    totalCached: number;
    unreadCount: number;
    lastSync: Date | null;
    oldestNotification: Date | null;
    newestNotification: Date | null;
  }> {
    try {
      const notifications = await this.getStoredNotifications();
      const unreadCount = await this.getUnreadCount();
      const lastSync = await this.getLastSyncTimestamp();

      const dates = notifications.map(n => new Date(n.createdAt).getTime());
      const oldest = dates.length > 0 ? new Date(Math.min(...dates)) : null;
      const newest = dates.length > 0 ? new Date(Math.max(...dates)) : null;

      return {
        totalCached: notifications.length,
        unreadCount,
        lastSync,
        oldestNotification: oldest,
        newestNotification: newest,
      };
    } catch (error) {
      console.error('[NotificationStorage] Failed to get stats:', error);
      return {
        totalCached: 0,
        unreadCount: 0,
        lastSync: null,
        oldestNotification: null,
        newestNotification: null,
      };
    }
  }
}

// Export singleton instance
export default new NotificationStorageService();
