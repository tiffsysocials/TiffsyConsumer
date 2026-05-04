# Tiffsy Consumer App - FCM Notification Integration Guide

## Overview

This document provides complete integration details for FCM (Firebase Cloud Messaging) notifications in the Tiffsy Consumer App built with React Native and `@react-native-firebase/messaging`.

---

## Table of Contents

1. [Notification Types](#notification-types)
2. [Android Notification Channels](#android-notification-channels)
3. [FCM Payload Structure](#fcm-payload-structure)
4. [Frontend Implementation](#frontend-implementation)
5. [Backend Requirements](#backend-requirements)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)

---

## Notification Types

### Complete List (Consumer App)

| Category | Type | Channel | Description |
|----------|------|---------|-------------|
| **Order Status** | `ORDER_ACCEPTED` | orders_channel | Kitchen accepted order |
| | `ORDER_PREPARING` | orders_channel | Kitchen preparing meal |
| | `ORDER_READY` | orders_channel | Order ready for pickup |
| | `ORDER_PICKED_UP` | orders_channel | Driver picked up order |
| | `ORDER_OUT_FOR_DELIVERY` | orders_channel | Order out for delivery |
| | `ORDER_DELIVERED` | orders_channel | Order delivered |
| | `ORDER_CANCELLED` | orders_channel | Order cancelled |
| | `ORDER_REJECTED` | orders_channel | Kitchen rejected order |
| **Auto-Order** | `AUTO_ORDER_SUCCESS` | orders_channel | Auto-order placed successfully |
| | `AUTO_ORDER_FAILED` | subscriptions_channel | Auto-order failed |
| **Subscription** | `VOUCHER_EXPIRY_REMINDER` | subscriptions_channel | Vouchers expiring soon |
| | `SUBSCRIPTION_CREATED` | subscriptions_channel | New subscription purchased |
| **General** | `MENU_UPDATE` | general_channel | Menu updates |
| | `PROMOTIONAL` | general_channel | Promotional offers |
| | `ADMIN_PUSH` | general_channel | Admin announcements |
| **Legacy** | `ORDER_STATUS_CHANGE` | orders_channel | Generic order update |

---

## Android Notification Channels

### Channel Configuration

#### 1. **orders_channel** (High Priority)
```kotlin
// Channel: orders_channel
// Name: Orders
// Importance: HIGH
// Features: Sound, Vibration, LED (Orange), Badge
// Vibration: [0, 300, 200, 300]
// Use: Order status updates, delivery notifications
```

#### 2. **subscriptions_channel** (High Priority)
```kotlin
// Channel: subscriptions_channel
// Name: Subscriptions
// Importance: HIGH
// Features: Sound, Vibration, LED (Purple), Badge
// Vibration: [0, 200, 100, 200]
// Use: Voucher alerts, subscription notifications
```

#### 3. **general_channel** (Default Priority)
```kotlin
// Channel: general_channel
// Name: General
// Importance: DEFAULT
// Features: Sound, LED (Green), No vibration, No badge
// Use: Menu updates, promotional messages
```

#### 4. **default_channel** (Fallback)
```kotlin
// Channel: default_channel
// Name: Default
// Importance: DEFAULT
// Features: Sound, Vibration, Badge
// Use: Uncategorized notifications
```

### Native Module Implementation

Location: `android/app/src/main/java/com/tiffindelivery/NotificationChannelModule.kt`

All channels are created on app startup via:
```javascript
import notificationChannelService from './services/notificationChannel.service';

// In App.tsx componentDidMount or useEffect
await notificationChannelService.createChannels();
```

---

## FCM Payload Structure

### React Native Compatible Format

**CRITICAL**: Use `android.channelId` (NOT `android.notification.channelId`)

```javascript
{
  // System notification (shown in tray)
  notification: {
    title: "Notification Title",
    body: "Notification body text"
  },

  // Custom data (all values must be STRINGS)
  data: {
    type: "NOTIFICATION_TYPE",       // Required
    channelId: "channel_name",       // Required for Android channels
    // ... type-specific fields (strings only)
  },

  // Android-specific config (React Native)
  android: {
    channelId: "channel_name",       // ✅ CORRECT for React Native
    priority: "high" | "default"
  },

  // iOS-specific config
  apns: {
    payload: {
      aps: {
        sound: "default",
        badge: 1
      }
    }
  }
}
```

### Example Payloads

#### 1. Order Accepted
```json
{
  "notification": {
    "title": "Order Confirmed!",
    "body": "Your order #ORD-123456 has been accepted."
  },
  "data": {
    "type": "ORDER_ACCEPTED",
    "orderId": "64f8a3c9e1b2c3d4e5f6g7h8",
    "orderNumber": "ORD-123456",
    "channelId": "orders_channel"
  },
  "android": {
    "channelId": "orders_channel",
    "priority": "high"
  }
}
```

#### 2. Auto-Order Success
```json
{
  "notification": {
    "title": "Your lunch is on the way! 🍱",
    "body": "Order #ORD-123456 accepted by Tiffsy Kitchen"
  },
  "data": {
    "type": "AUTO_ORDER_SUCCESS",
    "orderId": "64f8a3c9e1b2c3d4e5f6g7h8",
    "orderNumber": "ORD-123456",
    "mealWindow": "LUNCH",
    "kitchenName": "Tiffsy Kitchen",
    "channelId": "orders_channel"
  },
  "android": {
    "channelId": "orders_channel",
    "priority": "high"
  }
}
```

#### 3. Auto-Order Failed
```json
{
  "notification": {
    "title": "Couldn't place your lunch order",
    "body": "No vouchers available"
  },
  "data": {
    "type": "AUTO_ORDER_FAILED",
    "mealWindow": "LUNCH",
    "failureCategory": "NO_VOUCHERS",
    "message": "No vouchers available. Purchase a subscription to continue.",
    "channelId": "subscriptions_channel"
  },
  "android": {
    "channelId": "subscriptions_channel",
    "priority": "high"
  }
}
```

**Failure Categories:**
- `NO_VOUCHERS` → Navigate to MealPlans
- `NO_ADDRESS` → Navigate to Address
- `NO_ZONE` → Navigate to Address
- `NO_KITCHEN` → Info message only
- `NO_MENU_ITEM` → Navigate to Home
- `VOUCHER_REDEMPTION_FAILED` → Contact support
- `UNKNOWN` → Navigate to Home

#### 4. Voucher Expiry Reminder
```json
{
  "notification": {
    "title": "Vouchers Expiring Soon!",
    "body": "You have 3 vouchers expiring in 7 days."
  },
  "data": {
    "type": "VOUCHER_EXPIRY_REMINDER",
    "count": "3",
    "expiryDate": "2024-01-25",
    "daysRemaining": "7",
    "channelId": "subscriptions_channel"
  },
  "android": {
    "channelId": "subscriptions_channel",
    "priority": "high"
  }
}
```

---

## Frontend Implementation

### File Structure

```
src/
├── constants/
│   └── notificationTypes.ts              # All notification types
├── services/
│   ├── notificationStorage.service.ts    # AsyncStorage persistence
│   ├── notificationChannel.service.ts    # Android channel wrapper
│   └── notification.service.ts           # FCM handling
├── components/
│   ├── NotificationPopup.tsx             # Foreground notification UI
│   ├── NotificationDetailModal.tsx       # Notification detail view
│   └── AutoOrderFailureModal.tsx         # Auto-order failure handler
├── context/
│   └── NotificationContext.tsx           # Notification state management
└── screens/
    └── notifications/
        └── AutoOrderFailureScreen.tsx    # Failure screen wrapper
```

### Notification Handling Flow

```
┌─────────────────────────────────────────┐
│ FCM Message Received                     │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   Background/Quit      Foreground
        │                   │
        │                   │
   index.js              App.tsx
   setBackgroundMessageHandler  onMessage
        │                   │
        ├─────────┬─────────┘
                  │
        ┌─────────┴─────────┐
        │ Save to AsyncStorage │
        │ (notificationStorage.service.ts) │
        └─────────┬─────────┘
                  │
        ┌─────────┴─────────┐
        │ Notification Context │
        │ Merge with backend   │
        └─────────┬─────────┘
                  │
        ┌─────────┴─────────┐
        │ Display UI          │
        │ (NotificationPopup) │
        └─────────┬─────────┘
                  │
        ┌─────────┴─────────┐
        │ User Taps           │
        └─────────┬─────────┘
                  │
        ┌─────────┴─────────┐
        │ Navigate to Screen  │
        │ (notification.service.ts) │
        └─────────────────────┘
```

### Notification Persistence

**Background Handler** (`index.js`):
```javascript
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  // 1. Save to AsyncStorage
  await saveNotificationToStorage(remoteMessage);

  // 2. Increment unread count
  await incrementUnreadCount();

  // 3. Log notification
  console.log('Background notification:', remoteMessage);
});
```

**Storage Service** (`notificationStorage.service.ts`):
- Saves notifications to AsyncStorage
- Deduplicates by messageId or _id
- Enforces cache size limit (100 max)
- Cleans up notifications older than 30 days
- Merges cached + backend notifications

**Offline Support**:
- Notifications persist even when app is closed
- On app open: merge cached with backend (backend is source of truth)
- If offline: show cached notifications only

### Navigation Mapping

| Notification Type | Target Screen | Params |
|-------------------|---------------|--------|
| ORDER_ACCEPTED - ORDER_OUT_FOR_DELIVERY | OrderTracking | orderId |
| ORDER_DELIVERED | OrderDetail | orderId, showRating: true |
| ORDER_CANCELLED, ORDER_REJECTED | OrderDetail | orderId |
| AUTO_ORDER_SUCCESS | OrderDetail | orderId, orderNumber |
| AUTO_ORDER_FAILED | AutoOrderFailure | failureCategory, mealWindow |
| VOUCHER_EXPIRY_REMINDER | Vouchers | highlightExpiring: true |
| SUBSCRIPTION_CREATED | Vouchers | highlightNew: true |
| MENU_UPDATE | Home | - |
| PROMOTIONAL | MealPlans or custom | - |

---

## Backend Requirements

### Notification Sending Function

```javascript
// services/notification.service.js

const NOTIFICATION_CHANNELS = {
  ORDER_ACCEPTED: 'orders_channel',
  ORDER_PREPARING: 'orders_channel',
  ORDER_READY: 'orders_channel',
  ORDER_PICKED_UP: 'orders_channel',
  ORDER_OUT_FOR_DELIVERY: 'orders_channel',
  ORDER_DELIVERED: 'orders_channel',
  ORDER_CANCELLED: 'orders_channel',
  ORDER_REJECTED: 'orders_channel',
  AUTO_ORDER_SUCCESS: 'orders_channel',
  AUTO_ORDER_FAILED: 'subscriptions_channel',
  VOUCHER_EXPIRY_REMINDER: 'subscriptions_channel',
  SUBSCRIPTION_CREATED: 'subscriptions_channel',
  MENU_UPDATE: 'general_channel',
  PROMOTIONAL: 'general_channel',
  ADMIN_PUSH: 'general_channel',
};

async function sendPushNotification(userId, type, data) {
  const user = await User.findById(userId);
  if (!user?.fcmToken) return;

  const channelId = NOTIFICATION_CHANNELS[type] || 'default_channel';

  const message = {
    notification: {
      title: data.title,
      body: data.body,
    },
    data: {
      type: type,
      channelId: channelId,  // For our native module
      ...data.customData,     // All values must be strings!
    },
    android: {
      channelId: channelId,   // React Native Firebase uses this
      priority: channelId.includes('orders') || channelId.includes('subscriptions')
        ? 'high'
        : 'default',
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    token: user.fcmToken,
  };

  try {
    await admin.messaging().send(message);
    console.log('✅ Notification sent:', type);
  } catch (error) {
    console.error('❌ Failed to send notification:', error);
  }
}
```

### Data Type Constraints

**CRITICAL**: All values in `data` object MUST be strings!

```javascript
// ❌ WRONG
data: {
  type: "ORDER_ACCEPTED",
  orderId: objectId,           // Object
  count: 3,                    // Number
  isAutoOrder: true,           // Boolean
}

// ✅ CORRECT
data: {
  type: "ORDER_ACCEPTED",
  orderId: objectId.toString(), // String
  count: "3",                   // String
  isAutoOrder: "true",          // String
}
```

**Frontend parsing:**
```javascript
const count = parseInt(data.count, 10);
const isAutoOrder = data.isAutoOrder === 'true';
```

### Token Management Endpoints

```javascript
// Register FCM token
POST /api/auth/register-fcm-token
Body: { fcmToken: "..." }

// Remove FCM token (logout)
DELETE /api/auth/fcm-token
Body: { fcmToken: "..." }
```

---


---

## Implementation Checklist

### Backend
- [ ] Add `channelId` to all FCM payloads
- [ ] Ensure all `data` values are strings
- [ ] Use `android.channelId` (not `android.notification.channelId`)
- [ ] Implement channel mapping for all notification types


### Frontend
- [x] Create Android notification channels (native module)
- [x] Implement background notification handler with persistence
- [x] Update foreground handler (non-blocking UI)
- [x] Add handlers for all notification types
- [x] Implement offline support with AsyncStorage
- [x] Add navigation for all notification types
- [x] Create auto-order failure modal
- [x] Update UI components with new notification icons

---
