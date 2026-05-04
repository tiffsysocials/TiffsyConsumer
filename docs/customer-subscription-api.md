# Customer Subscription & Vouchers API

---

## Authentication

All endpoints require Firebase ID Token:

```
Authorization: Bearer <firebase_id_token>
```

---

## Subscription Flow

```
1. Browse active plans → GET /api/subscriptions/plans/active
2. Select plan & pay (mock) → POST /api/subscriptions/purchase
3. Vouchers issued instantly → User gets vouchers
4. Use vouchers for orders → Redeem during checkout
5. View voucher balance → GET /api/vouchers/my-vouchers
```

---

## Endpoints

### 1. Browse Active Plans

**GET** `/api/subscriptions/plans/active`

Get all available subscription plans.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| zoneId | string | No | Filter by delivery zone |

**Request:**

```
GET /api/subscriptions/plans/active
```

**Response (200):**

```json
{
  "success": true,
  "message": "Active subscription plans",
  "data": {
    "plans": [
      {
        "_id": "6789plan123abc456789ab01",
        "name": "Weekly Starter",
        "description": "Perfect for trying out Tiffsy",
        "durationDays": 7,
        "vouchersPerDay": 1,
        "totalVouchers": 7,
        "price": 499,
        "originalPrice": 700,
        "badge": "BEST_VALUE",
        "features": [
          "7 meal vouchers",
          "Use any kitchen",
          "No delivery charges"
        ],
        "displayOrder": 1,
        "applicableZoneIds": []
      },
      {
        "_id": "6789plan123abc456789ab02",
        "name": "Monthly Pro",
        "description": "Most popular for regular users",
        "durationDays": 30,
        "vouchersPerDay": 2,
        "totalVouchers": 60,
        "price": 2999,
        "originalPrice": 4200,
        "badge": "POPULAR",
        "features": [
          "60 meal vouchers",
          "2 meals per day",
          "Premium kitchen access",
          "Priority support"
        ],
        "displayOrder": 2,
        "applicableZoneIds": []
      },
      {
        "_id": "6789plan123abc456789ab03",
        "name": "Family Pack",
        "description": "Great for families",
        "durationDays": 30,
        "vouchersPerDay": 4,
        "totalVouchers": 120,
        "price": 5499,
        "originalPrice": 8400,
        "badge": "FAMILY",
        "features": [
          "120 meal vouchers",
          "4 meals per day",
          "Share with family",
          "All kitchen access"
        ],
        "displayOrder": 3,
        "applicableZoneIds": []
      }
    ]
  }
}
```

---

### 2. Purchase Subscription

**POST** `/api/subscriptions/purchase`

Buy a subscription plan and get vouchers.

**Headers:**

