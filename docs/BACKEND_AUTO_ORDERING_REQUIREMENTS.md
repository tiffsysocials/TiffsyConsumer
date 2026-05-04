# Backend Auto Ordering Requirements - Tiffsy App

## Executive Summary

This document outlines the **missing backend functionality** required to implement the auto ordering system for the Tiffsy app. The frontend has voucher management in place, but the core auto-ordering, pause/resume, and skip meal features are **NOT implemented** in either frontend or backend.

---

## Current State Analysis

### ✅ What Already Works (Frontend & Backend)

1. **Subscription Purchase System**
   - Users can buy meal plans that include vouchers
   - API: `POST /api/subscriptions/purchase`
   - Frontend: Full UI in `MealPlansScreen.tsx`

2. **Voucher Management**
   - View vouchers with statuses: AVAILABLE, REDEEMED, EXPIRED, RESTORED, CANCELLED
   - API: `GET /api/subscriptions/my-vouchers`
   - Frontend: Full UI in `VouchersScreen.tsx`

3. **Subscription Cancellation**
   - Cancel active subscriptions
   - API: `POST /api/subscriptions/{subscriptionId}/cancel`
   - Frontend: Cancel modal with reason selection

4. **Manual Order Placement**
   - Users can manually add meals to cart and checkout
   - API: `POST /api/orders`
   - Frontend: Cart and checkout flow

### ❌ What's Missing (Backend Required)

The following features are **completely missing** and need backend implementation:

---

## 1. AUTO ORDERING SYSTEM

### Problem
Currently, users with active subscriptions must **manually** place orders for every meal. Even though they have vouchers, they need to:
1. Add meals to cart
2. Go through checkout
3. Apply vouchers manually

This defeats the purpose of a "subscription" service.

### Required Solution

**Backend Cron Job/Scheduler:**
- Run daily (e.g., at midnight or 2 AM)
- Query all active subscriptions where `autoOrderingEnabled = true`
- For each subscription:
  - Check if user has available vouchers
  - Check if subscription is not paused (`isPaused = false`)
  - Check if the specific meal window is not skipped
  - Automatically create orders for the next meal window(s)
  - Mark vouchers as REDEEMED
  - Send notification to user

**Database Changes Required:**

```sql
-- Add to subscriptions table
ALTER TABLE subscriptions ADD COLUMN auto_ordering_enabled BOOLEAN DEFAULT true;
ALTER TABLE subscriptions ADD COLUMN default_meal_type VARCHAR(10) DEFAULT 'BOTH'; -- 'LUNCH', 'DINNER', 'BOTH'
ALTER TABLE subscriptions ADD COLUMN default_kitchen_id UUID; -- Optional: user's preferred kitchen
ALTER TABLE subscriptions ADD COLUMN default_meal_id UUID; -- Optional: user's default meal choice
```

**Backend Logic:**

```typescript
// Pseudocode for auto-order cron job
async function processAutoOrders() {
  const subscriptions = await db.subscriptions.findMany({
    where: {
      status: 'ACTIVE',
      autoOrderingEnabled: true,
      isPaused: false,
      endDate: { gte: new Date() }
    },
    include: { user: true, vouchers: true }
  });

  for (const subscription of subscriptions) {
    const availableVouchers = subscription.vouchers.filter(
      v => v.status === 'AVAILABLE' && v.expiryDate >= new Date()
    );

    if (availableVouchers.length === 0) continue;

    // Determine which meals to order based on defaultMealType
    const mealWindows = getMealWindowsToOrder(subscription.defaultMealType);

    for (const window of mealWindows) {
      // Check if this meal window is skipped
      const isSkipped = await checkIfMealSkipped(subscription.id, window, new Date());
      if (isSkipped) continue;

      // Check if order already exists for this window
      const existingOrder = await checkExistingOrder(subscription.userId, window, new Date());
      if (existingOrder) continue;

      // Create auto order
      await createAutoOrder({
        userId: subscription.userId,
        mealWindow: window,
        kitchenId: subscription.defaultKitchenId || getDefaultKitchen(),
        mealId: subscription.defaultMealId || getDefaultMeal(),
        voucherId: availableVouchers[0].id,
        subscriptionId: subscription.id,
        isAutoOrdered: true
      });

      // Mark voucher as REDEEMED
      await redeemVoucher(availableVouchers[0].id);

      // Send notification
      await sendPushNotification(subscription.userId, {
        title: 'Auto Order Placed',
        body: `Your ${window.toLowerCase()} for ${formatDate(new Date())} has been automatically ordered!`
      });
    }
  }
}
```

