import axios, { AxiosInstance } from 'axios';
import {
  getAuthToken,
  clearAuthToken,
  storeAuthToken,
  refreshAuthToken,
  isTokenExpiringSoon,
  AuthRefreshError,
} from './auth.token.service';
import { authEvents } from './auth.events';

// Backend base URL - update this with your actual backend URL
const BASE_URL = 'https://d31od4t2t5epcb.cloudfront.net';
// const BASE_URL = 'http://192.168.1.4:5005';
// const BASE_URL = 'http://192.168.29.69:5005';

// Type definitions for API responses
export interface UserData {
  _id: string;
  phone: string;
  role: string;
  name?: string;
  email?: string;
  dietaryPreferences?: string[];
  profileImage?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  data: {
    user: UserData | null;
    token?: string;
    expiresIn?: number;
    registrationToken?: string;
    isNewUser: boolean;
    isProfileComplete: boolean;
    approvalStatus?: string;
    rejectionReason?: string;
  };
}

export interface RegisterUserResponse {
  success: boolean;
  message: string;
  data: {
    user: UserData;
    token: string;
    expiresIn: number;
    isProfileComplete: boolean;
  };
}

export interface ZoneLookupResponse {
  status: number;
  message: string;
  data: {
    found: boolean;
    zone: {
      _id: string;
      pincode: string;
      name: string;
      city: string;
    } | null;
    isServiceable: boolean;
    message: string;
  };
}

export interface FcmTokenResponse {
  status: number;
  message: string;
  data: null;
}

export interface UpdateProfileResponse {
  status: number;
  message: string;
  data: {
    user: UserData;
    isProfileComplete: boolean;
  };
}

export interface ServiceabilityResponse {
  success: boolean;
  message: string;
  data: {
    isServiceable: boolean;
    message: string;
  };
}

export interface AddressData {
  label: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isDefault?: boolean;
}

export interface ServerAddress {
  _id: string;
  userId: string;
  label: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isDefault: boolean;
  zoneId?: string;
  isServiceable: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressResponse {
  status: number;
  message: string;
  data: {
    address: ServerAddress;
    isServiceable: boolean;
    zone?: {
      _id: string;
      name: string;
      city: string;
    };
  };
}

export interface GetAddressesResponse {
  success: boolean;
  message: string;
  data: {
    addresses: ServerAddress[];
  };
}

export interface UpdateAddressResponse {
  success: boolean;
  message: string;
  data: {
    address: ServerAddress;
  };
}

export interface DeleteAddressResponse {
  success: boolean;
  message: string;
  data: null;
}

export interface KitchenData {
  id: string;
  displayName: string;
  fulfilledBy: string;
  type: string;
  isPremium: boolean;
  isGourmet: boolean;
  rating: number;
  totalRatings: number;
}

// New types for zone/kitchen/menu flow
export interface ZoneData {
  _id: string;
  pincode: string;
  name: string;
  city: string;
  state: string;
  status: string;
  orderingEnabled: boolean;
}

export interface ZoneLookupFullResponse {
  success: boolean;
  data: ZoneData;
}

export interface KitchenInfo {
  _id: string;
  name: string;
  code: string;
  type: 'TIFFSY' | 'PARTNER';
  premiumFlag: boolean;
  gourmetFlag: boolean;
  logo?: string;
  coverImage?: string;
  description?: string;
  cuisineTypes: string[];
  averageRating: number;
  totalRatings: number;
  isAcceptingOrders: boolean;
  operatingHours?: {
    lunch?: {
      startTime: string;  // Format: "HH:mm"
      endTime: string;
    };
    dinner?: {
      startTime: string;
      endTime: string;
    };
    onDemand?: {
      startTime: string;
      endTime: string;
      isAlwaysOpen: boolean;
    };
  };
  isTiffsyKitchen?: boolean;
  badges?: string[];
}

export interface KitchensForZoneResponse {
  success: boolean;
  message?: string;
  data: {
    tiffsyKitchens: KitchenInfo[];
    partnerKitchens: KitchenInfo[];
  } | KitchenInfo[]; // Support both old and new response formats
}

export interface AddonItem {
  _id: string;
  name: string;
  price: number;
  dietaryType: 'VEG' | 'NON-VEG' | 'VEGAN';
  description?: string;
  category?: string;
}

export interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  menuType: 'MEAL_MENU' | 'ON_DEMAND_MENU';
  mealWindow?: 'LUNCH' | 'DINNER';
  price: number;
  discountedPrice?: number;
  portionSize?: string;
  dietaryType: 'VEG' | 'NON-VEG' | 'VEGAN';
  spiceLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  includes?: string[];
  images?: string[];
  thumbnailImage?: string;
  isAvailable: boolean;
  isJainFriendly?: boolean;
  isFeatured?: boolean;
  cutoffTime?: string;
  isPastCutoff?: boolean;
  canUseVoucher?: boolean;
  canOrder?: boolean;
  voucherCutoffTime?: string;
  orderCutoffTime?: string;
  cutoffMessage?: string;
  addonIds?: AddonItem[];
}

export interface KitchenMenuResponse {
  success: boolean;
  data: {
    mealMenu: {
      lunch?: MenuItem;
      dinner?: MenuItem;
    };
    onDemandMenu: MenuItem[];
  };
}

export interface AddressKitchensResponse {
  success: boolean;
  message?: string;
  data: {
    address: {
      _id: string;
      label: string;
      zoneId: string;
    };
    tiffsyKitchens?: KitchenInfo[];
    partnerKitchens?: KitchenInfo[];
    kitchens?: KitchenInfo[]; // Legacy support
  };
}

export interface HomeFeedResponse {
  success: boolean;
  message: string;
  data: {
    address?: {
      id: string;
      label: string;
      addressLine1: string;
      locality: string;
      city: string;
    };
    kitchen?: KitchenData;
    _kitchenId?: string;
    alternativeKitchens?: KitchenData[];
    hasAlternatives?: boolean;
    mealWindow?: {
      current: string;
      isLunchActive: boolean;
      isDinnerActive: boolean;
    };
    menu?: {
      mealMenu?: {
        lunch?: any;
        dinner?: any;
      };
      onDemandMenu?: any[];
    };
    vouchers?: {
      lunch: number;
      dinner: number;
      total: number;
    };
    requiresAddressSetup?: boolean;
    isServiceable?: boolean;
  };
}

// ============================================
// COUPON TYPES
// ============================================

export type CouponDiscountType =
  | 'PERCENTAGE'
  | 'FLAT'
  | 'FREE_DELIVERY'
  | 'FREE_ADDON_COUNT'
  | 'FREE_ADDON_VALUE'
  | 'FREE_EXTRA_VOUCHER';

export interface Coupon {
  code: string;
  name: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  freeAddonCount?: number | null;
  freeAddonMaxValue?: number | null;
  extraVoucherCount?: number | null;
  applicableMenuTypes: ('MEAL_MENU' | 'ON_DEMAND_MENU')[];
  minOrderValue: number;
  termsAndConditions?: string | null;
  validTill: string;
  usesRemaining: number;
  bannerImage?: string | null;
}

export interface GetAvailableCouponsParams {
  kitchenId?: string;
  zoneId?: string;
  orderValue?: number;
  menuType?: 'MEAL_MENU' | 'ON_DEMAND_MENU';
}

export interface GetAvailableCouponsResponse {
  code: number;
  success: boolean;
  message: string;
  data: {
    coupons: Coupon[];
  };
}

export interface ValidateCouponRequest {
  code: string;
  kitchenId: string;
  zoneId: string;
  orderValue: number;
  itemCount: number;
  menuType: 'MEAL_MENU' | 'ON_DEMAND_MENU';
}

export type CouponRejectionReason =
  | 'INVALID_CODE'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'USER_LIMIT_EXCEEDED'
  | 'WRONG_MENU_TYPE'
  | 'KITCHEN_NOT_APPLICABLE'
  | 'ZONE_NOT_APPLICABLE'
  | 'MIN_ORDER_NOT_MET'
  | 'MIN_ITEMS_NOT_MET'
  | 'NEW_USERS_ONLY'
  | 'EXISTING_USERS_ONLY'
  | 'NOT_ELIGIBLE_USER'
  | 'FIRST_ORDER_ONLY';

