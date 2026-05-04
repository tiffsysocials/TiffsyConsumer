# Backend Requirements: Dual Meal Window + Two-Phase Cutoff

## Overview

The frontend has been updated to support two features:
1. **Buy Both Lunch & Dinner** — Customer selects both slots, frontend creates **two separate orders** (one per meal window) and processes payments sequentially.
2. **Two-Phase Cutoff** — Instead of a single binary cutoff, there are now two cutoff times: `voucherCutoffTime` (voucher redemption closes) and `orderCutoffTime` (ordering closes entirely).

---

## 1. Two-Phase Cutoff — Menu Item Response

### What the frontend expects

In `GET /api/kitchens/:kitchenId/menu?menuType=MEAL_MENU`, each menu item (`lunch` / `dinner`) should return:

```json
{
  "_id": "...",
  "name": "Lunch Thali",
  "price": 120,
  "discountedPrice": 99,
  ...existing fields...

  "canOrder": true,
  "canUseVoucher": false,
  "voucherCutoffTime": "08:00",
  "orderCutoffTime": "12:00"
}
```

### Field definitions

| Field | Type | Description |
|-------|------|-------------|
| `canOrder` | `boolean` | `false` when current time is past `orderCutoffTime`. If `false`, the slot is completely disabled — user cannot place any order for this slot. |
| `canUseVoucher` | `boolean` | `false` when current time is past `voucherCutoffTime` but before `orderCutoffTime`. If `false`, the user can still order but must pay cash (no voucher redemption). |
| `voucherCutoffTime` | `string` (HH:mm) | Time after which voucher redemption is no longer allowed for this meal window. Example: `"08:00"` |
| `orderCutoffTime` | `string` (HH:mm) | Time after which ordering is completely closed for this meal window. Example: `"12:00"` |

### Three states the frontend renders

| State | Condition | User experience |
|-------|-----------|-----------------|
| **Available** | `canOrder=true` AND `canUseVoucher=true` | Full access — can order + use vouchers |
| **Cash Only** | `canOrder=true` AND `canUseVoucher=false` | Can order but must pay cash — voucher button disabled, shows "Cash Only" badge |
| **Closed** | `canOrder=false` | Slot is grayed out and disabled, shows "Ordering Closed" |

### Backward compatibility

The frontend falls back gracefully:
- If `voucherCutoffTime` and `orderCutoffTime` are not present, it falls back to the old `isPastCutoff` / `cutoffTime` single-cutoff model.
- If only the old fields are present: `canOrder = !isPastCutoff`, `canUseVoucher = !isPastCutoff`.

**Priority:** No breaking changes needed. Just add the new fields alongside old ones. Frontend uses new fields when present, falls back to old ones otherwise.

---

## 2. Two-Phase Cutoff — Calculate Pricing / Voucher Eligibility

### What the frontend expects

In `POST /api/orders/calculate-pricing`, the `voucherEligibility` object in the response should include:

```json
{
  "voucherEligibility": {
    "available": 5,
    "canUse": 1,
    "cutoffPassed": false,
    "orderCutoffPassed": false,
    "canOrder": true,
    "cutoffInfo": {
      "cutoffTime": "08:00",
      "voucherCutoffTime": "08:00",
      "orderCutoffTime": "12:00",
      "currentTime": "07:30",
      "message": "Voucher cutoff is at 8:00 AM"
    }
  }
}
```

### New fields in `voucherEligibility`

| Field | Type | Description |
|-------|------|-------------|
| `orderCutoffPassed` | `boolean` | `true` if current time is past `orderCutoffTime` |
| `canOrder` | `boolean` | `false` if ordering is closed (same as `orderCutoffPassed` but explicit) |
| `cutoffInfo.voucherCutoffTime` | `string` (HH:mm) | The voucher cutoff time |
| `cutoffInfo.orderCutoffTime` | `string` (HH:mm) | The order cutoff time |

The existing `cutoffPassed` field should now mean **voucher** cutoff has passed (i.e., `voucherCutoffTime` exceeded). This is backward compatible — old behavior was `cutoffPassed = true` means no vouchers AND no orders, new behavior splits that into two separate flags.

---

## 3. Dual Order Placement — No New Endpoints Needed

The frontend creates **two separate orders** by calling the existing `POST /api/orders/create` endpoint twice — once for LUNCH and once for DINNER.

Each call sends the standard `CreateOrderRequest`:

```json
{
  "kitchenId": "...",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "deliveryAddressId": "...",
  "items": [{ "menuItemId": "...", "quantity": 1, "addons": [...] }],
  "voucherCount": 1,
  "couponCode": "SAVE20",
  "paymentMethod": "UPI"
}
```

Then the second call:

