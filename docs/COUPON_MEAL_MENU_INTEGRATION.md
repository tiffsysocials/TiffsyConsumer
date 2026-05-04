# Coupon System - MEAL_MENU Integration Guide (Frontend)

> **Date:** February 2026
> **Backend Version:** Latest (post coupon-meal-menu extension)

---

## Overview

The coupon system has been extended to support **MEAL_MENU (thali) orders** in addition to ON_DEMAND_MENU orders. Customers can now apply coupons when ordering thalis, and coupons **stack with subscription vouchers** (voucher covers the thali, coupon gives additional benefits like free add-ons).

### New Discount Types

| Type | What It Does | Applies To |
|------|-------------|------------|
| `PERCENTAGE` | X% off the payable amount | Both menus |
| `FLAT` | Rs. X off the payable amount | Both menus |
| `FREE_DELIVERY` | Waives delivery fee | Both menus |
| `FREE_ADDON_COUNT` | N add-ons free (cheapest N picked automatically) | Both menus |
| `FREE_ADDON_VALUE` | Add-ons free up to Rs. X value | Both menus |
| `FREE_EXTRA_VOUCHER` | X bonus meal vouchers credited to account | Both menus |

### Key Behavior Differences by Menu Type

| Scenario | ON_DEMAND_MENU | MEAL_MENU |
|----------|---------------|-----------|
| PERCENTAGE/FLAT target | Applied on subtotal | Applied on `amountToPay` (after voucher deduction) |
| Voucher stacking | N/A (no vouchers) | Yes - voucher covers thali, coupon gives extra discount |
| FREE_EXTRA_VOUCHER | Bonus vouchers issued | Bonus vouchers issued |

---

## API Endpoints

### 1. Get Available Coupons for Customer

Fetches all coupons the current user can see/use. **Now supports `menuType` filter.**

```
GET /api/coupons/available?menuType=MEAL_MENU
```

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `kitchenId` | string (ObjectId) | No | Filter by applicable kitchen |
| `zoneId` | string (ObjectId) | No | Filter by applicable zone |
| `orderValue` | number | No | Filter by minimum order value |
| `menuType` | string | No | `"ON_DEMAND_MENU"` or `"MEAL_MENU"` - filters coupons by applicable menu type |

**Response:**

```json
{
  "code": 200,
  "success": true,
  "message": "Available coupons retrieved",
  "data": {
    "coupons": [
      {
        "code": "FREEADDON3",
        "name": "3 Free Add-ons",
        "description": "Get 3 add-ons free with your thali!",
        "discountType": "FREE_ADDON_COUNT",
        "discountValue": 0,
        "maxDiscountAmount": null,
        "freeAddonCount": 3,
        "freeAddonMaxValue": null,
        "extraVoucherCount": null,
        "applicableMenuTypes": ["MEAL_MENU"],
        "minOrderValue": 0,
        "termsAndConditions": "Valid on thali orders only",
        "validTill": "2026-03-31T23:59:59.000Z",
        "usesRemaining": 95,
        "bannerImage": "https://..."
      },
      {
        "code": "ADDONMAX50",
        "name": "Add-ons worth Rs.50 Free",
        "description": "Get add-ons worth up to Rs.50 free",
        "discountType": "FREE_ADDON_VALUE",
        "discountValue": 0,
        "maxDiscountAmount": null,
        "freeAddonCount": null,
        "freeAddonMaxValue": 50,
        "extraVoucherCount": null,
        "applicableMenuTypes": ["MEAL_MENU", "ON_DEMAND_MENU"],
        "minOrderValue": 100,
        "termsAndConditions": null,
        "validTill": "2026-04-30T23:59:59.000Z",
        "usesRemaining": 200,
        "bannerImage": null
      },
      {
        "code": "BONUS5",
        "name": "5 Bonus Meal Vouchers",
        "description": "Place an order and get 5 extra meal vouchers!",
        "discountType": "FREE_EXTRA_VOUCHER",
        "discountValue": 0,
        "maxDiscountAmount": null,
        "freeAddonCount": null,
        "freeAddonMaxValue": null,
        "extraVoucherCount": 5,
        "applicableMenuTypes": ["MEAL_MENU"],
        "minOrderValue": 0,
        "termsAndConditions": "Bonus vouchers expire in 30 days",
        "validTill": "2026-03-15T23:59:59.000Z",
        "usesRemaining": 50,
        "bannerImage": null
      }
    ]
  }
}
```