export const COUPON_REJECTION_MESSAGES: Record<CouponRejectionReason, string> = {
  INVALID_CODE: 'Invalid coupon code',
  EXPIRED: 'This coupon has expired',
  EXHAUSTED: 'This coupon has been fully redeemed',
  INACTIVE: 'This coupon is not active',
  NOT_STARTED: 'This coupon is not yet valid',
  USER_LIMIT_EXCEEDED: "You've already used this coupon",
  WRONG_MENU_TYPE: 'This coupon is not valid for this order type',
  KITCHEN_NOT_APPLICABLE: 'This coupon is not valid for this kitchen',
  ZONE_NOT_APPLICABLE: 'This coupon is not valid in your area',
  MIN_ORDER_NOT_MET: 'Minimum order value not met',
  MIN_ITEMS_NOT_MET: 'Minimum items not met',
  NEW_USERS_ONLY: 'This coupon is for new users only',
  EXISTING_USERS_ONLY: 'This coupon is for existing users only',
  NOT_ELIGIBLE_USER: 'You are not eligible for this coupon',
  FIRST_ORDER_ONLY: 'This coupon is valid on first order only',
};

export interface ValidateCouponResponse {
  code: number;
  success: boolean;
  message: string;
  data: {
    valid: boolean;
    coupon: {
      code: string;
      name: string;
      discountType?: CouponDiscountType;
      discountValue?: number;
      freeAddonCount?: number | null;
      freeAddonMaxValue?: number | null;
      extraVoucherCount?: number | null;
      applicableMenuTypes?: ('MEAL_MENU' | 'ON_DEMAND_MENU')[];
    };
    discount: {
      type: string;
      value: number;
      amount: number;
    } | null;
    reason: CouponRejectionReason | null;
  };
}

// ============================================
// ORDER TYPES
// ============================================

export interface OrderItemAddon {
  addonId: string;
  quantity: number;
}

export interface OrderItem {
  menuItemId: string;
  quantity: number;
  addons?: OrderItemAddon[];
}

export interface CalculatePricingRequest {
  kitchenId: string;
  menuType: 'MEAL_MENU' | 'ON_DEMAND_MENU';
  mealWindow?: 'LUNCH' | 'DINNER';
  deliveryAddressId: string;
  items: OrderItem[];
  voucherCount: number;
  couponCode?: string | null;
}

export interface PricingItemAddon {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PricingItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  addons: PricingItemAddon[];
}

export interface PricingCharges {
  deliveryFee: number;
  serviceFee: number;
  packagingFee: number;
  handlingFee: number;
  platformFee: number;
  surgeFee: number;
  smallOrderFee: number;
  lateNightFee: number;
  taxAmount: number;
  taxBreakdown?: { taxType: string; rate: number; amount: number }[];
}

export interface VoucherCoverage {
  voucherCount: number;
  mainCoursesCovered: number;
  value: number;
}

export interface PricingDiscount {
  couponCode?: string;
  discountType?: CouponDiscountType;
  discountAmount?: number;
  addonDiscountAmount?: number;
  deliveryDiscount?: number;
  extraVouchersToIssue?: number;
  // Legacy fields for backward compatibility
  code?: string;
  type?: string;
  value?: number;
}

export interface PricingBreakdown {
  items: PricingItem[];
  subtotal: number;
  charges: PricingCharges;
  discount: PricingDiscount | null;
  voucherCoverage: VoucherCoverage | null;
  grandTotal: number;
  amountToPay: number;
}

export interface VoucherEligibility {
  available: number;
  canUse: number;
  cutoffPassed: boolean;
  orderCutoffPassed?: boolean;
  canOrder?: boolean;
  cutoffInfo: {
    cutoffTime: string;
    voucherCutoffTime?: string;
    orderCutoffTime?: string;
    currentTime: string;
    message: string;
  };
}

export interface CalculatePricingResponse {
  success: boolean;
  message: string;
  data: {
    breakdown: PricingBreakdown;
    voucherEligibility: VoucherEligibility;
  };
}

export interface CreateOrderRequest extends CalculatePricingRequest {
  specialInstructions?: string;
  deliveryNotes?: string;
  leaveAtDoor?: boolean;
  doNotContact?: boolean;
  confirmed?: boolean;
  paymentMethod:
    | 'UPI'
    | 'CARD'
    | 'WALLET'
    | 'NETBANKING'
    | 'VOUCHER_ONLY'
    | 'OTHER'
    | null;
}

export interface OrderVoucherUsage {
  voucherIds?: string[];
  voucherCount: number;
  mainCoursesCovered: number;
}

export type OrderStatus =
  | 'SCHEDULED'
  | 'PENDING_KITCHEN_ACCEPTANCE'
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'FAILED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface OrderRating {
  stars: number;
  comment?: string;
  ratedAt: string;
}

