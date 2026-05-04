# Tiffsy Consumer App - Testing Checklist

## Quick Testing Guide

This checklist covers all critical testing scenarios for the auto-ordering and notification features.

---

## Pre-Testing Setup

- [ ] Rebuild Android app: `cd android && ./gradlew clean && cd .. && npm run android`
- [ ] Verify Firebase configuration is up to date
- [ ] Get FCM token from app logs
- [ ] Have Firebase Console open for manual notification sending
- [ ] Have backend admin access for triggering notifications

---

## 1. Notification System Tests

### 1.1 Background Notifications (App Closed)

- [ ] **Test**: Close app completely → Send ORDER_ACCEPTED notification
  - **Expected**: System tray notification appears
  - **Tap**: Opens OrderTracking screen with correct order

- [ ] **Test**: Close app → Send AUTO_ORDER_SUCCESS notification
  - **Expected**: System tray notification appears
  - **Tap**: Opens OrderDetail screen with order info

- [ ] **Test**: Close app → Send AUTO_ORDER_FAILED notification
  - **Expected**: System tray notification appears
  - **Tap**: Opens AutoOrderFailure modal with correct category

- [ ] **Test**: Close app → Send VOUCHER_EXPIRY_REMINDER
  - **Expected**: System tray notification appears
  - **Tap**: Opens Vouchers screen

### 1.2 Foreground Notifications (App Open)

- [ ] **Test**: App open → Send ORDER_PREPARING notification
  - **Expected**: Non-blocking popup appears at top of screen
  - **Tap "View"**: Navigates to OrderTracking screen
  - **Tap "Dismiss"**: Popup closes
  - **Wait 10s**: Auto-dismisses

- [ ] **Test**: App open → Send ORDER_DELIVERED notification
  - **Expected**: Popup with delivery confirmation
  - **Tap "View"**: Opens OrderDetail with rating prompt

### 1.3 Notification Persistence

- [ ] **Test**: Close app → Send 5 notifications → Open app
  - **Expected**: All 5 notifications appear in Notifications screen
  - **Verify**: Unread count badge shows "5"

- [ ] **Test**: Open app → Navigate to Notifications screen → Mark one as read
  - **Expected**: Unread count decreases by 1
  - **Verify**: Read notification styled differently

### 1.4 Offline Behavior

- [ ] **Test**: Turn off WiFi/data → Close app → Send notification → Open app
  - **Expected**: Cached notifications display (if any exist)
  - **Turn on internet**: Pull to refresh → Backend notifications merge with cache

### 1.5 Android Notification Channels

- [ ] **Test**: Open Android Settings → Apps → Tiffsy → Notifications
  - **Verify**: 4 channels exist:
    - Orders (High priority)
    - Subscriptions (High priority)
    - General (Default priority)
    - Default (Default priority)

- [ ] **Test**: Send ORDER_ACCEPTED → Check notification settings
  - **Verify**: Uses "Orders" channel
  - **Verify**: Sound + vibration enabled

- [ ] **Test**: Send VOUCHER_EXPIRY_REMINDER
  - **Verify**: Uses "Subscriptions" channel
  - **Verify**: Sound + vibration enabled

- [ ] **Test**: Send PROMOTIONAL
  - **Verify**: Uses "General" channel
  - **Verify**: No vibration

---

## 2. Auto-Ordering Features

### 2.1 Auto-Order Settings Screen

- [ ] **Navigate**: Account → Auto-Order Settings
  - **Verify**: Screen loads with current subscription data

- [ ] **Test**: Toggle "Enable Auto-Ordering" ON
  - **Expected**: Requires delivery address (shows error if none set)
  - **Expected**: Requires meal type selection

- [ ] **Test**: Select "Lunch Only" → Save
  - **Expected**: Settings update successfully
  - **Verify**: Next auto-order time displays (~10:00 AM)

- [ ] **Test**: Select "Dinner Only" → Save
  - **Expected**: Settings update successfully
  - **Verify**: Next auto-order time displays (~6:00 PM)

- [ ] **Test**: Select "Both Meals" → Save
  - **Expected**: Settings update successfully
  - **Verify**: Next auto-order time displays (earlier of lunch/dinner)

### 2.2 Pause/Resume Functionality

- [ ] **Test**: Click "Pause Auto-Ordering"
  - **Expected**: Modal opens with reason field and date picker
  - **Enter**: Reason "Vacation" + Date 7 days from now → Confirm
  - **Expected**: Success message, settings update
  - **Verify**: Pause status displays in AccountScreen

- [ ] **Test**: Click "Resume Auto-Ordering" (while paused)
  - **Expected**: Modal opens with confirmation
  - **Confirm**: Settings update, pause status removed
  - **Verify**: Next auto-order time reappears

### 2.3 Skip Meal Calendar

- [ ] **Navigate**: Auto-Order Settings → Skip Meals
  - **Expected**: Calendar loads with existing skipped slots marked

