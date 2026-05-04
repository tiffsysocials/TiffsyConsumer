# Consumer Orders API

Mini API documentation for consumer order history and current orders.

---

## Authentication

All endpoints require Firebase/JWT token:

```
Authorization: Bearer <token>
```

---

## Endpoints

---

### 1. Get My Orders (History + Current)

**GET** `/api/orders/my-orders`

Returns paginated list of all orders for the authenticated customer, including active orders.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzkyYWJjZDEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MDQ4NzM2MDB9.abc123
```

**Query Parameters (all optional):**

```
?status=DELIVERED&menuType=MEAL_MENU&dateFrom=2025-01-01&dateTo=2025-01-31&page=1&limit=20
```

- status: PLACED, ACCEPTED, REJECTED, PREPARING, READY, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, FAILED
- menuType: MEAL_MENU, ON_DEMAND_MENU
- dateFrom: ISO date string
- dateTo: ISO date string
- page: number (default 1, min 1)
- limit: number (default 20, min 1, max 50)

**Response (200):**

```json
{
  "message": "Orders retrieved",
  "data": {
    "orders": [
      {
        "_id": "6792abcd1234567890abcdef",
        "orderNumber": "ORD-20250110-A1B2C",
        "userId": "6792user1234567890abcdef",
        "kitchenId": {
          "_id": "6792kitch234567890abcdef",
          "name": "Sharma's Kitchen",
          "logo": "https://storage.tiffsy.com/kitchens/sharma-logo.png"
        },
        "zoneId": "6792zone1234567890abcdef",
        "menuType": "MEAL_MENU",
        "mealWindow": "LUNCH",
        "status": "DELIVERED",
        "items": [
          {
            "menuItemId": "6792item1234567890abcdef",
            "name": "Dal Tadka",
            "quantity": 1,
            "unitPrice": 120,
            "totalPrice": 120,
            "addons": []
          },
          {
            "menuItemId": "6792item2234567890abcdef",
            "name": "Jeera Rice",
            "quantity": 1,
            "unitPrice": 80,
            "totalPrice": 80,
            "addons": []
          }
        ],
        "subtotal": 200,
        "charges": {
          "deliveryFee": 30,
          "serviceFee": 10,
          "packagingFee": 15,
          "handlingFee": 0,
          "taxAmount": 12.75
        },
        "discount": {
          "couponCode": null,
          "discountAmount": 0
        },
        "grandTotal": 267.75,
        "amountPaid": 267.75,
        "paymentStatus": "PAID",
        "statusTimeline": [
          {
            "status": "PLACED",
            "timestamp": "2025-01-10T10:30:00.000Z",
            "notes": "Order placed by customer"
          },
          {
            "status": "ACCEPTED",
            "timestamp": "2025-01-10T10:32:00.000Z",
            "notes": null
          },
          {
            "status": "DELIVERED",
            "timestamp": "2025-01-10T12:15:00.000Z",
            "notes": null
          }
        ],
        "placedAt": "2025-01-10T10:30:00.000Z",
        "statusDisplay": "Delivered",
        "canCancel": false,
        "canRate": true,
        "createdAt": "2025-01-10T10:30:00.000Z",
        "updatedAt": "2025-01-10T12:15:00.000Z"
      }
    ],
    "activeOrders": ["6792actv1234567890abcdef"],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "pages": 1
    }
  }
}
```

---

### 2. Get Order by ID

**GET** `/api/orders/:id`

Returns detailed information for a specific order.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzkyYWJjZDEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MDQ4NzM2MDB9.abc123
```

**Path:**

```
/api/orders/6792abcd1234567890abcdef
```

**Response (200):**