export interface KitchenSummary {
  _id: string;
  name: string;
  logo?: string;
  phone?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  userId: string;
  kitchenId: string | KitchenSummary;
  menuType: 'MEAL_MENU' | 'ON_DEMAND_MENU';
  mealWindow?: 'LUNCH' | 'DINNER';
  items: {
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    isMainCourse?: boolean; // True if this is a main course item (can be covered by voucher)
    addons?: {
      addonId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[];
  }[];
  subtotal: number;
  charges: PricingCharges;
  discount?: {
    couponId?: string;
    couponCode?: string;
    discountType?: CouponDiscountType;
    discountAmount?: number;
    addonDiscountAmount?: number;
    deliveryDiscount?: number;
    extraVouchersIssued?: number;
  };
  grandTotal: number;
  voucherUsage?: OrderVoucherUsage;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  status: OrderStatus;
  statusDisplay?: string; // Human-readable status text (e.g., "Meal is being prepared")
  placedAt: string;
  deliveryAddress: {
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    locality: string;
    city: string;
    pincode: string;
    contactName: string;
    contactPhone: string;
  };
  specialInstructions?: string;
  deliveryNotes?: string;
  leaveAtDoor?: boolean;
  doNotContact?: boolean;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  rating?: OrderRating;
  canCancel?: boolean;
  canRate?: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  isAutoOrder?: boolean;
  orderSource?: 'DIRECT' | 'SCHEDULED' | 'AUTO_ORDER';
  scheduledFor?: string;
  distanceMetadata?: {
    distanceFromKitchenKm?: number;
    acceptanceZone?: 'AUTO_ACCEPT' | 'MANUAL_ACCEPT';
    kitchenAcceptanceDeadline?: string;
    kitchenResponseAt?: string;
    autoRejectedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderResponse {
  success: boolean;
  message: string;
  data: {
    order: Order;
    cancelDeadline?: string;
    vouchersUsed: number;
    amountToPay: number;
    paymentRequired: boolean;
  };
}

export interface GetOrdersParams {
  status?: OrderStatus; // Single status value - backend doesn't support comma-separated values
  menuType?: 'MEAL_MENU' | 'ON_DEMAND_MENU';
  dateFrom?: string; // ISO 8601 date
  dateTo?: string; // ISO 8601 date
  page?: number; // Default: 1
  limit?: number; // Default: 20, max: 100
}

export interface GetOrdersResponse {
  success?: boolean;
  message?: string | boolean;
  data: {
    orders: Order[];
    activeOrders?: string[]; // IDs of active orders
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } | string;
  error?: {
    orders?: Order[];
    activeOrders?: string[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface OrderTimelineEvent {
  status: string;
  timestamp: string;
  message?: string;
}

export interface DriverInfo {
  name: string;
  phone: string;
  vehicleNumber?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface OrderTrackingData {
  status: OrderStatus;
  statusMessage: string;
  timeline: OrderTimelineEvent[];
  driver: DriverInfo | null;
  estimatedDelivery: string | null;
  canContactDriver: boolean;
  canContactKitchen: boolean;
  order?: Order;
  deliveryOtp?: string | null; // OTP for delivery verification - only present when status is PICKED_UP or OUT_FOR_DELIVERY
}

export interface OrderTrackingResponse {
  success?: boolean;
  message?: string;
  data: OrderTrackingData;
  error?: {
    code?: string;
  };
}

// ============================================
// SUBSCRIPTION & VOUCHER TYPES
// ============================================

export type SubscriptionBadge = 'BEST_VALUE' | 'POPULAR' | 'FAMILY';

export interface SubscriptionPlan {
  _id: string;
  name: string;
  description: string;
  durationDays: number;
  vouchersPerDay: number;
  totalVouchers: number;
  price: number;
  originalPrice: number;
  badge?: SubscriptionBadge;
  features: string[];
  displayOrder: number;
  applicableZoneIds?: string[];
}

export interface PlanSnapshot {
  name: string;
  durationDays: number;
  vouchersPerDay: number;
  totalVouchers: number;
  price: number;
}

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAUSED';

// Auto-ordering types
export type MealWindowType = 'LUNCH' | 'DINNER';

export interface SkippedSlot {
  date: string;
  mealWindow: MealWindowType;
  reason?: string;
  skippedAt: string;
}

// Weekly schedule types
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DayMealSchedule {
  lunch: boolean;  // REQUIRED: Backend will reject if missing
  dinner: boolean; // REQUIRED: Backend will reject if missing
}

export type WeeklySchedule = {
  [K in DayOfWeek]?: DayMealSchedule;
} | null;

export interface Subscription {
  _id: string;
  userId: string;
  planId:
    | string
    | {
        _id: string;
        name: string;
        durationDays?: number;
        badge?: SubscriptionBadge;
      };
  planSnapshot: PlanSnapshot;
  purchaseDate: string;
  startDate: string;
  endDate: string;
  totalVouchersIssued: number;
  vouchersUsed: number;
  vouchersRemaining?: number;
  daysRemaining?: number;
  voucherExpiryDate: string;
  status: SubscriptionStatus;
  amountPaid: number;
  paymentId?: string;
  paymentMethod?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  refundAmount?: number;
  // Auto-ordering fields
  autoOrderingEnabled?: boolean;
  isPaused?: boolean;
  pausedUntil?: string;
  skippedSlots?: SkippedSlot[];
  defaultKitchenId?: string;
  defaultAddressId?: string;
  weeklySchedule?: WeeklySchedule;
}

export type VoucherStatus =
  | 'AVAILABLE'
  | 'REDEEMED'
  | 'EXPIRED'
  | 'RESTORED'
  | 'CANCELLED';
export type VoucherMealType = 'LUNCH' | 'DINNER' | 'ANY';

export interface Voucher {
  _id: string;
  voucherCode: string;
  userId: string;
  subscriptionId: string;
  mealType: VoucherMealType;
  issuedDate: string;
  expiryDate: string;
  status: VoucherStatus;
  redeemedAt?: string;
  redeemedOrderId?: string;
  redeemedKitchenId?: string;
  redeemedMealWindow?: string;
  restoredAt?: string;
  restorationReason?: string;
}

export interface VoucherSummary {
  available: number;
  redeemed: number;
  expired: number;
  restored: number;
  total: number;
}

// Subscription API Response Types
export interface GetActivePlansResponse {
  success: boolean;
  message: string;
  data: {
    plans: SubscriptionPlan[];
  };
}

export interface PurchaseSubscriptionRequest {
  planId: string;
  paymentId?: string;
  paymentMethod?: 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'OTHER';
}

export interface PurchaseSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    subscription: Subscription;
    vouchersIssued: number;
    voucherExpiryDate: string;
  };
}

export interface GetMySubscriptionsParams {
  status?: SubscriptionStatus;
  page?: number;
  limit?: number;
}

export interface ActiveSubscriptionSummary {
  _id: string;
  planName: string;
  vouchersRemaining: number;
  daysRemaining: number;
  expiryDate: string;
}

export interface GetMySubscriptionsResponse {
  success: boolean;
  message: string;
  data: {
    subscriptions: Subscription[];
    activeSubscription: ActiveSubscriptionSummary | null;
    totalVouchersAvailable: number;
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
}

export interface CancelSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    subscription: Subscription;
    vouchersCancelled: number;
    refundEligible: boolean;
    refundAmount: number | null;
    refundReason: string;
  };
}

// Voucher API Response Types
export interface GetMyVouchersParams {
  status?: VoucherStatus;
  page?: number;
  limit?: number;
}

export interface GetMyVouchersResponse {
  success: boolean;
  message?: string;
  data: {
    vouchers: Voucher[];
    summary: VoucherSummary;
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
}

export interface CheckVoucherEligibilityRequest {
  kitchenId: string;
  menuType: 'MEAL_MENU' | 'ON_DEMAND_MENU';
  mealWindow: 'LUNCH' | 'DINNER';
  mainCourseQuantity: number;
}

export interface VoucherCutoffInfo {
  isPastCutoff: boolean;
  cutoffTime: string;
  message: string;
}

export interface CheckVoucherEligibilityResponse {
  success: boolean;
  data: {
    canUseVoucher: boolean;
    availableVouchers: number;
    maxRedeemable: number;
    cutoffInfo?: VoucherCutoffInfo;
    reason?: string;
  };
}

// Voucher Balance Types (from consumer-checkout-api.md)
export interface VoucherBalance {
  total: number;
  available: number;
  redeemed: number;
  expired: number;
  restored: number;
  cancelled: number;
}

export interface ExpiringVouchers {
  count: number;
  date: string;
  daysRemaining: number;
}

export interface NextCutoff {
  mealWindow: 'LUNCH' | 'DINNER';
  cutoffTime: string;
  isPastCutoff: boolean;
  message: string;
}

export interface GetVoucherBalanceResponse {
  message: string;
  data: {
    balance: VoucherBalance;
    expiringNext: ExpiringVouchers | null;
    canRedeemToday: boolean;
    nextCutoff: NextCutoff;
  };
}

// ============================================
// AUTO-ORDERING API TYPES (Per-Address Multi-Config)
// ============================================

// Per-address auto-order config (from configs[] array)
export interface AutoOrderAddressConfig {
  _id: string;
  addressId: string;
  address: { addressLine1: string; city: string };
  enabled: boolean;
  weeklySchedule: WeeklySchedule;
  kitchen: { _id: string; name: string } | null;
  addons: Array<{
    addonId: string;
    name: string;
    price: number;
    quantity: number;
    isAvailable?: boolean;
  }>;
  isPaused: boolean;
  pausedUntil: string | null;
  skippedSlots: SkippedSlot[];
}

// GET /api/scheduling/auto-order/settings (no addressId) → all configs
export interface AutoOrderSettingsMultiResponse {
  success: boolean;
  message: string;
  data: {
    autoOrderingEnabled: boolean;
    isPaused: boolean;
    pausedUntil: string | null;
    skippedSlots: SkippedSlot[];
    configs: AutoOrderAddressConfig[];
  };
}

// GET /api/scheduling/auto-order/settings?addressId=X → single config
export interface AutoOrderSettingsSingleResponse {
  success: boolean;
  message: string;
  data: {
    autoOrderingEnabled: boolean;
    isPaused: boolean;
    config: AutoOrderAddressConfig;
  };
}

// PUT /api/scheduling/auto-order/settings
export interface UpdateAutoOrderConfigRequest {
  addressId: string;
  autoOrderingEnabled?: boolean;
  enabled?: boolean;
  kitchenId?: string | null;
  weeklySchedule?: WeeklySchedule;
  addons?: Array<{ addonId: string; quantity: number }>;
}

export interface UpdateAutoOrderConfigResponse {
  success: boolean;
  message: string;
  data: {
    autoOrderingEnabled: boolean;
    config: AutoOrderAddressConfig;
  };
}

// POST /api/scheduling/auto-order/pause
export interface PauseAutoOrderRequest {
  addressId?: string; // Optional: omit for global pause
  pauseUntil?: string; // ISO date string
  pauseReason?: string; // Max 500 characters
}

export interface PauseAutoOrderResponse {
  success: boolean;
  message: string;
  data: {
    isPaused: boolean;
    pausedUntil: string | null;
    message: string;
  };
}

// POST /api/scheduling/auto-order/resume
export interface ResumeAutoOrderResponse {
  success: boolean;
  message: string;
  data: {
    isPaused: boolean;
    autoOrderingEnabled: boolean;
    message: string;
  };
}

// POST /api/scheduling/auto-order/skip-meal
export interface SkipMealRequest {
  addressId: string;
  date: string; // ISO date string - cannot be in the past
  mealWindow: MealWindowType;
  reason?: string; // Max 200 characters
}

export interface SkipMealResponse {
  success: boolean;
  message: string;
  data: {
    skippedSlot: {
      date: string;
      mealWindow: MealWindowType;
      reason: string | null;
    };
    totalSkippedSlots: number;
  };
}

// POST /api/scheduling/auto-order/unskip-meal
export interface UnskipMealRequest {
  addressId: string;
  date: string; // ISO date string
  mealWindow: MealWindowType;
}

export interface UnskipMealResponse {
  success: boolean;
  message: string;
  data: {
    unskippedSlot: {
      date: string;
      mealWindow: MealWindowType;
    };
    totalSkippedSlots: number;
  };
}

// DELETE /api/scheduling/auto-order/config/:addressId
export interface DeleteAutoOrderConfigResponse {
  success: boolean;
  message: string;
}

// GET /api/scheduling/auto-order/schedule?addressId=X
export interface AutoOrderScheduleDay {
  date: string;
  dayName: string;
  lunch: { scheduled: boolean; skipped: boolean };
  dinner: { scheduled: boolean; skipped: boolean };
}

export interface AutoOrderScheduleResponse {
  success: boolean;
  message: string;
  data: {
    autoOrderingEnabled: boolean;
    isPaused: boolean;
    pausedUntil: string | null;
    configAddressId?: string;
    configEnabled?: boolean;
    configIsPaused?: boolean;
    schedule: AutoOrderScheduleDay[];
  };
}

/**
 * Helper function to extract kitchens from API response
 * Handles both old (single array) and new (separate arrays) response formats
 */
export const extractKitchensFromResponse = (
  response: AddressKitchensResponse | KitchensForZoneResponse
): KitchenInfo[] => {
  const data = response.data;

  // Handle new format with separate arrays
  if ('tiffsyKitchens' in data || 'partnerKitchens' in data) {
    const tiffsyKitchens = (data as any).tiffsyKitchens || [];
    const partnerKitchens = (data as any).partnerKitchens || [];
    return [...tiffsyKitchens, ...partnerKitchens];
  }

  // Handle old format with single array
  if ('kitchens' in data) {
    return (data as any).kitchens || [];
  }

  // Handle direct array format
  if (Array.isArray(data)) {
    return data;
  }

  return [];
};

// ============================================
// SCHEDULED MEAL TYPES
// ============================================

export interface ScheduledMealSlot {
  date: string;
  dayName: string;
  mealWindow: 'LUNCH' | 'DINNER';
  status: 'available' | 'cutoff_passed' | 'auto_order_active' | 'already_scheduled' | 'already_ordered' | 'not_serviceable' | 'no_kitchen';
  reason: string | null;
}

export interface ScheduledMealPricingData {
  kitchen: { id: string; name: string; logo?: string };
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    isMainCourse: boolean;
    addons: Array<{
      addonId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }>;
  pricing: {
    subtotal: number;
    mainCoursesTotal: number;
    addonsTotal: number;
    charges: {
      deliveryFee: number;
      serviceFee: number;
      packagingFee: number;
      handlingFee: number;
      taxAmount: number;
      taxBreakdown: Array<{ taxType: string; rate: number; amount: number }>;
    };
    discount: {
      couponCode: string;
      discountType: string;
      discountAmount: number;
      addonDiscountAmount?: number;
      deliveryDiscount?: number;
      extraVouchersToIssue?: number;
    } | null;
    voucherCoverage?: {
      voucherCount: number;
      mainCoursesCovered: number;
      value: number;
      coversAddons: boolean;
    } | null;
    grandTotal: number;
    amountToPay: number;
    requiresPayment: boolean;
  };
}

export interface ScheduledMealOrderData {
  order: {
    id?: string;
    _id?: string;
    orderNumber: string;
    status: 'SCHEDULED' | 'PLACED';
    paymentStatus: 'PENDING' | 'PAID';
    mealWindow: 'LUNCH' | 'DINNER';
    scheduledFor: string;
    kitchen: { id: string; name: string };
    menuItem: { id: string; name: string };
    pricing: {
      subtotal: number;
      charges: {
        deliveryFee: number;
        serviceFee: number;
        packagingFee: number;
        handlingFee: number;
        taxAmount: number;
        taxBreakdown: any[];
      };
      discount: {
        couponCode: string;
        discountType: string;
        discountAmount: number;
        addonDiscountAmount?: number;
        deliveryDiscount?: number;
      } | null;
      voucherCoverage?: {
        voucherCount: number;
        mainCoursesCovered: number;
        value: number;
      } | null;
      grandTotal: number;
      amountToPay: number;
    };
  };
  paymentRequired: boolean;
}

export interface ScheduledMealListItem {
  _id: string;
  orderNumber: string;
  orderSource?: 'DIRECT' | 'SCHEDULED' | 'AUTO_ORDER';
  status: string;
  paymentStatus: string;
  mealWindow: 'LUNCH' | 'DINNER';
  menuType: string;
  scheduledFor: string;
  isScheduledMeal: boolean;
  voucherUsage?: { voucherCount: number; mainCoursesCovered: number };
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    isMainCourse: boolean;
    addons: any[];
  }>;
  subtotal: number;
  charges: {
    deliveryFee: number;
    serviceFee: number;
    packagingFee: number;
    handlingFee: number;
    taxAmount: number;
  };
  grandTotal: number;
  amountPaid: number;
  kitchenId: { _id: string; name: string; logo?: string };
  deliveryAddress: {
    addressLine1: string;
    locality: string;
    city: string;
    pincode: string;
  };
  specialInstructions?: string;
  placedAt: string;
  createdAt: string;
}

export interface CancelScheduledMealData {
  orderId: string;
  orderNumber: string;
  refundInitiated: boolean;
  vouchersRestored?: number;
  warning: string | null;
}

// Bulk scheduling types
export interface BulkSlotInput {
  date: string;      // ISO date YYYY-MM-DD
  mealWindow: 'LUNCH' | 'DINNER';
  addons?: Array<{ addonId: string; quantity: number }>;
}

export interface BulkSlotPricing {
  date: string;
  mealWindow: 'LUNCH' | 'DINNER';
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    isMainCourse: boolean;
    addons: Array<{
      addonId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }>;
  pricing: {
    subtotal: number;
    mainCoursesTotal: number;
    addonsTotal: number;
    charges: {
      deliveryFee: number;
      serviceFee: number;
      packagingFee: number;
      handlingFee: number;
      taxAmount: number;
    };
    discount?: {
      couponCode: string;
      discountType: string;
      discountAmount: number;
      addonDiscountAmount: number;
      deliveryDiscount: number;
      extraVouchersToIssue: number;
    } | null;
    voucherCoverage?: {
      voucherCount: number;
      mainCoursesCovered: number;
      value: number;
    } | null;
    grandTotal: number;
    amountToPay: number;
  };
}

export interface BulkPricingData {
  totalSlots: number;
  kitchen: { id: string; name: string };
  perSlotBreakdown: BulkSlotPricing[];
  summary: {
    totalSubtotal: number;
    totalAddons: number;
    totalCharges: number;
    totalDiscount: number;
    totalExtraVouchers: number;
    appliedCouponType?: string | null;
    vouchersApplied: number;
    voucherSavings: number;
    totalAmountToPay: number;
  };
  vouchers: {
    available: number;
    toUse: number;
    remainingAfter: number;
  };
  conflicts: {
    duplicates: Array<{ date: string; mealWindow: string; existingOrderNumber: string }>;
    autoOrderConflicts: Array<{ date: string; mealWindow: string; reason: string }>;
  };
}

export interface BulkScheduleOrderItem {
  id: string;
  orderNumber: string;
  date: string;
  mealWindow: 'LUNCH' | 'DINNER';
  status: string;
  amountToPay: number;
}

export interface BulkScheduleResult {
  batchId: string;
  orders: BulkScheduleOrderItem[];
  totalOrders: number;
  paymentRequired: boolean;
  payment?: {
    razorpayOrderId: string;
    amount: number;
    amountRupees: number;
    key: string;
    currency: string;
    prefill: { name: string; contact: string; email?: string };
  };
}

// ============================================
// AUTO-ORDER ADDON TYPES
// ============================================

export interface AutoOrderAddonSlot {
  date: string;                // "YYYY-MM-DD"
  dayName: string;             // e.g. "Monday"
  mealWindow: 'LUNCH' | 'DINNER';
  addressId: string;
  isPaid: boolean;             // true if an existing PAID selection exists
  existingAddons: Array<{
    addonId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  addonsCost: number;          // cost of existing paid selection (0 if not paid)
}

export interface AutoOrderAddonPricingData {
  slots: Array<{
    date: string;
    mealWindow: string;
    addons: Array<{
      addonId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    addonsCost: number;
  }>;
  grandTotal: number;
  kitchenId: string;
}

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Local reference for use in interceptor arrow functions
    const api = this.api;

    // Request interceptor to add JWT auth token and log requests
    this.api.interceptors.request.use(
      async config => {
        // Proactively refresh if the stored token is within 5 minutes of expiry.
        // Skip the refresh endpoint itself to avoid recursion.
        const isRefreshCall = config.url === '/api/auth/token/refresh';
        if (!isRefreshCall && (await isTokenExpiringSoon())) {
          try {
            await refreshAuthToken(BASE_URL);
          } catch (e) {
            // Don't block the request — let it go out with the existing token.
            // The response interceptor handles 401 via the same singleton refresh.
          }
        }

        const token = await getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Log raw request
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
        console.log('[API] Request:', JSON.stringify({
          url: (config.baseURL || '') + (config.url || ''),
          method: config.method?.toUpperCase(),
          data: config.data,
          params: config.params,
        }, null, 2));
        return config;
      },
      error => {
        console.log('[API] Request Error:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor for error handling and logging
    this.api.interceptors.response.use(
      response => {
        // Log raw response
        console.log(`[API] Response ${response.status}:`, JSON.stringify(response.data, null, 2));
        return response.data;
      },
      async error => {
        // Log error response
        console.log(`[API] Error ${error.response?.status}:`, JSON.stringify(error.response?.data, null, 2));

        // Handle 401 — attempt a single coalesced token refresh.
        // Don't try to refresh failures from the refresh endpoint itself.
        const isRefreshCall = error.config?.url === '/api/auth/token/refresh';
        if (
          error.response?.status === 401 &&
          error.config &&
          !error.config._retry &&
          !isRefreshCall
        ) {
          error.config._retry = true;
          try {
            const newToken = await refreshAuthToken(BASE_URL);
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(error.config);
          } catch (refreshError: any) {
            if (
              refreshError instanceof AuthRefreshError &&
              refreshError.kind === 'auth'
            ) {
              // Definitive auth failure — session is gone, clear and notify UI.
              console.log('[API] Token refresh definitively rejected, clearing token');
              await clearAuthToken();
              authEvents.emitAuthExpired();
            } else {
              // Transient failure (network/5xx/timeout) — keep the token so the
              // user can retry. Just fail this individual request.
              console.log(
                '[API] Token refresh transient failure, keeping session:',
                refreshError?.message,
              );
            }
          }
        }

        if (error.response) {
          return Promise.reject(error.response.data);
        } else if (error.request) {
          return Promise.reject({
            success: false,
            message: 'Network error. Please check your connection.',
            data: { error: 'NETWORK_ERROR' },
          });
        } else {
          return Promise.reject({
            success: false,
            message: 'An unexpected error occurred.',
            data: { error: 'UNKNOWN_ERROR' },
          });
        }
      },
    );
  }

  // ============================================
  // AUTH ENDPOINTS (MSG91 OTP)
  // ============================================

  // Send OTP to phone number via MSG91
  async sendOTP(phone: string): Promise<{ success: boolean; message: string }> {
    return this.api.post('/api/auth/send-otp', { phone });
  }

  // Verify OTP and authenticate/sync user
  async verifyOTP(phone: string, otp: string): Promise<{
    success: boolean;
    message: string;
    data: {
      user: UserData | null;
      token?: string;
      expiresIn?: number;
      registrationToken?: string;
      isNewUser: boolean;
      isProfileComplete: boolean;
      approvalStatus?: string;
      rejectionReason?: string;
    };
  }> {
    return this.api.post('/api/auth/verify-otp', { phone, otp });
  }

  // Resend OTP via MSG91
  async resendOTP(phone: string, retryType?: 'text' | 'voice'): Promise<{ success: boolean; message: string }> {
    return this.api.post('/api/auth/resend-otp', { phone, retryType });
  }

  // Register new customer after OTP verification
  async registerUser(data: {
    name: string;
    email?: string;
    dietaryPreferences?: string[];
    referralCode?: string;
  }, registrationToken: string): Promise<RegisterUserResponse> {
    return this.api.post('/api/auth/otp/register', data, {
      headers: { Authorization: `Bearer ${registrationToken}` },
    });
  }

  // Refresh JWT token
  async refreshToken(): Promise<{
    success: boolean;
    data: { token: string; expiresIn: number };
  }> {
    return this.api.post('/api/auth/token/refresh', {});
  }

  // Update profile for existing users (call when sync returns isProfileComplete: false)
  async updateProfile(data: {
    name: string;
    email?: string;
    dietaryPreferences?: string[];
    profileImage?: string;
  }): Promise<UpdateProfileResponse> {
    return this.api.put('/api/auth/profile', data);
  }

  // Register FCM token for push notifications
  async registerFcmToken(data: {
    fcmToken: string;
    deviceType: 'ANDROID' | 'IOS';
    deviceId: string;
  }): Promise<FcmTokenResponse> {
    return this.api.post('/api/auth/fcm-token', data);
  }

  // Remove FCM token on logout
  async removeFcmToken(fcmToken: string): Promise<FcmTokenResponse> {
    return this.api.delete('/api/auth/fcm-token', { data: { fcmToken } });
  }

  // ============================================
  // ADDRESS ENDPOINTS
  // ============================================

  // Check if pincode is serviceable (no auth required)
  async checkServiceability(pincode: string): Promise<ZoneLookupResponse> {
    return this.api.get(`/api/zones/lookup/${pincode}`);
  }

  // Legacy serviceability check (POST method)
  async checkServiceabilityPost(
    pincode: string,
  ): Promise<ServiceabilityResponse> {
    return this.api.post('/api/customer/check-serviceability', { pincode });
  }

  // Get all addresses for the user
  async getAddresses(): Promise<GetAddressesResponse> {
    return this.api.get('/api/address');
  }

  // Get a single address by ID
  async getAddress(addressId: string): Promise<UpdateAddressResponse> {
    return this.api.get(`/api/address/${addressId}`);
  }

  // Create a new delivery address
  async createAddress(address: AddressData): Promise<CreateAddressResponse> {
    return this.api.post('/api/address', address);
  }

  // Update an existing address
  async updateAddress(
    addressId: string,
    address: Partial<AddressData>,
  ): Promise<UpdateAddressResponse> {
    return this.api.put(`/api/address/${addressId}`, address);
  }

  // Delete an address
  async deleteAddress(addressId: string): Promise<DeleteAddressResponse> {
    return this.api.delete(`/api/address/${addressId}`);
  }

  // Set an address as default
  async setDefaultAddress(addressId: string): Promise<UpdateAddressResponse> {
    return this.api.patch(`/api/address/${addressId}/default`, {});
  }

  // Get kitchens serving a specific address (authenticated)
  async getAddressKitchens(
    addressId: string,
    menuType?: 'MEAL_MENU' | 'ON_DEMAND_MENU',
  ): Promise<AddressKitchensResponse> {
    const params = menuType ? { menuType } : undefined;
    return this.api.get(`/api/address/${addressId}/kitchens`, { params });
  }

  // ============================================
  // ZONE & KITCHEN ENDPOINTS
  // ============================================

  // Get zone info by pincode (public, no auth)
  async getZoneByPincode(pincode: string): Promise<ZoneLookupFullResponse> {
    return this.api.get(`/api/zones/lookup/${pincode}`);
  }

  // Get all kitchens serving a zone (public, no auth)
  async getKitchensForZone(
    zoneId: string,
    menuType?: 'MEAL_MENU' | 'ON_DEMAND_MENU',
  ): Promise<KitchensForZoneResponse> {
    const params = menuType ? { menuType } : undefined;
    return this.api.get(`/api/kitchens/zone/${zoneId}`, { params });
  }

  // ============================================
  // MENU ENDPOINTS
  // ============================================

  // Get complete menu for a kitchen (public, no auth)
  async getKitchenMenu(
    kitchenId: string,
    menuType?: 'MEAL_MENU' | 'ON_DEMAND_MENU',
  ): Promise<KitchenMenuResponse> {
    const params = menuType ? { menuType } : undefined;
    return this.api.get(`/api/menu/kitchen/${kitchenId}`, { params });
  }

  // Get meal menu for specific window (LUNCH/DINNER)
  async getMealMenu(
    kitchenId: string,
    mealWindow: 'LUNCH' | 'DINNER',
  ): Promise<{ success: boolean; data: MenuItem }> {
    return this.api.get(`/api/menu/kitchen/${kitchenId}/meal/${mealWindow}`);
  }

  // Legacy: Get home feed (deprecated - use new flow)
  async getHomeFeed(params?: {
    addressId?: string;
    kitchenId?: string;
  }): Promise<HomeFeedResponse> {
    return this.api.get('/api/customer/home', { params });
  }

  // ============================================
  // COUPON ENDPOINTS
  // ============================================

  // Get available coupons for the current user
  async getAvailableCoupons(
    params?: GetAvailableCouponsParams,
  ): Promise<GetAvailableCouponsResponse> {
    return this.api.get('/api/coupons/available', { params });
  }

  // Validate a coupon code for the current order context
  async validateCoupon(
    data: ValidateCouponRequest,
  ): Promise<ValidateCouponResponse> {
    return this.api.post('/api/coupons/validate', data);
  }

  // ============================================
  // LEGACY ENDPOINTS (for backward compatibility)
  // ============================================

  // Get customer profile status (deprecated - use syncUser)
  async getCustomerStatus() {
    return this.api.get('/api/auth/customer/status');
  }

  // Get comprehensive customer profile (deprecated - use syncUser)
  async getCustomerProfile() {
    return this.api.get('/api/auth/customer/profile');
  }

  // Complete customer onboarding (deprecated - use updateProfile)
  async completeOnboarding(data: {
    name: string;
    email?: string;
    dietaryPreferences?: {
      foodType?: 'VEG' | 'NON-VEG' | 'VEGAN';
      eggiterian?: boolean;
      jainFriendly?: boolean;
      dabbaType?: 'DISPOSABLE' | 'STEEL DABBA';
      spiceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
    };
  }) {
    return this.api.put('/api/auth/customer/onboarding', data);
  }

  // Request account deletion
  async deleteAccount() {
    return this.api.delete('/api/auth/customer/delete-account');
  }

  // ============================================
  // ORDER ENDPOINTS
  // ============================================

  // Calculate pricing for cart preview (validates items, checks voucher eligibility)
  async calculatePricing(
    data: CalculatePricingRequest,
  ): Promise<CalculatePricingResponse> {
    return this.api.post('/api/orders/calculate-pricing', data);
  }

  // Create a new order
  async createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    return this.api.post('/api/orders', data);
  }

  // Get user's orders (with optional filters)
  async getMyOrders(params?: GetOrdersParams): Promise<GetOrdersResponse> {
    return this.api.get('/api/orders/my-orders', { params });
  }

  // Get single order details
  // Backend returns the order plus kitchen, statusTimeline, delivery, deliveryOtp,
  // vouchersUsed, couponApplied alongside it (see order.controller.js:840).
  async getOrder(orderId: string): Promise<{
    success: boolean;
    message: string;
    data: { order: Order } & Record<string, unknown>;
  }> {
    return this.api.get(`/api/orders/${orderId}`);
  }

  // Track order status and timeline
  async trackOrder(orderId: string): Promise<OrderTrackingResponse> {
    return this.api.get(`/api/orders/${orderId}/track`);
  }

  // Cancel an order (if allowed by business rules)
  async cancelOrder(
    orderId: string,
    reason: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      order: Order;
      refundInitiated: boolean;
      vouchersRestored: number;
      message: string;
    };
  }> {
    return this.api.patch(`/api/orders/${orderId}/customer-cancel`, { reason });
  }

  // Rate a delivered order
  async rateOrder(
    orderId: string,
    stars: number,
    comment?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      order: Order;
    };
  }> {
    return this.api.post(`/api/orders/${orderId}/rate`, { stars, comment });
  }

  // ============================================
  // SUBSCRIPTION ENDPOINTS
  // ============================================

  // Get all active subscription plans
  async getActivePlans(zoneId?: string): Promise<GetActivePlansResponse> {
    const params = zoneId ? { zoneId } : undefined;
    return this.api.get('/api/subscriptions/plans/active', { params });
  }

  // Purchase a subscription plan
  async purchaseSubscription(
    data: PurchaseSubscriptionRequest,
  ): Promise<PurchaseSubscriptionResponse> {
    return this.api.post('/api/subscriptions/purchase', data);
  }

  // Get user's subscriptions
  async getMySubscriptions(
    params?: GetMySubscriptionsParams,
  ): Promise<GetMySubscriptionsResponse> {
    return this.api.get('/api/subscriptions/my-subscriptions', { params });
  }

  // Cancel a subscription
  async cancelSubscription(
    subscriptionId: string,
    reason?: string,
  ): Promise<CancelSubscriptionResponse> {
    return this.api.post(`/api/subscriptions/${subscriptionId}/cancel`, {
      reason,
    });
  }

  // ============================================
  // AUTO-ORDERING ENDPOINTS (Per-Address Multi-Config)
  // ============================================

  // Get all auto-order configs (dashboard view)
  async getAllAutoOrderConfigs(): Promise<AutoOrderSettingsMultiResponse> {
    console.log('[ApiService] getAllAutoOrderConfigs - Request');
    const response = await this.api.get('/api/scheduling/auto-order/settings');
    console.log('[ApiService] getAllAutoOrderConfigs - Response:', JSON.stringify(response, null, 2));
    return response;
  }

  // Get single auto-order config for a specific address
  async getAutoOrderConfigForAddress(addressId: string): Promise<AutoOrderSettingsSingleResponse> {
    console.log('[ApiService] getAutoOrderConfigForAddress - Request:', { addressId });
    const response = await this.api.get('/api/scheduling/auto-order/settings', { params: { addressId } });
    console.log('[ApiService] getAutoOrderConfigForAddress - Response:', JSON.stringify(response, null, 2));
    return response;
  }

  // Get 14-day schedule for a specific address
  async getAutoOrderSchedule(addressId: string): Promise<AutoOrderScheduleResponse> {
    console.log('[ApiService] getAutoOrderSchedule - Request:', { addressId });
    const response = await this.api.get('/api/scheduling/auto-order/schedule', { params: { addressId } });
    console.log('[ApiService] getAutoOrderSchedule - Response:', JSON.stringify(response, null, 2));
    return response;
  }

  // Create or update auto-order config for an address
  async updateAutoOrderConfig(
    data: UpdateAutoOrderConfigRequest,
  ): Promise<UpdateAutoOrderConfigResponse> {
    // Strip empty/falsy addressId so the backend doesn't reject it
    const payload = { ...data };
    if (!payload.addressId) {
      delete (payload as any).addressId;
    }
    console.log('[ApiService] updateAutoOrderConfig - Request:', { data: payload });
    const response = await this.api.put('/api/scheduling/auto-order/settings', payload);
    console.log('[ApiService] updateAutoOrderConfig - Response:', JSON.stringify(response, null, 2));
    return response;
  }

  // Pause auto-ordering (global or per-address)
  async pauseAutoOrder(
    data?: PauseAutoOrderRequest,
  ): Promise<PauseAutoOrderResponse> {
    console.log('[ApiService] pauseAutoOrder - Request:', { data: data || {} });
    const response = await this.api.post('/api/scheduling/auto-order/pause', data || {});
    console.log('[ApiService] pauseAutoOrder - Response:', JSON.stringify(response, null, 2));
    return response;
  }

  // Resume auto-ordering (global or per-address)
  async resumeAutoOrder(addressId?: string): Promise<ResumeAutoOrderResponse> {
    console.log('[ApiService] resumeAutoOrder - Request:', { addressId });
    const response = await this.api.post('/api/scheduling/auto-order/resume', addressId ? { addressId } : {});
    console.log('[ApiService] resumeAutoOrder - Response:', JSON.stringify(response, null, 2));
    return response;
  }

  // Delete an auto-order config for an address
  async deleteAutoOrderConfig(addressId: string): Promise<DeleteAutoOrderConfigResponse> {
    console.log('[ApiService] deleteAutoOrderConfig - Request:', { addressId });
    const response = await this.api.delete(`/api/scheduling/auto-order/config/${addressId}`);
    console.log('[ApiService] deleteAutoOrderConfig - Response:', JSON.stringify(response, null, 2));
    return response;
  }

  // Skip auto-ordering for a specific meal slot
  async skipMeal(
    data: SkipMealRequest,
  ): Promise<SkipMealResponse> {
    console.log('[ApiService] skipMeal - Request:', { data });
    const response = await this.api.post('/api/scheduling/auto-order/skip-meal', data);
    console.log('[ApiService] skipMeal - Response:', JSON.stringify(response, null, 2));
    return response;
  }

  // Remove a meal from skipped slots (re-enable auto-ordering for that slot)
  async unskipMeal(
    data: UnskipMealRequest,
  ): Promise<UnskipMealResponse> {
    console.log('[ApiService] unskipMeal - Request:', { data });
    const response = await this.api.post('/api/scheduling/auto-order/unskip-meal', data);
    console.log('[ApiService] unskipMeal - Response:', JSON.stringify(response, null, 2));
    return response;
  }

  // ============================================
  // VOUCHER ENDPOINTS
  // ============================================

  // Get voucher balance summary
  async getVoucherBalance(): Promise<GetVoucherBalanceResponse> {
    return this.api.get('/api/vouchers/balance');
  }

  // Get user's vouchers
  async getMyVouchers(
    params?: GetMyVouchersParams,
  ): Promise<GetMyVouchersResponse> {
    return this.api.get('/api/vouchers/my-vouchers', { params });
  }

  // Check voucher eligibility for an order
  async checkVoucherEligibility(
    data: CheckVoucherEligibilityRequest,
  ): Promise<CheckVoucherEligibilityResponse> {
    return this.api.post('/api/vouchers/check-eligibility', data);
  }

  // ============================================
  // CUSTOMER PROFILE ENDPOINTS
  // ============================================

  // Get current user profile
  async getProfile(): Promise<{
    message: string;
    data: { user: UserData };
  }> {
    return this.api.get('/api/customer/profile');
  }

  // Check if profile is complete
  async getProfileStatus(): Promise<{
    message: string;
    data: {
      isComplete: boolean;
      missingFields: string[];
      profile: UserData | null;
    };
  }> {
    return this.api.get('/api/customer/profile/status');
  }

  // Complete profile after signup
  async completeProfile(data: {
    name: string;
    email?: string;
    dietaryPreferences?: string[];
    referralCode?: string;
  }): Promise<{
    message: string;
    data: { user: UserData; referral?: { success: boolean; error?: string } };
  }> {
    return this.api.post('/api/customer/profile/complete', data);
  }

  // Update profile details (full update)
  async updateCustomerProfile(data: {
    name?: string;
    email?: string;
    dietaryPreferences?: string[];
    profileImage?: string;
  }): Promise<{
    message: string;
    data: { user: UserData };
  }> {
    return this.api.put('/api/customer/profile', data);
  }

  // Update only dietary preferences
  async updateDietaryPreferences(
    dietaryPreferences: string[],
  ): Promise<{
    message: string;
    data: { user: { _id: string; dietaryPreferences: string[] } };
  }> {
    return this.api.patch('/api/customer/profile/dietary-preferences', {
      dietaryPreferences,
    });
  }

  // Update profile image URL
  async updateProfileImage(profileImage: string): Promise<{
    message: string;
    data: { user: { _id: string; profileImage: string } };
  }> {
    return this.api.patch('/api/customer/profile/image', { profileImage });
  }

  // Delete account with confirmation
  async deleteAccountWithConfirmation(data: {
    reason?: string;
    confirmPhone: string;
  }): Promise<{
    message: string;
    data: null;
    error?: { code: string; activeOrderCount?: number };
  }> {
    return this.api.delete('/api/customer/profile', { data });
  }

  // Upload file to cloud storage
  async uploadFile(
    file: { uri: string; type: string; name: string },
    folder?: string,
  ): Promise<{
    message: string;
    data: {
      files: Array<{
        url: string;
        publicId: string;
        format: string;
        resourceType: string;
        bytes: number;
        width: number;
        height: number;
        createdAt: string;
      }>;
      count: number;
    };
  }> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    const url = folder ? `/api/upload?folder=${folder}` : '/api/upload';
    return this.api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // ============================================
  // PAYMENT ENDPOINTS
  // ============================================

  // Get Razorpay payment configuration
  async getPaymentConfig(): Promise<{
    success: boolean;
    message: string;
    data: {
      available: boolean;
      key: string | null;
      currency: string;
      provider: string;
    };
  }> {
    return this.api.get('/api/payment/config');
  }

  // Initiate payment for an order
  async initiateOrderPayment(orderId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      razorpayOrderId: string;
      amount: number;
      currency: string;
      key: string;
      orderId: string;
      orderNumber: string;
      expiresAt: string;
      prefill: {
        name: string;
        contact: string;
        email?: string;
      };
    };
  }> {
    return this.api.post(`/api/payment/order/${orderId}/initiate`);
  }

  // Cancel an in-flight order payment (call when Razorpay modal is dismissed
  // or the SDK errors — flips the order to FAILED instantly).
  async cancelOrderPayment(orderId: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    data?: { orderId: string; alreadyFailed?: boolean };
  }> {
    return this.api.post(`/api/payment/order/${orderId}/cancel`, { reason });
  }

  // Initiate payment for subscription purchase
  async initiateSubscriptionPayment(planId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      razorpayOrderId: string;
      amount: number;
      currency: string;
      key: string;
      planId: string;
      planName: string;
      expiresAt: string;
      prefill: {
        name: string;
        contact: string;
        email?: string;
      };
    };
  }> {
    return this.api.post('/api/payment/subscription/initiate', { planId });
  }

  // Verify payment after Razorpay checkout
  async verifyPayment(data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      success: boolean;
      status: string;
      purchaseType: 'ORDER' | 'SUBSCRIPTION';
      referenceId: string;
      paymentId: string;
    };
  }> {
    return this.api.post('/api/payment/verify', data);
  }

  // Get payment status by Razorpay order ID
  async getPaymentStatus(razorpayOrderId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      razorpayOrderId: string;
      razorpayPaymentId: string | null;
      status: string;
      amount: number;
      amountRupees: number;
      paymentMethod: string | null;
      paidAt: string | null;
      failureReason: string | null;
      purchaseType: 'ORDER' | 'SUBSCRIPTION';
      referenceId: string;
    };
  }> {
    return this.api.get(`/api/payment/status/${razorpayOrderId}`);
  }

