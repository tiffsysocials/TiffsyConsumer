/**
 * Notification Type Constants
 *
 * Centralized definitions for all notification types and related enums
 * used throughout the application for FCM notifications.
 */

/**
 * All supported notification types in the app
 * Based on backend FCM notification types
 */
export enum NotificationType {
  // Order status notifications (specific)
  ORDER_ACCEPTED = 'ORDER_ACCEPTED',
  ORDER_REJECTED = 'ORDER_REJECTED',
  ORDER_PREPARING = 'ORDER_PREPARING',
  ORDER_READY = 'ORDER_READY',
  ORDER_PICKED_UP = 'ORDER_PICKED_UP',
  ORDER_OUT_FOR_DELIVERY = 'ORDER_OUT_FOR_DELIVERY',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_UPDATE = 'ORDER_UPDATE',

  // Auto-ordering notifications
  AUTO_ORDER_SUCCESS = 'AUTO_ORDER_SUCCESS',
  AUTO_ORDER_FAILED = 'AUTO_ORDER_FAILED',
  AUTO_ORDER_PAYMENT_REQUIRED = 'AUTO_ORDER_PAYMENT_REQUIRED',
  AUTO_ORDER_PAYMENT_EXPIRED = 'AUTO_ORDER_PAYMENT_EXPIRED',

  // Subscription notifications
  VOUCHER_EXPIRY_REMINDER = 'VOUCHER_EXPIRY_REMINDER',
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',

  // General notifications
  MENU_UPDATE = 'MENU_UPDATE',
  PROMOTIONAL = 'PROMOTIONAL',
  ADMIN_PUSH = 'ADMIN_PUSH',

  // Scheduled meal notifications
  SCHEDULED_MEAL_CREATED = 'SCHEDULED_MEAL_CREATED',
  SCHEDULED_MEAL_PLACED = 'SCHEDULED_MEAL_PLACED',
  SCHEDULED_MEAL_CANCELLED = 'SCHEDULED_MEAL_CANCELLED',
  SCHEDULED_MEAL_ISSUE = 'SCHEDULED_MEAL_ISSUE',

  // Legacy/generic (for backward compatibility)
  ORDER_STATUS_CHANGE = 'ORDER_STATUS_CHANGE',
}

/**
 * Auto-order failure categories
 * Each category maps to a specific user action or message
 */
export enum AutoOrderFailureCategory {
  NO_VOUCHERS = 'NO_VOUCHERS',                           // User has no available vouchers
  NO_ADDRESS = 'NO_ADDRESS',                             // No default delivery address set
  NO_ZONE = 'NO_ZONE',                                   // Address not in serviceable zone
  NO_KITCHEN = 'NO_KITCHEN',                             // No kitchen available for the area
  NO_MENU_ITEM = 'NO_MENU_ITEM',                         // Menu not available yet
  VOUCHER_REDEMPTION_FAILED = 'VOUCHER_REDEMPTION_FAILED', // Transaction failed
  KITCHEN_NOT_SERVING_ZONE = 'KITCHEN_NOT_SERVING_ZONE', // Kitchen doesn't serve the zone
  ORDER_CREATION_FAILED = 'ORDER_CREATION_FAILED',       // Order creation failed
  UNKNOWN = 'UNKNOWN',                                   // Generic failure
}

/**
 * Notification data interface for AUTO_ORDER_SUCCESS
 */
export interface AutoOrderSuccessData {
  type: NotificationType.AUTO_ORDER_SUCCESS;
  orderId: string;
  orderNumber: string;
  status: 'ACCEPTED';
  kitchenId: string;
  kitchenName?: string;
}

/**
 * Notification data interface for AUTO_ORDER_FAILED
 */
export interface AutoOrderFailedData {
  type: NotificationType.AUTO_ORDER_FAILED;
  failureCategory: AutoOrderFailureCategory;
  mealWindow: 'LUNCH' | 'DINNER';
  message?: string;
  failureReason?: string;
}

/**
 * Notification channel IDs for Android
 */
export const NotificationChannels = {
  ORDERS: 'orders_channel',
  SUBSCRIPTIONS: 'subscriptions_channel',
  GENERAL: 'general_channel',
  DEFAULT: 'default_channel',
} as const;

/**
 * Map notification types to their corresponding channels
 */
export const NotificationChannelMapping: Record<NotificationType, string> = {
  // Order status notifications → orders_channel
  [NotificationType.ORDER_ACCEPTED]: NotificationChannels.ORDERS,
  [NotificationType.ORDER_REJECTED]: NotificationChannels.ORDERS,
  [NotificationType.ORDER_PREPARING]: NotificationChannels.ORDERS,
  [NotificationType.ORDER_READY]: NotificationChannels.ORDERS,
  [NotificationType.ORDER_PICKED_UP]: NotificationChannels.ORDERS,
  [NotificationType.ORDER_OUT_FOR_DELIVERY]: NotificationChannels.ORDERS,
  [NotificationType.ORDER_DELIVERED]: NotificationChannels.ORDERS,
  [NotificationType.ORDER_CANCELLED]: NotificationChannels.ORDERS,
  [NotificationType.ORDER_UPDATE]: NotificationChannels.ORDERS,
  [NotificationType.AUTO_ORDER_SUCCESS]: NotificationChannels.ORDERS,
  [NotificationType.AUTO_ORDER_PAYMENT_REQUIRED]: NotificationChannels.ORDERS,
  [NotificationType.AUTO_ORDER_PAYMENT_EXPIRED]: NotificationChannels.ORDERS,

  // Subscription notifications → subscriptions_channel
  [NotificationType.AUTO_ORDER_FAILED]: NotificationChannels.SUBSCRIPTIONS,
  [NotificationType.VOUCHER_EXPIRY_REMINDER]: NotificationChannels.SUBSCRIPTIONS,
  [NotificationType.SUBSCRIPTION_CREATED]: NotificationChannels.SUBSCRIPTIONS,

  // Scheduled meal notifications → orders_channel
  [NotificationType.SCHEDULED_MEAL_CREATED]: NotificationChannels.ORDERS,
  [NotificationType.SCHEDULED_MEAL_PLACED]: NotificationChannels.ORDERS,
  [NotificationType.SCHEDULED_MEAL_CANCELLED]: NotificationChannels.ORDERS,
  [NotificationType.SCHEDULED_MEAL_ISSUE]: NotificationChannels.ORDERS,

  // General notifications → general_channel
  [NotificationType.MENU_UPDATE]: NotificationChannels.GENERAL,
  [NotificationType.PROMOTIONAL]: NotificationChannels.GENERAL,
  [NotificationType.ADMIN_PUSH]: NotificationChannels.GENERAL,

  // Legacy
  [NotificationType.ORDER_STATUS_CHANGE]: NotificationChannels.ORDERS,
};

/**
 * Helper to get channel ID for a notification type
 */
export const getChannelForType = (type: NotificationType): string => {
  return NotificationChannelMapping[type] || NotificationChannels.DEFAULT;
};

/**
 * Helper to check if notification type is auto-order related
 */
export const isAutoOrderNotification = (type: NotificationType): boolean => {
  return type === NotificationType.AUTO_ORDER_SUCCESS ||
         type === NotificationType.AUTO_ORDER_FAILED ||
         type === NotificationType.AUTO_ORDER_PAYMENT_REQUIRED ||
         type === NotificationType.AUTO_ORDER_PAYMENT_EXPIRED;
};
