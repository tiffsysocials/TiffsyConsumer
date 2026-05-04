# Scheduled Thali Meal - Frontend Integration Guide

## Overview

Customers (new or existing) can schedule 1-2 upcoming thali meals. They pay full price per meal (no subscription/vouchers needed). They pick a date + meal slot (LUNCH/DINNER) or the system auto-picks the next available slot.

**Base URL:** `/api/scheduled-meals`
**Auth Required:** Yes - Firebase token in `Authorization: Bearer <token>` header
**Role:** CUSTOMER (or ADMIN)

---

## Response Format (all endpoints)

```json
{
  "success": true | false,
  "message": "Human-readable message",
  "data": { ... } | null,
  "error": null | "error details"
}
```

---

## Complete User Flow

```
1. Customer opens "Schedule a Meal" screen
2. App calls GET /slots → shows available slots grid
3. Customer taps an "available" slot (e.g., Tomorrow Lunch)
4. App calls POST /pricing → shows thali details + price breakdown
5. Customer confirms → App calls POST / → creates order
6. If paymentRequired = true:
   a. App calls POST /api/payment/order/{orderId}/initiate → gets Razorpay order
   b. Customer completes Razorpay checkout
   c. App calls POST /api/payment/verify → confirms payment
7. Done! Order is SCHEDULED (future) or PLACED (today)
8. Customer can view scheduled meals via GET /
9. Customer can cancel via PATCH /:id/cancel
```

---

## API Endpoints

### 1. GET /api/scheduled-meals/slots

**Purpose:** Fetch available meal slots for the next 7 days. Shows which slots are available, blocked by auto-ordering, already scheduled, or past cutoff.

**When to call:** When the "Schedule a Meal" screen loads, or when the customer selects/changes their delivery address.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `deliveryAddressId` | string (24 hex) | Yes | Customer's saved address ID |

**Request:**
```
GET /api/scheduled-meals/slots?deliveryAddressId=64f1a2b3c4d5e6f7a8b9c0d1
Authorization: Bearer <firebase_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Available slots retrieved",
  "data": {
    "slots": [
      {
        "date": "2026-02-12",
        "dayName": "thursday",
        "mealWindow": "LUNCH",
        "status": "cutoff_passed",
        "reason": "LUNCH ordering closed. Cutoff was 11:00."
      },
      {
        "date": "2026-02-12",
        "dayName": "thursday",
        "mealWindow": "DINNER",
        "status": "available",
        "reason": null
      },
      {
        "date": "2026-02-13",
        "dayName": "friday",
        "mealWindow": "LUNCH",
        "status": "auto_order_active",
        "reason": "Auto-ordering is active for friday lunch"
      },
      {
        "date": "2026-02-13",
        "dayName": "friday",
        "mealWindow": "DINNER",
        "status": "available",
        "reason": null
      },
      {
        "date": "2026-02-14",
        "dayName": "saturday",
        "mealWindow": "LUNCH",
        "status": "already_scheduled",
        "reason": "You already have a meal scheduled for this slot"
      }
      // ... up to 16 slots (8 days x 2 windows)
    ],
    "activeScheduledMeals": 1,
    "maxScheduledMeals": 2
  }
}
```

**Slot Status Values:**

| Status | Color/Icon | Meaning | Tappable? |
|--------|------------|---------|-----------|
| `available` | Green | Slot is open for scheduling | Yes |
| `cutoff_passed` | Gray | Today's cutoff time has passed | No |
| `auto_order_active` | Blue/Info | Customer's subscription auto-order covers this slot | No |
| `already_scheduled` | Orange | Customer already has a scheduled meal here | No |
| `already_ordered` | Orange | An auto-order already exists for this slot | No |
| `not_serviceable` | Gray | Address zone not serviceable | No |
| `no_kitchen` | Gray | No kitchen serving this area | No |

**UI Recommendations:**
- Show slots as a calendar/grid: rows = dates, columns = LUNCH | DINNER
- Disable non-available slots with visual distinction
- Show `activeScheduledMeals` / `maxScheduledMeals` as "1/2 meals scheduled"
- If `activeScheduledMeals >= maxScheduledMeals`, show a banner: "You've reached the max. Cancel an existing meal to schedule a new one."