  // Get user's payment history
  async getPaymentHistory(params?: {
    status?: string;
    purchaseType?: 'ORDER' | 'SUBSCRIPTION';
    limit?: number;
    skip?: number;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      transactions: Array<{
        _id: string;
        razorpayOrderId: string;
        razorpayPaymentId: string | null;
        purchaseType: 'ORDER' | 'SUBSCRIPTION';
        status: string;
        amountRupees: number;
        paymentMethod: string | null;
        paidAt: string | null;
        createdAt: string;
      }>;
      count: number;
    };
  }> {
    return this.api.get('/api/payment/history', { params });
  }

  // ===========================
  // NOTIFICATION ENDPOINTS
  // ===========================

  // Get all notifications with pagination
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      notifications: Array<{
        _id: string;
        userId: string;
        type: string;
        title: string;
        body: string;
        data?: any;
        entityType?: string | null;
        entityId?: string | null;
        deliveryStatus: string;
        isRead: boolean;
        readAt: string | null;
        sentAt: string;
        createdAt: string;
        updatedAt: string;
      }>;
      unreadCount: number;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    };
  }> {
    return this.api.get('/api/notifications', { params });
  }

  // Get latest unread notification for popup
  async getLatestUnreadNotification(): Promise<{
    success: boolean;
    message: string;
    data: {
      notification: {
        _id: string;
        userId: string;
        type: string;
        title: string;
        body: string;
        data?: any;
        entityType?: string | null;
        entityId?: string | null;
        isRead: boolean;
        createdAt: string;
      } | null;
    };
  }> {
    return this.api.get('/api/notifications/latest-unread');
  }

  // Get unread notification count for badge
  async getUnreadNotificationCount(): Promise<{
    success: boolean;
    message: string;
    data: {
      count: number;
    };
  }> {
    return this.api.get('/api/notifications/unread-count');
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.api.patch(`/api/notifications/${notificationId}/read`);
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(): Promise<{
    success: boolean;
    message: string;
    data: {
      updatedCount: number;
    };
  }> {
    return this.api.post('/api/notifications/mark-all-read');
  }

  // Delete notification
  async deleteNotification(notificationId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.api.delete(`/api/notifications/${notificationId}`);
  }

  // ============================================
  // SCHEDULED MEAL ENDPOINTS
  // ============================================

  // Get available slots for scheduling meals
  async getScheduledMealSlots(deliveryAddressId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      slots: ScheduledMealSlot[];
      activeScheduledMeals: number;
      maxScheduledMeals: number;
    };
  }> {
    return this.api.get('/api/scheduling/slots', { params: { deliveryAddressId } });
  }

  // Get pricing preview for a scheduled meal
  async getScheduledMealPricing(data: {
    deliveryAddressId: string;
    mealWindow: string;
    scheduledDate?: string;
    items?: Array<{
      menuItemId: string;
      quantity: number;
      addons?: Array<{ addonId: string; quantity: number }>;
    }>;
    voucherCount?: number;
    couponCode?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: ScheduledMealPricingData;
  }> {
    return this.api.post('/api/scheduling/meals/pricing', data);
  }

  // Create a new scheduled meal
  async createScheduledMeal(data: {
    deliveryAddressId: string;
    mealWindow: string;
    scheduledDate?: string;
    items?: Array<{
      menuItemId: string;
      quantity: number;
      addons?: Array<{ addonId: string; quantity: number }>;
    }>;
    voucherCount?: number;
    couponCode?: string;
    specialInstructions?: string;
    deliveryNotes?: string;
    leaveAtDoor?: boolean;
    doNotContact?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    data: ScheduledMealOrderData;
  }> {
    return this.api.post('/api/scheduling/meals', data);
  }

  // Get user's scheduled meals list
  async getMyScheduledMeals(params?: {
    page?: number;
    limit?: number;
    status?: string;
    deliveryAddressId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      meals: ScheduledMealListItem[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    };
  }> {
    return this.api.get('/api/scheduling/meals', { params });
  }

  // Cancel a scheduled meal
  async cancelScheduledMeal(id: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    data: CancelScheduledMealData;
  }> {
    return this.api.patch(`/api/scheduling/meals/${id}/cancel`, { reason });
  }

  // Bulk scheduling - pricing preview
  async getBulkSchedulePricing(data: {
    deliveryAddressId: string;
    slots: BulkSlotInput[];
    vouchersToUse?: number;
    couponCode?: string;
  }): Promise<{ success: boolean; message: string; data: BulkPricingData }> {
    return this.api.post('/api/scheduling/meals/bulk/pricing', data);
  }

  // Bulk scheduling - create orders
  async createBulkScheduledMeals(data: {
    deliveryAddressId: string;
    slots: BulkSlotInput[];
    vouchersToUse?: number;
    couponCode?: string;
    specialInstructions?: string;
    leaveAtDoor?: boolean;
    doNotContact?: boolean;
    allowDuplicates?: boolean;
    allowAutoOrderConflict?: boolean;
  }): Promise<{ success: boolean; message: string; data: BulkScheduleResult }> {
    return this.api.post('/api/scheduling/meals/bulk', data);
  }

  // ============================================
  // AUTO-ORDER ADDON ENDPOINTS
  // ============================================

  // Get all upcoming auto-order slots with existing paid selections.
  // Empty results include a `reason` code: NOT_ENABLED | NO_CONFIG | NO_UPCOMING
  // Error responses (404 from rejected Promise) carry `data.reason`: NO_SUBSCRIPTION | NO_CONFIG
  async getAutoOrderAddonSlots(addressId?: string): Promise<{
    success: boolean;
    message: string;
    data: {
      slots: AutoOrderAddonSlot[];
      totalSlots?: number;
      paidSlots?: number;
      reason?: 'NOT_ENABLED' | 'NO_CONFIG' | 'NO_UPCOMING';
    };
  }> {
    return this.api.get('/api/auto-order/addon-slots', { params: addressId ? { addressId } : {} });
  }

  // Calculate pricing for chosen slots + addons
  async getAutoOrderAddonPricing(data: {
    addressId: string;
    slots: Array<{ date: string; mealWindow: 'LUNCH' | 'DINNER'; addons: Array<{ addonId: string; quantity: number }> }>;
  }): Promise<{ success: boolean; message: string; data: AutoOrderAddonPricingData }> {
    return this.api.post('/api/auto-order/addon-pricing', data);
  }

  // Create selections + initiate Razorpay payment
  async createAutoOrderAddonSelections(data: {
    addressId: string;
    slots: Array<{ date: string; mealWindow: 'LUNCH' | 'DINNER'; addons: Array<{ addonId: string; quantity: number }> }>;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      batchId: string;
      paymentRequired: boolean;
      slotsActivated?: number;
      payment?: {
        razorpayOrderId: string;
        amount: number;
        amountRupees: number;
        key: string;
        expiresAt: string;
      };
    };
  }> {
    return this.api.post('/api/auto-order/addon-selections', data);
  }

  // Verify Razorpay payment and activate selections
  async verifyAutoOrderAddonPayment(data: {
    batchId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<{ success: boolean; message: string; data: { success: boolean; slotsActivated: number } }> {
    return this.api.post('/api/auto-order/addon-selections/verify-payment', data);
  }

  // =============================================
  // REFERRAL ENDPOINTS
  // =============================================

  // Get or generate referral code
  async getMyReferralCode(): Promise<{
    success: boolean;
    message: string;
    data: { code: string };
  }> {
    return this.api.get('/api/referrals/my-code');
  }

  // Get referral stats
  async getMyReferralStats(): Promise<{
    success: boolean;
    message: string;
    data: {
      referralCode: string;
      isReferred: boolean;
      totalReferred: number;
      totalConverted: number;
      totalVouchersEarned: number;
      currentMilestone: { name: string; referralCount: number } | null;
      nextMilestone: { name: string; referralCount: number; remaining: number } | null;
      referrals: Array<{
        _id: string;
        refereeName: string;
        refereePhone: string | null;
        status: string;
        createdAt: string;
        conversionDate?: string;
        referrerReward?: { voucherCount: number };
      }>;
    };
  }> {
    return this.api.get('/api/referrals/my-stats');
  }

  // Validate a referral code
  async validateReferralCode(code: string): Promise<{
    success: boolean;
    message: string;
    data: { valid: boolean; referrerName?: string; reason?: string };
  }> {
    return this.api.post('/api/referrals/validate-code', { code });
  }

  // Apply a referral code
  async applyReferralCode(code: string): Promise<{
    success: boolean;
    message: string;
    data: { applied: boolean; referralId?: string };
  }> {
    return this.api.post('/api/referrals/apply-code', { code });
  }

  // Get shareable content
  async getShareContent(): Promise<{
    success: boolean;
    message: string;
    data: { message: string; code: string };
  }> {
    return this.api.get('/api/referrals/share-content');
  }
}

export default new ApiService();