**Frontend Notes:**
- Pass `menuType` to only show relevant coupons on the cart screen
- Use `discountType` to display the correct coupon badge/icon
- For `FREE_ADDON_COUNT`: Show "X add-ons free" using `freeAddonCount`
- For `FREE_ADDON_VALUE`: Show "Add-ons worth Rs.X free" using `freeAddonMaxValue`
- For `FREE_EXTRA_VOUCHER`: Show "X bonus meal vouchers" using `extraVoucherCount`

---

### 2. Validate Coupon

Checks if a coupon code is valid for the current order context. Call this when user enters/selects a coupon code.

```
POST /api/coupons/validate
```

**Request Body:**

```json
{
  "code": "FREEADDON3",
  "kitchenId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "zoneId": "64a1b2c3d4e5f6a7b8c9d0e2",
  "orderValue": 250,
  "itemCount": 3,
  "menuType": "MEAL_MENU"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Coupon code entered by user |
| `kitchenId` | string | Yes | Current kitchen's ID |
| `zoneId` | string | Yes | User's delivery zone ID |
| `orderValue` | number | Yes | Current cart subtotal |
| `itemCount` | number | Yes | Total items in cart |
| `menuType` | string | Yes | `"ON_DEMAND_MENU"` or `"MEAL_MENU"` |

**Success Response:**

```json
{
  "code": 200,
  "success": true,
  "message": "Coupon validation result",
  "data": {
    "valid": true,
    "coupon": {
      "code": "FREEADDON3",
      "name": "3 Free Add-ons",
      "discountType": "FREE_ADDON_COUNT",
      "discountValue": 0,
      "freeAddonCount": 3,
      "freeAddonMaxValue": null,
      "extraVoucherCount": null,
      "applicableMenuTypes": ["MEAL_MENU"]
    },
    "discount": {
      "type": "FREE_ADDON_COUNT",
      "value": 0,
      "amount": 0
    },
    "reason": null
  }
}
```

**Invalid Coupon Response:**

```json
{
  "code": 200,
  "success": true,
  "message": "Coupon validation result",
  "data": {
    "valid": false,
    "coupon": {
      "code": "FREEADDON3",
      "name": "3 Free Add-ons"
    },
    "discount": null,
    "reason": "WRONG_MENU_TYPE"
  }
}
```

**Rejection Reason Codes:**

| Reason | User-Facing Message |
|--------|-------------------|
| `INVALID_CODE` | "Invalid coupon code" |
| `EXPIRED` | "This coupon has expired" |
| `EXHAUSTED` | "This coupon has been fully redeemed" |
| `INACTIVE` | "This coupon is not active" |
| `NOT_STARTED` | "This coupon is not yet valid" |
| `USER_LIMIT_EXCEEDED` | "You've already used this coupon" |
| `WRONG_MENU_TYPE` | "This coupon is not valid for this order type" |
| `KITCHEN_NOT_APPLICABLE` | "This coupon is not valid for this kitchen" |
| `ZONE_NOT_APPLICABLE` | "This coupon is not valid in your area" |
| `MIN_ORDER_NOT_MET` | "Minimum order value not met" |
| `MIN_ITEMS_NOT_MET` | "Minimum items not met" |
| `NEW_USERS_ONLY` | "This coupon is for new users only" |
| `EXISTING_USERS_ONLY` | "This coupon is for existing users only" |
| `NOT_ELIGIBLE_USER` | "You are not eligible for this coupon" |
| `FIRST_ORDER_ONLY` | "This coupon is valid on first order only" |

**Frontend Notes:**
- The `discount.amount` for `FREE_ADDON_COUNT` / `FREE_ADDON_VALUE` / `FREE_EXTRA_VOUCHER` may be `0` at validation time because the actual discount depends on addon selection. The real discount shows up in the pricing preview.
- Always call the pricing endpoint after validating to see the actual discount breakdown.

---

### 3. Calculate Pricing (Cart Preview)

This is your main pricing endpoint. Send the full cart and get back a complete price breakdown including coupon discount.

```
POST /api/orders/calculate-pricing
```

**Request Body:**

```json
{
  "kitchenId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "items": [
    {
      "menuItemId": "64a1b2c3d4e5f6a7b8c9d0e3",
      "quantity": 1,
      "addons": [
        { "addonId": "64a1b2c3d4e5f6a7b8c9d0e4", "quantity": 1 },
        { "addonId": "64a1b2c3d4e5f6a7b8c9d0e5", "quantity": 2 },
        { "addonId": "64a1b2c3d4e5f6a7b8c9d0e6", "quantity": 1 }
      ]
    }
  ],
  "voucherCount": 1,
  "couponCode": "FREEADDON3",
  "deliveryAddressId": "64a1b2c3d4e5f6a7b8c9d0e7"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kitchenId` | string | Yes | Kitchen ID |
| `menuType` | string | Yes | `"ON_DEMAND_MENU"` or `"MEAL_MENU"` |
| `mealWindow` | string | Only for MEAL_MENU | `"LUNCH"` or `"DINNER"` |
| `items` | array | Yes | Cart items with addons |
| `voucherCount` | number | No | Number of meal vouchers to use (MEAL_MENU only, default 0) |
| `couponCode` | string | No | Coupon code to apply |
| `deliveryAddressId` | string | Yes | User's delivery address ID |

**Response (MEAL_MENU + Voucher + FREE_ADDON_COUNT coupon):**

```json
{
  "code": 200,
  "success": true,
  "message": "Pricing calculated",
  "data": {
    "breakdown": {
      "items": [
        {
          "name": "Paneer Thali",
          "quantity": 1,
          "unitPrice": 150,
          "total": 150,
          "addons": [
            { "addonId": "...", "name": "Raita", "quantity": 1, "unitPrice": 20, "totalPrice": 20 },
            { "addonId": "...", "name": "Butter Roti", "quantity": 2, "unitPrice": 15, "totalPrice": 30 },
            { "addonId": "...", "name": "Gulab Jamun", "quantity": 1, "unitPrice": 40, "totalPrice": 40 }
          ]
        }
      ],
      "subtotal": 240,
      "charges": {
        "deliveryFee": 30,
        "serviceFee": 5,
        "packagingFee": 10,
        "handlingFee": 2,
        "taxAmount": 7.2,
        "taxBreakdown": [
          { "taxType": "GST", "rate": 5, "amount": 7.2 }
        ]
      },
      "discount": {
        "couponCode": "FREEADDON3",
        "discountType": "FREE_ADDON_COUNT",
        "discountAmount": 0,
        "addonDiscountAmount": 50,
        "extraVouchersToIssue": 0
      },
      "voucherCoverage": {
        "voucherCount": 1,
        "mainCoursesCovered": 1,
        "uncoveredMainCourses": 0,
        "value": 150,
        "coversDelivery": false,
        "coversServiceFee": false,
        "coversPackagingFee": false,
        "coversHandlingFee": false,
        "coversTaxOnCoveredMeals": false,
        "coversAddons": false
      },
      "grandTotal": 294.2,
      "amountToPay": 94.2
    },
    "voucherEligibility": {
      "available": 12,
      "canUse": 1,
      "cutoffPassed": false,
      "cutoffInfo": {
        "cutoffTime": "10:30 AM",
        "currentTime": "9:15 AM",
        "message": "Order before 10:30 AM to use vouchers"
      }
    }
  }
}
```

**Discount Object Fields:**

| Field | Description |
|-------|-------------|
| `couponCode` | The applied coupon code |
| `discountType` | One of the 6 discount types |
| `discountAmount` | Monetary discount on the order total (for PERCENTAGE, FLAT, FREE_DELIVERY) |
| `addonDiscountAmount` | Addon-specific discount amount (for FREE_ADDON_COUNT, FREE_ADDON_VALUE) |
| `extraVouchersToIssue` | Number of bonus vouchers the customer will receive (for FREE_EXTRA_VOUCHER) |

**How to calculate displayed "You Save" amount:**
```
totalSavings = discount.discountAmount + discount.addonDiscountAmount
```

**How `amountToPay` is calculated by backend:**
```
For MEAL_MENU:
  amountToPay = subtotal - voucherCoverage.value + charges (all) - discountAmount - addonDiscountAmount

