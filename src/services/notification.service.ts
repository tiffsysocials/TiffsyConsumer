/**
 * Notification Service for FCM
 *
 * SETUP REQUIRED:
 * 1. Install the messaging package:
 *    npm install @react-native-firebase/messaging
 *
 * 2. For Android (android/app/build.gradle is already configured with Firebase)
 *
 * 3. For iOS:
 *    - cd ios && pod install
 *    - Enable Push Notifications capability in Xcode
 *    - Add APNs key in Firebase Console
 */

import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { NotificationType, AutoOrderFailureCategory } from '../constants/notificationTypes';

// FCM Token storage key
const FCM_TOKEN_KEY = 'fcm_token';
const FCM_PERMISSION_ASKED_KEY = 'fcm_permission_asked';

// Conditional require for messaging to handle cases where it's not installed
let messaging: any = null;

const loadMessaging = () => {
  if (messaging) return messaging;

  try {
    // Use require instead of import() for React Native Metro compatibility
    messaging = require('@react-native-firebase/messaging').default;
    return messaging;
  } catch (error) {
    console.warn('Firebase Messaging not installed. Run: npm install @react-native-firebase/messaging');
    return null;
  }
};

class NotificationService {
  private tokenRefreshUnsubscribe: (() => void) | null = null;

  /**
   * Check if Firebase Messaging is available
   */
  async isAvailable(): Promise<boolean> {
    const msg = loadMessaging();
    return msg !== null;
  }

  /**
   * Request notification permission
   * Returns true if granted, false otherwise
   */
  async requestPermission(): Promise<boolean> {
    const msg = loadMessaging();
    if (!msg) {
      console.warn('Firebase Messaging not available');
      return false;
    }

    try {
      // For Android 13+ (API 33+), need to request POST_NOTIFICATIONS permission
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission',
            message: 'Allow notifications to stay updated on your orders',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Android notification permission denied');
          return false;
        }
      }

      // Request Firebase messaging permission (required for iOS, also works on Android)
      const authStatus = await msg().requestPermission();

