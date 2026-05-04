// src/types/navigation.ts
import { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';
import { RouteProp, CompositeNavigationProp } from '@react-navigation/native';

// Root Stack
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Auth: undefined;
  UserOnboarding: undefined;
  AddressSetup: undefined;
  Main: undefined;
};

// Onboarding Stack
export type OnboardingStackParamList = {
  OnboardingScreen1: undefined;
};

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  OTPVerification: {
    phoneNumber: string;
  };
  UserOnboarding: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  Home: undefined;
  Address: undefined;
  Menu: undefined;
  Cart: { directCheckout?: boolean; scheduledDate?: string; deliveryAddressId?: string } | undefined;
  Profile: undefined;
  Payment: undefined;
  Account: undefined;
  EditProfile: undefined;  // Edit user profile (name, email, dietary preferences, image)
  ReferAndEarn: undefined;  // Refer & Earn screen
  HelpSupport: undefined;
  About: undefined;
  OurJourney: undefined;
  YourOrders: undefined;
  OrderDetail: { orderId: string };  // Requires orderId for order details
  OrderTracking: { orderId: string };  // Requires orderId to track
  MealPlans: undefined;
  BulkOrders: undefined;
  Vouchers: undefined;  // View all vouchers with status filters
  OnDemand: undefined;  // On-Demand screen (Coming Soon)
  AutoOrderSettings: undefined;  // Auto-order dashboard (lists all address configs)
  AutoOrderConfig: { addressId?: string };  // Create (no addressId) or edit (with addressId) auto-order config
ScheduledMealPricing: { deliveryAddressId: string; mealWindow: 'LUNCH' | 'DINNER'; scheduledDate: string; voucherCount?: number };  // Meal pricing preview
  MyScheduledMeals: undefined;  // List of user's scheduled meals
  MealCalendar: undefined;  // Unified meal calendar view
  BulkSchedulePricing: {
    deliveryAddressId: string;
    selectedSlots: Array<{ date: string; mealWindow: 'LUNCH' | 'DINNER' }>;
  };
  ChatSupport: undefined;  // Chat support screen with hardcoded responses
  AutoOrderAddons: { addressId: string };  // Add add-ons to auto-order meals
};

// Root navigation props
export type NavigationProps<T extends keyof RootStackParamList> = {
  navigation: StackNavigationProp<RootStackParamList, T>;
  route: RouteProp<RootStackParamList, T>;
};

// ✅ Onboarding navigation props (for each onboarding screen)
export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> = {
  navigation: CompositeNavigationProp<
    StackNavigationProp<OnboardingStackParamList, T>,
    StackNavigationProp<RootStackParamList>
  >;
  route: RouteProp<OnboardingStackParamList, T>;
};

// ✅ Auth navigation props (for each auth screen)
export type AuthScreenProps<T extends keyof AuthStackParamList> =
  StackScreenProps<AuthStackParamList, T>;