For ON_DEMAND_MENU:
  amountToPay = grandTotal - discountAmount - addonDiscountAmount
```

---

### 4. Create Order

Same as before, but now `couponCode` works for both menu types.

```
POST /api/orders
```

**Request Body:**

```json
{
  "kitchenId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "deliveryAddressId": "64a1b2c3d4e5f6a7b8c9d0e7",
  "items": [
    {
      "menuItemId": "64a1b2c3d4e5f6a7b8c9d0e3",
      "quantity": 1,
      "addons": [
        { "addonId": "64a1b2c3d4e5f6a7b8c9d0e4", "quantity": 1 },
        { "addonId": "64a1b2c3d4e5f6a7b8c9d0e5", "quantity": 2 }
      ]
    }
  ],
  "voucherCount": 1,
  "couponCode": "BONUS5",
  "specialInstructions": "Extra spicy",
  "paymentMethod": "UPI"
}
```

**Response (key fields related to coupons):**

```json
{
  "code": 201,
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      "_id": "...",
      "orderNumber": "ORD-20260212-001",
      "menuType": "MEAL_MENU",
      "mealWindow": "LUNCH",
      "subtotal": 200,
      "charges": { "..." : "..." },
      "discount": {
        "couponId": "...",
        "couponCode": "BONUS5",
        "discountType": "FREE_EXTRA_VOUCHER",
        "discountAmount": 0,
        "addonDiscountAmount": 0,
        "extraVouchersIssued": 5
      },
      "grandTotal": 247,
      "amountPaid": 97,
      "status": "PLACED"
    },
    "vouchersUsed": 1,
    "amountToPay": 97,
    "paymentRequired": true,
    "paymentAutoConfirmed": false,
    "autoAccepted": false
  }
}
```

**Frontend Notes:**
- When `discount.extraVouchersIssued > 0`, show a success banner: "You got X bonus meal vouchers!"
- The bonus vouchers are immediately available in the user's voucher balance
- On order cancellation, bonus vouchers are automatically revoked

---

## Frontend Integration Flows

### Flow 1: MEAL_MENU Cart with Coupon

```
┌─────────────────────────────────────────────────┐
│ 1. User selects thali + add-ons                 │
│    (existing flow, no change)                   │
├─────────────────────────────────────────────────┤
│ 2. Show "Apply Coupon" section on cart          │
│    GET /api/coupons/available?menuType=MEAL_MENU│
│    → Display list of applicable coupons         │
├─────────────────────────────────────────────────┤
│ 3. User taps a coupon or enters code            │
│    POST /api/coupons/validate                   │
│    → If valid: show green tick, coupon name      │
│    → If invalid: show error with reason message  │
├─────────────────────────────────────────────────┤
│ 4. Refresh pricing with coupon applied          │
│    POST /api/orders/calculate-pricing            │
│    (include couponCode + voucherCount)           │
│    → Update price breakdown on UI               │
├─────────────────────────────────────────────────┤
│ 5. User places order                            │
│    POST /api/orders                              │
│    (include couponCode + voucherCount)           │
│    → Show order confirmation                    │
│    → If extraVouchersIssued > 0: show banner    │
└─────────────────────────────────────────────────┘
```

### Flow 2: Coupon Selection UI

```
┌──────────────────────────────────────────┐
│          Available Coupons               │
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ 🏷️ FREEADDON3                       │ │
│ │ 3 Free Add-ons                      │ │
│ │ Get 3 add-ons free with your thali! │ │
│ │ Valid till: 31 Mar 2026             │ │
│ │                        [APPLY]      │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ 🎫 BONUS5                           │ │
│ │ 5 Bonus Meal Vouchers               │ │
│ │ Place order & get 5 extra vouchers! │ │
│ │ Valid till: 15 Mar 2026             │ │
│ │                        [APPLY]      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │  Enter coupon code: [__________]    │ │
│ │                        [APPLY]      │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Flow 3: Cart Price Breakdown Display