- [ ] **Test**: Tap future date (e.g., tomorrow)
  - **Expected**: Bottom panel slides up
  - **Select**: LUNCH → Enter reason → Click "Skip"
  - **Expected**: Calendar updates with orange dot, success message

- [ ] **Test**: Tap already-skipped date
  - **Expected**: Panel shows "Unskip" button (green)
  - **Click Unskip**: Dot removes from calendar

- [ ] **Test**: Try to skip past date
  - **Expected**: Error message "Cannot skip past meals"

- [ ] **Verify**: Monthly summary shows correct skipped count

### 2.4 Dashboard Integration

#### AccountScreen

- [ ] **Test**: Open AccountScreen with active subscription + auto-ordering enabled
  - **Verify**: "Next Auto-Order" card displays with time
  - **Format**: "Today at 10:00 AM" or "Tomorrow at 6:00 PM"

- [ ] **Test**: Pause auto-ordering → Return to AccountScreen
  - **Verify**: "Auto-Ordering Paused" status displays
  - **Verify**: Resume date shows if set

- [ ] **Test**: Click settings icon on voucher card
  - **Expected**: Navigates to AutoOrderSettings screen

- [ ] **Test**: Navigate to Account menu
  - **Verify**: "Auto-Order Settings" menu item exists

#### YourOrdersScreen

- [ ] **Test**: Open YourOrders screen with auto-orders present
  - **Verify**: Auto-order badge appears on auto-ordered meals (purple badge)
  - **Badge text**: "Auto-Order"

- [ ] **Test**: Click "Show Auto-Orders" filter toggle
  - **Expected**: Filter activates (white background)
  - **Verify**: Only auto-orders display
  - **Click again**: Shows all orders

#### OrderDetailScreen

- [ ] **Test**: Open detail for an auto-order
  - **Verify**: "Auto-Order Info" section displays (purple background)
  - **Text**: "This meal was automatically ordered based on your subscription."

---

## 3. Auto-Order Notification Flows

### 3.1 AUTO_ORDER_SUCCESS

- [ ] **Test**: Receive AUTO_ORDER_SUCCESS notification
  - **Tap**: Opens OrderDetail screen
  - **Verify**: Order details load correctly
  - **Verify**: Shows order number, items, status

### 3.2 AUTO_ORDER_FAILED - Each Category

#### NO_VOUCHERS
- [ ] **Test**: Receive AUTO_ORDER_FAILED with failureCategory: "NO_VOUCHERS"
  - **Tap**: Opens AutoOrderFailure modal
  - **Verify**: Shows "No Vouchers Available" title
  - **Verify**: CTA button says "Buy Subscription"
  - **Click CTA**: Navigates to MealPlans screen

#### NO_ADDRESS
- [ ] **Test**: Receive AUTO_ORDER_FAILED with failureCategory: "NO_ADDRESS"
  - **Verify**: Shows "No Delivery Address" title
  - **Verify**: CTA button says "Add Address"
  - **Click CTA**: Navigates to Address screen

#### NO_ZONE
- [ ] **Test**: Receive AUTO_ORDER_FAILED with failureCategory: "NO_ZONE"
  - **Verify**: Shows "Address Not Serviceable" title
  - **Verify**: CTA button says "Update Address"
  - **Click CTA**: Navigates to Address screen

#### NO_KITCHEN
- [ ] **Test**: Receive AUTO_ORDER_FAILED with failureCategory: "NO_KITCHEN"
  - **Verify**: Shows "No Kitchen Available" title
  - **Verify**: No CTA button (info only)
  - **Dismiss**: Modal closes

#### NO_MENU_ITEM
- [ ] **Test**: Receive AUTO_ORDER_FAILED with failureCategory: "NO_MENU_ITEM"
  - **Verify**: Shows "Menu Not Available" title
  - **Verify**: CTA button says "Check Menu"
  - **Click CTA**: Navigates to Home screen

#### VOUCHER_REDEMPTION_FAILED
- [ ] **Test**: Receive AUTO_ORDER_FAILED with failureCategory: "VOUCHER_REDEMPTION_FAILED"
  - **Verify**: Shows "Payment Failed" title
  - **Verify**: CTA button says "Contact Support"
  - **Click CTA**: Opens contact support flow

#### UNKNOWN
- [ ] **Test**: Receive AUTO_ORDER_FAILED with failureCategory: "UNKNOWN"
  - **Verify**: Shows generic failure message
  - **Verify**: CTA button says "Order Manually"
  - **Click CTA**: Navigates to Home screen

---

## 4. Order Status Notifications

### 4.1 Active Order Statuses

- [ ] **Test**: ORDER_ACCEPTED notification
  - **Tap**: Opens OrderTracking screen
  - **Verify**: Shows "Order Accepted" status

- [ ] **Test**: ORDER_PREPARING notification
  - **Tap**: Opens OrderTracking screen
  - **Verify**: Shows "Preparing" status with progress

- [ ] **Test**: ORDER_READY notification
  - **Tap**: Opens OrderTracking screen
  - **Verify**: Shows "Ready for Pickup" status

