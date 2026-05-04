# Consumer App - Scheduling & Ordering Integration Guide

> **Purpose:** This document provides everything needed to integrate the refactored ordering system into the Tiffsy consumer app. The backend now has exactly **2 ordering services**: Direct Orders + Scheduling Service.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [API Migration Map](#2-api-migration-map)
3. [Direct Ordering (Same-Day)](#3-direct-ordering-same-day)
4. [Scheduling Service APIs](#4-scheduling-service-apis)
5. [Pricing Engine](#5-pricing-engine)
6. [Order Lifecycle & Status](#6-order-lifecycle--status)
7. [FCM Notification Types](#7-fcm-notification-types)
8. [Screen-by-Screen Integration](#8-screen-by-screen-integration)
9. [Business Rules Reference](#9-business-rules-reference)
10. [Error Handling Reference](#10-error-handling-reference)

---

## 1. Architecture Overview

### Two Services, One Pricing Engine

```
CONSUMER APP
    |
    |--- Direct Order (/api/orders)
    |       Same-day LUNCH or DINNER
    |       With/without vouchers, addons, coupons
    |       orderSource: "DIRECT"
    |
    |--- Scheduling Service (/api/scheduling)
            |
            |--- Schedule Meals (/api/scheduling/meals)
            |       Future dates, unlimited days ahead
            |       With/without vouchers, addons, coupons
            |       orderSource: "SCHEDULED"
            |
            |--- Auto-Order Config (/api/scheduling/auto-order)
            |       Weekly day/meal configuration
            |       Default addons, default kitchen/address
            |       Pause/resume auto-ordering
            |       orderSource: "AUTO_ORDER" (system-created)
            |
            |--- Skip Meal (/api/scheduling/auto-order/skip-meal)
                    ONLY for auto-order days
                    Skip from calendar in advance
```

### Key Rules

| Rule | Detail |
|------|--------|
| **Voucher** | Covers main course ONLY. Never covers addons, delivery, service fee, tax |
| **Addons** | Supported in ALL order types (direct, scheduled, auto-order) |
| **Coupons** | Supported in direct orders and scheduled meals. NOT in auto-orders |
| **Skip** | Only available when auto-ordering is active for that specific day+meal |
| **Cancel** | Scheduled meals have full cancel with refund. Direct orders have time-window cancel |
| **Scheduling limit** | No day-ahead limit. Customer can schedule unlimited days into the future |
| **Auto-order addons** | Create order with `paymentStatus: "PENDING"`. Customer has 30 min to pay. Auto-cancelled if unpaid |

---

## 2. API Migration Map

### Removed Endpoints (OLD -> NEW)

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/scheduled-meals/slots` | `GET /api/scheduling/slots` | Same functionality, no day-ahead limit now |
| `POST /api/scheduled-meals` | `POST /api/scheduling/meals` | Now supports `items[]` with addons + `voucherCount` + `couponCode` |
| `POST /api/scheduled-meals/pricing` | `POST /api/scheduling/meals/pricing` | Same, plus addon support |
| `GET /api/scheduled-meals` | `GET /api/scheduling/meals` | Same |
| `PATCH /api/scheduled-meals/:id/cancel` | `PATCH /api/scheduling/meals/:id/cancel` | Same |
| `PUT /api/subscriptions/:id/settings` | `PUT /api/scheduling/auto-order/settings` | No longer needs subscription ID in URL. Now supports `defaultAddons[]` |
| `POST /api/subscriptions/:id/pause` | `POST /api/scheduling/auto-order/pause` | No longer needs subscription ID |
| `POST /api/subscriptions/:id/resume` | `POST /api/scheduling/auto-order/resume` | No longer needs subscription ID |
| `POST /api/subscriptions/:id/skip-meal` | `POST /api/scheduling/auto-order/skip-meal` | No longer needs subscription ID. Enforces auto-order active |
| `POST /api/subscriptions/:id/unskip-meal` | `POST /api/scheduling/auto-order/unskip-meal` | No longer needs subscription ID |

### New Endpoints (did not exist before)

| Endpoint | Purpose |
|---|---|
| `GET /api/scheduling/auto-order/settings` | Get full auto-order config with resolved addon details |
| `GET /api/scheduling/auto-order/schedule` | 14-day calendar view with skip status per slot |

### Unchanged Endpoints

| Endpoint | Notes |
|---|---|
| `POST /api/orders` | Direct order creation - now sets `orderSource: "DIRECT"` |
| `GET /api/orders/my-orders` | Returns ALL orders (DIRECT + SCHEDULED + AUTO_ORDER) |
| `GET /api/orders/:id` | Works for any order regardless of source |
| `PATCH /api/orders/:id/customer-cancel` | Works for direct orders |
| `GET /api/subscriptions/my-subscriptions` | Still works for subscription info |
| `POST /api/subscriptions/purchase` | Still works for purchasing subscriptions |

---

## 3. Direct Ordering (Same-Day)

### `POST /api/orders`

No changes to the request format. The only new field in the response is `orderSource: "DIRECT"`.

**Request:**
```json
{
  "kitchenId": "64abc...",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "deliveryAddressId": "64abc...",
  "items": [
    {
      "menuItemId": "64abc...",
      "quantity": 1,
      "addons": [
        { "addonId": "64abc...", "quantity": 2 }
      ]
    }
  ],
  "voucherCount": 1,
  "couponCode": "SAVE20",
  "specialInstructions": "Less spicy",
  "deliveryNotes": "Ring doorbell"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      "_id": "...",
      "orderNumber": "ORD-20260214-A1B2C",
      "orderSource": "DIRECT",
      "status": "PLACED",
      "paymentStatus": "PAID",
      "mealWindow": "LUNCH",
      "items": [...],
      "subtotal": 199,
      "charges": {
        "deliveryFee": 30,
        "serviceFee": 5,
        "packagingFee": 10,
        "handlingFee": 0,
        "taxAmount": 12.25,
        "taxBreakdown": [{ "taxType": "GST", "rate": 5, "amount": 12.25 }]
      },
      "grandTotal": 256.25,
      "voucherUsage": { "voucherCount": 1, "mainCoursesCovered": 1 },
      "amountPaid": 57.25
    },
    "vouchersUsed": 1,
    "amountToPay": 57.25,
    "paymentRequired": true,
    "paymentAutoConfirmed": false,
    "autoAccepted": true,
    "cancelDeadline": "2026-02-14T11:05:00.000Z"
  }
}
```

---

## 4. Scheduling Service APIs

All endpoints require auth header. All are under `/api/scheduling`.

### 4.1 Get Available Slots

**`GET /api/scheduling/slots?deliveryAddressId={id}`**

Returns 30 days of slots with availability status. Use this to render the scheduling calendar.

**Response:**
```json
{
  "success": true,
  "data": {
    "slots": [
      {
        "date": "2026-02-14",
        "dayName": "saturday",
        "mealWindow": "LUNCH",
        "status": "cutoff_passed",
        "reason": "LUNCH cutoff has passed for today"
      },
      {
        "date": "2026-02-14",
        "dayName": "saturday",
        "mealWindow": "DINNER",
        "status": "available",
        "reason": null
      },
      {
        "date": "2026-02-15",
        "dayName": "sunday",
        "mealWindow": "LUNCH",
        "status": "auto_order_active",
        "reason": "Auto-ordering is active for sunday lunch"
      },
      {
        "date": "2026-02-16",
        "dayName": "monday",
        "mealWindow": "LUNCH",
        "status": "already_scheduled",
        "reason": "You already have a meal scheduled for this slot"
      }
    ],
    "activeScheduledMeals": 3
  }
}
```

**Slot Status Values (for UI rendering):**

| Status | Color/State | User Action | Description |
|--------|------------|-------------|-------------|
| `available` | Green / Tappable | Can schedule | Slot is open for scheduling |
| `cutoff_passed` | Grey / Disabled | None | Today's cutoff time has passed |
| `not_serviceable` | Grey / Disabled | None | Address zone not serviceable |
| `no_kitchen` | Grey / Disabled | None | No kitchen serving this area |
| `auto_order_active` | Blue / Info | Show "Auto-order" badge | Auto-ordering handles this slot |
| `already_scheduled` | Orange / Info | Show "Scheduled" badge, allow cancel | Already scheduled |
| `already_ordered` | Orange / Info | Show "Ordered" badge | Order exists for this slot |

---

### 4.2 Schedule a Meal

**`POST /api/scheduling/meals`**

**Request:**
```json
{
  "deliveryAddressId": "64abc...",
  "mealWindow": "LUNCH",
  "scheduledDate": "2026-02-20",
  "items": [
    {
      "menuItemId": "64abc...",
      "quantity": 1,
      "addons": [
        { "addonId": "64def...", "quantity": 1 }
      ]
    }
  ],
  "voucherCount": 1,
  "couponCode": "SAVE10",
  "specialInstructions": "Extra chutney",
  "deliveryNotes": "Leave at door"
}
```

**Simplified request (no items = auto-resolve default thali):**
```json
{
  "deliveryAddressId": "64abc...",
  "mealWindow": "DINNER",
  "scheduledDate": "2026-02-20",
  "voucherCount": 1
}
```

> **Note:** `scheduledDate` is optional. If omitted, the backend auto-resolves to the next available slot (today if before cutoff, otherwise tomorrow).

**Response (201):**
```json
{
  "success": true,
  "message": "Meal scheduled successfully",
  "data": {
    "order": {
      "id": "...",
      "orderNumber": "ORD-20260214-X9Y8Z",
      "status": "SCHEDULED",
      "paymentStatus": "PAID",
      "mealWindow": "LUNCH",
      "scheduledFor": "2026-02-20T00:00:00.000Z",
      "kitchen": { "id": "...", "name": "Tiffsy Central Kitchen" },
      "pricing": {
        "subtotal": 249,
        "charges": {
          "deliveryFee": 30,
          "serviceFee": 5,
          "packagingFee": 10,
          "handlingFee": 0,
          "taxAmount": 5.25,
          "taxBreakdown": [{ "taxType": "GST", "rate": 5, "amount": 5.25 }]
        },
        "discount": null,
        "voucherCoverage": {
          "voucherCount": 1,
          "mainCoursesCovered": 1,
          "uncoveredMainCourses": 0,
          "value": 199,
          "coversDelivery": false,
          "coversServiceFee": false,
          "coversPackagingFee": false,
          "coversHandlingFee": false,
          "coversTaxOnCoveredMeals": false,
          "coversAddons": false
        },
        "grandTotal": 299.25,
        "amountToPay": 100.25
      }
    },
    "paymentRequired": true
  }
}
```

**Status Logic:**
- `scheduledDate` is today AND within cutoff → status: `"PLACED"` (or `"ACCEPTED"` if auto-accepted)
- `scheduledDate` is future → status: `"SCHEDULED"` (promoted to `"PLACED"` by cron on the day)

---

### 4.3 Get Pricing Preview

**`POST /api/scheduling/meals/pricing`**

Call this to show pricing breakdown before the customer confirms. Same request shape as schedule meal minus `specialInstructions` and `deliveryNotes`.

**Request:**
```json
{
  "deliveryAddressId": "64abc...",
  "mealWindow": "LUNCH",
  "items": [
    {
      "menuItemId": "64abc...",
      "quantity": 1,
      "addons": [{ "addonId": "64def...", "quantity": 2 }]
    }
  ],
  "voucherCount": 1,
  "couponCode": "SAVE20"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "menuItemId": "...",
        "name": "Lunch Thali",
        "quantity": 1,
        "unitPrice": 199,
        "totalPrice": 199,
        "isMainCourse": true,
        "addons": [
          { "addonId": "...", "name": "Extra Roti", "quantity": 2, "unitPrice": 20, "totalPrice": 40 }
        ]
      }
    ],
    "pricing": {
      "subtotal": 239,
      "mainCoursesTotal": 199,
      "addonsTotal": 40,
      "charges": { "deliveryFee": 30, "serviceFee": 5, "packagingFee": 10, "handlingFee": 0, "taxAmount": 4.25, "taxBreakdown": [...] },
      "discount": null,
      "voucherCoverage": {
        "voucherCount": 1,
        "mainCoursesCovered": 1,
        "value": 199,
        "coversAddons": false
      },
      "grandTotal": 288.25,
      "amountToPay": 89.25,
      "requiresPayment": true
    },
    "kitchen": { "id": "...", "name": "Tiffsy Central Kitchen" }
  }
}
```

---

### 4.4 Get My Scheduled Meals

**`GET /api/scheduling/meals?status=SCHEDULED&page=1&limit=10`**

Query params:
- `status` (optional): `"SCHEDULED"` | `"PLACED"` | `"CANCELLED"` | `"DELIVERED"`
- `page` (default 1), `limit` (default 10, max 20)

If no `status` is provided, returns all active/pending meals (SCHEDULED, PLACED, ACCEPTED, PREPARING, READY, PICKED_UP, OUT_FOR_DELIVERY).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "meals": [
      {
        "_id": "...",
        "orderNumber": "ORD-20260214-X9Y8Z",
        "orderSource": "SCHEDULED",
        "status": "SCHEDULED",
        "paymentStatus": "PAID",
        "mealWindow": "LUNCH",
        "scheduledFor": "2026-02-20T00:00:00.000Z",
        "kitchenId": { "_id": "...", "name": "Tiffsy Central", "code": "TCK" },
        "items": [...],
        "subtotal": 249,
        "grandTotal": 299.25,
        "amountPaid": 100.25,
        "voucherUsage": { "voucherCount": 1, "mainCoursesCovered": 1 }
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 5, "pages": 1 }
  }
}
```

---

### 4.5 Cancel Scheduled Meal

**`PATCH /api/scheduling/meals/:id/cancel`**

**Request:**
```json
{
  "reason": "Changed my plans"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Scheduled meal cancelled",
  "data": {
    "orderId": "...",
    "orderNumber": "ORD-20260214-X9Y8Z",
    "refundInitiated": true,
    "vouchersRestored": 1,
    "warning": null
  }
}
```

**Cancel Rules:**
- `SCHEDULED` status: **Always cancellable** with full refund + voucher restore (response does NOT include `warning` field)
- `PLACED`/`ACCEPTED` status: Uses standard cancellation eligibility window (configurable). Response includes `warning: string|null` field
- `PREPARING` and beyond: Not cancellable

---

### 4.6 Get Auto-Order Settings

**`GET /api/scheduling/auto-order/settings`**

Returns the full auto-order configuration for the current user's active subscription.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "autoOrderingEnabled": true,
    "isPaused": false,
    "pausedUntil": null,
    "weeklySchedule": {
      "monday": { "lunch": true, "dinner": true },
      "tuesday": { "lunch": true, "dinner": false },
      "wednesday": { "lunch": true, "dinner": true },
      "thursday": { "lunch": false, "dinner": false },
      "friday": { "lunch": true, "dinner": true },
      "saturday": { "lunch": true, "dinner": true },
      "sunday": { "lunch": false, "dinner": false }
    },
    "defaultKitchen": { "_id": "...", "name": "Tiffsy Central" },
    "defaultAddress": { "_id": "...", "addressLine1": "12 MG Road", "city": "Bangalore", "pincode": "560001" },
    "defaultAddons": [
      { "addonId": "...", "name": "Extra Roti", "price": 20, "quantity": 2, "isAvailable": true },
      { "addonId": "...", "name": "Buttermilk", "price": 30, "quantity": 1, "isAvailable": false }
    ],
    "skippedSlots": [
      { "date": "2026-02-17T00:00:00.000Z", "mealWindow": "LUNCH", "reason": "On leave", "skippedAt": "2026-02-14T10:00:00.000Z" }
    ],
    "subscriptionId": "..."
  }
}
```

**UI Notes:**
- Show `defaultAddons` with availability status. Grey out unavailable addons with note "Currently unavailable"
- `defaultAddons` cost is charged EXTRA on top of the voucher-covered meal. Show estimated daily addon cost
- When kitchen changes, `defaultAddons` are auto-cleared (addons are kitchen-specific)

---

### 4.7 Update Auto-Order Settings

**`PUT /api/scheduling/auto-order/settings`**

Send only the fields you want to update. At least one field required.

**Settable Fields:** `autoOrderingEnabled`, `defaultKitchenId`, `defaultAddressId`, `weeklySchedule`, `defaultAddons`

**Request examples:**

Toggle auto-ordering:
```json
{ "autoOrderingEnabled": true }
```

Set default kitchen and address (REQUIRED before enabling auto-ordering):
```json
{
  "defaultKitchenId": "64abc...",
  "defaultAddressId": "64def..."
}
```

Update weekly schedule:
```json
{
  "weeklySchedule": {
    "monday": { "lunch": true, "dinner": false },
    "tuesday": { "lunch": true, "dinner": true }
  }
}
```

Set default addons (must belong to the default kitchen):
```json
{
  "defaultAddons": [
    { "addonId": "64abc...", "quantity": 2 },
    { "addonId": "64def...", "quantity": 1 }
  ]
}
```

Clear default addons:
```json
{ "defaultAddons": [] }
```

> **Important:** When `defaultKitchenId` changes, `defaultAddons` are auto-cleared (addons are kitchen-specific). Set new addons after changing kitchen.

**Response (200):**
```json
{
  "success": true,
  "message": "Auto-order settings updated",
  "data": {
    "subscription": { ... },
    "autoOrderingEnabled": true,
    "weeklySchedule": { ... },
    "defaultKitchen": { "_id": "...", "name": "..." },
    "defaultAddress": { "_id": "...", "addressLine1": "...", "city": "..." },
    "defaultAddons": [{ "addonId": "...", "quantity": 2 }]
  }
}
```

> **Note:** `defaultAddons` in the update response returns raw `[{addonId, quantity}]` (not resolved with name/price like the GET settings response). Use the GET endpoint after update if you need resolved addon details.

> **Note:** `subscription` contains the full subscription object. Use the individual fields (`autoOrderingEnabled`, `defaultKitchen`, etc.) for display.

**Validation errors (400):**
- `"Default kitchen is required to enable auto-ordering"`
- `"Default address is required to enable auto-ordering"`
- `"Addon [name] does not belong to the selected kitchen"` (when addons from wrong kitchen)
- `"Addon [name] is not available"` (when addon is inactive)

---

### 4.8 Get Weekly Schedule (14-Day Calendar View)

**`GET /api/scheduling/auto-order/schedule`**

Returns a 14-day view showing which slots are scheduled and which are skipped.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "autoOrderingEnabled": true,
    "isPaused": false,
    "pausedUntil": null,
    "schedule": [
      {
        "date": "2026-02-14",
        "dayName": "saturday",
        "lunch": { "scheduled": true, "skipped": false },
        "dinner": { "scheduled": true, "skipped": true }
      },
      {
        "date": "2026-02-15",
        "dayName": "sunday",
        "lunch": { "scheduled": false, "skipped": false },
        "dinner": { "scheduled": false, "skipped": false }
      }
    ]
  }
}
```

**UI rendering logic per slot:**

| `scheduled` | `skipped` | UI State | User Action |
|-------------|-----------|----------|-------------|
| `true` | `false` | Active (green) | Tap to skip |
| `true` | `true` | Skipped (strikethrough/grey) | Tap to unskip |
| `false` | `false` | Off (empty) | No action (not configured for this day) |
| `false` | `true` | N/A (shouldn't happen) | Ignore |

---

### 4.9 Pause Auto-Ordering

**`POST /api/scheduling/auto-order/pause`**

**Request:**
```json
{
  "pauseUntil": "2026-02-21",
  "pauseReason": "Going on vacation"
}
```

Or pause indefinitely:
```json
{
  "pauseReason": "Taking a break"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "...",
    "isPaused": true,
    "pausedUntil": "2026-02-21T00:00:00.000Z",
    "message": "Auto-ordering paused until 21/2/2026"
  }
}
```

---

### 4.10 Resume Auto-Ordering

**`POST /api/scheduling/auto-order/resume`**

No request body needed.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "...",
    "isPaused": false,
    "autoOrderingEnabled": true,
    "message": "Auto-ordering has been resumed successfully."
  }
}
```

---

### 4.11 Skip Meal

**`POST /api/scheduling/auto-order/skip-meal`**

**Request:**
```json
{
  "date": "2026-02-17",
  "mealWindow": "LUNCH",
  "reason": "Eating out"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Meal skipped successfully",
  "data": {
    "skippedSlot": { "date": "2026-02-17T00:00:00.000Z", "mealWindow": "LUNCH", "reason": "Eating out" },
    "totalSkippedSlots": 3
  }
}
```

**ENFORCEMENT RULES (these are hard errors, not just UI hiding):**
1. Auto-ordering MUST be enabled: `"Auto-ordering is not enabled. Skip is only available for auto-order days."`
2. Meal MUST be scheduled for that day+meal: `"Auto-ordering is not scheduled for monday lunch. Nothing to skip."`
3. Date cannot be in the past: `"Cannot skip meals in the past"`
4. Cannot double-skip: `"This meal is already skipped"`

---

### 4.12 Unskip Meal

**`POST /api/scheduling/auto-order/unskip-meal`**

**Request:**
```json
{
  "date": "2026-02-17",
  "mealWindow": "LUNCH"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Meal unskipped successfully",
  "data": {
    "unskippedSlot": { "date": "2026-02-17T00:00:00.000Z", "mealWindow": "LUNCH" },
    "totalSkippedSlots": 2
  }
}
```

---

## 5. Pricing Engine

### How Pricing Works (same engine for ALL order types)

```
SUBTOTAL = mainCoursesTotal + addonsTotal

VOUCHER COVERAGE:
  - Covers ONLY main course price (1 voucher = 1 main course)
  - NEVER covers: addons, delivery fee, service fee, packaging fee, tax

CHARGES (always applied, even with voucher):
  - deliveryFee: 30
  - serviceFee: 5
  - packagingFee: 10
  - handlingFee: 0
  - taxAmount: (taxable amount) * 5% GST

TAX CALCULATION:
  With voucher:  tax on (addons + uncovered meals + serviceFee + packagingFee)
  Without voucher: tax on (subtotal + serviceFee + packagingFee)
  Note: deliveryFee and handlingFee are NOT taxed

AMOUNT TO PAY:
  With voucher:  addons + uncoveredMealCost + allCharges + tax
  Without voucher: grandTotal (= subtotal + allCharges - discounts)

COUPON DISCOUNTS (applied after voucher calculation):
  - PERCENTAGE / FLAT: reduces amountToPay
  - FREE_DELIVERY: sets deliveryFee to 0
  - FREE_ADDON_COUNT / FREE_ADDON_VALUE: reduces addon cost
  - FREE_EXTRA_VOUCHER: no monetary discount, bonus vouchers issued after order
```

### Pricing Display Breakdown (recommended UI)

```
Lunch Thali (1x)              ₹199
  + Extra Roti (2x)            ₹40
  + Buttermilk (1x)            ₹30
                              ------
Subtotal                      ₹269

Voucher Applied (1x)         -₹199  ← covers main course only
Coupon SAVE20 (20% off)       -₹14  ← applied to remaining amount

Delivery Fee                   ₹30
Service Fee                     ₹5
Packaging Fee                  ₹10
GST (5%)                       ₹4.80
                              ------
Amount to Pay                 ₹55.80
```

---

## 6. Order Lifecycle & Status

### Order Sources

| `orderSource` | Created By | Entry Point | Initial Status |
|---|---|---|---|
| `"DIRECT"` | Customer via app | `POST /api/orders` | `PLACED` or `ACCEPTED` |
| `"SCHEDULED"` | Customer via app | `POST /api/scheduling/meals` | `SCHEDULED` (future) or `PLACED` (today) |
| `"AUTO_ORDER"` | System cron | Automatic | `PLACED` or `ACCEPTED` |

### Status Flow

```
SCHEDULED ──(cron promotes on the day)──> PLACED ──> ACCEPTED ──> PREPARING ──> READY ──> PICKED_UP ──> OUT_FOR_DELIVERY ──> DELIVERED
    |                                       |           |            |
    v                                       v           v            v
CANCELLED                               CANCELLED   CANCELLED    CANCELLED
(always cancellable)                        |
                                            v
                                        REJECTED
```

### `orderSource` in `getMyOrders`

The existing `GET /api/orders/my-orders` returns ALL orders. Use `orderSource` to categorize:

```javascript
// Frontend categorization
const directOrders = orders.filter(o => o.orderSource === "DIRECT");
const scheduledOrders = orders.filter(o => o.orderSource === "SCHEDULED");
const autoOrders = orders.filter(o => o.orderSource === "AUTO_ORDER");
```

### Order Display Badge

| `orderSource` | Badge Text | Badge Color |
|---|---|---|
| `"DIRECT"` | No badge (default) | - |
| `"SCHEDULED"` | "Scheduled" | Blue |
| `"AUTO_ORDER"` | "Auto-Order" | Purple |

---

## 7. FCM Notification Types

### New Notification Types to Handle

| `type` (in `data` payload) | Title | When Sent | Action |
|---|---|---|---|
| `SCHEDULED_MEAL_CREATED` | "Meal Scheduled!" | After successful scheduling | Navigate to order detail |
| `SCHEDULED_MEAL_CANCELLED` | "Scheduled Meal Cancelled" | After cancel | Navigate to scheduling screen |
| `SCHEDULED_MEAL_PLACED` | "Scheduled Meal Confirmed!" | Cron promotes SCHEDULED->PLACED on day | Navigate to order detail |
| `SCHEDULED_MEAL_ISSUE` | "Scheduled Meal Update" | Kitchen unavailable on delivery day | Navigate to order detail |
| `AUTO_ORDER_SUCCESS` | "Auto Order Placed!" | Auto-order cron creates order | Navigate to order detail |
| `AUTO_ORDER_FAILED` | "Auto Order Skipped/Failed" | Auto-order cron fails | Navigate to auto-order settings |
| `AUTO_ORDER_PAYMENT_REQUIRED` | "Payment Required for Add-ons" | Auto-order has addon cost pending | Navigate to payment screen for order |
| `AUTO_ORDER_PAYMENT_EXPIRED` | "Auto-Order Cancelled" | Unpaid addon auto-order cancelled | Navigate to order history |

### Notification Data Payload Shape

All notifications include:
```json
{
  "data": {
    "orderId": "string",
    "orderNumber": "string",
    "type": "SCHEDULED_MEAL_CREATED | AUTO_ORDER_SUCCESS | etc."
  }
}
```

Additional fields for specific types:
- `AUTO_ORDER_SUCCESS`: `paymentRequired: "true"|"false"`, `amountToPay: "string"`
- `AUTO_ORDER_PAYMENT_REQUIRED`: `amountToPay: "string"`
- `AUTO_ORDER_PAYMENT_EXPIRED`: `vouchersRestored: "string"`
- `AUTO_ORDER_FAILED`: `failureCategory: "string"`, `mealWindow: "string"`, `message: "string"`

### AUTO_ORDER_FAILED Categories (for UI messaging)

| `failureCategory` | User-Facing Message |
|---|---|
| `NO_VOUCHERS` | "No vouchers available. Purchase more vouchers to continue." |
| `NO_ADDRESS` | "Please set a default delivery address." |
| `NO_ZONE` | "Your delivery area is not currently serviceable." |
| `NO_KITCHEN` | "No kitchen is currently serving your area." |
| `KITCHEN_NOT_SERVING_ZONE` | "No kitchen is currently serving your area." |
| `NO_MENU_ITEM` | "No menu items available for this meal window." |
| `VOUCHER_REDEMPTION_FAILED` | "Voucher couldn't be redeemed. Try ordering manually." |
| `ORDER_CREATION_FAILED` | "Something went wrong. Please try ordering manually." |
| `UNKNOWN` | "Something went wrong. Please try ordering manually." |

> **Note:** `SUBSCRIPTION_PAUSED`, `SLOT_SKIPPED`, and `NOT_SCHEDULED` are logged as `SKIPPED` status (no notification sent to user).

---

## 8. Screen-by-Screen Integration

### Screen 1: Home / Dashboard

**What to show:**
- Today's upcoming meals (from `GET /api/orders/my-orders?status=PLACED,ACCEPTED,PREPARING,READY`)
- Auto-order status badge: "Auto-ordering: ON" / "Paused" / "OFF"
- Quick actions: "Schedule a Meal", "Order Now"

**API calls on mount:**
- `GET /api/orders/my-orders` (active orders for today)
- `GET /api/scheduling/auto-order/settings` (auto-order status for badge)

---

### Screen 2: Schedule Meal Calendar

**Flow:**
1. User selects delivery address
2. Call `GET /api/scheduling/slots?deliveryAddressId={id}` to get 30-day calendar
3. Render calendar with slot status colors (see section 4.1 table)
4. User taps an `available` slot
5. Show meal selection (default thali pre-selected, or pick items + addons)
6. Call `POST /api/scheduling/meals/pricing` for live pricing preview
7. User confirms -> Call `POST /api/scheduling/meals`
8. Show success with order details
9. If `paymentRequired: true` -> Navigate to payment flow

**Important:** If no `items` are sent in the request, the backend auto-resolves the default thali for that kitchen/mealWindow. This is the "quick schedule" flow.

---

### Screen 3: My Scheduled Meals

**Flow:**
1. Call `GET /api/scheduling/meals` (default: active/pending meals)
2. Show list sorted by `scheduledFor` date
3. Each card shows: date, mealWindow, kitchen name, status badge, price
4. For `SCHEDULED` status: show "Cancel" button
5. For `PLACED`/`ACCEPTED`: show "Cancel" button (may be time-restricted)
6. Cancel -> Call `PATCH /api/scheduling/meals/:id/cancel`

---

### Screen 4: Auto-Order Settings

**Flow:**
1. Call `GET /api/scheduling/auto-order/settings` on mount
2. Show toggle for `autoOrderingEnabled`
3. Show weekly schedule grid (7 days x 2 meals)
4. Show default kitchen, default address (from settings response)
5. Show default addons list with prices and availability
6. Show "Pause" / "Resume" button based on `isPaused`

**Set default kitchen + address first (required before enabling):**
```json
PUT /api/scheduling/auto-order/settings
{ "defaultKitchenId": "64abc...", "defaultAddressId": "64def..." }
```

**Toggle auto-ordering ON:**
```json
PUT /api/scheduling/auto-order/settings
{ "autoOrderingEnabled": true }
```
This will fail if `defaultKitchenId` and `defaultAddressId` are not already set.

**Update weekly schedule:**
```json
PUT /api/scheduling/auto-order/settings
{
  "weeklySchedule": {
    "monday": { "lunch": true, "dinner": false }
  }
}
```
Note: Only send the days you're changing. Unmentioned days retain their previous values.

**Manage default addons:**
Show addon picker (filtered by `defaultKitchenId`). Save:
```json
PUT /api/scheduling/auto-order/settings
{
  "defaultAddons": [
    { "addonId": "...", "quantity": 2 }
  ]
}
```

**Warning UI:** When default addons are set, show:
> "Add-ons will be added to your auto-orders. You'll receive a notification to complete payment within 30 minutes, or the order will be auto-cancelled and your voucher restored."

---

### Screen 5: Auto-Order Calendar (Skip/Unskip)

**Flow:**
1. Call `GET /api/scheduling/auto-order/schedule` to get 14-day view
2. Render calendar with slot states (see section 4.8 table)
3. Tap active slot -> Confirm skip -> `POST /api/scheduling/auto-order/skip-meal`
4. Tap skipped slot -> Confirm unskip -> `POST /api/scheduling/auto-order/unskip-meal`

**Important enforcement:** The backend REJECTS skip if:
- Auto-ordering is disabled
- The meal is not scheduled for that day (e.g., user turned off Monday lunch in weekly schedule)

The frontend should disable skip buttons for non-scheduled slots, but the backend enforces this regardless.

---

### Screen 6: Order Detail

**No changes needed** for existing order detail screen. The `GET /api/orders/:id` endpoint works for all order types. New field to display:
- `orderSource`: Show badge "Scheduled" or "Auto-Order" (skip for "DIRECT")
- `scheduledFor`: Show "Scheduled for Feb 20, Lunch" when present

---

## 9. Business Rules Reference

### Voucher Rules
- 1 voucher = 1 main course covered
- Voucher ONLY covers the meal base price
- Addons, delivery, service fee, packaging, tax are NEVER covered
- Customer always pays: addons + charges + tax (even with voucher)
- On cancel: vouchers are restored to "AVAILABLE" status

### Coupon Rules
- Supported in direct orders and scheduled meals
- NOT supported in auto-orders (auto-orders only use vouchers)
- Types: PERCENTAGE, FLAT, FREE_DELIVERY, FREE_ADDON_COUNT, FREE_ADDON_VALUE, FREE_EXTRA_VOUCHER
- Per-user limits enforced server-side
- On cancel: coupon usage count reversed

### Auto-Order Addon Payment
- If auto-order has default addons that cost money, order is created with `paymentStatus: "PENDING"`
- Customer receives notification `AUTO_ORDER_PAYMENT_REQUIRED`
- Customer has **30 minutes** (configurable via `addonPaymentWindowMinutes`) to complete payment
- If unpaid after window: order auto-cancelled, voucher restored, notification `AUTO_ORDER_PAYMENT_EXPIRED` sent
- If no addons (or addons cost 0): `paymentStatus: "PAID"`, auto-accepted immediately

### Skip vs Cancel
| Action | What it means | When available | Effect |
|--------|--------------|----------------|--------|
| **Skip** | Prevent auto-order from being created | Before cron runs, for future auto-order days only | No order created, no voucher used |
| **Cancel scheduled meal** | Cancel an existing order | After scheduling, before delivery | Order cancelled, voucher restored, refund if paid |
| **Cancel direct order** | Cancel a same-day order | Within cancellation window | Order cancelled, voucher restored, refund if paid |

---

## 10. Error Handling Reference

### Common Error Response Format

All errors follow this shape:
```json
{
  "success": false,
  "message": "Human-readable error message",
  "data": null
}
```

### Error Messages to Show Inline

| API | Error Message | UI Handling |
|-----|--------------|-------------|
| Schedule meal | `"Cannot schedule a meal for a past date"` | Show inline error, disable past dates in calendar |
| Schedule meal | `"LUNCH cutoff has passed for today..."` | Show toast, grey out today's lunch slot |
| Schedule meal | `"You already have a meal scheduled for this slot"` | Show toast, mark slot as "already scheduled" |
| Schedule meal | `"No kitchen currently serving your area"` | Show full-screen error with address change option |
| Schedule meal | `"Voucher redemption failed: ..."` | Show error dialog with retry option |
| Skip meal | `"Auto-ordering is not enabled..."` | Should not happen if UI is correct. Show toast |
| Skip meal | `"Auto-ordering is not scheduled for..."` | Should not happen if UI is correct. Show toast |
| Update settings | `"Default kitchen is required to enable auto-ordering"` | Show prompt to select kitchen first |
| Update settings | `"Default address is required to enable auto-ordering"` | Show prompt to select address first |
| Update settings | `"Default kitchen is required when setting default addons"` | Set kitchen before addons |
| Update settings | `"Addon not found: ..."` | Remove stale addon from selection |
| Update settings | `"Addon [X] does not belong to the selected kitchen"` | Clear addons and show re-select prompt |
| Update settings | `"Addon [X] is not available"` | Remove unavailable addon |
| Auto-order settings | `"No active subscription found"` | Show "Subscribe first" CTA |

---

## Quick Reference: All Scheduling API Endpoints

```
MEAL SCHEDULING
  GET    /api/scheduling/slots                         → Calendar slot availability
  POST   /api/scheduling/meals                         → Schedule a meal
  POST   /api/scheduling/meals/pricing                 → Pricing preview
  GET    /api/scheduling/meals                         → List my scheduled meals
  PATCH  /api/scheduling/meals/:id/cancel              → Cancel scheduled meal

AUTO-ORDER CONFIGURATION
  GET    /api/scheduling/auto-order/settings            → Get settings + resolved addons
  PUT    /api/scheduling/auto-order/settings            → Update settings
  GET    /api/scheduling/auto-order/schedule            → 14-day calendar with skip status
  POST   /api/scheduling/auto-order/pause               → Pause auto-ordering
  POST   /api/scheduling/auto-order/resume              → Resume auto-ordering

SKIP/UNSKIP (auto-order only)
  POST   /api/scheduling/auto-order/skip-meal           → Skip a meal
  POST   /api/scheduling/auto-order/unskip-meal         → Unskip a meal

DIRECT ORDERING (unchanged)
  POST   /api/orders                                    → Place direct order
  GET    /api/orders/my-orders                          → All orders (DIRECT+SCHEDULED+AUTO_ORDER)
  GET    /api/orders/:id                                → Order detail
  PATCH  /api/orders/:id/customer-cancel                → Cancel direct order
```