**New API Endpoints Required:**

```typescript
// GET /api/subscriptions/:subscriptionId/settings
// Returns: { autoOrderingEnabled, defaultMealType, defaultKitchenId, defaultMealId }

// PATCH /api/subscriptions/:subscriptionId/settings
// Body: { autoOrderingEnabled?, defaultMealType?, defaultKitchenId?, defaultMealId? }
// Updates auto-order preferences
```

---

## 2. PAUSE/RESUME AUTO ORDER

### Problem
Users cannot pause their subscriptions temporarily (e.g., going on vacation, business trip). The `PAUSED` status is defined in the type system but **never used**.

### Required Solution

**Database Changes:**

```sql
-- Add to subscriptions table
ALTER TABLE subscriptions ADD COLUMN is_paused BOOLEAN DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN paused_at TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN paused_until TIMESTAMP; -- Optional: auto-resume date
ALTER TABLE subscriptions ADD COLUMN pause_reason VARCHAR(255); -- Optional: tracking
```

**New API Endpoints:**

```typescript
// POST /api/subscriptions/:subscriptionId/pause
// Body: {
//   pausedUntil?: Date, // Optional: if provided, auto-resume on this date
//   reason?: string
// }
// Response: {
//   success: boolean,
//   subscription: Subscription,
//   message: 'Subscription paused successfully'
// }

async function pauseSubscription(subscriptionId: string, data: PauseData) {
  const subscription = await db.subscriptions.update({
    where: { id: subscriptionId },
    data: {
      isPaused: true,
      pausedAt: new Date(),
      pausedUntil: data.pausedUntil || null,
      pauseReason: data.reason || null,
      status: 'PAUSED' // Update status to PAUSED
    }
  });

  // Cancel any upcoming auto-orders that haven't been fulfilled
  await cancelUpcomingAutoOrders(subscriptionId);

  // Send notification
  await sendNotification(subscription.userId, {
    title: 'Subscription Paused',
    body: data.pausedUntil
      ? `Your subscription is paused until ${formatDate(data.pausedUntil)}`
      : 'Your subscription has been paused'
  });

  return subscription;
}

// POST /api/subscriptions/:subscriptionId/resume
// Response: {
//   success: boolean,
//   subscription: Subscription,
//   message: 'Subscription resumed successfully'
// }

async function resumeSubscription(subscriptionId: string) {
  const subscription = await db.subscriptions.update({
    where: { id: subscriptionId },
    data: {
      isPaused: false,
      pausedAt: null,
      pausedUntil: null,
      pauseReason: null,
      status: 'ACTIVE' // Change status back to ACTIVE
    }
  });

  // Send notification
  await sendNotification(subscription.userId, {
    title: 'Subscription Resumed',
    body: 'Your auto-orders will resume from the next meal window'
  });

  return subscription;
}
```

**Auto-Resume Cron Job:**

```typescript
// Run daily to check for subscriptions that should auto-resume
async function autoResumeSubscriptions() {
  const subscriptionsToResume = await db.subscriptions.findMany({
    where: {
      isPaused: true,
      pausedUntil: { lte: new Date() }
    }
  });

  for (const subscription of subscriptionsToResume) {
    await resumeSubscription(subscription.id);
  }
}
```

**Validation Rules:**
- Cannot pause if subscription is already paused
- Cannot pause if subscription is cancelled or expired
- Cannot resume if subscription is not paused
- If `pausedUntil` is in the past, reject with error

---

## 3. SKIP MEAL FUNCTIONALITY

### Problem
Users cannot skip specific meals (lunch or dinner) for specific dates. This is a common requirement when users:
- Are traveling
- Have other meal arrangements for a day
- Don't need a particular meal

### Required Solution

**Database Changes:**

