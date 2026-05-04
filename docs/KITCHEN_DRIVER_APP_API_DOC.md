# Kitchen Staff & Driver App - API Documentation

> **App Type**: Single unified app for Kitchen Staff + Drivers
> **Auth**: Phone OTP via Firebase (No registration - backend only)
> **Business**: Tiffin meal delivery with subscription plans

---

## Table of Contents

1. [Business Rules](#business-rules)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Authentication Flow](#authentication-flow)
4. [App Architecture](#app-architecture)
5. [Screens & Features](#screens--features)
6. [API Endpoints](#api-endpoints)
7. [Data Models](#data-models)
8. [State Management](#state-management)
9. [Real-time Features](#real-time-features)
10. [Notifications](#notifications)

---

## Business Rules

### Order Cutoff Times
| Meal   | Cutoff Time | Next Day Ordering |
|--------|-------------|-------------------|
| Lunch  | 11:00 AM    | Available after cutoff |
| Dinner | 9:00 PM     | Available after cutoff |

### Subscription Plans
| Plan  | Duration | Vouchers/Day | Total Vouchers | Expiry |
|-------|----------|--------------|----------------|--------|
| 7D    | 7 days   | 2 (L+D)      | 14             | 3 months from purchase |
| 14D   | 14 days  | 2 (L+D)      | 28             | 3 months from purchase |
| 30D   | 30 days  | 2 (L+D)      | 60             | 3 months from purchase |

### Voucher Rules
- 1 voucher = 1 meal (lunch OR dinner)
- Unused vouchers can be saved
- All vouchers expire 3 months from plan purchase date
- Vouchers cannot be used for addons
- Addons require separate payment

---

## User Roles & Permissions

### Kitchen Staff
```yaml
permissions:
  - view_orders
  - update_order_status
  - manage_menu_items
  - manage_addons
  - view_subscriptions
  - view_voucher_usage
  - manage_daily_menu
  - view_analytics
  - assign_driver
```

### Driver
```yaml
permissions:
  - view_assigned_deliveries
  - update_delivery_status
  - view_customer_details
  - view_delivery_route
  - mark_delivered
  - contact_customer
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│                    APP LAUNCH                            │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│              CHECK FIREBASE AUTH STATE                   │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────────────────────────┐
│ NOT LOGGED IN │   │ LOGGED IN                         │
│               │   │                                   │
│ LoginScreen   │   │ GET /api/auth/staff/profile       │
│ (Phone Input) │   │                                   │
└───────┬───────┘   │ Check role: KITCHEN | DRIVER      │
        │           │                                   │
        ▼           │ Route to appropriate dashboard    │
┌───────────────┐   └─────────────┬─────────────────────┘
│ Send OTP      │                 │
│ Firebase      │                 │
└───────┬───────┘                 │
        │                         │
        ▼                         │
┌───────────────┐                 │
│ OTP Screen    │                 │
│ Verify OTP    │                 │
└───────┬───────┘                 │
        │                         │
        ▼                         │
┌───────────────────────────────┐ │
│ GET /api/auth/staff/profile   │ │
│ Verify staff exists in system │ │
└───────────────┬───────────────┘ │
                │                 │
                ▼                 │
┌───────────────────────────────┐ │
│ ROLE-BASED ROUTING            │◄┘
│                               │
│ role === 'KITCHEN_STAFF'      │
│   → Kitchen Dashboard         │
│                               │
│ role === 'DRIVER'             │
│   → Driver Dashboard          │
└───────────────────────────────┘
```

### Auth Error Handling
| Error Code | Message | Action |
|------------|---------|--------|
| `STAFF_NOT_FOUND` | Phone not registered | Show "Contact admin for registration" |
| `STAFF_INACTIVE` | Account deactivated | Show "Account suspended" message |
| `INVALID_OTP` | Wrong OTP entered | Allow retry (max 3 attempts) |

---

## App Architecture

### Navigation Structure

```
AppNavigator
├── AuthStack (unauthenticated)
│   ├── LoginScreen
│   └── OTPVerificationScreen
│
├── KitchenStack (role: KITCHEN_STAFF)
│   ├── DrawerNavigator
│   │   ├── Dashboard (default)
│   │   ├── Orders
│   │   ├── Menu Management
│   │   ├── Subscriptions
│   │   ├── Users
│   │   ├── Deliveries
│   │   ├── Analytics
│   │   └── Settings
│   │
│   └── Modal Screens
│       ├── OrderDetailModal
│       ├── AddMenuItemModal
│       ├── EditMenuItemModal
│       ├── AddAddonModal
│       ├── AssignDriverModal
│       └── UserDetailModal
│
└── DriverStack (role: DRIVER)
    ├── TabNavigator
    │   ├── Deliveries (default)
    │   ├── Earnings
    │   └── Profile
    │
    └── Modal Screens
        ├── DeliveryDetailModal
        ├── CustomerContactModal
        └── DeliveryCompleteModal
```

### Folder Structure

```
src/
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   └── OTPVerificationScreen.tsx
│   │
│   ├── kitchen/
│   │   ├── DashboardScreen.tsx
│   │   ├── OrdersScreen.tsx
│   │   ├── OrderDetailScreen.tsx
│   │   ├── MenuManagementScreen.tsx
│   │   ├── AddonsScreen.tsx
│   │   ├── SubscriptionsScreen.tsx
│   │   ├── UsersScreen.tsx
│   │   ├── UserDetailScreen.tsx
│   │   ├── DeliveriesScreen.tsx
│   │   ├── AnalyticsScreen.tsx
│   │   └── SettingsScreen.tsx
│   │
│   └── driver/
│       ├── DeliveriesScreen.tsx
│       ├── DeliveryDetailScreen.tsx
│       ├── EarningsScreen.tsx
│       └── ProfileScreen.tsx
│
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   └── LoadingSpinner.tsx
│   │
│   ├── kitchen/
│   │   ├── OrderCard.tsx
│   │   ├── MenuItemCard.tsx
│   │   ├── AddonCard.tsx
│   │   ├── UserCard.tsx
│   │   ├── StatsCard.tsx
│   │   └── DeliveryCard.tsx
│   │
│   ├── driver/
│   │   ├── DeliveryCard.tsx
│   │   ├── RouteMap.tsx
│   │   └── EarningsCard.tsx
│   │
│   └── modals/
│       ├── OrderDetailModal.tsx
│       ├── AddMenuItemModal.tsx
│       ├── EditMenuItemModal.tsx
│       ├── AddAddonModal.tsx
│       ├── AssignDriverModal.tsx
│       ├── ConfirmationModal.tsx
│       └── DeliveryCompleteModal.tsx
│
├── context/
│   ├── AuthContext.tsx
│   ├── OrderContext.tsx
│   └── NotificationContext.tsx
│
├── services/
│   ├── api.service.ts
│   ├── auth.service.ts
│   ├── order.service.ts
│   ├── menu.service.ts
│   ├── delivery.service.ts
│   └── notification.service.ts
│
├── hooks/
│   ├── useOrders.ts
│   ├── useDeliveries.ts
│   ├── useRealtime.ts
│   └── useNotifications.ts
│
├── types/
│   ├── navigation.ts
│   ├── order.ts
│   ├── menu.ts
│   ├── user.ts
│   └── delivery.ts
│
└── utils/
    ├── dateUtils.ts
    ├── formatters.ts
    └── validators.ts
```

---

## Screens & Features

### Kitchen Staff Screens

#### 1. Dashboard Screen
**Path**: `/kitchen/dashboard`

```yaml
components:
  - StatsCards:
      - today_orders_count
      - pending_orders
      - active_deliveries
      - revenue_today

  - QuickActions:
      - view_pending_orders
      - manage_menu
      - view_deliveries

  - RecentOrders:
      - list: 5 most recent
      - quick_status_update

  - MealSlotIndicator:
      - current_slot: LUNCH | DINNER
      - cutoff_countdown
      - orders_for_slot

features:
  - real_time_order_updates
  - pull_to_refresh
  - auto_refresh: 30s
```

#### 2. Orders Screen
**Path**: `/kitchen/orders`

```yaml
tabs:
  - Pending
  - Preparing
  - Ready
  - Out for Delivery
  - Delivered
  - Cancelled

filters:
  - meal_type: [lunch, dinner]
  - date_range: [today, yesterday, custom]
  - order_type: [subscription, addon, one_time]
  - payment_status: [paid, pending, cod]

order_card:
  - order_id
  - customer_name
  - items_summary
  - total_amount
  - order_time
  - delivery_address_preview
  - status_badge
  - voucher_indicator

actions:
  - view_details
  - update_status
  - assign_driver
  - print_order
  - cancel_order

bulk_actions:
  - mark_multiple_preparing
  - mark_multiple_ready
  - assign_driver_bulk
```

#### 3. Order Detail Modal
**Trigger**: Tap order card

```yaml
sections:
  - OrderHeader:
      - order_id
      - status_badge
      - created_at
      - meal_type

  - CustomerInfo:
      - name
      - phone (tap to call)
      - delivery_address
      - special_instructions

  - OrderItems:
      - main_items (with voucher indicator)
      - addons (with price)
      - quantities

  - PaymentInfo:
      - subtotal
      - tax
      - discount
      - vouchers_used
      - addon_charges
      - total
      - payment_method
      - payment_status

  - DeliveryInfo:
      - assigned_driver
      - estimated_time
      - delivery_otp

  - StatusTimeline:
      - ordered_at
      - confirmed_at
      - preparing_at
      - ready_at
      - picked_up_at
      - delivered_at

actions:
  - update_status_dropdown
  - assign_driver_button
  - cancel_order_button
  - print_button
  - contact_customer_button
```

#### 4. Menu Management Screen
**Path**: `/kitchen/menu`

```yaml
tabs:
  - Main Items
  - Addons

main_items_section:
  components:
    - MenuItemCard:
        - image
        - name
        - description
        - price
        - availability_toggle
        - meal_type_tags: [lunch, dinner, both]
        - food_type: [veg, non_veg, vegan]

  actions:
    - add_item
    - edit_item
    - toggle_availability
    - delete_item

  filters:
    - meal_type
    - food_type
    - availability

addons_section:
  components:
    - AddonCard:
        - image
        - name
        - price
        - availability_toggle
        - compatible_items

  actions:
    - add_addon
    - edit_addon
    - toggle_availability
    - delete_addon
```

#### 5. Add/Edit Menu Item Modal

```yaml
form_fields:
  - image: ImagePicker (required)
  - name: TextInput (required, max 100)
  - description: TextArea (required, max 500)
  - price: NumberInput (required)
  - meal_type: MultiSelect [lunch, dinner]
  - food_type: Select [VEG, NON_VEG, VEGAN]
  - is_jain_friendly: Toggle
  - spice_level: Select [LOW, MEDIUM, HIGH]
  - is_available: Toggle (default: true)
  - preparation_time_mins: NumberInput

validation:
  - name: required, min 2 chars
  - price: required, > 0
  - image: required, max 5MB
  - meal_type: at least 1 selected
```

#### 6. Add/Edit Addon Modal

```yaml
form_fields:
  - image: ImagePicker (required)
  - name: TextInput (required)
  - description: TextArea
  - price: NumberInput (required)
  - is_available: Toggle
  - compatible_meals: MultiSelect [all_items or specific]

validation:
  - name: required
  - price: required, > 0
```

#### 7. Subscriptions Screen
**Path**: `/kitchen/subscriptions`

```yaml
tabs:
  - Active
  - Expiring Soon (< 7 days)
  - Expired

subscription_card:
  - customer_name
  - phone
  - plan_type: 7D | 14D | 30D
  - purchase_date
  - expiry_date
  - vouchers_remaining
  - vouchers_used
  - auto_order_status
  - status_badge

filters:
  - plan_type
  - status
  - expiry_range

details_modal:
  - customer_info
  - plan_details
  - voucher_usage_history
  - upcoming_scheduled_meals
  - dietary_preferences
```

#### 8. Users Screen
**Path**: `/kitchen/users`

```yaml
tabs:
  - Customers
  - Drivers (kitchen staff only)

customer_list:
  - search: by name, phone, email
  - filters:
      - has_active_subscription
      - dietary_preference
      - registration_date

  - customer_card:
      - name
      - phone
      - subscription_status
      - total_orders
      - last_order_date

driver_list:
  - driver_card:
      - name
      - phone
      - status: online | offline | on_delivery
      - active_deliveries_count
      - today_completed
      - rating

actions:
  - view_customer_details
  - view_driver_details
  - toggle_driver_status
```

#### 9. User Detail Screen

```yaml
customer_detail:
  - profile_info:
      - name
      - phone
      - email
      - dietary_preferences
      - registration_date

  - subscription_info:
      - current_plan
      - vouchers_remaining
      - expiry_date

  - address_list

  - order_history:
      - paginated list
      - filter by date

  - voucher_history:
      - usage log
      - remaining balance

driver_detail:
  - profile_info
  - status_toggle
  - today_stats:
      - deliveries_completed
      - earnings
      - average_delivery_time
  - delivery_history
  - ratings_breakdown
```

#### 10. Deliveries Screen
**Path**: `/kitchen/deliveries`

```yaml
tabs:
  - Unassigned
  - In Progress
  - Completed

delivery_card:
  - order_id
  - customer_name
  - address_preview
  - meal_type
  - driver_name (if assigned)
  - estimated_time
  - status

actions:
  - assign_driver
  - view_details
  - contact_driver
  - contact_customer

map_view_toggle:
  - show all active deliveries on map
  - driver locations (real-time)
```

#### 11. Assign Driver Modal

```yaml
components:
  - order_summary
  - available_drivers_list:
      - driver_name
      - current_status
      - distance_from_kitchen
      - active_deliveries_count
      - rating

  - auto_assign_button (nearest available)

actions:
  - select_driver
  - confirm_assignment
```

#### 12. Analytics Screen
**Path**: `/kitchen/analytics`

```yaml
date_range_selector:
  - today
  - this_week
  - this_month
  - custom_range

stats_cards:
  - total_orders
  - total_revenue
  - average_order_value
  - vouchers_redeemed
  - addon_revenue
  - new_subscriptions

charts:
  - orders_by_meal_type (pie)
  - daily_orders_trend (line)
  - revenue_trend (line)
  - popular_items (bar)
  - popular_addons (bar)
  - peak_order_times (heatmap)

tables:
  - top_customers
  - subscription_breakdown
  - voucher_usage_summary
```

#### 13. Settings Screen
**Path**: `/kitchen/settings`

```yaml
sections:
  - profile:
      - view_name
      - view_phone
      - change_language

  - notifications:
      - new_order_sound
      - order_ready_alert
      - delivery_updates

  - app:
      - auto_refresh_interval
      - dark_mode
      - print_settings

  - about:
      - app_version
      - contact_support

  - logout_button
```

---

### Driver Screens

#### 1. Deliveries Screen (Driver)
**Path**: `/driver/deliveries`

```yaml
tabs:
  - Assigned (pending pickup)
  - In Progress
  - Completed Today

delivery_card:
  - order_id
  - customer_name
  - address_preview
  - meal_type_badge
  - items_count
  - estimated_distance
  - priority_indicator

actions:
  - start_delivery
  - view_route
  - contact_customer
  - mark_delivered

empty_state:
  - no_deliveries_assigned
  - pull_to_refresh
```

#### 2. Delivery Detail Screen (Driver)

```yaml
sections:
  - OrderInfo:
      - order_id
      - meal_type
      - items_list
      - special_instructions

  - CustomerInfo:
      - name
      - phone (tap to call)
      - address_full
      - delivery_notes

  - DeliveryOTP:
      - otp_display
      - verify_otp_input (on delivery)

  - NavigationSection:
      - open_in_maps_button
      - estimated_time
      - distance

actions:
  - mark_picked_up
  - start_navigation
  - contact_customer
  - mark_delivered (with OTP verification)
  - report_issue

status_flow:
  ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
```

#### 3. Delivery Complete Modal

```yaml
form:
  - otp_input: 4 digits (required)
  - delivery_photo: optional
  - notes: optional

validation:
  - otp must match order.delivery_otp

on_success:
  - show_success_animation
  - auto_navigate_to_next_delivery
  - update_earnings
```

#### 4. Earnings Screen (Driver)
**Path**: `/driver/earnings`

```yaml
summary_card:
  - today_earnings
  - today_deliveries
  - today_tips

tabs:
  - Today
  - This Week
  - This Month

earnings_list:
  - delivery_card:
      - order_id
      - delivery_time
      - base_pay
      - tip (if any)
      - total

stats:
  - total_earnings
  - total_deliveries
  - average_per_delivery
  - best_day
```

#### 5. Profile Screen (Driver)
**Path**: `/driver/profile`

```yaml
sections:
  - profile_info:
      - name
      - phone
      - photo
      - rating
      - member_since

  - stats:
      - total_deliveries
      - average_rating
      - on_time_percentage

  - settings:
      - notification_preferences
      - language

  - documents:
      - view_uploaded_docs

  - logout_button
```

---

## API Endpoints

### Base URL
```
Production: https://api.tiffin-delivery.com
Development: http://192.168.29.105:3000
```

### Authentication

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/auth/staff/send-otp` | POST | Send OTP to staff phone | `{ phone }` | `{ success, message, confirmationId }` |
| `/api/auth/staff/verify-otp` | POST | Verify OTP | `{ phone, otp, firebaseToken }` | `{ success, token, user }` |
| `/api/auth/staff/profile` | GET | Get staff profile | - | `{ user: StaffProfile }` |
| `/api/auth/staff/logout` | POST | Logout | - | `{ success }` |

### Orders (Kitchen)

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/kitchen/orders` | GET | List orders | `?status&mealType&date&page&limit` | `{ orders[], pagination }` |
| `/api/kitchen/orders/:id` | GET | Order details | - | `{ order: OrderDetail }` |
| `/api/kitchen/orders/:id/status` | PATCH | Update status | `{ status }` | `{ order }` |
| `/api/kitchen/orders/:id/assign` | POST | Assign driver | `{ driverId }` | `{ order }` |
| `/api/kitchen/orders/:id/cancel` | POST | Cancel order | `{ reason }` | `{ order }` |
| `/api/kitchen/orders/bulk-status` | PATCH | Bulk update | `{ orderIds[], status }` | `{ updated[] }` |
| `/api/kitchen/orders/stats` | GET | Order stats | `?date` | `{ stats }` |

### Menu Management

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/kitchen/menu-items` | GET | List items | `?mealType&foodType&available` | `{ items[] }` |
| `/api/kitchen/menu-items` | POST | Create item | `FormData` | `{ item }` |
| `/api/kitchen/menu-items/:id` | GET | Item details | - | `{ item }` |
| `/api/kitchen/menu-items/:id` | PUT | Update item | `FormData` | `{ item }` |
| `/api/kitchen/menu-items/:id` | DELETE | Delete item | - | `{ success }` |
| `/api/kitchen/menu-items/:id/availability` | PATCH | Toggle | `{ available }` | `{ item }` |

### Addons Management

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/kitchen/addons` | GET | List addons | `?available` | `{ addons[] }` |
| `/api/kitchen/addons` | POST | Create addon | `FormData` | `{ addon }` |
| `/api/kitchen/addons/:id` | PUT | Update addon | `FormData` | `{ addon }` |
| `/api/kitchen/addons/:id` | DELETE | Delete addon | - | `{ success }` |
| `/api/kitchen/addons/:id/availability` | PATCH | Toggle | `{ available }` | `{ addon }` |

### Users Management

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/kitchen/customers` | GET | List customers | `?search&hasSubscription&page` | `{ customers[], pagination }` |
| `/api/kitchen/customers/:id` | GET | Customer details | - | `{ customer }` |
| `/api/kitchen/customers/:id/orders` | GET | Customer orders | `?page&limit` | `{ orders[] }` |
| `/api/kitchen/customers/:id/vouchers` | GET | Voucher history | - | `{ vouchers[] }` |
| `/api/kitchen/drivers` | GET | List drivers | `?status` | `{ drivers[] }` |
| `/api/kitchen/drivers/:id` | GET | Driver details | - | `{ driver }` |
| `/api/kitchen/drivers/:id/status` | PATCH | Toggle status | `{ status }` | `{ driver }` |

### Subscriptions

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/kitchen/subscriptions` | GET | List subs | `?status&planType&page` | `{ subscriptions[] }` |
| `/api/kitchen/subscriptions/:id` | GET | Sub details | - | `{ subscription }` |
| `/api/kitchen/subscriptions/stats` | GET | Sub stats | - | `{ stats }` |

### Deliveries (Kitchen)

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/kitchen/deliveries` | GET | List deliveries | `?status&date` | `{ deliveries[] }` |
| `/api/kitchen/deliveries/:id/assign` | POST | Assign driver | `{ driverId }` | `{ delivery }` |
| `/api/kitchen/deliveries/available-drivers` | GET | Get drivers | - | `{ drivers[] }` |

### Analytics

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/kitchen/analytics/overview` | GET | Overview | `?startDate&endDate` | `{ stats }` |
| `/api/kitchen/analytics/orders` | GET | Order analytics | `?startDate&endDate` | `{ data }` |
| `/api/kitchen/analytics/revenue` | GET | Revenue analytics | `?startDate&endDate` | `{ data }` |
| `/api/kitchen/analytics/popular-items` | GET | Popular items | `?startDate&endDate` | `{ items[] }` |

### Driver Endpoints

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/driver/deliveries` | GET | My deliveries | `?status&date` | `{ deliveries[] }` |
| `/api/driver/deliveries/:id` | GET | Delivery detail | - | `{ delivery }` |
| `/api/driver/deliveries/:id/pickup` | POST | Mark picked up | - | `{ delivery }` |
| `/api/driver/deliveries/:id/complete` | POST | Mark delivered | `{ otp, photo?, notes? }` | `{ delivery }` |
| `/api/driver/deliveries/:id/issue` | POST | Report issue | `{ issue, description }` | `{ success }` |
| `/api/driver/earnings` | GET | My earnings | `?startDate&endDate` | `{ earnings }` |
| `/api/driver/profile` | GET | My profile | - | `{ profile }` |
| `/api/driver/location` | POST | Update location | `{ lat, lng }` | `{ success }` |
| `/api/driver/status` | PATCH | Toggle online | `{ online }` | `{ status }` |

---

## Data Models

### Staff Profile
```typescript
interface StaffProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'KITCHEN_STAFF' | 'DRIVER';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}
```

### Order
```typescript
interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customer: CustomerSummary;

  items: OrderItem[];
  addons: OrderAddon[];

  mealType: 'LUNCH' | 'DINNER';

  subtotal: number;
  tax: number;
  discount: number;
  addonTotal: number;
  total: number;

  vouchersUsed: number;
  subscriptionId?: string;

  status: OrderStatus;

  deliveryAddress: Address;
  deliveryOtp: string;
  deliveryInstructions?: string;

  driverId?: string;
  driver?: DriverSummary;

  paymentMethod: PaymentMethod;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';

  statusHistory: StatusHistoryItem[];

  createdAt: Date;
  updatedAt: Date;
}

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  isVoucherApplied: boolean;
}

interface OrderAddon {
  id: string;
  addonId: string;
  name: string;
  quantity: number;
  price: number;
}
```

### Menu Item
```typescript
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;

  mealTypes: ('LUNCH' | 'DINNER')[];
  foodType: 'VEG' | 'NON_VEG' | 'VEGAN';
  isJainFriendly: boolean;
  spiceLevel: 'LOW' | 'MEDIUM' | 'HIGH';

  isAvailable: boolean;
  preparationTime: number; // minutes

  createdAt: Date;
  updatedAt: Date;
}
```

### Addon
```typescript
interface Addon {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  isAvailable: boolean;
  compatibleMenuItems: string[] | 'ALL';
  createdAt: Date;
  updatedAt: Date;
}
```

### Customer
```typescript
interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;

  dietaryPreferences: {
    foodType: 'VEG' | 'NON_VEG' | 'VEGAN';
    isEggetarian: boolean;
    isJainFriendly: boolean;
    dabbaType: 'DISPOSABLE' | 'STEEL_DABBA';
    spiceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };

  addresses: Address[];

  activeSubscription?: SubscriptionSummary;
  totalOrders: number;
  lastOrderDate?: Date;

  createdAt: Date;
}
```

### Subscription
```typescript
interface Subscription {
  id: string;
  customerId: string;
  customer: CustomerSummary;

  planType: '7D' | '14D' | '30D';

  purchaseDate: Date;
  expiryDate: Date; // 3 months from purchase

  totalVouchers: number;
  vouchersUsed: number;
  vouchersRemaining: number;

  autoOrderLunch: boolean;
  autoOrderDinner: boolean;

  status: 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED';

  createdAt: Date;
}

interface VoucherUsage {
  id: string;
  subscriptionId: string;
  orderId: string;
  mealType: 'LUNCH' | 'DINNER';
  usedAt: Date;
}
```

### Driver
```typescript
interface Driver extends StaffProfile {
  role: 'DRIVER';

  isOnline: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };

  activeDeliveries: number;
  todayCompleted: number;

  rating: number;
  totalDeliveries: number;
  totalEarnings: number;
}
```

### Delivery
```typescript
interface Delivery {
  id: string;
  orderId: string;
  order: OrderSummary;

  driverId?: string;
  driver?: DriverSummary;

  status: DeliveryStatus;

  pickupTime?: Date;
  deliveredTime?: Date;

  customerOtp: string;
  deliveryPhoto?: string;
  deliveryNotes?: string;

  estimatedTime: number; // minutes
  distance: number; // km

  issue?: {
    type: string;
    description: string;
    reportedAt: Date;
  };
}

type DeliveryStatus =
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED';
```

---

## State Management

### Auth Context
```typescript
interface AuthState {
  user: StaffProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: 'KITCHEN_STAFF' | 'DRIVER' | null;
}

interface AuthActions {
  login: (phone: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

### Order Context (Kitchen)
```typescript
interface OrderState {
  orders: Order[];
  selectedOrder: Order | null;
  filters: OrderFilters;
  pagination: Pagination;
  stats: OrderStats;
  isLoading: boolean;
}

interface OrderActions {
  fetchOrders: (filters?: OrderFilters) => Promise<void>;
  fetchOrderDetail: (id: string) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  assignDriver: (orderId: string, driverId: string) => Promise<void>;
  cancelOrder: (id: string, reason: string) => Promise<void>;
}
```

### Delivery Context (Driver)
```typescript
interface DeliveryState {
  deliveries: Delivery[];
  activeDelivery: Delivery | null;
  todayStats: {
    completed: number;
    earnings: number;
  };
  isOnline: boolean;
}

interface DeliveryActions {
  fetchDeliveries: () => Promise<void>;
  markPickedUp: (id: string) => Promise<void>;
  markDelivered: (id: string, otp: string) => Promise<void>;
  reportIssue: (id: string, issue: DeliveryIssue) => Promise<void>;
  toggleOnlineStatus: () => Promise<void>;
  updateLocation: (lat: number, lng: number) => Promise<void>;
}
```

---

## Real-time Features

### WebSocket Events

```typescript
// Kitchen Staff Events
interface KitchenEvents {
  'order:new': Order;
  'order:updated': { orderId: string; status: OrderStatus };
  'order:cancelled': { orderId: string; reason: string };
  'delivery:status': { deliveryId: string; status: DeliveryStatus };
  'driver:location': { driverId: string; lat: number; lng: number };
}

// Driver Events
interface DriverEvents {
  'delivery:assigned': Delivery;
  'delivery:unassigned': { deliveryId: string };
  'order:cancelled': { orderId: string; reason: string };
}
```

### Socket Connection
```typescript
// Connect on auth
socket.connect(token);

// Kitchen subscriptions
socket.on('order:new', handleNewOrder);
socket.on('order:updated', handleOrderUpdate);

// Driver subscriptions
socket.on('delivery:assigned', handleNewDelivery);
```

---

## Notifications

### Push Notification Types

```typescript
interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
}

// Kitchen Notifications
type KitchenNotification =
  | 'NEW_ORDER'
  | 'ORDER_CANCELLED'
  | 'DRIVER_ARRIVED'
  | 'DELIVERY_COMPLETED'
  | 'DELIVERY_ISSUE';

// Driver Notifications
type DriverNotification =
  | 'DELIVERY_ASSIGNED'
  | 'ORDER_CANCELLED'
  | 'CUSTOMER_MESSAGE';
```

### Notification Handlers
```typescript
// Register FCM token
await registerPushToken(fcmToken, staffId, role);

// Handle foreground notifications
messaging().onMessage(async (message) => {
  showInAppNotification(message);
});

// Handle background/quit state
messaging().setBackgroundMessageHandler(async (message) => {
  // Navigate to relevant screen on tap
});
```

---

## Order Status Flow

```
┌─────────────┐
│   PENDING   │ ← Customer places order
└──────┬──────┘
       │ Kitchen confirms
       ▼
┌─────────────┐
│  CONFIRMED  │
└──────┬──────┘
       │ Kitchen starts preparing
       ▼
┌─────────────┐
│  PREPARING  │
└──────┬──────┘
       │ Kitchen marks ready
       ▼
┌─────────────┐
│    READY    │ ← Assign driver here
└──────┬──────┘
       │ Driver picks up
       ▼
┌─────────────┐
│  PICKED_UP  │
└──────┬──────┘
       │ Driver en route
       ▼
┌─────────────┐
│  IN_TRANSIT │
└──────┬──────┘
       │ OTP verified, delivered
       ▼
┌─────────────┐
│  DELIVERED  │
└─────────────┘

┌─────────────┐
│  CANCELLED  │ ← Can happen from PENDING/CONFIRMED/PREPARING
└─────────────┘
```

---

## Cutoff Time Logic

```typescript
const CUTOFF = {
  LUNCH: { hour: 11, minute: 0 },
  DINNER: { hour: 21, minute: 0 }
};

function canOrderForMeal(mealType: 'LUNCH' | 'DINNER'): boolean {
  const now = new Date();
  const cutoff = CUTOFF[mealType];
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoff.hour, cutoff.minute, 0, 0);

  return now < cutoffTime;
}

function getAvailableOrderDate(mealType: 'LUNCH' | 'DINNER'): Date {
  if (canOrderForMeal(mealType)) {
    return new Date(); // Today
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow; // Next day
}
```

---

## Quick Reference

### Status Badges
| Status | Color | Icon |
|--------|-------|------|
| PENDING | Yellow | clock |
| CONFIRMED | Blue | check |
| PREPARING | Orange | cooking |
| READY | Green | package |
| PICKED_UP | Purple | bike |
| IN_TRANSIT | Blue | navigation |
| DELIVERED | Green | check-circle |
| CANCELLED | Red | x-circle |

### Meal Type Badges
| Type | Color | Icon |
|------|-------|------|
| LUNCH | Orange | sun |
| DINNER | Indigo | moon |

### Food Type Badges
| Type | Color | Icon |
|------|-------|------|
| VEG | Green | leaf |
| NON_VEG | Red | drumstick |
| VEGAN | Emerald | sprout |

---

## Error Codes

| Code | Message | Resolution |
|------|---------|------------|
| `AUTH_001` | Phone not registered | Contact admin |
| `AUTH_002` | Account inactive | Contact admin |
| `AUTH_003` | Invalid OTP | Retry or resend |
| `ORDER_001` | Order not found | Refresh |
| `ORDER_002` | Invalid status transition | Check current status |
| `ORDER_003` | Driver already assigned | Refresh order |
| `DELIVERY_001` | Invalid OTP | Customer provides correct OTP |
| `DELIVERY_002` | Delivery already completed | Refresh |
| `MENU_001` | Item name exists | Use different name |
| `MENU_002` | Image upload failed | Retry |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | - | Initial release |

---

*Document generated for Kitchen Staff & Driver App development. Keep synced with backend API changes.*
