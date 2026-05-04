# Customer Frontend Implementation Prompts

> **Platform**: React Native CLI (without Expo)
>
> **Purpose**: Copy these prompts to Claude to implement the customer app. Execute prompts in order. Each prompt builds on the previous one.

---

## Prompt 0: Pre-requisites Setup

```
Implement the foundation for the Tiffsy customer app (React Native CLI, no Expo).

## Tech Stack
- React Native CLI (NOT Expo)
- React Navigation v6 (stack + bottom tabs)
- React Query (TanStack Query) for data fetching/caching
- Axios for HTTP requests
- React Hook Form + Zod for forms
- AsyncStorage for persistence
- Firebase Auth for phone OTP
- Firebase Cloud Messaging for push notifications

## Project Structure
```
src/
  api/           # Axios instance, API functions
  components/    # Reusable components
  hooks/         # Custom hooks
  navigation/    # Navigation setup
  screens/       # Screen components
  store/         # Context/state management
  utils/         # Helper functions
  types/         # TypeScript interfaces
```

## Core Setup Required

### 1. API Client (src/api/client.ts)
- Base URL: `http://10.0.2.2:5000/api` (Android emulator)
- Axios instance with interceptors
- Request interceptor: Attach Firebase ID token from auth
- Response interceptor: Handle 401 (re-authenticate)
- Error handling wrapper

### 2. Auth Context (src/store/AuthContext.tsx)
- Store current user
- Store Firebase ID token (refresh before API calls)
- isAuthenticated, isLoading states
- login(), logout(), refreshToken() methods
- Persist user to AsyncStorage

### 3. Navigation (src/navigation/)
- AuthStack: Login, OTP, Register screens
- MainStack: Home, Kitchens, Orders, Subscriptions, Profile tabs
- Conditional rendering based on auth state

### 4. Firebase Setup
- Configure Firebase for Android (@react-native-firebase/app)
- Phone auth (@react-native-firebase/auth)
- Cloud Messaging (@react-native-firebase/messaging)
- Get ID token: `await auth().currentUser.getIdToken()`

### 5. React Query Setup
- QueryClientProvider at app root
- Default stale time: 5 minutes
- Retry: 1 attempt for failed requests

Create the complete foundation with these components working together. The API should use Firebase ID token for Authorization header.
```

---

## Prompt 1: Authentication Flow

```
Implement Firebase phone OTP authentication for the Tiffsy customer app.

## API Endpoints

### POST /api/auth/sync
Check if user exists after Firebase OTP.
- Header: `Authorization: Bearer <firebase_id_token>`
- Response: { user, isNewUser, isProfileComplete }

### POST /api/auth/register
Register new user.
- Header: `Authorization: Bearer <firebase_id_token>`
- Body: { name (required), email, dietaryPreferences: ["VEG"|"NON_VEG"|"VEGAN"|"JAIN"|"EGGETARIAN"] }
- Response: { user, isProfileComplete }

### GET /api/auth/me
Get current user profile.
- Header: `Authorization: Bearer <firebase_id_token>`
- Response: { user }

### PUT /api/auth/profile
Update profile.
- Header: `Authorization: Bearer <firebase_id_token>`
- Body: { name, email, dietaryPreferences, profileImage }

### POST /api/auth/fcm-token
Register FCM token.
- Body: { fcmToken, deviceId }

## Screens to Implement

### 1. LoginScreen
- Phone input with +91 country code (India only)
- "Send OTP" button
- Firebase phone auth: `signInWithPhoneNumber(phoneNumber)`
- Handle Firebase errors (too many attempts, invalid number)

### 2. OTPScreen
- 6-digit OTP input (auto-advance on type)
- Auto-submit when complete
- Resend OTP with 30s cooldown timer
- Confirm with Firebase: `confirmationResult.confirm(code)`
- On success: Get ID token, call POST /api/auth/sync
  - If isNewUser: true → Navigate to RegisterScreen
  - If isNewUser: false → Navigate to Home

### 3. RegisterScreen
- Name input (required, min 2 chars)
- Email input (optional, validate format)
- Dietary preferences (multi-select chips: VEG, NON_VEG, VEGAN, JAIN, EGGETARIAN)
- "Create Account" button → POST /api/auth/register
- On success: Navigate to Home

### 4. ProfileScreen (in main app)
- Display user info
- Edit mode for name, email, preferences
- Profile image picker (optional)
- Logout button (clear auth state, navigate to LoginScreen)