```json
{
  "message": "Order retrieved",
  "data": {
    "order": {
      "_id": "6792abcd1234567890abcdef",
      "orderNumber": "ORD-20250110-A1B2C",
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
          "quantity": 1,
          "unitPrice": 120,
          "totalPrice": 120,
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
      "subtotal": 225,
      "charges": {
        "deliveryFee": 30,
        "serviceFee": 5,
        "packagingFee": 10,
        "handlingFee": 0,
        "taxAmount": 12.5,
        "taxBreakdown": [
          {
            "taxType": "CGST",
            "rate": 2.5,
            "amount": 6.25
          },
          {
            "taxType": "SGST",
            "rate": 2.5,
            "amount": 6.25
          }
        ]
      },
      "discount": {
        "couponId": null,
        "couponCode": null,
        "discountAmount": 0,
        "discountType": null
      },
      "grandTotal": 282.5,
      "amountPaid": 282.5,
      "voucherUsage": {
        "voucherIds": [],
        "voucherCount": 0,
        "mainCoursesCovered": 0
      },
      "paymentStatus": "PAID",
      "paymentMethod": "UPI",
      "status": "OUT_FOR_DELIVERY",
      "statusTimeline": [
        {
          "status": "PLACED",
          "timestamp": "2025-01-10T10:30:00.000Z",
          "updatedBy": "6792user1234567890abcdef",
          "notes": "Order placed by customer"
        },
        {
          "status": "ACCEPTED",
          "timestamp": "2025-01-10T10:32:00.000Z",
          "updatedBy": "6792kitch234567890abcdef",
          "notes": null
        },
        {
          "status": "PREPARING",
          "timestamp": "2025-01-10T11:00:00.000Z",
          "updatedBy": "6792kitch234567890abcdef",
          "notes": null
        },
        {
          "status": "READY",
          "timestamp": "2025-01-10T11:45:00.000Z",
          "updatedBy": "6792kitch234567890abcdef",
          "notes": null
        },
        {
          "status": "PICKED_UP",
          "timestamp": "2025-01-10T11:50:00.000Z",
          "updatedBy": "6792drvr1234567890abcdef",
          "notes": null
        },
        {
          "status": "OUT_FOR_DELIVERY",
          "timestamp": "2025-01-10T12:00:00.000Z",
          "updatedBy": "6792drvr1234567890abcdef",
          "notes": null
        }
      ],
      "acceptedAt": "2025-01-10T10:32:00.000Z",
      "preparedAt": "2025-01-10T11:45:00.000Z",
      "pickedUpAt": "2025-01-10T11:50:00.000Z",
      "estimatedPrepTime": 45,
      "estimatedDeliveryTime": "2025-01-10T12:30:00.000Z",
      "driverId": "6792drvr1234567890abcdef",
      "batchId": "6792btch1234567890abcdef",
      "specialInstructions": "Less spicy please",
      "deliveryNotes": "Call when at gate",
      "placedAt": "2025-01-10T10:30:00.000Z",
      "createdAt": "2025-01-10T10:30:00.000Z",
      "updatedAt": "2025-01-10T12:00:00.000Z"
    },
    "kitchen": {
      "_id": "6792kitch234567890abcdef",
      "name": "Sharma's Kitchen",
      "logo": "https://storage.tiffsy.com/kitchens/sharma-logo.png",
      "address": "Shop 12, Market Complex, Vashi",
      "phone": "+912248001234"
    },
    "statusTimeline": [
      {
        "status": "PLACED",
        "timestamp": "2025-01-10T10:30:00.000Z",
        "updatedBy": "6792user1234567890abcdef",
        "notes": "Order placed by customer"
      },
      {
        "status": "ACCEPTED",
        "timestamp": "2025-01-10T10:32:00.000Z",
        "updatedBy": "6792kitch234567890abcdef",
        "notes": null
      },
      {
        "status": "PREPARING",
        "timestamp": "2025-01-10T11:00:00.000Z",
        "updatedBy": "6792kitch234567890abcdef",
        "notes": null
      },
      {
        "status": "READY",
        "timestamp": "2025-01-10T11:45:00.000Z",
        "updatedBy": "6792kitch234567890abcdef",
        "notes": null
      },
      {
        "status": "PICKED_UP",
        "timestamp": "2025-01-10T11:50:00.000Z",
        "updatedBy": "6792drvr1234567890abcdef",
        "notes": null
      },
      {
        "status": "OUT_FOR_DELIVERY",
        "timestamp": "2025-01-10T12:00:00.000Z",
        "updatedBy": "6792drvr1234567890abcdef",
        "notes": null
      }
    ],
    "delivery": {
      "driver": {
        "_id": "6792drvr1234567890abcdef",
        "name": "Ajay Kumar",
        "phone": "+919123456789"
      },
      "batch": "6792btch1234567890abcdef",
      "estimatedTime": "2025-01-10T12:30:00.000Z"
    },
    "vouchersUsed": [],
    "couponApplied": null
  }
}
```