---

### 2. POST /api/scheduled-meals/pricing

**Purpose:** Get pricing preview before confirming. Shows the thali details, kitchen info, and full price breakdown.

**When to call:** After the customer taps an available slot.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deliveryAddressId` | string (24 hex) | Yes | Customer's address ID |
| `mealWindow` | string | Yes | `"LUNCH"` or `"DINNER"` |
| `scheduledDate` | string (ISO date) | No | `"2026-02-13"`. If omitted, uses next available |
| `couponCode` | string | No | Coupon code to apply |

**Request:**
```json
POST /api/scheduled-meals/pricing
{
  "deliveryAddressId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "mealWindow": "DINNER",
  "scheduledDate": "2026-02-13",
  "couponCode": "FIRST50"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Pricing calculated",
  "data": {
    "kitchen": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d2",
      "name": "Tiffsy Kitchen Andheri",
      "logo": "https://res.cloudinary.com/..."
    },
    "menuItem": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d3",
      "name": "Veg Thali Special",
      "description": "Rice, Dal, Sabzi, Roti, Salad, Pickle",
      "price": 180,
      "discountedPrice": 150,
      "dietaryType": "VEG",
      "includes": ["Rice", "Dal Tadka", "Mix Veg", "2 Roti", "Salad", "Pickle"],
      "thumbnailImage": "https://res.cloudinary.com/..."
    },
    "mealWindow": "DINNER",
    "pricing": {
      "items": [
        {
          "menuItemId": "64f1a2b3c4d5e6f7a8b9c0d3",
          "name": "Veg Thali Special",
          "quantity": 1,
          "unitPrice": 150,
          "totalPrice": 150,
          "isMainCourse": true,
          "addons": []
        }
      ],
      "subtotal": 150,
      "charges": {
        "deliveryFee": 30,
        "serviceFee": 5,
        "packagingFee": 10,
        "handlingFee": 0,
        "taxAmount": 8.25,
        "taxBreakdown": [
          { "taxType": "GST", "rate": 5, "amount": 8.25 }
        ]
      },
      "discount": {
        "couponCode": "FIRST50",
        "discountType": "FLAT",
        "discountAmount": 50
      },
      "grandTotal": 153.25,
      "amountToPay": 153.25,
      "requiresPayment": true
    }
  }
}
```

**UI Recommendations:**
- Show the thali card with image, name, description, includes list
- Show kitchen name + logo
- Show price breakdown:
  - Item price: Rs 150 (show original Rs 180 struck through if discounted)
  - Delivery: Rs 30
  - Service: Rs 5
  - Packaging: Rs 10
  - GST (5%): Rs 8.25
  - Discount: -Rs 50
  - **Total: Rs 153.25**
- "Apply Coupon" input field (re-call this endpoint with couponCode)

**Error Responses:**

| Status | Message | Meaning |
|--------|---------|---------|
| 404 | "Address not found" | Invalid address ID |
| 400 | "No serviceable zone found for pincode ..." | Address area not covered |
| 404 | "No kitchen currently serving your area" | No active kitchen for this zone |
| 404 | "No dinner thali available at this time" | Kitchen hasn't set up menu for this window |

---

### 3. POST /api/scheduled-meals/

**Purpose:** Create and schedule the meal. This is the "Confirm" action.

**When to call:** After customer reviews pricing and taps "Schedule Meal" / "Pay & Schedule".

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deliveryAddressId` | string (24 hex) | Yes | Customer's address ID |
| `mealWindow` | string | Yes | `"LUNCH"` or `"DINNER"` |
| `scheduledDate` | string (ISO date) | No | `"2026-02-13"`. If omitted, next available slot |
| `couponCode` | string | No | Coupon code |
| `specialInstructions` | string | No | Max 500 chars (e.g., "No onion") |
| `deliveryNotes` | string | No | Max 200 chars (e.g., "Ring the bell twice") |