```sql
-- Create new table for skipped meals
CREATE TABLE skipped_meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_window VARCHAR(10) NOT NULL, -- 'LUNCH' or 'DINNER'
  skip_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  reason VARCHAR(255), -- Optional

  UNIQUE(subscription_id, meal_window, skip_date) -- Prevent duplicate skips
);

CREATE INDEX idx_skipped_meals_subscription ON skipped_meals(subscription_id);
CREATE INDEX idx_skipped_meals_date ON skipped_meals(skip_date);
```

**New API Endpoints:**

```typescript
// POST /api/subscriptions/:subscriptionId/skip-meal
// Body: {
//   mealWindow: 'LUNCH' | 'DINNER',
//   date: Date, // YYYY-MM-DD format
//   reason?: string
// }
// Response: {
//   success: boolean,
//   skippedMeal: SkippedMeal,
//   message: 'Meal skipped successfully'
// }

async function skipMeal(subscriptionId: string, data: SkipMealData) {
  const subscription = await db.subscriptions.findUnique({
    where: { id: subscriptionId }
  });

  if (!subscription || subscription.status !== 'ACTIVE') {
    throw new Error('Cannot skip meal for inactive subscription');
  }

  const skipDate = new Date(data.date);
  if (skipDate < new Date()) {
    throw new Error('Cannot skip meals in the past');
  }

  // Check if meal is already skipped
  const existing = await db.skippedMeals.findUnique({
    where: {
      subscriptionId_mealWindow_skipDate: {
        subscriptionId,
        mealWindow: data.mealWindow,
        skipDate
      }
    }
  });

  if (existing) {
    throw new Error('This meal is already marked as skipped');
  }

  const skippedMeal = await db.skippedMeals.create({
    data: {
      subscriptionId,
      userId: subscription.userId,
      mealWindow: data.mealWindow,
      skipDate,
      reason: data.reason
    }
  });

  // If there's an existing auto-order for this meal, cancel it
  await cancelAutoOrderForMeal(subscription.userId, data.mealWindow, skipDate);

  // Don't deduct voucher since meal is skipped

  // Send notification
  await sendNotification(subscription.userId, {
    title: 'Meal Skipped',
    body: `Your ${data.mealWindow.toLowerCase()} for ${formatDate(skipDate)} has been skipped`
  });

  return skippedMeal;
}

// DELETE /api/subscriptions/:subscriptionId/skip-meal/:skipMealId
// Un-skip a meal (if user changes their mind)
async function unskipMeal(skipMealId: string) {
  const skippedMeal = await db.skippedMeals.delete({
    where: { id: skipMealId }
  });

  await sendNotification(skippedMeal.userId, {
    title: 'Meal Unskipped',
    body: `Your ${skippedMeal.mealWindow.toLowerCase()} for ${formatDate(skippedMeal.skipDate)} will be delivered`
  });

  return skippedMeal;
}

// GET /api/subscriptions/:subscriptionId/skipped-meals
// Query params: { startDate?, endDate? }
// Returns: { skippedMeals: SkippedMeal[] }
async function getSkippedMeals(subscriptionId: string, filters: DateFilters) {
  return db.skippedMeals.findMany({
    where: {
      subscriptionId,
      skipDate: {
        gte: filters.startDate || new Date(),
        lte: filters.endDate
      }
    },
    orderBy: { skipDate: 'asc' }
  });
}
```

**Integration with Auto-Order Cron:**

```typescript
// Update processAutoOrders() function
async function checkIfMealSkipped(
  subscriptionId: string,
  mealWindow: MealWindow,
  date: Date
): Promise<boolean> {
  const skipped = await db.skippedMeals.findFirst({
    where: {
      subscriptionId,
      mealWindow,
      skipDate: {
        gte: startOfDay(date),
        lte: endOfDay(date)
      }
    }
  });

  return !!skipped;
}
```

**Validation Rules:**
- Cannot skip meals in the past
- Cannot skip if subscription is paused or inactive
- Cannot skip the same meal window twice for the same date
- Must have an active subscription to skip meals
- Skip date must be within subscription period (startDate to endDate)

---

## 4. UPDATED TYPE DEFINITIONS

Update the API service types to include new fields and endpoints:

```typescript
// Add to Subscription type
export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus; // Use 'PAUSED' when paused
  autoOrderingEnabled: boolean; // NEW
  defaultMealType: 'LUNCH' | 'DINNER' | 'BOTH'; // NEW
  defaultKitchenId?: string; // NEW
  defaultMealId?: string; // NEW
  isPaused: boolean; // NEW
  pausedAt?: Date; // NEW
  pausedUntil?: Date; // NEW
  pauseReason?: string; // NEW
  vouchersRemaining: number;
  daysRemaining: number;
  voucherExpiryDate: Date;
  purchaseDate: Date;
  startDate: Date;
  endDate: Date;
  planSnapshot: SubscriptionPlanSnapshot;
}

// NEW type
export interface SkippedMeal {
  id: string;
  subscriptionId: string;
  userId: string;
  mealWindow: 'LUNCH' | 'DINNER';
  skipDate: Date;
  createdAt: Date;
  reason?: string;
}

// NEW type
export interface AutoOrderSettings {
  autoOrderingEnabled: boolean;
  defaultMealType: 'LUNCH' | 'DINNER' | 'BOTH';
  defaultKitchenId?: string;
  defaultMealId?: string;
}

// NEW request types
export interface PauseSubscriptionRequest {
  pausedUntil?: Date;
  reason?: string;
}

export interface SkipMealRequest {
  mealWindow: 'LUNCH' | 'DINNER';
  date: string; // YYYY-MM-DD
  reason?: string;
}

export interface UpdateAutoOrderSettingsRequest {
  autoOrderingEnabled?: boolean;
  defaultMealType?: 'LUNCH' | 'DINNER' | 'BOTH';
  defaultKitchenId?: string;
  defaultMealId?: string;
}
```

---

## 5. NOTIFICATION REQUIREMENTS

Implement push notifications for:

1. **Auto-Order Placed**
   - Title: "Auto Order Placed"
   - Body: "Your lunch/dinner for [date] has been automatically ordered!"
   - Action: Deep link to order details

2. **Subscription Paused**
   - Title: "Subscription Paused"
   - Body: "Your subscription is paused until [date]" or "Your subscription has been paused"
   - Action: Deep link to subscription settings

3. **Subscription Resumed**
   - Title: "Subscription Resumed"
   - Body: "Your auto-orders will resume from the next meal window"
   - Action: Deep link to upcoming orders

4. **Meal Skipped**
   - Title: "Meal Skipped"
   - Body: "Your lunch/dinner for [date] has been skipped"
   - Action: Deep link to skipped meals list

5. **Reminder Before Auto-Order** (Optional)
   - Title: "Upcoming Auto Order"
   - Body: "Your lunch/dinner will be auto-ordered in 2 hours. Skip now if needed."
   - Action: Quick action to skip meal

---

## 6. EDGE CASES TO HANDLE

### Voucher Expiry
- What happens when vouchers expire but subscription is still active?
- Should auto-ordering stop or should it alert the user?

**Recommendation:**
```typescript
if (availableVouchers.length === 0) {
  await sendNotification(subscription.userId, {
    title: 'No Vouchers Available',
    body: 'Please purchase more vouchers to continue auto-ordering'
  });
  // Optionally pause auto-ordering
  await pauseSubscription(subscription.id, { reason: 'No vouchers available' });
}
```

### Subscription Expiry
- Auto-ordering should stop when subscription expires
- Send notification to user before expiry

**Recommendation:**
```typescript
// 3 days before expiry
if (daysUntilExpiry === 3) {
  await sendNotification(subscription.userId, {
    title: 'Subscription Expiring Soon',
    body: 'Your subscription expires in 3 days. Renew now to continue auto-orders.'
  });
}
```

### Cancelled Orders
- If user cancels an auto-ordered meal, should the voucher be restored?

**Recommendation:**
```typescript
// When order is cancelled
if (order.isAutoOrdered && order.status === 'PENDING') {
  await restoreVoucher(order.voucherId); // Change status back to AVAILABLE
}
```

### Paused During Active Order
- If user pauses while an order is being prepared, should it be cancelled?

**Recommendation:**
- Don't cancel orders that are already being prepared (status: PREPARING, READY, OUT_FOR_DELIVERY)
- Only cancel PENDING orders