**Error Response (404):**

```json
{
  "message": "Order not found",
  "error": {
    "code": "ORDER_NOT_FOUND"
  }
}
```

**Error Response (403):**

```json
{
  "message": "Not authorized to view this order",
  "error": {
    "code": "UNAUTHORIZED"
  }
}
```

---

### 3. Track Order

**GET** `/api/orders/:id/track`

Returns real-time tracking information for an active order.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzkyYWJjZDEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MDQ4NzM2MDB9.abc123
```

**Path:**

```
/api/orders/6792abcd1234567890abcdef/track
```

**Response (200):**

```json
{
  "message": "Order tracking info",
  "data": {
    "status": "OUT_FOR_DELIVERY",
    "statusMessage": "On the way",
    "timeline": [
      {
        "status": "PLACED",
        "timestamp": "2025-01-10T10:30:00.000Z",
        "updatedBy": "6792user1234567890abcdef",
        "notes": "Order placed by customer"
      },
      {
        "status": "ACCEPTED",
        "timestamp": "2025-01-10T10:32:00.000Z",
        "updatedBy": "6792kitch234567890abcdef",
        "notes": null
      },
      {
        "status": "PREPARING",
        "timestamp": "2025-01-10T11:00:00.000Z",
        "updatedBy": "6792kitch234567890abcdef",
        "notes": null
      },
      {
        "status": "READY",
        "timestamp": "2025-01-10T11:45:00.000Z",
        "updatedBy": "6792kitch234567890abcdef",
        "notes": null
      },
      {
        "status": "PICKED_UP",
        "timestamp": "2025-01-10T11:50:00.000Z",
        "updatedBy": "6792drvr1234567890abcdef",
        "notes": null
      },
      {
        "status": "OUT_FOR_DELIVERY",
        "timestamp": "2025-01-10T12:00:00.000Z",
        "updatedBy": "6792drvr1234567890abcdef",
        "notes": null
      }
    ],
    "customer": {
      "name": "Rahul Verma",
      "phone": "+919876543210"
    },
    "driver": {
      "name": "Ajay Kumar",
      "phone": "+919123456789"
    },
    "estimatedDelivery": "2025-01-10T12:30:00.000Z",
    "canContactDriver": true,
    "canContactKitchen": true
  }
}
```

**Error Response (404):**

```json
{
  "message": "Order not found",
  "error": {
    "code": "ORDER_NOT_FOUND"
  }
}
```

---

### 4. Cancel Order (Customer)

**PATCH** `/api/orders/:id/customer-cancel`

Cancel an order placed by the authenticated customer.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzkyYWJjZDEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MDQ4NzM2MDB9.abc123
Content-Type: application/json
```

**Path:**

```
/api/orders/6792abcd1234567890abcdef/customer-cancel
```

**Request Body:**

```json
{
  "reason": "Changed my mind, will order later"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| reason | string | Yes | Cancellation reason (min 5 chars) |

**Response (200):**

```json
{
  "message": "Order cancelled successfully",
  "data": {
    "order": {
      "_id": "6792abcd1234567890abcdef",
      "orderNumber": "ORD-20250110-A1B2C",
      "status": "CANCELLED",
      "cancelledAt": "2025-01-10T10:35:00.000Z",
      "cancelledBy": "CUSTOMER",
      "cancellationReason": "Changed my mind, will order later"
    },
    "refundInitiated": true,
    "vouchersRestored": 2,
    "voucherWarning": null,
    "message": "Order cancelled. Refund of Rs 168 will be processed in 5-7 business days. 2 vouchers have been restored to your account."
  }
}
```

**Error Response (400) - Cancellation Window Passed:**

```json
{
  "message": "Cancellation not allowed",
  "error": {
    "code": "CANCELLATION_WINDOW_PASSED",
    "orderAgeMinutes": 15,
    "windowMinutes": 10
  }
}
```

**Error Response (400) - Non-Cancellable Status:**

```json
{
  "message": "Order cannot be cancelled after pickup",
  "error": {
    "code": "CANNOT_CANCEL",
    "currentStatus": "PICKED_UP"
  }
}
```

---

### 5. Rate Order

**POST** `/api/orders/:id/rate`

Rate a delivered order.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzkyYWJjZDEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MDQ4NzM2MDB9.abc123
Content-Type: application/json
```