**MEAL_MENU with voucher + FREE_ADDON_COUNT coupon:**

```
┌──────────────────────────────────────────┐
│           Order Summary                  │
├──────────────────────────────────────────┤
│ Paneer Thali        x1      ₹150.00     │
│   + Raita           x1       ₹20.00     │
│   + Butter Roti     x2       ₹30.00     │
│   + Gulab Jamun     x1       ₹40.00     │
├──────────────────────────────────────────┤
│ Subtotal                     ₹240.00     │
│ Voucher (1 used)            -₹150.00     │
│ Delivery Fee                  ₹30.00     │
│ Service Fee                    ₹5.00     │
│ Packaging                     ₹10.00     │
│ Handling                       ₹2.00     │
│ GST (5%)                       ₹7.20     │
│ Coupon FREEADDON3            -₹50.00     │  ← addonDiscountAmount
│   (3 add-ons free)                       │
├──────────────────────────────────────────┤
│ Total                        ₹294.20     │
│ You Pay                       ₹94.20     │
│                                          │
│ 💰 You saved ₹200.00                    │  ← voucherValue + addonDiscount
└──────────────────────────────────────────┘
```

**MEAL_MENU with voucher + PERCENTAGE coupon:**

```
┌──────────────────────────────────────────┐
│ Subtotal                     ₹200.00     │
│ Voucher (1 used)            -₹150.00     │
│ Delivery Fee                  ₹30.00     │
│ Charges + Tax                 ₹20.00     │
│ Coupon SAVE20 (20% off)     -₹20.00     │  ← discountAmount
│   (20% off your payment)                 │
├──────────────────────────────────────────┤
│ You Pay                       ₹80.00     │
└──────────────────────────────────────────┘
```