### Multiple Subscriptions
- Can user have multiple active subscriptions?
- How to handle auto-ordering priority?

**Recommendation:**
- Process subscriptions in order of purchase date (oldest first)
- Or let user set priority in settings

### Kitchen/Meal Unavailability
- What if default kitchen is closed or default meal is unavailable?

**Recommendation:**
```typescript
if (!isKitchenAvailable(subscription.defaultKitchenId, date)) {
  // Try to find alternative kitchen
  const alternativeKitchen = await findNearestKitchen(subscription.userId);

  if (!alternativeKitchen) {
    await sendNotification(subscription.userId, {
      title: 'Auto Order Failed',
      body: 'Your preferred kitchen is unavailable. Please update your preferences.'
    });
    continue; // Skip this auto-order
  }
}
```

---

## 7. DATABASE MIGRATION SCRIPT

```sql
-- Run these migrations in order

-- Step 1: Add auto-ordering fields to subscriptions table
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS auto_ordering_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_meal_type VARCHAR(10) DEFAULT 'BOTH',
  ADD COLUMN IF NOT EXISTS default_kitchen_id UUID REFERENCES kitchens(id),
  ADD COLUMN IF NOT EXISTS default_meal_id UUID REFERENCES meals(id),
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pause_reason VARCHAR(255);

-- Step 2: Create skipped_meals table
CREATE TABLE IF NOT EXISTS skipped_meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_window VARCHAR(10) NOT NULL CHECK (meal_window IN ('LUNCH', 'DINNER')),
  skip_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  reason VARCHAR(255),

  CONSTRAINT unique_skip UNIQUE(subscription_id, meal_window, skip_date)
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_skipped_meals_subscription ON skipped_meals(subscription_id);
CREATE INDEX IF NOT EXISTS idx_skipped_meals_date ON skipped_meals(skip_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_auto_order ON subscriptions(auto_ordering_enabled, is_paused, status);

-- Step 4: Add is_auto_ordered flag to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_auto_ordered BOOLEAN DEFAULT false;

-- Step 5: Update existing subscriptions
UPDATE subscriptions
SET auto_ordering_enabled = true
WHERE status = 'ACTIVE';

-- Step 6: Add check constraint for default_meal_type
ALTER TABLE subscriptions
  ADD CONSTRAINT check_default_meal_type
  CHECK (default_meal_type IN ('LUNCH', 'DINNER', 'BOTH'));
```

---

## 8. TESTING CHECKLIST

### Manual Testing Scenarios

#### Auto-Ordering
- [ ] User with active subscription gets auto-order at scheduled time
- [ ] User without vouchers does NOT get auto-order
- [ ] Paused subscription does NOT generate auto-orders
- [ ] Expired subscription does NOT generate auto-orders
- [ ] Skipped meal does NOT generate auto-order
- [ ] Auto-order uses correct default kitchen and meal
- [ ] Voucher is marked as REDEEMED after auto-order
- [ ] User receives push notification for auto-order

#### Pause/Resume
- [ ] Can pause active subscription
- [ ] Cannot pause already paused subscription
- [ ] Cannot pause cancelled/expired subscription
- [ ] Can set auto-resume date
- [ ] Auto-resume works on specified date
- [ ] Can manually resume paused subscription
- [ ] Subscription status changes to PAUSED when paused
- [ ] Subscription status changes to ACTIVE when resumed
- [ ] User receives notifications for pause/resume

#### Skip Meal
- [ ] Can skip lunch for specific date
- [ ] Can skip dinner for specific date
- [ ] Cannot skip same meal twice for same date
- [ ] Cannot skip meals in the past
- [ ] Can unskip a meal (undo skip)
- [ ] Skipped meal does NOT create auto-order
- [ ] Can view list of skipped meals
- [ ] User receives notification for skipped meal

#### Edge Cases
- [ ] Subscription expiry stops auto-ordering
- [ ] Voucher expiry stops auto-ordering
- [ ] Cancelled auto-order restores voucher
- [ ] Multiple subscriptions are handled correctly
- [ ] Unavailable kitchen triggers fallback or notification
- [ ] Unavailable meal triggers fallback or notification

---

## 9. API ENDPOINTS SUMMARY

### New Endpoints Required