**Path:**

```
/api/orders/6792abcd1234567890abcdef/rate
```

**Request Body:**

```json
{
  "stars": 4,
  "comment": "Food was delicious, delivery was on time"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| stars | number | Yes | Rating 1-5 stars |
| comment | string | No | Optional review text (max 500 chars) |

**Response (200):**

```json
{
  "message": "Order rated successfully",
  "data": {
    "order": {
      "_id": "6792abcd1234567890abcdef",
      "orderNumber": "ORD-20250110-A1B2C",
      "rating": {
        "stars": 4,
        "comment": "Food was delicious, delivery was on time",
        "ratedAt": "2025-01-10T13:00:00.000Z"
      }
    }
  }
}
```

**Error Response (400) - Not Delivered:**

```json
{
  "message": "Can only rate delivered orders",
  "error": {
    "code": "ORDER_NOT_DELIVERED",
    "currentStatus": "OUT_FOR_DELIVERY"
  }
}
```

**Error Response (400) - Already Rated:**

```json
{
  "message": "Order already rated",
  "error": {
    "code": "ALREADY_RATED"
  }
}
```

---

## Order Status Values

- PLACED: Order placed, waiting for kitchen acceptance
- ACCEPTED: Kitchen accepted the order
- REJECTED: Kitchen rejected the order
- PREPARING: Kitchen is preparing the food
- READY: Food is ready for pickup
- PICKED_UP: Driver picked up the order
- OUT_FOR_DELIVERY: Driver is on the way
- DELIVERED: Order delivered successfully
- CANCELLED: Order cancelled
- FAILED: Delivery failed

---

## Active Order Statuses

Orders with these statuses are considered active and returned in the `activeOrders` array:

- PLACED
- ACCEPTED
- PREPARING
- READY
- PICKED_UP
- OUT_FOR_DELIVERY

---

## Cancellation Rules

Non-voucher orders:
- Can be cancelled within 10 minutes of placing (configurable via SystemConfig)
- Cannot be cancelled after status becomes PREPARING

Voucher orders:
- Can be cancelled anytime before pickup (statuses: PLACED, ACCEPTED, PREPARING, READY)
- Vouchers only restored if cancelled **before** meal window cutoff
- If cancelled **after** cutoff: order is cancelled but vouchers are NOT restored (warning returned)

Non-cancellable statuses:
- REJECTED
- PICKED_UP
- OUT_FOR_DELIVERY
- DELIVERED
- CANCELLED
- FAILED

---

## Computed Fields in Response

- statusDisplay: Human-readable status text (e.g., "Order Placed", "Being Prepared", "On the way", "Delivered")
- canCancel: Whether order can be cancelled by customer
- canRate: Whether order can be rated (only DELIVERED orders that haven't been rated)

---

## Status Display Mapping

| Status | Display Text |
|--------|--------------|
| PLACED | Order Placed |
| ACCEPTED | Accepted |
| REJECTED | Rejected |
| PREPARING | Being Prepared |
| READY | Ready for Pickup |
| PICKED_UP | Picked Up |
| OUT_FOR_DELIVERY | On the way |
| DELIVERED | Delivered |
| CANCELLED | Cancelled |
| FAILED | Failed |

---

## Developer Notes

### Configurable Settings

The following values are configurable via admin API and stored in SystemConfig:

| Setting | Default | Description |
|---------|---------|-------------|
| Cancellation Window | 10 minutes | Time window after placing order during which cancellation is allowed |
| LUNCH Cutoff | 11:00 AM IST | Voucher usage cutoff for lunch orders |
| DINNER Cutoff | 9:00 PM IST | Voucher usage cutoff for dinner orders |

### Contact Availability

- `canContactDriver`: Only `true` when order status is `OUT_FOR_DELIVERY`
- `canContactKitchen`: Only `true` when order status is `PLACED`, `ACCEPTED`, or `PREPARING`
