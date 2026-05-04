/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEY = '@notifications_cache';
const COUNT_KEY = '@notification_unread_count';
const MAX_CACHE_SIZE = 100;

/**
 * Save notification to AsyncStorage for offline access
 */
async function saveNotificationToStorage(remoteMessage) {
  try {
    // Create notification object from FCM message
    const notification = {
      _id: remoteMessage.messageId || `temp_${Date.now()}`,
      type: remoteMessage.data?.type || 'UNKNOWN',
      title: remoteMessage.notification?.title || '',
      body: remoteMessage.notification?.body || '',
      data: remoteMessage.data || {},
      entityType: remoteMessage.data?.entityType || null,
      entityId: remoteMessage.data?.entityId || null,
      deliveryStatus: 'DELIVERED',
      isRead: false,
      readAt: null,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'FCM_BACKGROUND', // Track that this came from background
    };

    // Get existing notifications from cache
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const notifications = stored ? JSON.parse(stored) : [];

    // Check for duplicates
    const exists = notifications.some(
      n => n._id === notification._id ||
           (notification.data?.messageId && n.data?.messageId === notification.data.messageId)
    );

    if (exists) {
      console.log('[Background] Duplicate notification, skipping save');
      return;
    }

    // Prepend new notification (newest first)
    notifications.unshift(notification);

    // Enforce cache size limit (FIFO - remove oldest)
    if (notifications.length > MAX_CACHE_SIZE) {
      notifications.splice(MAX_CACHE_SIZE);
    }

    // Save back to AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    console.log('[Background] Notification saved to cache:', notification._id);
  } catch (error) {
    console.error('[Background] Failed to save notification:', error);
  }
}

/**
 * Increment unread notification count
 */
async function incrementUnreadCount() {
  try {
    const stored = await AsyncStorage.getItem(COUNT_KEY);
    const count = stored ? parseInt(stored, 10) : 0;
    await AsyncStorage.setItem(COUNT_KEY, (count + 1).toString());
    console.log('[Background] Unread count incremented to', count + 1);
  } catch (error) {
    console.error('[Background] Failed to increment count:', error);
  }
}

// Register background handler for FCM
// This MUST be done at the top level, outside of any React components
// This allows notifications to be received when the app is in background or quit state
try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[Background] Message received:', remoteMessage);

    try {
      // 1. Save notification to AsyncStorage for offline access
      await saveNotificationToStorage(remoteMessage);

      // 2. Increment unread count
      await incrementUnreadCount();

      // 3. Log notification data for debugging
      console.log('[Background] Notification type:', remoteMessage.data?.type);
      console.log('[Background] Notification processed successfully');

      // The notification will be displayed by the system automatically
      // When user taps it, onNotificationOpenedApp will be triggered
    } catch (error) {
      console.error('[Background] Error processing notification:', error);
      // Don't throw - allow system notification to still display
    }
  });
} catch (error) {
  console.error('[Background] Failed to register background handler:', error);
}

AppRegistry.registerComponent(appName, () => App);