```json
{
  "kitchenId": "...",
  "menuType": "MEAL_MENU",
  "mealWindow": "DINNER",
  "deliveryAddressId": "...",
  "items": [{ "menuItemId": "...", "quantity": 1, "addons": [...] }],
  "voucherCount": 0,
  "couponCode": "SAVE20",
  "paymentMethod": "UPI"
}
```

### Backend behavior to verify

1. **Coupon on both orders:** The same `couponCode` is sent in both requests. The backend should decide per-order whether the coupon applies (e.g., per-user limit might allow only 1 use — backend decides which order gets the discount).

2. **Vouchers are per-slot:** Each order has its own `voucherCount`. The frontend allocates vouchers independently per slot. Backend should deduct from the user's voucher pool accordingly. Example: User has 2 vouchers, assigns 1 to LUNCH and 1 to DINNER.

3. **Sequential order creation:** The two orders are created sequentially (LUNCH first, then DINNER). If LUNCH order creation fails, DINNER order is NOT attempted. If LUNCH succeeds but DINNER fails, the user is informed that the LUNCH order was placed and they should check "Your Orders."

4. **Payment per order:** After both orders are created, payments are processed sequentially via the existing Razorpay flow. Each order gets its own payment. If payment fails for one order, the other order's payment is NOT attempted — the user is directed to "Your Orders" to retry.

---

## 4. Future: Bulk Payment Endpoint (Not Blocking)

Currently the frontend processes payments one at a time. When the bulk-pay endpoint is ready, the frontend can be updated to send both order IDs in a single payment request.

### Suggested endpoint

```
POST /api/payments/bulk-create
{
  "orderIds": ["order1_id", "order2_id"]
}

Response:
{
  "success": true,
  "data": {
    "razorpayOrderId": "...",
    "totalAmount": 250,
    "orders": [
      { "orderId": "order1_id", "amount": 150 },
      { "orderId": "order2_id", "amount": 100 }
    ]
  }
}
```

**This is NOT blocking for testing.** The current sequential payment flow works. Bulk-pay is a UX improvement for later.

---

## 5. Calculate Pricing — Called Per Slot

The frontend calls `POST /api/orders/calculate-pricing` **once per selected slot** (so up to 2 calls in parallel when both LUNCH and DINNER are selected).

Each call is a standard `CalculatePricingRequest` with the slot's specific `mealWindow`, `items`, `voucherCount`, and shared `couponCode`.

### Backend behavior to verify

- When `couponCode` is provided in both calls, calculate the discount independently per order. The frontend displays both discounts added together.
- `voucherCount` per call is independent — the user might use 1 voucher for lunch and 0 for dinner.
- If a coupon has a per-user limit of 1, only one of the two pricing calls should show the discount. (Exact behavior is up to backend — frontend just displays what it gets back.)

---

## 6. Summary of Changes Needed

### Must Have (for testing)

| # | Endpoint | Change | Priority |
|---|----------|--------|----------|
| 1 | `GET /api/kitchens/:id/menu` | Add `canOrder`, `canUseVoucher`, `voucherCutoffTime`, `orderCutoffTime` to each menu item | **HIGH** |
| 2 | `POST /api/orders/calculate-pricing` | Add `orderCutoffPassed`, `canOrder`, `cutoffInfo.voucherCutoffTime`, `cutoffInfo.orderCutoffTime` to `voucherEligibility` | **HIGH** |
| 3 | `POST /api/orders/create` | Verify: same `couponCode` works on two separate orders for same user in same session (one LUNCH, one DINNER) | **MEDIUM** |
| 4 | `POST /api/orders/create` | Verify: per-slot `voucherCount` deducted correctly when two orders placed back-to-back | **MEDIUM** |

### Nice to Have (later)

| # | Endpoint | Change |
|---|----------|--------|
| 5 | `POST /api/payments/bulk-create` | New endpoint for combined Razorpay payment of multiple orders |
| 6 | `POST /api/orders/create` | Return `cancelDeadline` in response (already exists?) — needed for cancel countdown in success modal |

---

## 7. Testing Checklist

Once backend changes are deployed:

- [ ] Menu response includes `canOrder`, `canUseVoucher`, `voucherCutoffTime`, `orderCutoffTime` for both lunch and dinner
- [ ] Before `voucherCutoffTime`: both `canOrder=true` and `canUseVoucher=true`
- [ ] Between `voucherCutoffTime` and `orderCutoffTime`: `canOrder=true`, `canUseVoucher=false`
- [ ] After `orderCutoffTime`: `canOrder=false`
- [ ] Calculate pricing returns updated `voucherEligibility` with new fields
- [ ] Can create LUNCH order, then immediately create DINNER order (same user, same session)
- [ ] Voucher deduction works across two sequential orders (e.g., 1 voucher on lunch + 1 voucher on dinner = 2 vouchers deducted total)
- [ ] Same coupon code on both orders — backend applies discount correctly (per its own rules)
- [ ] Payment works independently per order via existing Razorpay flow