## Auth Flow Logic
1. App launch: Check AsyncStorage for user
2. If user exists: Get fresh Firebase ID token, verify with GET /api/auth/me
3. If valid: Show main app
4. If invalid/expired: Clear storage, show LoginScreen

## FCM Token Registration
- Request notification permission
- Get FCM token
- Call POST /api/auth/fcm-token on login
- Call DELETE /api/auth/fcm-token on logout

Implement complete auth flow with proper error handling and loading states.
```

---

## Prompt 2: Address Management

```
Implement address management for the Tiffsy customer app.

## API Endpoints

### GET /api/addresses/check-serviceability?pincode=400001
Check if pincode is serviceable (public endpoint).
- Response: { pincode, isServiceable, zone, kitchenCount, message }

### POST /api/addresses
Create address.
- Body: { label, addressLine1, addressLine2?, landmark?, locality, city, state?, pincode, contactName?, contactPhone?, coordinates?, isDefault? }

### GET /api/addresses
Get all addresses.
- Response: { addresses, defaultAddressId }

### GET /api/addresses/:id
Get address details.
- Response: { address, zone, isServiceable, availableKitchens }

### PUT /api/addresses/:id
Update address.

### DELETE /api/addresses/:id
Soft delete address.

### PATCH /api/addresses/:id/default
Set as default address.

### GET /api/addresses/:id/kitchens
Get kitchens serving this address.
- Response: { kitchens: [{ _id, name, code, type, logo, cuisineTypes, averageRating }], count }

## Screens to Implement

### 1. AddressListScreen
- FlatList of addresses
- Default address badge (star icon)
- Serviceability indicator (green check / red warning)
- Swipe actions: Edit, Delete
- FAB: "Add Address"
- Empty state: "Add your first delivery address"

### 2. AddAddressScreen
- Google Maps location picker (react-native-maps)
- Search bar for address lookup (Google Places API)
- Form fields:
  - Label: Chips (Home, Work, Other)
  - Address Line 1 (required)
  - Address Line 2
  - Landmark
  - Locality (required)
  - City (required)
  - State
  - Pincode (required, 6 digits)
  - Contact Name
  - Contact Phone
  - Set as Default toggle
- Pincode validation:
  - On pincode change/blur: Call GET /api/addresses/check-serviceability
  - Show serviceability status below pincode field
  - Warn if not serviceable but allow save

### 3. EditAddressScreen
- Same form as AddAddressScreen
- Pre-filled with existing data
- Update on save
- Delete button with confirmation

## Address Selection Component
- Reusable component for checkout flow
- Horizontal scrollable cards
- Current default highlighted
- "Add New" button
- Show serviceability status

## Data Fetching
- Use React Query for caching
- Query key: ['addresses']
- Refetch on focus
- Optimistic updates for delete/default

Implement with proper loading states, error handling, and form validation.
```

---

## Prompt 3: Order Placement

```
Implement order placement for the Tiffsy customer app with voucher support.

## API Endpoints

### POST /api/orders/calculate-pricing
Cart preview with pricing breakdown.
- Body: { kitchenId, menuType, mealWindow?, deliveryAddressId, items: [{ menuItemId, quantity, addons?: [{ addonId, quantity }] }], voucherCount?, couponCode? }
- Response: { breakdown: { items, subtotal, charges, discount, voucherCoverage, grandTotal, amountToPay }, voucherEligibility: { available, canUse, cutoffPassed, cutoffInfo } }

### POST /api/orders
Create order.
- Body: { kitchenId, menuType, mealWindow?, deliveryAddressId, items, voucherCount?, couponCode?, specialInstructions?, deliveryNotes?, paymentMethod }
- Response: { order, vouchersUsed, amountToPay, paymentRequired }

### GET /api/orders/my-orders?status=&menuType=&page=&limit=
Get order history.

### GET /api/orders/:id
Get order details.

### GET /api/orders/:id/track
Track order status.

### PATCH /api/orders/:id/customer-cancel
Cancel order.
- Body: { reason }

### POST /api/orders/:id/rate
Rate order.
- Body: { rating: 1-5, comment }

## Order Types
- MEAL_MENU: Requires mealWindow (LUNCH/DINNER), supports vouchers
- ON_DEMAND_MENU: No mealWindow, supports coupons

## Voucher Rules
- Only for MEAL_MENU
- Cutoff: LUNCH 11:00 IST, DINNER 21:00 IST
- Each voucher covers 1 main course
- Max 10 vouchers per order
- FIFO by expiry date

## Screens to Implement