```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**

```json
{
  "planId": "6789plan123abc456789ab02",
  "paymentId": "demo_pay_12345",
  "paymentMethod": "UPI"
}
```

| Field         | Type   | Required | Description                                          |
| ------------- | ------ | -------- | ---------------------------------------------------- |
| planId        | string | Yes      | Plan ObjectId (24 chars)                             |
| paymentId     | string | No       | Payment gateway transaction ID (any string for demo) |
| paymentMethod | string | No       | `UPI`, `CARD`, `NETBANKING`, `WALLET`, `OTHER`       |

**Response (201):**

```json
{
  "success": true,
  "message": "Subscription purchased successfully",
  "data": {
    "subscription": {
      "_id": "6789sub123abc456789ab01",
      "userId": "6789user123abc456789ab01",
      "planId": "6789plan123abc456789ab02",
      "planSnapshot": {
        "name": "Monthly Pro",
        "durationDays": 30,
        "vouchersPerDay": 2,
        "totalVouchers": 60,
        "price": 2999
      },
      "purchaseDate": "2025-01-10T10:00:00.000Z",
      "startDate": "2025-01-10T10:00:00.000Z",
      "endDate": "2025-02-09T10:00:00.000Z",
      "totalVouchersIssued": 60,
      "vouchersUsed": 0,
      "voucherExpiryDate": "2025-02-28T23:59:59.000Z",
      "status": "ACTIVE",
      "amountPaid": 2999,
      "paymentId": "demo_pay_12345",
      "paymentMethod": "UPI"
    },
    "vouchersIssued": 60,
    "voucherExpiryDate": "2025-02-28T23:59:59.000Z"
  }
}
```

**Response (400) - Already Has Active Plan:**

```json
{
  "success": false,
  "message": "You already have an active subscription for this plan"
}
```

**Response (404) - Plan Not Available:**

```json
{
  "success": false,
  "message": "Plan not found or not available"
}
```

---

### 3. Get My Subscriptions

**GET** `/api/subscriptions/my-subscriptions`

Get all subscriptions for authenticated user.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | `ACTIVE`, `EXPIRED`, `CANCELLED` |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 50) |

**Request:**

```
GET /api/subscriptions/my-subscriptions?status=ACTIVE
```

**Response (200):**

```json
{
  "success": true,
  "message": "My subscriptions",
  "data": {
    "subscriptions": [
      {
        "_id": "6789sub123abc456789ab01",
        "planId": {
          "_id": "6789plan123abc456789ab02",
          "name": "Monthly Pro",
          "durationDays": 30,
          "badge": "POPULAR"
        },
        "totalVouchersIssued": 60,
        "vouchersRemaining": 45,
        "vouchersUsed": 15,
        "daysRemaining": 20,
        "status": "ACTIVE",
        "startDate": "2025-01-10T10:00:00.000Z",
        "endDate": "2025-02-09T10:00:00.000Z",
        "purchaseDate": "2025-01-10T10:00:00.000Z"
      }
    ],
    "activeSubscription": {
      "_id": "6789sub123abc456789ab01",
      "planName": "Monthly Pro",
      "vouchersRemaining": 45,
      "daysRemaining": 20,
      "expiryDate": "2025-02-28T23:59:59.000Z"
    },
    "totalVouchersAvailable": 45,
    "pagination": {
      "total": 3,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

---

### 4. Cancel Subscription

**POST** `/api/subscriptions/:id/cancel`

Cancel an active subscription.

**Request Body:**

```json
{
  "reason": "Not using enough"
}
```

**Response (200) - Eligible for Refund:**

```json
{
  "success": true,
  "message": "Subscription cancelled",
  "data": {
    "subscription": {
      "_id": "6789sub123abc456789ab01",
      "status": "CANCELLED",
      "cancelledAt": "2025-01-15T10:00:00.000Z",
      "cancellationReason": "Not using enough"
    },
    "vouchersCancelled": 45,
    "refundEligible": true,
    "refundAmount": 1800,
    "refundReason": "15/60 vouchers used (25%)"
  }
}
```

**Response (200) - Not Eligible for Refund:**

```json
{
  "success": true,
  "message": "Subscription cancelled",
  "data": {
    "subscription": {...},
    "vouchersCancelled": 30,
    "refundEligible": false,
    "refundAmount": null,
    "refundReason": "Too many vouchers used: 30/60 (50%)"
  }
}
```

**Refund Eligibility Rules:**

- Eligible if ≤25% vouchers used
- Refund = 100% - (usage% × 2)
- Example: 10% used → 80% refund

---

### 5. Get My Vouchers

**GET** `/api/vouchers/my-vouchers`

Get all vouchers for authenticated user.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | `AVAILABLE`, `REDEEMED`, `EXPIRED`, `RESTORED` |
| page | number | Page number |
| limit | number | Items per page |

**Request:**

```
GET /api/vouchers/my-vouchers?status=AVAILABLE
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "vouchers": [
      {
        "_id": "6789vch123abc456789ab01",
        "voucherCode": "VCH-A2B3C-D4E5F",
        "userId": "6789user123abc456789ab01",
        "subscriptionId": "6789sub123abc456789ab01",
        "mealType": "ANY",
        "issuedDate": "2025-01-10T10:00:00.000Z",
        "expiryDate": "2025-02-28T23:59:59.000Z",
        "status": "AVAILABLE"
      },
      {
        "_id": "6789vch123abc456789ab02",
        "voucherCode": "VCH-F6G7H-J8K9L",
        "mealType": "ANY",
        "issuedDate": "2025-01-10T10:00:00.000Z",
        "expiryDate": "2025-02-28T23:59:59.000Z",
        "status": "AVAILABLE"
      }
    ],
    "summary": {
      "available": 45,
      "redeemed": 15,
      "expired": 0,
      "restored": 0,
      "total": 60
    },
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "pages": 3
    }
  }
}
```

---

### 6. Check Voucher Eligibility

**POST** `/api/vouchers/check-eligibility`

Check if vouchers can be used for an order.

**Request Body:**

```json
{
  "kitchenId": "6789kit123abc456789ab01",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "mainCourseQuantity": 2
}
```

**Response (200) - Can Use:**

```json
{
  "success": true,
  "data": {
    "canUseVoucher": true,
    "availableVouchers": 45,
    "maxRedeemable": 10,
    "cutoffInfo": {
      "isPastCutoff": false,
      "cutoffTime": "11:00",
      "message": "LUNCH orders open until 11:00"
    }
  }
}
```

**Response (200) - Cutoff Passed:**

```json
{
  "success": true,
  "data": {
    "canUseVoucher": false,
    "availableVouchers": 45,
    "maxRedeemable": 0,
    "cutoffInfo": {
      "isPastCutoff": true,
      "cutoffTime": "11:00",
      "message": "LUNCH ordering closed. Cutoff was 11:00."
    },
    "reason": "Cutoff time has passed"
  }
}
```

**Response (200) - Wrong Menu Type:**

```json
{
  "success": true,
  "data": {
    "canUseVoucher": false,
    "availableVouchers": 45,
    "maxRedeemable": 0,
    "reason": "Vouchers can only be used for MEAL_MENU orders"
  }
}
```

---

## Data Models

### Subscription

```typescript
interface Subscription {
  _id: string;
  userId: string;
  planId: string;
  planSnapshot: {
    name: string;
    durationDays: number;
    vouchersPerDay: number;
    totalVouchers: number;
    price: number;
  };
  purchaseDate: Date;
  startDate: Date;
  endDate: Date;
  totalVouchersIssued: number;
  vouchersUsed: number;
  voucherExpiryDate: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAUSED';
  amountPaid: number;
  paymentId?: string;
  paymentMethod?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  refundAmount?: number;
}
```

### Voucher

```typescript
interface Voucher {
  _id: string;
  voucherCode: string; // VCH-XXXXX-XXXXX
  userId: string;
  subscriptionId: string;
  mealType: 'LUNCH' | 'DINNER' | 'ANY';
  issuedDate: Date;
  expiryDate: Date;
  status: 'AVAILABLE' | 'REDEEMED' | 'EXPIRED' | 'RESTORED' | 'CANCELLED';
  redeemedAt?: Date;
  redeemedOrderId?: string;
  redeemedKitchenId?: string;
  redeemedMealWindow?: string;
  restoredAt?: Date;
  restorationReason?: string;
}
```

---

## Payment Handling (Mock)

For demo, pass any string as `paymentId`:

```json
{
  "planId": "6789plan123abc456789ab02",
  "paymentId": "demo_pay_12345",
  "paymentMethod": "UPI"
}
```

The backend does NOT validate the payment - it just stores the ID and creates the subscription with vouchers immediately.

---

## UI Implementation Notes

1. **Plans Screen**:

   - List of plans with badges (BEST_VALUE, POPULAR, FAMILY)
   - Show savings (originalPrice vs price)
   - Features list for each plan
   - "Subscribe" button

2. **Subscription Details**:

   - Progress bar (vouchers used/total)
   - Days remaining countdown
   - Voucher expiry date warning
   - Cancel subscription button

3. **Vouchers Screen**:

   - Available voucher count prominently
   - List of vouchers with status badges
   - Expiry date for each
   - Filter by status

4. **Checkout Integration**:

   - Show "Use Vouchers" toggle if available
   - Voucher count selector (1-10)
   - Show cutoff time warning
   - Display voucher coverage in pricing

5. **Status Badges**:
   - AVAILABLE: Green
   - REDEEMED: Blue
   - EXPIRED: Gray (strikethrough)
   - RESTORED: Orange (recycled from cancelled order)