**Request:**
```json
POST /api/scheduled-meals/
{
  "deliveryAddressId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "mealWindow": "DINNER",
  "scheduledDate": "2026-02-13",
  "couponCode": "FIRST50",
  "specialInstructions": "Less spicy please",
  "deliveryNotes": "Leave at door"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Meal scheduled successfully",
  "data": {
    "order": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d4",
      "orderNumber": "ORD-20260213-A1B2C",
      "status": "SCHEDULED",
      "paymentStatus": "PENDING",
      "mealWindow": "DINNER",
      "scheduledFor": "2026-02-13T00:00:00.000Z",
      "kitchen": {
        "id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "name": "Tiffsy Kitchen Andheri"
      },
      "menuItem": {
        "id": "64f1a2b3c4d5e6f7a8b9c0d3",
        "name": "Veg Thali Special"
      },
      "pricing": {
        "subtotal": 150,
        "charges": {
          "deliveryFee": 30,
          "serviceFee": 5,
          "packagingFee": 10,
          "handlingFee": 0,
          "taxAmount": 8.25,
          "taxBreakdown": [{ "taxType": "GST", "rate": 5, "amount": 8.25 }]
        },
        "discount": {
          "couponCode": "FIRST50",
          "discountType": "FLAT",
          "discountAmount": 50
        },
        "grandTotal": 153.25,
        "amountToPay": 153.25
      }
    },
    "paymentRequired": true
  }
}
```

**Key field: `paymentRequired`**
- `true` → Customer must complete payment via Razorpay (see Payment Flow below)
- `false` → Coupon covered everything, order is already confirmed (`paymentStatus: "PAID"`)

**Key field: `status`**
- `"SCHEDULED"` → Future date, order will be promoted to PLACED on delivery day
- `"PLACED"` → Today's order, kitchen is already notified

**Error Responses:**

| Status | Message | When |
|--------|---------|------|
| 400 | "You can have at most 2 scheduled meals at a time..." | Max limit reached |
| 400 | "Cannot schedule a meal for a past date" | Date is in the past |
| 400 | "Cannot schedule more than 7 days in advance" | Too far in future |
| 400 | "DINNER cutoff has passed for today..." | Today's slot is closed |
| 400 | "You already have auto-ordering active for..." | Auto-order conflict |
| 400 | "You already have a meal scheduled for this slot" | Duplicate slot |
| 400 | "This address is not currently serviceable" | Address not serviceable |
| 404 | "Address not found" | Invalid address |
| 404 | "No kitchen currently serving your area" | No kitchen |
| 404 | "No dinner thali available at this time" | No menu item |

---

### 4. GET /api/scheduled-meals/

**Purpose:** List customer's scheduled meals.

**When to call:** On the "My Scheduled Meals" screen, or in the profile/orders section.

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `status` | string | No | Active statuses | Filter: `SCHEDULED`, `PLACED`, `CANCELLED`, `DELIVERED` |
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 10 | Items per page (max 20) |