**MEAL_MENU with FREE_EXTRA_VOUCHER coupon:**

```
┌──────────────────────────────────────────┐
│ Subtotal                     ₹200.00     │
│ Voucher (1 used)            -₹150.00     │
│ Charges + Tax                 ₹47.00     │
├──────────────────────────────────────────┤
│ You Pay                       ₹97.00     │
│                                          │
│ 🎉 Coupon BONUS5 applied!               │
│    You'll get 5 bonus meal vouchers      │  ← extraVouchersToIssue
│    after placing this order              │
└──────────────────────────────────────────┘
```

---

## Display Logic by Discount Type

Use the `discount` object from the pricing response to determine what to display:

```javascript
function getCouponDisplayInfo(discount) {
  if (!discount) return null;

  switch (discount.discountType) {
    case "PERCENTAGE":
    case "FLAT":
      return {
        label: `Coupon ${discount.couponCode}`,
        savings: discount.discountAmount,
        showAsSavings: true,
        message: null
      };

    case "FREE_DELIVERY":
      return {
        label: `Coupon ${discount.couponCode}`,
        savings: discount.discountAmount, // = deliveryFee waived
        showAsSavings: true,
        message: "Free delivery applied!"
      };

    case "FREE_ADDON_COUNT":
    case "FREE_ADDON_VALUE":
      return {
        label: `Coupon ${discount.couponCode}`,
        savings: discount.addonDiscountAmount,
        showAsSavings: true,
        message: discount.discountType === "FREE_ADDON_COUNT"
          ? `${discount.addonDiscountAmount > 0 ? 'Add-ons discounted!' : 'Add add-ons to use this coupon'}`
          : `Add-ons worth ₹${discount.addonDiscountAmount} free!`
      };

    case "FREE_EXTRA_VOUCHER":
      return {
        label: `Coupon ${discount.couponCode}`,
        savings: 0,
        showAsSavings: false,
        message: `You'll get ${discount.extraVouchersToIssue} bonus meal vouchers!`
      };
  }
}
```

---

## Admin Panel Integration

### Create Coupon with New Types

```
POST /api/coupons
```

**Example: Create FREE_ADDON_COUNT coupon for MEAL_MENU:**

```json
{
  "code": "FREEADDON3",
  "name": "3 Free Add-ons",
  "description": "Get 3 add-ons free with your thali!",
  "discountType": "FREE_ADDON_COUNT",
  "discountValue": 0,
  "freeAddonCount": 3,
  "applicableMenuTypes": ["MEAL_MENU"],
  "minOrderValue": 0,
  "totalUsageLimit": 100,
  "perUserLimit": 2,
  "targetUserType": "ALL",
  "validFrom": "2026-02-12T00:00:00.000Z",
  "validTill": "2026-03-31T23:59:59.000Z",
  "status": "ACTIVE",
  "isVisible": true,
  "termsAndConditions": "Valid on thali orders with add-ons. Cheapest 3 add-ons will be free."
}
```

**Example: Create FREE_ADDON_VALUE coupon:**

```json
{
  "code": "ADDONMAX50",
  "name": "Add-ons worth Rs.50 Free",
  "description": "Get add-ons worth up to Rs.50 free",
  "discountType": "FREE_ADDON_VALUE",
  "discountValue": 0,
  "freeAddonMaxValue": 50,
  "applicableMenuTypes": ["MEAL_MENU", "ON_DEMAND_MENU"],
  "minOrderValue": 100,
  "totalUsageLimit": 500,
  "perUserLimit": 1,
  "targetUserType": "ALL",
  "validFrom": "2026-02-12T00:00:00.000Z",
  "validTill": "2026-04-30T23:59:59.000Z",
  "status": "ACTIVE",
  "isVisible": true
}
```

**Example: Create FREE_EXTRA_VOUCHER coupon:**

```json
{
  "code": "BONUS5",
  "name": "5 Bonus Meal Vouchers",
  "description": "Place an order and get 5 extra meal vouchers!",
  "discountType": "FREE_EXTRA_VOUCHER",
  "discountValue": 0,
  "extraVoucherCount": 5,
  "extraVoucherExpiryDays": 30,
  "applicableMenuTypes": ["MEAL_MENU"],
  "totalUsageLimit": 50,
  "perUserLimit": 1,
  "targetUserType": "ALL",
  "validFrom": "2026-02-12T00:00:00.000Z",
  "validTill": "2026-03-15T23:59:59.000Z",
  "status": "ACTIVE",
  "isVisible": true,
  "termsAndConditions": "Bonus vouchers expire in 30 days from issuance."
}
```

**Example: PERCENTAGE coupon for both menu types:**

```json
{
  "code": "SAVE20",
  "name": "20% Off",
  "description": "Get 20% off on your order!",
  "discountType": "PERCENTAGE",
  "discountValue": 20,
  "maxDiscountAmount": 100,
  "applicableMenuTypes": ["ON_DEMAND_MENU", "MEAL_MENU"],
  "minOrderValue": 200,
  "totalUsageLimit": 1000,
  "perUserLimit": 3,
  "targetUserType": "ALL",
  "validFrom": "2026-02-12T00:00:00.000Z",
  "validTill": "2026-06-30T23:59:59.000Z",
  "status": "ACTIVE",
  "isVisible": true
}
```

### Admin Form: Conditional Fields

When creating/editing a coupon in the admin panel, show fields conditionally based on `discountType`:

| discountType | Show These Fields |
|-------------|-------------------|
| `PERCENTAGE` | `discountValue` (%), `maxDiscountAmount` |
| `FLAT` | `discountValue` (₹) |
| `FREE_DELIVERY` | (no extra fields) |
| `FREE_ADDON_COUNT` | `freeAddonCount` (number input, min 1) |
| `FREE_ADDON_VALUE` | `freeAddonMaxValue` (₹ input, min 0.01) |
| `FREE_EXTRA_VOUCHER` | `extraVoucherCount` (number, 1-50), `extraVoucherExpiryDays` (number, 1-365, default 30) |

**Always show:** `applicableMenuTypes` as a multi-select checkbox with options: `ON_DEMAND_MENU`, `MEAL_MENU`

---

## Edge Cases & Important Notes

### 1. Coupon + Voucher Stacking
- Vouchers cover the main course (thali) price
- Coupons apply to the remaining payable amount or add-ons
- For PERCENTAGE/FLAT on MEAL_MENU: discount is on `amountToPay` after voucher deduction, NOT on the full subtotal
- For addon coupons: discount is on add-on prices only

### 2. FREE_ADDON_COUNT Behavior
- The backend automatically picks the **cheapest N add-ons** to make free
- If user has fewer add-ons than `freeAddonCount`, all add-ons are free
- Each unit counts separately (qty 2 of same addon = 2 units)
- Show users: "Add more add-ons to maximize this coupon!"

### 3. FREE_EXTRA_VOUCHER Behavior
- No monetary discount on the current order
- Bonus vouchers are issued **after order is placed** (not at preview)
- Bonus vouchers are cancelled if the order is cancelled/rejected
- Show on order confirmation screen, not in price breakdown savings

### 4. Coupon Removal
- When user removes coupon from cart, re-call calculate-pricing without `couponCode`
- The backend handles all price recalculation

### 5. Order Cancellation
- Coupon usage is automatically reversed (user can reuse)
- Bonus vouchers from FREE_EXTRA_VOUCHER are automatically cancelled
- No frontend action needed for this

### 6. Backward Compatibility
- Existing ON_DEMAND_MENU coupon flow is **unchanged**
- All existing coupons default to `applicableMenuTypes: ["ON_DEMAND_MENU"]`
- No migration needed for existing coupons

---

## Summary of Changes from Previous Version

| What Changed | Before | After |
|-------------|--------|-------|
| Coupon on MEAL_MENU | Not allowed | Allowed |
| `couponCode` in MEAL_MENU order | Validation rejected it | Accepted |
| Available coupons API | No `menuType` filter | Supports `menuType` query param |
| Validate coupon API | Only ON_DEMAND_MENU | Both menu types |
| Pricing response | `discount.discountAmount` only | + `addonDiscountAmount`, `extraVouchersToIssue` |
| Order response | `discount.discountAmount` only | + `addonDiscountAmount`, `extraVouchersIssued` |
| New discount types | PERCENTAGE, FLAT, FREE_DELIVERY | + FREE_ADDON_COUNT, FREE_ADDON_VALUE, FREE_EXTRA_VOUCHER |
| Admin create coupon | No `applicableMenuTypes` | Required field with multi-select |