### 1. CartScreen
- FlatList of cart items with quantity adjusters
- Address selector (horizontal scroll)
- Menu type tabs (Meal Menu / On Demand)
- If MEAL_MENU:
  - Meal window selector (Lunch / Dinner)
  - Voucher section:
    - Toggle: "Use Vouchers"
    - Voucher count selector (1-10, max available)
    - Show cutoff time warning
    - Disable if cutoff passed
- If ON_DEMAND_MENU:
  - Coupon input field
  - "Apply" button
- Pricing breakdown:
  - Items subtotal
  - Delivery fee
  - Service fee
  - Packaging fee
  - Tax
  - Voucher coverage (if applicable)
  - Coupon discount (if applicable)
  - Grand Total
  - Amount to Pay
- "Place Order" button

### 2. Cart Logic
- On any change: Call POST /api/orders/calculate-pricing
- Debounce API calls (300ms)
- Show loading state during calculation
- Update pricing breakdown
- Show voucher eligibility info

### 3. CheckoutFlow
- Validate address is serviceable
- Validate items are available
- If amountToPay > 0:
  - Show payment method selector (UPI, Card, etc.)
  - For demo: Just pass mock paymentId
- If amountToPay = 0 (voucher-only):
  - Skip payment, paymentMethod = "VOUCHER_ONLY"
- Call POST /api/orders
- On success: Navigate to OrderConfirmationScreen

### 4. OrderConfirmationScreen
- Order number
- Order summary
- Amount paid
- Vouchers used
- "Track Order" button
- "Back to Home" button

### 5. OrderHistoryScreen
- FlatList with status filter tabs
- Order cards with: orderNumber, kitchen, status, date, total
- Status badges (color-coded)
- Tap to view details
- Pull-to-refresh

### 6. OrderDetailScreen
- Order info
- Items list
- Pricing breakdown
- Status timeline (stepper)
- Delivery address
- Actions:
  - Cancel (if eligible)
  - Rate (if DELIVERED)
  - Reorder

### 7. OrderTrackingScreen
- Status stepper visualization
- Estimated delivery time
- Driver info (when out for delivery)
- Kitchen info
- Auto-refresh every 30 seconds

## Payment Handling (Mock)
For demo, simulate payment:
```javascript
const mockPaymentId = `demo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
// Pass this as paymentId in order creation
```

Implement complete order flow with voucher logic, pricing preview, and tracking.
```

---

## Prompt 4: Subscription Purchase

```
Implement subscription plan purchase for the Tiffsy customer app.

## API Endpoints

### GET /api/subscriptions/plans/active
Get available plans.
- Response: { plans: [{ _id, name, description, durationDays, vouchersPerDay, totalVouchers, price, originalPrice, badge, features }] }

### POST /api/subscriptions/purchase
Purchase subscription.
- Body: { planId, paymentId?, paymentMethod? }
- Response: { subscription, vouchersIssued, voucherExpiryDate }

### GET /api/subscriptions/my-subscriptions?status=&page=&limit=
Get user subscriptions.
- Response: { subscriptions, activeSubscription, totalVouchersAvailable, pagination }

### POST /api/subscriptions/:id/cancel
Cancel subscription.
- Body: { reason }
- Response: { subscription, vouchersCancelled, refundEligible, refundAmount, refundReason }

### GET /api/vouchers/my-vouchers?status=&page=&limit=
Get vouchers.
- Response: { vouchers, summary: { available, redeemed, expired, restored, total }, pagination }

### POST /api/vouchers/check-eligibility
Check voucher eligibility.
- Body: { kitchenId, menuType, mealWindow, mainCourseQuantity }
- Response: { canUseVoucher, availableVouchers, maxRedeemable, cutoffInfo, reason? }

## Screens to Implement

### 1. SubscriptionPlansScreen
- Horizontal scroll or vertical list of plans
- Plan cards with:
  - Badge (BEST_VALUE, POPULAR, FAMILY)
  - Plan name
  - Voucher count (e.g., "60 vouchers")
  - Duration (e.g., "30 days")
  - Price with strikethrough original price
  - Savings amount
  - Features list
  - "Subscribe" button
- Current subscription indicator (if active)

### 2. PlanDetailScreen
- Full plan info
- Features list
- Terms and conditions
- "Subscribe Now" button
- Payment flow (mock):
  ```javascript
  const mockPaymentId = `demo_${Date.now()}`;
  await purchaseSubscription({ planId, paymentId: mockPaymentId, paymentMethod: 'UPI' });
  ```

### 3. SubscriptionSuccessScreen
- Success animation
- Subscription summary
- Vouchers issued count
- Voucher expiry date
- "View Vouchers" button
- "Start Ordering" button

### 4. MySubscriptionsScreen
- Active subscription card (prominent):
  - Plan name
  - Progress bar: vouchers used / total
  - Days remaining
  - Expiry date
  - "View Vouchers" button
  - "Cancel" button (with confirmation)
- Past subscriptions list (collapsed)

### 5. VouchersScreen
- Summary cards: Available, Used, Expired
- Filter tabs: All, Available, Redeemed, Expired
- Voucher list:
  - Voucher code (partial, e.g., "VCH-A2B...E5F")
  - Status badge
  - Meal type (ANY, LUNCH, DINNER)
  - Expiry date
  - If redeemed: Order number, date

### 6. CancellationScreen
- Cancel reason input (optional)
- Refund eligibility info:
  - Vouchers used: X/Y
  - Usage percentage
  - Refund amount (if eligible)
- Confirm cancellation button
- Warning: "This action cannot be undone"

## Voucher Widget (for Home screen)
- Show available voucher count
- Quick link to VouchersScreen
- Expiry warning if < 7 days

## Integration with Order Flow
- In CartScreen, fetch voucher eligibility
- Show available voucher count
- Enable/disable voucher toggle based on eligibility
- Update on meal window change

Implement complete subscription and voucher management flow.
```