```
GET    /api/subscriptions/:subscriptionId/settings
PATCH  /api/subscriptions/:subscriptionId/settings
POST   /api/subscriptions/:subscriptionId/pause
POST   /api/subscriptions/:subscriptionId/resume
POST   /api/subscriptions/:subscriptionId/skip-meal
DELETE /api/subscriptions/:subscriptionId/skip-meal/:skipMealId
GET    /api/subscriptions/:subscriptionId/skipped-meals
```

### Existing Endpoints (No Changes)

```
POST   /api/subscriptions/purchase
GET    /api/subscriptions/my-subscriptions
POST   /api/subscriptions/:subscriptionId/cancel
GET    /api/subscriptions/plans/active
GET    /api/subscriptions/my-vouchers
POST   /api/subscriptions/check-voucher-eligibility
```

---

## 10. IMPLEMENTATION PRIORITY

### Phase 1: Essential (Implement First)
1. **Auto-ordering cron job** - Core functionality
2. **Pause/Resume endpoints** - High user demand
3. **Skip meal endpoints** - High user demand
4. **Database migrations** - Required for all features

### Phase 2: Settings & Preferences
1. **Auto-order settings endpoints** - User customization
2. **Default kitchen/meal selection** - Improves UX
3. **Auto-resume scheduler** - Automation

### Phase 3: Polish
1. **Push notifications** - User engagement
2. **Advanced edge case handling** - Robustness
3. **Analytics tracking** - Business insights

---

## 11. FRONTEND IMPLICATIONS

Once backend is implemented, frontend will need:

1. **New Screens:**
   - Subscription Settings screen
   - Skip Meal screen/modal
   - Skipped Meals list

2. **New Components:**
   - Pause/Resume subscription buttons
   - Skip next meal buttons
   - Auto-order status indicators
   - Paused subscription banner

3. **Updates to Existing Screens:**
   - MealPlansScreen: Add pause/resume/skip actions
   - Home screen: Show next auto-order info
   - Notifications: Handle new notification types

4. **API Service Updates:**
   - Add new API methods
   - Update types/interfaces
   - Handle new error states

---

## 12. QUESTIONS FOR BACKEND TEAM

Please clarify:

1. **Auto-Order Timing:**
   - What time should auto-orders be placed? (e.g., midnight for next day?)
   - How many hours in advance?
   - Different times for lunch vs dinner?

2. **Voucher Logic:**
   - Should auto-ordering stop when vouchers run out?
   - Should subscription auto-pause when vouchers expire?
   - Can user manually order even when subscription is paused?

3. **Multiple Subscriptions:**
   - Can user have multiple active subscriptions?
   - How to prioritize which subscription to use for auto-ordering?

4. **Cancellation Policy:**
   - Can user cancel auto-ordered meal?
   - If yes, within what timeframe?
   - Should voucher be restored?

5. **Pause Limits:**
   - Is there a maximum pause duration?
   - How many times can user pause per subscription?

6. **Skip Limits:**
   - Is there a limit to how many meals can be skipped?
   - How far in advance can meals be skipped?

---

## CONCLUSION

The auto-ordering system requires significant backend work across:
- Database schema changes (3 new columns + 1 new table)
- 7 new API endpoints
- 2 cron jobs (auto-order + auto-resume)
- Notification integration
- Edge case handling

**Estimated Backend Effort:** 3-5 days for experienced developer

**Critical Path:** Database migrations → Auto-order cron → Pause/Resume → Skip meal → Settings

Once backend is complete, frontend implementation will take approximately 2-3 days.

---

## CONTACT & COLLABORATION

- Frontend has placeholder UI in FAQ screen mentioning these features
- `PAUSED` status type already exists but is unused
- Voucher system is fully functional and ready for auto-ordering integration
- Frontend team ready to start UI development once backend endpoints are available

**Next Steps:**
1. Backend team reviews this document
2. Clarify questions in section 12
3. Backend implements Phase 1 (essential features)
4. API documentation shared with frontend
5. Frontend begins UI implementation
6. Integration testing
7. Rollout Phase 2 & 3 features

---

**Document Version:** 1.0
**Last Updated:** January 17, 2026
**Author:** Claude Code (Frontend Analysis)
**For:** Backend Development Team