**Request:**
```
GET /api/scheduled-meals/?page=1&limit=10
Authorization: Bearer <firebase_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Scheduled meals retrieved",
  "data": {
    "meals": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d4",
        "orderNumber": "ORD-20260213-A1B2C",
        "status": "SCHEDULED",
        "paymentStatus": "PAID",
        "mealWindow": "DINNER",
        "menuType": "MEAL_MENU",
        "scheduledFor": "2026-02-13T00:00:00.000Z",
        "isScheduledMeal": true,
        "items": [
          {
            "menuItemId": "64f1a2b3c4d5e6f7a8b9c0d3",
            "name": "Veg Thali Special",
            "quantity": 1,
            "unitPrice": 150,
            "totalPrice": 150,
            "isMainCourse": true,
            "addons": []
          }
        ],
        "subtotal": 150,
        "charges": { "deliveryFee": 30, "serviceFee": 5, "packagingFee": 10, "handlingFee": 0, "taxAmount": 8.25 },
        "grandTotal": 153.25,
        "amountPaid": 153.25,
        "kitchenId": {
          "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
          "name": "Tiffsy Kitchen Andheri",
          "logo": "https://res.cloudinary.com/..."
        },
        "deliveryAddress": {
          "addressLine1": "123, MG Road",
          "locality": "Andheri West",
          "city": "Mumbai",
          "pincode": "400058"
        },
        "specialInstructions": "Less spicy please",
        "placedAt": "2026-02-12T10:30:00.000Z",
        "createdAt": "2026-02-12T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

**UI Recommendations:**
- Show as a card list sorted by `scheduledFor` (nearest first)
- Each card shows: thali name, kitchen name, scheduled date, meal window, status badge, price
- Show "Cancel" button for SCHEDULED and PLACED orders
- Color code statuses:
  - SCHEDULED = Blue (upcoming, waiting for delivery day)
  - PLACED = Yellow (being processed by kitchen)
  - ACCEPTED/PREPARING/READY = Green (in progress)
  - CANCELLED = Red
  - DELIVERED = Gray

---

### 5. PATCH /api/scheduled-meals/:id/cancel

**Purpose:** Cancel a scheduled meal. Full refund for SCHEDULED status. Standard cancellation rules for PLACED/ACCEPTED.

**When to call:** When customer taps "Cancel" on a scheduled meal.

**URL Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (24 hex) | Yes | Order ID (from `order.id` or `meal._id`) |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | Cancellation reason (min 3 chars if provided) |

**Request:**
```json
PATCH /api/scheduled-meals/64f1a2b3c4d5e6f7a8b9c0d4/cancel
{
  "reason": "Plans changed"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Scheduled meal cancelled",
  "data": {
    "orderId": "64f1a2b3c4d5e6f7a8b9c0d4",
    "orderNumber": "ORD-20260213-A1B2C",
    "refundInitiated": true,
    "warning": null
  }
}
```

**Error Responses:**

| Status | Message | When |
|--------|---------|------|
| 400 | "Invalid order ID" | Malformed ID |
| 404 | "Scheduled meal not found" | Wrong ID or not owned by user |
| 400 | "Cannot cancel order in PREPARING status" | Kitchen already started |
| 400 | "Cancellation window of 10 minutes has passed" | Non-voucher order past window |

**Cancellation Rules:**
- **SCHEDULED** status: Always cancellable, full refund
- **PLACED** status: Cancellable before kitchen accepts (within 10 min window)
- **ACCEPTED** and beyond: Follow standard order cancellation rules

---

## Payment Flow (When `paymentRequired: true`)

After creating a scheduled meal, if `paymentRequired` is `true`, the customer must complete payment. Use the **existing Razorpay payment flow** (same as regular orders):

### Step 1: Initiate Payment
```
POST /api/payment/order/{orderId}/initiate
Authorization: Bearer <firebase_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "razorpayOrderId": "order_NxxxxxYYYY",
    "amount": 15325,
    "currency": "INR",
    "key": "rzp_test_xxxx",
    "expiresAt": "2026-02-12T11:00:00.000Z"
  }
}
```

### Step 2: Open Razorpay Checkout
Use the Razorpay SDK with the returned `razorpayOrderId`, `amount`, `key`.

### Step 3: Verify Payment
After Razorpay checkout success:
```json
POST /api/payment/verify
{
  "razorpayOrderId": "order_NxxxxxYYYY",
  "razorpayPaymentId": "pay_NxxxxxZZZZ",
  "razorpaySignature": "abc123..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified",
  "data": {
    "orderId": "64f1a2b3c4d5e6f7a8b9c0d4",
    "paymentStatus": "PAID",
    "status": "SCHEDULED"
  }
}
```

### Payment Failure
If payment fails or expires, the order stays in `paymentStatus: "PENDING"`. It won't count against the max-2 limit (only PAID orders in SCHEDULED/PLACED status count). The customer can retry payment via `POST /api/payment/order/{orderId}/initiate`.

---

## Push Notifications (FCM)

The customer will receive these push notifications:

| Event | Title | Body | Data Payload |
|-------|-------|------|-------------|
| Meal scheduled | "Meal Scheduled!" | "Your dinner thali for 13 Feb has been scheduled. Order #ORD-..." | `{ orderId, orderNumber, type: "SCHEDULED_MEAL_CREATED" }` |
| SCHEDULED promoted to PLACED (delivery day) | "Scheduled Meal Confirmed!" | "Your scheduled dinner meal #ORD-... is now being processed for delivery today." | `{ orderId, orderNumber, type: "SCHEDULED_MEAL_PLACED" }` |
| Cancellation | "Scheduled Meal Cancelled" | "Your scheduled dinner meal #ORD-... has been cancelled." | `{ orderId, type: "SCHEDULED_MEAL_CANCELLED" }` |
| Issue (kitchen unavailable) | "Scheduled Meal Update" | "Your scheduled dinner meal may be affected. The kitchen is temporarily unavailable." | `{ orderId, type: "SCHEDULED_MEAL_ISSUE" }` |

**Handle `type` in notification data to navigate to the right screen.**

---

## Order Status Flow

```
                              [Future date]