- [ ] **Test**: ORDER_OUT_FOR_DELIVERY notification
  - **Tap**: Opens OrderTracking screen
  - **Verify**: Shows delivery in progress

### 4.2 Completed/Cancelled Statuses

- [ ] **Test**: ORDER_DELIVERED notification
  - **Tap**: Opens OrderDetail screen
  - **Verify**: Rating prompt appears (if not already rated)

- [ ] **Test**: ORDER_CANCELLED notification
  - **Tap**: Opens OrderDetail screen
  - **Verify**: Shows cancelled status and reason

- [ ] **Test**: ORDER_REJECTED notification
  - **Tap**: Opens OrderDetail screen
  - **Verify**: Shows rejected status and reason

---

## 5. Subscription Notifications

### 5.1 Voucher Expiry

- [ ] **Test**: VOUCHER_EXPIRY_REMINDER notification
  - **Tap**: Opens Vouchers screen
  - **Verify**: Expiring vouchers highlighted
  - **Verify**: Shows expiry date

### 5.2 New Subscription

- [ ] **Test**: SUBSCRIPTION_CREATED notification
  - **Tap**: Opens Vouchers screen
  - **Verify**: New vouchers displayed
  - **Verify**: Shows subscription details

---

## 6. General Notifications

### 6.1 Menu Update

- [ ] **Test**: MENU_UPDATE notification
  - **Tap**: Opens Home screen
  - **Verify**: Menu updates visible (if any)

### 6.2 Promotional

- [ ] **Test**: PROMOTIONAL notification with no targetScreen
  - **Tap**: Opens MealPlans screen (default)

- [ ] **Test**: PROMOTIONAL notification with targetScreen: "Vouchers"
  - **Tap**: Opens Vouchers screen

### 6.3 Admin Push

- [ ] **Test**: ADMIN_PUSH notification with no custom screen
  - **Tap**: Opens Home screen (default)

- [ ] **Test**: ADMIN_PUSH notification with targetScreen
  - **Tap**: Opens specified screen

---

## 7. Edge Cases & Error Handling

### 7.1 Network Issues

- [ ] **Test**: Turn off internet → Try to enable auto-ordering
  - **Expected**: Shows network error message

- [ ] **Test**: Turn off internet → Try to skip meal
  - **Expected**: Shows network error message

- [ ] **Test**: Turn off internet → Open notifications screen
  - **Expected**: Shows cached notifications

### 7.2 Invalid Data

- [ ] **Test**: Notification with missing orderId
  - **Expected**: Navigates to Notifications screen (fallback)

- [ ] **Test**: Notification with unknown type
  - **Expected**: Displays with default icon, navigates to Notifications screen

### 7.3 Permission Issues

- [ ] **Test**: Revoke notification permission → Send notification
  - **Expected**: No notification appears (system blocked)
  - **Open app**: Request permission again

### 7.4 Token Management

- [ ] **Test**: Logout → Verify FCM token removed from backend
- [ ] **Test**: Login again → Verify new FCM token registered
- [ ] **Test**: Token refresh (happens automatically)
  - **Verify**: New token sent to backend

---

## 8. Performance Tests

### 8.1 Large Notification Volume

- [ ] **Test**: Send 50 notifications → Open app
  - **Expected**: All notifications load within 2 seconds
  - **Scroll**: Smooth scrolling through list

- [ ] **Test**: Cache contains 100 notifications (max) → Send 10 more
  - **Expected**: Oldest 10 removed, newest 10 added
  - **Verify**: Cache size stays at 100

### 8.2 Memory & Battery

- [ ] **Test**: Receive 20 notifications while app closed
  - **Monitor**: Battery drain should be minimal
  - **Monitor**: No memory leaks when opening app

---

## 9. Regression Tests

### 9.1 Existing Features Still Work

- [ ] Place regular order (non-auto-order)
- [ ] Cancel an order
- [ ] Track an order
- [ ] View vouchers
- [ ] Purchase subscription
- [ ] Add/edit address
- [ ] View order history

### 9.2 Navigation Still Works

- [ ] Bottom tab navigation
- [ ] Deep linking (if implemented)
- [ ] Back button behavior
- [ ] Screen transitions

---

## 10. Final Verification

- [ ] **No console errors** during testing
- [ ] **No app crashes** during testing
- [ ] **All navigation flows** work correctly
- [ ] **Notification icons** display correctly
- [ ] **Sound and vibration** work as expected
- [ ] **UI is responsive** and smooth
- [ ] **Data persists** correctly across app restarts
- [ ] **Offline mode** works as expected

---

## Test Environment Details

| Item | Value |
|------|-------|
| App Version | |
| Android Version | |
| Device Model | |
| Test Date | |
| Tester Name | |

---

## Issues Found

| # | Description | Severity | Status |
|---|-------------|----------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## Sign-Off

- [ ] All critical tests passed
- [ ] All auto-ordering features working
- [ ] All notification types tested
- [ ] Ready for production deployment

**Tester Signature**: ___________________
**Date**: ___________________