---

## Prompt 5: Final Integration & Polish

```
Complete the Tiffsy customer app with final integration and polish.

## Home Screen
- Welcome message with user name
- Voucher balance widget (if active subscription)
- Address selector (current default)
- Kitchen list for current address:
  - Call GET /api/addresses/:id/kitchens
  - Grid/list of kitchen cards
  - Each card: logo, name, type (TIFFSY/PARTNER), rating, cuisines
  - Tap to view kitchen menu

## Kitchen & Menu Flow
- KitchenDetailScreen: Kitchen info, menu tabs
- MenuScreen: Items grouped by category
- Add to cart flow
- Cart badge in header

## Bottom Tab Navigation
```javascript
const tabs = [
  { name: 'Home', icon: 'home' },
  { name: 'Orders', icon: 'receipt' },
  { name: 'Subscriptions', icon: 'card' },
  { name: 'Profile', icon: 'person' },
];
```

## Push Notifications
- Request permission on first launch
- Register FCM token after login
- Handle notification types:
  - ORDER_STATUS: Navigate to OrderTrackingScreen
  - SUBSCRIPTION_EXPIRY: Navigate to SubscriptionPlansScreen
  - PROMOTION: Navigate to relevant screen

## Error Handling
- Network error screen with retry
- Toast/snackbar for API errors
- Form validation errors inline
- Session expired: Auto-logout, show login

## Loading States
- Skeleton screens for lists
- Activity indicator for actions
- Pull-to-refresh on all lists
- Infinite scroll pagination

## Offline Support
- Show cached data when offline
- Queue actions when offline (optional)
- Show offline indicator

## Deep Linking (optional)
- tiffsy://order/:orderId
- tiffsy://subscription/:planId
- tiffsy://kitchen/:kitchenId

## Performance
- Memoize expensive computations
- Optimize FlatList with keyExtractor, getItemLayout
- Lazy load images
- Debounce search/filter inputs

## Testing Checklist
1. Auth flow: Login → OTP → Register → Home
2. Address: Add → Set default → View kitchens
3. Order: Add items → Apply vouchers → Checkout → Track
4. Subscription: Buy plan → Get vouchers → Use in order
5. Cancel order (before cutoff)
6. Cancel subscription (check refund)

Complete the app with all screens connected and working together.
```

---

## Quick Reference

### API Base URL
- Android Emulator: `http://10.0.2.2:5000/api`
- iOS Simulator: `http://localhost:5000/api`
- Real Device: `http://<your-ip>:5000/api`

### Auth Header
```javascript
const token = await auth().currentUser?.getIdToken();
headers: { 'Authorization': `Bearer ${token}` }
```

### Mock Payment
```javascript
const paymentId = `demo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
```

### Recommended Libraries
- `@react-native-firebase/app` - Firebase core
- `@react-native-firebase/auth` - Phone auth
- `@react-native-firebase/messaging` - FCM
- `@react-navigation/native` - Navigation
- `@tanstack/react-query` - Data fetching
- `axios` - HTTP client
- `react-hook-form` - Forms
- `zod` - Validation
- `@react-native-async-storage/async-storage` - Persistence
- `react-native-maps` - Maps
- `react-native-google-places-autocomplete` - Place search