Customer schedules ──────────► SCHEDULED ──── (cron on delivery day) ──► PLACED
                              [Today]                                      │
Customer schedules ──────────► PLACED ◄────────────────────────────────────┘
                                 │
                          Kitchen accepts
                                 │
                              ACCEPTED
                                 │
                              PREPARING
                                 │
                               READY
                                 │
                              PICKED_UP
                                 │
                          OUT_FOR_DELIVERY
                                 │
                              DELIVERED

At any cancellable stage:
  SCHEDULED ──► CANCELLED (always, full refund)
  PLACED ──► CANCELLED (within 10 min window)
```

---

## Integration Checklist

### New Screens
- [ ] **Schedule a Meal** - Main screen with slot grid + address selector
- [ ] **Meal Pricing Preview** - Shows thali details, price breakdown, coupon input
- [ ] **My Scheduled Meals** - List of scheduled meals with cancel option

### UI Components
- [ ] Slot grid/calendar component (date x LUNCH/DINNER)
- [ ] Slot status badges (available, auto_order_active, cutoff_passed, etc.)
- [ ] Scheduled meal card (thali name, kitchen, date, status, price, cancel button)
- [ ] "X/2 scheduled" counter badge
- [ ] Coupon input field on pricing screen

### API Calls
- [ ] `GET /api/scheduled-meals/slots?deliveryAddressId=...`
- [ ] `POST /api/scheduled-meals/pricing`
- [ ] `POST /api/scheduled-meals/`
- [ ] `GET /api/scheduled-meals/`
- [ ] `PATCH /api/scheduled-meals/:id/cancel`
- [ ] `POST /api/payment/order/:orderId/initiate` (existing)
- [ ] `POST /api/payment/verify` (existing)

### Navigation
- [ ] Add "Schedule a Meal" entry point (home screen / menu)
- [ ] Add "Scheduled Meals" tab or section in orders/profile
- [ ] Handle push notification taps → navigate to order detail

### Error Handling
- [ ] Show user-friendly messages for all error responses
- [ ] Handle "max 2 meals" gracefully (show existing meals, option to cancel)
- [ ] Handle auto-order conflicts (explain why slot is blocked)
- [ ] Handle payment failures (retry option)

### Edge Cases
- [ ] Address with no kitchen serving → show "Not available in your area" message
- [ ] All slots unavailable → show empty state
- [ ] Payment timeout → order remains PENDING, allow retry
- [ ] Scheduled meal promoted to PLACED → update UI via push notification
- [ ] Customer has no saved addresses → redirect to add address flow

---

## Quick Reference

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Get slots | GET | `/api/scheduled-meals/slots?deliveryAddressId=X` | Yes |
| Get pricing | POST | `/api/scheduled-meals/pricing` | Yes |
| Schedule meal | POST | `/api/scheduled-meals/` | Yes |
| List my meals | GET | `/api/scheduled-meals/?page=1&limit=10` | Yes |
| Cancel meal | PATCH | `/api/scheduled-meals/:id/cancel` | Yes |
| Initiate payment | POST | `/api/payment/order/:orderId/initiate` | Yes |
| Verify payment | POST | `/api/payment/verify` | Yes |
