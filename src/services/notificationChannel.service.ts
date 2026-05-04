/**
 * Notification Channel Service
 *
 * JavaScript wrapper for the native NotificationChannelModule
 * Handles creation and management of Android notification channels
 */

import { NativeModules, Platform } from 'react-native';

const { NotificationChannelModule } = NativeModules;

interface NotificationChannel {
  id: string;
  name: string;
  importance: number;
}

class NotificationChannelService {
  /**
   * Create all notification channels
   * Should be called once when app starts (Android 8+ only)
   *
   * @returns Promise<boolean> True if channels were created successfully
   */
  async createChannels(): Promise<boolean> {
    // Only available on Android
    if (Platform.OS !== 'android') {
      console.log('[NotificationChannels] iOS does not use notification channels');
      return true;
    }

    // Check if native module is available
    if (!NotificationChannelModule) {
      console.warn('[NotificationChannels] NotificationChannelModule not available');
      return false;
    }

    try {
      console.log('[NotificationChannels] Creating notification channels...');
      const result = await NotificationChannelModule.createNotificationChannels();
      console.log('[NotificationChannels] Notification channels created successfully');
      return result;
    } catch (error) {
      console.error('[NotificationChannels] Failed to create channels:', error);
      return false;
    }
  }

  /**
   * Delete a notification channel by ID
   * Useful for testing or cleanup
   *
   * @param channelId The ID of the channel to delete
   * @returns Promise<boolean> True if channel was deleted successfully
   */
  async deleteChannel(channelId: string): Promise<boolean> {
    if (Platform.OS !== 'android' || !NotificationChannelModule) {
      return false;
    }

    try {
      console.log(`[NotificationChannels] Deleting channel: ${channelId}`);
      const result = await NotificationChannelModule.deleteNotificationChannel(channelId);
      console.log(`[NotificationChannels] Channel ${channelId} deleted successfully`);
      return result;
    } catch (error) {
      console.error(`[NotificationChannels] Failed to delete channel ${channelId}:`, error);
      return false;
    }
  }

  /**
   * Get list of all notification channels
   * Useful for debugging
   *
   * @returns Promise<NotificationChannel[]> List of channels
   */
  async getChannels(): Promise<NotificationChannel[]> {
    if (Platform.OS !== 'android' || !NotificationChannelModule) {
      return [];
    }

    try {
      console.log('[NotificationChannels] Fetching channels...');
      const channels = await NotificationChannelModule.getNotificationChannels();
      console.log(`[NotificationChannels] Found ${channels.length} channels:`, channels);
      return channels;
    } catch (error) {
      console.error('[NotificationChannels] Failed to get channels:', error);
      return [];
    }
  }

  /**
   * Check if notification channels are supported
   *
   * @returns boolean True if channels are supported (Android 8+)
   */
  isSupported(): boolean {
    return Platform.OS === 'android' && NotificationChannelModule !== null;
  }
}

// Export singleton instance
export default new NotificationChannelService();