      const enabled =
        authStatus === msg.AuthorizationStatus.AUTHORIZED ||
        authStatus === msg.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Notification permission granted');
        await AsyncStorage.setItem(FCM_PERMISSION_ASKED_KEY, 'true');
        return true;
      }

      console.log('Notification permission denied');
      await AsyncStorage.setItem(FCM_PERMISSION_ASKED_KEY, 'true');
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Check current permission status without requesting
   */
  async checkPermission(): Promise<boolean> {
    const msg = loadMessaging();
    if (!msg) return false;

    try {
      const authStatus = await msg().hasPermission();
      return (
        authStatus === msg.AuthorizationStatus.AUTHORIZED ||
        authStatus === msg.AuthorizationStatus.PROVISIONAL
      );
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return false;
    }
  }

  /**
   * Check if permission was already asked before
   */
  async wasPermissionAsked(): Promise<boolean> {
    const asked = await AsyncStorage.getItem(FCM_PERMISSION_ASKED_KEY);
    return asked === 'true';
  }

  /**
   * Get FCM token
   * Returns null if permission not granted or error occurs
   *
   * iOS: must register for remote messages and have an APNs token bound
   * before getToken() will succeed. Without this guard the call can
   * silently return null on first launch and the user ends up with no
   * FCM token in the backend.
   */
  async getToken(): Promise<string | null> {
    const msg = loadMessaging();
    if (!msg) return null;

    try {
      // Check if permission is granted
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        console.log('No notification permission, cannot get FCM token');
        return null;
      }

      if (Platform.OS === 'ios') {
        try {
          if (!msg().isDeviceRegisteredForRemoteMessages) {
            await msg().registerDeviceForRemoteMessages();
          }
          const apnsToken = await msg().getAPNSToken();
          if (!apnsToken) {
            console.warn(
              '[FCM] iOS APNs token not yet available; check APNs key in Firebase Console and Push Notifications capability'
            );
            return null;
          }
        } catch (iosErr) {
          console.error('[FCM] iOS APNs registration failed:', iosErr);
          return null;
        }
      }

      const token = await msg().getToken();

      if (token) {
        // Store token locally
        await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
        console.log('FCM Token obtained successfully');
      }

      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Get stored FCM token
   */
  async getStoredToken(): Promise<string | null> {
    return AsyncStorage.getItem(FCM_TOKEN_KEY);
  }

  /**
   * Delete FCM token (useful for logout)
   */
  async deleteToken(): Promise<void> {
    const msg = loadMessaging();

    try {
      if (msg) {
        await msg().deleteToken();
      }
      await AsyncStorage.removeItem(FCM_TOKEN_KEY);
      console.log('FCM Token deleted');
    } catch (error) {
      console.error('Error deleting FCM token:', error);
    }
  }

  /**
   * Set up token refresh listener
   */
  async setupTokenRefreshListener(onTokenRefresh: (token: string) => void): Promise<void> {
    const msg = loadMessaging();
    if (!msg) return;

    try {
      // Clean up existing listener
      if (this.tokenRefreshUnsubscribe) {
        this.tokenRefreshUnsubscribe();
      }

      this.tokenRefreshUnsubscribe = msg().onTokenRefresh(async (token: string) => {
        console.log('FCM Token refreshed');
        await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
        onTokenRefresh(token);
      });
    } catch (error) {
      console.error('Error setting up token refresh listener:', error);
    }
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    if (this.tokenRefreshUnsubscribe) {
      this.tokenRefreshUnsubscribe();
      this.tokenRefreshUnsubscribe = null;
    }
  }

  /**
   * Generate a device ID (for FCM token registration)
   */
  async getDeviceId(): Promise<string> {
    const DEVICE_ID_KEY = 'device_id';

    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      // Generate a unique device ID
      deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  }

  /**
   * Set up foreground notification handler
   * This is called when a notification is received while the app is in the foreground
   */
  async setupForegroundHandler(
    onNotification: (message: FirebaseMessagingTypes.RemoteMessage) => void
  ): Promise<() => void> {
    const msg = loadMessaging();
    if (!msg) return () => {};

    try {
      return msg().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('Foreground notification received:', remoteMessage);
        onNotification(remoteMessage);
      });
    } catch (error) {
      console.error('Error setting up foreground handler:', error);
      return () => {};
    }
  }

  /**
   * Set up background notification handler
   * This is called when a notification is received while the app is in the background or quit state
   */
  setupBackgroundHandler(
    handler: (message: FirebaseMessagingTypes.RemoteMessage) => Promise<void>
  ): void {
    const msg = loadMessaging();
    if (!msg) return;

    try {
      msg().setBackgroundMessageHandler(handler);
    } catch (error) {
      console.error('Error setting up background handler:', error);
    }
  }

  /**
   * Get initial notification that opened the app
   * Returns the notification data if app was opened by a notification, null otherwise
   */
  async getInitialNotification(): Promise<FirebaseMessagingTypes.RemoteMessage | null> {
    const msg = loadMessaging();
    if (!msg) return null;

    try {
      return await msg().getInitialNotification();
    } catch (error) {
      console.error('Error getting initial notification:', error);
      return null;
    }
  }

  /**
   * Set up notification opened handler
   * This is called when a notification is tapped by the user
   */
  setupNotificationOpenedHandler(
    onNotificationOpened: (message: FirebaseMessagingTypes.RemoteMessage) => void
  ): () => void {
    const msg = loadMessaging();
    if (!msg) return () => {};

    try {
      return msg().onNotificationOpenedApp((remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('Notification opened app:', remoteMessage);
        onNotificationOpened(remoteMessage);
      });
    } catch (error) {
      console.error('Error setting up notification opened handler:', error);
      return () => {};
    }
  }

  /**
   * Handle notification data and determine navigation
   * Returns navigation params based on notification type
   */
  handleNotificationData(data: { [key: string]: string } | undefined): {
    screen: string;
    params?: any;
  } | null {
    if (!data) return null;

    const type = data.type as NotificationType;

    switch (type) {
      // Auto-order success - navigate to order detail
      case NotificationType.AUTO_ORDER_SUCCESS:
        console.log('[NotificationService] Handling AUTO_ORDER_SUCCESS notification');
        return {
          screen: 'OrderDetail',
          params: {
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            fromNotification: true,
          },
        };

      // Auto-order failed - navigate to auto-order settings so user can take action
      case NotificationType.AUTO_ORDER_FAILED:
        console.log('[NotificationService] Handling AUTO_ORDER_FAILED notification');
        return {
          screen: 'AutoOrderSettings',
          params: {
            fromNotification: true,
          },
        };

      // Auto-order payment required - navigate to order detail for payment
      case NotificationType.AUTO_ORDER_PAYMENT_REQUIRED:
        console.log('[NotificationService] Handling AUTO_ORDER_PAYMENT_REQUIRED notification');
        return {
          screen: 'OrderDetail',
          params: {
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            fromNotification: true,
          },
        };

      // Auto-order payment expired - navigate to order detail
      case NotificationType.AUTO_ORDER_PAYMENT_EXPIRED:
        console.log('[NotificationService] Handling AUTO_ORDER_PAYMENT_EXPIRED notification');
        return {
          screen: 'OrderDetail',
          params: {
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            fromNotification: true,
          },
        };

      // Scheduled meal notifications
      case NotificationType.SCHEDULED_MEAL_CREATED:
      case NotificationType.SCHEDULED_MEAL_CANCELLED:
      case NotificationType.SCHEDULED_MEAL_ISSUE:
        console.log(`[NotificationService] Handling ${type} notification`);
        return {
          screen: 'MyScheduledMeals',
        };

      case NotificationType.SCHEDULED_MEAL_PLACED:
        console.log('[NotificationService] Handling SCHEDULED_MEAL_PLACED notification');
        if (data.orderId) {
          return {
            screen: 'OrderDetail',
            params: {
              orderId: data.orderId,
            },
          };
        }
        return {
          screen: 'MyScheduledMeals',
        };

      // Geofencing order update - navigate to order detail
      case NotificationType.ORDER_UPDATE:
        console.log('[NotificationService] Handling ORDER_UPDATE notification');
        if (data.orderId) {
          return {
            screen: 'OrderDetail',
            params: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
            },
          };
        }
        break;

      // Specific order status notifications - navigate to order tracking/detail
      case NotificationType.ORDER_ACCEPTED:
      case NotificationType.ORDER_PREPARING:
      case NotificationType.ORDER_READY:
      case NotificationType.ORDER_PICKED_UP:
      case NotificationType.ORDER_OUT_FOR_DELIVERY:
        console.log(`[NotificationService] Handling ${type} notification`);
        if (data.orderId) {
          return {
            screen: 'OrderTracking',
            params: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
            },
          };
        }
        break;

      case NotificationType.ORDER_DELIVERED:
        console.log('[NotificationService] Handling ORDER_DELIVERED notification');
        if (data.orderId) {
          return {
            screen: 'OrderDetail',
            params: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              showRating: true,
            },
          };
        }
        break;

      case NotificationType.ORDER_REJECTED:
      case NotificationType.ORDER_CANCELLED:
        console.log(`[NotificationService] Handling ${type} notification`);
        if (data.orderId) {
          return {
            screen: 'OrderDetail',
            params: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
            },
          };
        }
        break;

      // Legacy order status change (backward compatibility)
      case NotificationType.ORDER_STATUS_CHANGE:
        console.log('[NotificationService] Handling ORDER_STATUS_CHANGE notification');
        if (data.orderId) {
          return {
            screen: 'OrderDetail',
            params: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
            },
          };
        }
        break;

      // Subscription notifications
      case NotificationType.VOUCHER_EXPIRY_REMINDER:
        console.log('[NotificationService] Handling VOUCHER_EXPIRY_REMINDER notification');
        if (data.voucherCount) {
          return {
            screen: 'Vouchers',
            params: {
              highlightExpiring: true,
            },
          };
        }
        break;

      case NotificationType.SUBSCRIPTION_CREATED:
        console.log('[NotificationService] Handling SUBSCRIPTION_CREATED notification');
        return {
          screen: 'Vouchers',
          params: {
            highlightNew: true,
          },
        };

      // General notifications
      case NotificationType.MENU_UPDATE:
        console.log('[NotificationService] Handling MENU_UPDATE notification');
        if (data.kitchenId) {
          return {
            screen: 'KitchenMenu',
            params: {
              kitchenId: data.kitchenId,
            },
          };
        }
        // Fallback to home if no kitchen ID
        return {
          screen: 'Home',
        };

      case NotificationType.PROMOTIONAL:
        console.log('[NotificationService] Handling PROMOTIONAL notification');
        // If specific screen is provided in data
        if (data.targetScreen) {
          return {
            screen: data.targetScreen,
            params: data.targetParams ? JSON.parse(data.targetParams) : undefined,
          };
        }
        // Default to meal plans for promotions
        return {
          screen: 'MealPlans',
        };

      case NotificationType.ADMIN_PUSH:
        console.log('[NotificationService] Handling ADMIN_PUSH notification');
        // Admin notifications can specify a target screen
        if (data.targetScreen) {
          return {
            screen: data.targetScreen,
            params: data.targetParams ? JSON.parse(data.targetParams) : undefined,
          };
        }
        return {
          screen: 'Home',
        };

      default:
        // Legacy fallback for notifications without explicit type
        console.log('[NotificationService] Handling notification with unknown or legacy type');

        // Try order ID
        if (data.orderId) {
          return {
            screen: 'OrderDetail',
            params: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
            },
          };
        }

        // Try voucher count
        if (data.voucherCount) {
          return {
            screen: 'Vouchers',
            params: {
              highlightExpiring: true,
            },
          };
        }

        // Try kitchen ID
        if (data.kitchenId) {
          return {
            screen: 'KitchenMenu',
            params: {
              kitchenId: data.kitchenId,
            },
          };
        }

        // Default to notifications screen
        return {
          screen: 'Notifications',
        };
    }

    // Fallback to notifications screen
    return {
      screen: 'Notifications',
    };
  }

  /**
   * Request notification permission and get token if granted
   */
  async initialize(): Promise<string | null> {
    const hasPermission = await this.requestPermission();
    if (hasPermission) {
      return await this.getToken();
    }
    return null;
  }
}

export default new NotificationService();
