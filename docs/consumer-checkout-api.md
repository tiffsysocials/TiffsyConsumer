# Consumer Checkout API

Mini API documentation for order placement payment flow when consumer clicks "Place Order".

---

## Authentication

All endpoints require Firebase/JWT token:

```
Authorization: Bearer <token>
```

---

## Payment Options

The checkout modal supports the following payment options:

1. Pay Full - Complete payment via UPI/Card/Wallet/NetBanking
2. Pay with Voucher Only - Order fully covered by vouchers (no payment needed)
3. Partial Pay - Vouchers cover main courses, pay remaining amount
4. Pay Before Meal Time - (Not yet implemented)
5. Pay After Meal Time - (Not yet implemented)

---

## Endpoints

---

### 1. Get Voucher Balance

**GET** `/api/vouchers/balance`

Get available voucher count for the authenticated user before checkout.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzkyYWJjZDEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MDQ4NzM2MDB9.abc123
```

**Response (200):**

```json
{
  "message": "Voucher balance retrieved",
  "data": {
    "balance": {
      "total": 10,
      "available": 5,
      "redeemed": 3,
      "expired": 1,
      "restored": 1,
      "cancelled": 0
    },
    "expiringNext": {
      "count": 2,
      "date": "2025-01-15T23:59:59.000Z",
      "daysRemaining": 5
    },
    "canRedeemToday": true,
    "nextCutoff": {
      "mealWindow": "LUNCH",
      "cutoffTime": "11:00 AM",
      "isPastCutoff": false,
      "message": "You can use vouchers for LUNCH until 11:00 AM"
    }
  }
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| `balance.total` | Total vouchers ever assigned to user |
| `balance.available` | Vouchers available for use (includes restored) |
| `balance.redeemed` | Vouchers already used |
| `balance.expired` | Vouchers that have expired |
| `balance.restored` | Vouchers restored after order cancellation |
| `balance.cancelled` | Vouchers cancelled by admin |
| `expiringNext` | Info about vouchers expiring soonest |
| `canRedeemToday` | Whether user can redeem vouchers today |
| `nextCutoff` | Current/next meal window cutoff info |

---

### 2. Calculate Pricing (Cart Preview)

**POST** `/api/orders/calculate-pricing`

Preview order pricing with different payment options. Use this to populate the payment modal with pricing breakdown.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzkyYWJjZDEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MDQ4NzM2MDB9.abc123
Content-Type: application/json
```

**Request Body:**

```json
{
  "kitchenId": "6792kitch234567890abcdef",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "deliveryAddressId": "6792addr1234567890abcdef",
  "items": [
    {
      "menuItemId": "6792item1234567890abcdef",
      "quantity": 2,
      "addons": []
    },
    {
      "menuItemId": "6792item2234567890abcdef",
      "quantity": 1,
      "addons": [
        {
          "addonId": "6792addn1234567890abcdef",
          "quantity": 1
        }
      ]
    }
  ],
  "voucherCount": 2,
  "couponCode": null
}
```

**Response (200):**

```json
{
  "message": "Pricing calculated",
  "data": {
    "breakdown": {
      "items": [
        {
          "menuItemId": "6792item1234567890abcdef",
          "name": "Dal Tadka",
          "quantity": 2,
          "unitPrice": 120,
          "total": 240,
          "isMainCourse": true,
          "addons": []
        },
        {
          "menuItemId": "6792item2234567890abcdef",
          "name": "Jeera Rice",
          "quantity": 1,
          "unitPrice": 80,
          "total": 80,
          "isMainCourse": false,
          "addons": [
            {
              "addonId": "6792addn1234567890abcdef",
              "name": "Extra Raita",
              "quantity": 1,
              "unitPrice": 25,
              "totalPrice": 25
            }
          ]
        }
      ],
      "subtotal": 345,
      "charges": {
        "deliveryFee": 30,
        "serviceFee": 5,
        "packagingFee": 10,
        "handlingFee": 0,
        "taxAmount": 18,
        "taxBreakdown": [
          {
            "taxType": "CGST",
            "rate": 2.5,
            "amount": 9
          },
          {
            "taxType": "SGST",
            "rate": 2.5,
            "amount": 9
          }
        ]
      },
      "discount": null,
      "voucherCoverage": {
        "voucherCount": 2,
        "mainCoursesCovered": 2,
        "value": 240
      },
      "grandTotal": 408,
      "amountToPay": 168
    },
    "voucherEligibility": {
      "available": 5,
      "canUse": 2,
      "cutoffPassed": false,
      "cutoffInfo": {
        "cutoffTime": "2025-01-10T11:00:00.000Z",
        "currentTime": "2025-01-10T09:30:00.000Z",
        "message": "Vouchers can be used until 11:00 AM"
      }
    }
  }
}
```

---

### 3. Create Order - Pay Full (No Vouchers)

**POST** `/api/orders/`

Create order with full payment via payment gateway. No vouchers applied.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzkyYWJjZDEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MDQ4NzM2MDB9.abc123
Content-Type: application/json
```

**Request Body:**

```json
{
  "kitchenId": "6792kitch234567890abcdef",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "deliveryAddressId": "6792addr1234567890abcdef",
  "items": [
    {
      "menuItemId": "6792item1234567890abcdef",
      "quantity": 2,
      "addons": []
    },
    {
      "menuItemId": "6792item2234567890abcdef",
      "quantity": 1,
      "addons": [
        {
          "addonId": "6792addn1234567890abcdef",
          "quantity": 1
        }
      ]
    }
  ],
  "voucherCount": 0,
  "couponCode": null,
  "paymentMethod": "UPI",
  "specialInstructions": "Less spicy",
  "deliveryNotes": "Call at gate"
}
```

**Response (200):**

```json
{
  "message": "Order created successfully",
  "data": {
    "order": {
      "_id": "6792ordr1234567890abcdef",
      "orderNumber": "ORD-20250110-X7K2M",
      "userId": "6792user1234567890abcdef",
      "kitchenId": "6792kitch234567890abcdef",
      "zoneId": "6792zone1234567890abcdef",
      "deliveryAddressId": "6792addr1234567890abcdef",
      "deliveryAddress": {
        "addressLine1": "Flat 402, Sunrise Apartments",
        "addressLine2": "Sector 15",
        "landmark": "Near City Mall",
        "locality": "Vashi",
        "city": "Navi Mumbai",
        "pincode": "400703",
        "contactName": "Rahul Verma",
        "contactPhone": "+919876543210",
        "coordinates": {
          "latitude": 19.076,
          "longitude": 72.9977
        }
      },
      "menuType": "MEAL_MENU",
      "mealWindow": "LUNCH",
      "items": [
        {
          "menuItemId": "6792item1234567890abcdef",
          "name": "Dal Tadka",
          "quantity": 2,
          "unitPrice": 120,
          "totalPrice": 240,
          "isMainCourse": true,
          "addons": []
        },
        {
          "menuItemId": "6792item2234567890abcdef",
          "name": "Jeera Rice",
          "quantity": 1,
          "unitPrice": 80,
          "totalPrice": 80,
          "isMainCourse": false,
          "addons": [
            {
              "addonId": "6792addn1234567890abcdef",
              "name": "Extra Raita",
              "quantity": 1,
              "unitPrice": 25,
              "totalPrice": 25
            }
          ]
        }
      ],
      "subtotal": 345,
      "charges": {
        "deliveryFee": 30,
        "serviceFee": 5,
        "packagingFee": 10,
        "handlingFee": 0,
        "taxAmount": 18,
        "taxBreakdown": [
          { "taxType": "CGST", "rate": 2.5, "amount": 9 },
          { "taxType": "SGST", "rate": 2.5, "amount": 9 }
        ]
      },
      "discount": {
        "couponId": null,
        "couponCode": null,
        "discountAmount": 0,
        "discountType": null
      },
      "grandTotal": 408,
      "voucherUsage": {
        "voucherIds": [],
        "voucherCount": 0,
        "mainCoursesCovered": 0
      },
      "amountPaid": 408,
      "paymentStatus": "PENDING",
      "paymentMethod": "UPI",
      "status": "PLACED",
      "statusTimeline": [
        {
          "status": "PLACED",
          "timestamp": "2025-01-10T09:30:00.000Z",
          "updatedBy": "6792user1234567890abcdef",
          "notes": "Order placed by customer"
        }
      ],
      "specialInstructions": "Less spicy",
      "deliveryNotes": "Call at gate",
      "placedAt": "2025-01-10T09:30:00.000Z",
      "createdAt": "2025-01-10T09:30:00.000Z",
      "updatedAt": "2025-01-10T09:30:00.000Z"
    },
    "vouchersUsed": 0,
    "amountToPay": 408,
    "paymentRequired": true,
    "paymentAutoConfirmed": true
  }
}
```

**Additional Response Fields:**

| Field | Description |
|-------|-------------|
| `vouchersUsed` | Number of vouchers redeemed for this order |
| `amountToPay` | Final amount customer needs to pay |
| `paymentRequired` | Whether payment gateway flow is needed |
| `paymentAutoConfirmed` | Whether payment was auto-confirmed (dev mode) |

---

### 4. Create Order - Pay with Voucher Only

**POST** `/api/orders/`

Create order fully covered by vouchers. No payment required.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzkyYWJjZDEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MDQ4NzM2MDB9.abc123
Content-Type: application/json
```

**Request Body:**

```json
{
  "kitchenId": "6792kitch234567890abcdef",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "deliveryAddressId": "6792addr1234567890abcdef",
  "items": [
    {
      "menuItemId": "6792item1234567890abcdef",
      "quantity": 2,
      "addons": []
    }
  ],
  "voucherCount": 2,
  "couponCode": null,
  "paymentMethod": "VOUCHER_ONLY",
  "specialInstructions": null,
  "deliveryNotes": null
}
```

**Response (200):**

```json
{
  "message": "Order created successfully",
  "data": {
    "order": {
      "_id": "6792ordr2234567890abcdef",
      "orderNumber": "ORD-20250110-Y8L3N",
      "userId": "6792user1234567890abcdef",
      "kitchenId": "6792kitch234567890abcdef",
      "zoneId": "6792zone1234567890abcdef",
      "deliveryAddressId": "6792addr1234567890abcdef",
      "deliveryAddress": {
        "addressLine1": "Flat 402, Sunrise Apartments",
        "addressLine2": "Sector 15",
        "landmark": "Near City Mall",
        "locality": "Vashi",
        "city": "Navi Mumbai",
        "pincode": "400703",
        "contactName": "Rahul Verma",
        "contactPhone": "+919876543210",
        "coordinates": {
          "latitude": 19.076,
          "longitude": 72.9977
        }
      },
      "menuType": "MEAL_MENU",
      "mealWindow": "LUNCH",
      "items": [
        {
          "menuItemId": "6792item1234567890abcdef",
          "name": "Dal Tadka",
          "quantity": 2,
          "unitPrice": 120,
          "totalPrice": 240,
          "isMainCourse": true,
          "addons": []
        }
      ],
      "subtotal": 240,
      "charges": {
        "deliveryFee": 30,
        "serviceFee": 5,
        "packagingFee": 10,
        "handlingFee": 0,
        "taxAmount": 12.75,
        "taxBreakdown": [
          { "taxType": "CGST", "rate": 2.5, "amount": 6.38 },
          { "taxType": "SGST", "rate": 2.5, "amount": 6.37 }
        ]
      },
      "discount": {
        "couponId": null,
        "couponCode": null,
        "discountAmount": 0,
        "discountType": null
      },
      "grandTotal": 297.75,
      "voucherUsage": {
        "voucherIds": [
          "6792vchr1234567890abcdef",
          "6792vchr2234567890abcdef"
        ],
        "voucherCount": 2,
        "mainCoursesCovered": 2
      },
      "amountPaid": 0,
      "paymentStatus": "PAID",
      "paymentMethod": "VOUCHER_ONLY",
      "status": "PLACED",
      "statusTimeline": [
        {
          "status": "PLACED",
          "timestamp": "2025-01-10T09:30:00.000Z",
          "updatedBy": "6792user1234567890abcdef",
          "notes": "Order placed by customer"
        }
      ],
      "placedAt": "2025-01-10T09:30:00.000Z",
      "createdAt": "2025-01-10T09:30:00.000Z",
      "updatedAt": "2025-01-10T09:30:00.000Z"
    },
    "vouchersUsed": 2,
    "amountToPay": 0,
    "paymentRequired": false,
    "paymentAutoConfirmed": false
  }
}
```

---

### 5. Create Order - Partial Pay (Voucher + Payment)

**POST** `/api/orders/`

Create order with vouchers covering main courses and remaining amount paid via payment gateway.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzkyYWJjZDEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MDQ4NzM2MDB9.abc123
Content-Type: application/json
```

**Request Body:**

```json
{
  "kitchenId": "6792kitch234567890abcdef",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "deliveryAddressId": "6792addr1234567890abcdef",
  "items": [
    {
      "menuItemId": "6792item1234567890abcdef",
      "quantity": 2,
      "addons": []
    },
    {
      "menuItemId": "6792item2234567890abcdef",
      "quantity": 1,
      "addons": [
        {
          "addonId": "6792addn1234567890abcdef",
          "quantity": 1
        }
      ]
    }
  ],
  "voucherCount": 2,
  "couponCode": null,
  "paymentMethod": "UPI",
  "specialInstructions": "Less spicy",
  "deliveryNotes": "Call at gate"
}
```

**Response (200):**

```json
{
  "message": "Order created successfully",
  "data": {
    "order": {
      "_id": "6792ordr3234567890abcdef",
      "orderNumber": "ORD-20250110-Z9M4P",
      "userId": "6792user1234567890abcdef",
      "kitchenId": "6792kitch234567890abcdef",
      "zoneId": "6792zone1234567890abcdef",
      "deliveryAddressId": "6792addr1234567890abcdef",
      "deliveryAddress": {
        "addressLine1": "Flat 402, Sunrise Apartments",
        "addressLine2": "Sector 15",
        "landmark": "Near City Mall",
        "locality": "Vashi",
        "city": "Navi Mumbai",
        "pincode": "400703",
        "contactName": "Rahul Verma",
        "contactPhone": "+919876543210",
        "coordinates": {
          "latitude": 19.076,
          "longitude": 72.9977
        }
      },
      "menuType": "MEAL_MENU",
      "mealWindow": "LUNCH",
      "items": [
        {
          "menuItemId": "6792item1234567890abcdef",
          "name": "Dal Tadka",
          "quantity": 2,
          "unitPrice": 120,
          "totalPrice": 240,
          "isMainCourse": true,
          "addons": []
        },
        {
          "menuItemId": "6792item2234567890abcdef",
          "name": "Jeera Rice",
          "quantity": 1,
          "unitPrice": 80,
          "totalPrice": 80,
          "isMainCourse": false,
          "addons": [
            {
              "addonId": "6792addn1234567890abcdef",
              "name": "Extra Raita",
              "quantity": 1,
              "unitPrice": 25,
              "totalPrice": 25
            }
          ]
        }
      ],
      "subtotal": 345,
      "charges": {
        "deliveryFee": 30,
        "serviceFee": 5,
        "packagingFee": 10,
        "handlingFee": 0,
        "taxAmount": 18,
        "taxBreakdown": [
          { "taxType": "CGST", "rate": 2.5, "amount": 9 },
          { "taxType": "SGST", "rate": 2.5, "amount": 9 }
        ]
      },
      "discount": {
        "couponId": null,
        "couponCode": null,
        "discountAmount": 0,
        "discountType": null
      },
      "grandTotal": 408,
      "voucherUsage": {
        "voucherIds": [
          "6792vchr1234567890abcdef",
          "6792vchr2234567890abcdef"
        ],
        "voucherCount": 2,
        "mainCoursesCovered": 2
      },
      "amountPaid": 168,
      "paymentStatus": "PENDING",
      "paymentMethod": "UPI",
      "status": "PLACED",
      "statusTimeline": [
        {
          "status": "PLACED",
          "timestamp": "2025-01-10T09:30:00.000Z",
          "updatedBy": "6792user1234567890abcdef",
          "notes": "Order placed by customer"
        }
      ],
      "specialInstructions": "Less spicy",
      "deliveryNotes": "Call at gate",
      "placedAt": "2025-01-10T09:30:00.000Z",
      "createdAt": "2025-01-10T09:30:00.000Z",
      "updatedAt": "2025-01-10T09:30:00.000Z"
    },
    "vouchersUsed": 2,
    "amountToPay": 168,
    "paymentRequired": true,
    "paymentAutoConfirmed": true
  }
}
```

---

### 6. Create Order - Pay Before Meal Time (Not Implemented)

This payment option is not yet implemented in the backend.

Proposed flow:
- Order is created with `paymentStatus: "SCHEDULED"`
- Payment is automatically triggered before meal window cutoff
- Requires payment gateway integration for scheduled payments

---

### 7. Create Order - Pay After Meal Time (Not Implemented)

This payment option is not yet implemented in the backend.

Proposed flow:
- Order is created with `paymentStatus: "POST_PAID"` or `paymentMethod: "PAY_LATER"`
- Payment is collected after delivery (COD-style)
- Requires trust scoring or deposit mechanism

---

## Error Responses

---

### Voucher Cutoff Passed

When trying to use vouchers after meal window cutoff.

**Response (400):**

```json
{
  "message": "Cutoff time for LUNCH orders has passed. Vouchers cannot be used.",
  "error": {
    "code": "VOUCHER_CUTOFF_PASSED",
    "cutoffTime": "2025-01-10T11:00:00.000Z",
    "currentTime": "2025-01-10T11:30:00.000Z"
  }
}
```

---

### Insufficient Vouchers

When requested voucher count exceeds available vouchers.

**Response (400):**

```json
{
  "message": "Insufficient vouchers",
  "error": {
    "code": "INSUFFICIENT_VOUCHERS",
    "requested": 5,
    "available": 2
  }
}
```

---

### Delivery Address Not Found

**Response (404):**

```json
{
  "message": "Delivery address not found or not owned by user",
  "error": {
    "code": "ADDRESS_NOT_FOUND"
  }
}
```

---

### Kitchen Not Available

**Response (400):**

```json
{
  "message": "Kitchen is not accepting orders",
  "error": {
    "code": "KITCHEN_NOT_ACCEPTING"
  }
}
```

---

### Item Not Available

**Response (400):**

```json
{
  "message": "Menu item not available",
  "error": {
    "code": "ITEM_NOT_AVAILABLE",
    "itemId": "6792item1234567890abcdef",
    "itemName": "Dal Tadka"
  }
}
```

---

## Voucher Rules

- One voucher covers one main course item
- Vouchers only work for MEAL_MENU orders
- Vouchers cannot be used after meal window cutoff (11:00 for LUNCH, 21:00 for DINNER)
- Coupons only work for ON_DEMAND_MENU orders
- Cannot combine vouchers and coupons in same order
- FIFO: Earliest expiring vouchers are used first

---

## Payment Method Values

- `UPI` - UPI payment
- `CARD` - Credit/Debit card
- `WALLET` - Digital wallet
- `NETBANKING` - Net banking
- `VOUCHER_ONLY` - Order fully covered by vouchers
- `OTHER` - Default/unspecified
- `null` / empty - Payment method can be omitted (optional field)

---

## Payment Status Values

- `PENDING` - Payment not yet completed
- `PAID` - Payment successful (or fully covered by vouchers)
- `FAILED` - Payment failed
- `REFUNDED` - Full refund processed
- `PARTIALLY_REFUNDED` - Partial refund processed

---

## Voucher Status Values

- `AVAILABLE` - Voucher can be used
- `REDEEMED` - Voucher has been used for an order
- `EXPIRED` - Voucher validity period has passed
- `RESTORED` - Voucher restored after order cancellation (counts as available)
- `CANCELLED` - Voucher cancelled by admin

---

## Developer Notes

### Dev Mode Payment Auto-Confirm

In non-production environments (`NODE_ENV !== 'production'`), payments are automatically confirmed:
- Orders with `amountToPay > 0` are auto-set to `paymentStatus: "PAID"`
- This bypasses actual payment gateway integration for easier testing
- In production, actual payment processing is required

### Voucher-Coupon Mutual Exclusivity

The backend enforces strict separation:
- **MEAL_MENU orders**: Can use vouchers (0-10), coupons NOT allowed
- **ON_DEMAND_MENU orders**: Can use coupons, vouchers NOT allowed (must be 0)

### Cutoff Time Configuration

Default cutoff times (configurable via admin endpoint):
- **LUNCH**: 11:00 AM IST
- **DINNER**: 9:00 PM IST

Vouchers cannot be used after the cutoff time for that meal window.
