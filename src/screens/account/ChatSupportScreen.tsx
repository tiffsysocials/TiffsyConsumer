// src/screens/account/ChatSupportScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { MainTabParamList } from '../../types/navigation';
import { TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Polyline } from 'react-native-svg';

type Props = StackScreenProps<MainTabParamList, 'ChatSupport'>;

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  quickReplies?: string[];
}

// ============================================
// HARDCODED RESPONSES - Keyword-based matching
// ============================================

interface ResponseRule {
  keywords: string[];
  response: string;
  quickReplies?: string[];
}

const GREETING_KEYWORDS = ['hi', 'hello', 'hey', 'hii', 'hiii', 'helo', 'sup', 'wassup', 'good morning', 'good afternoon', 'good evening', 'namaste'];
const THANKS_KEYWORDS = ['thank', 'thanks', 'thankyou', 'thank you', 'thx', 'tysm', 'appreciate'];
const BYE_KEYWORDS = ['bye', 'goodbye', 'good bye', 'see you', 'cya', 'take care'];

const RESPONSE_RULES: ResponseRule[] = [
  // ---- ORDERS ----
  {
    keywords: ['place order', 'how to order', 'order food', 'how do i order', 'ordering', 'new order', 'create order', 'book order', 'buy food'],
    response: 'To place an order:\n\n1. Go to the Home screen\n2. Browse the available kitchens and menus\n3. Select your meal (Lunch or Dinner)\n4. Add items to your cart with any add-ons\n5. Go to Cart, apply vouchers or coupons if available\n6. Proceed to payment and confirm your order\n\nYou can also use auto-ordering to schedule meals automatically!',
    quickReplies: ['Auto-ordering', 'Vouchers', 'Payment methods'],
  },
  {
    keywords: ['track order', 'order status', 'where is my order', 'order tracking', 'delivery status', 'when will i get', 'order update'],
    response: 'To track your order:\n\n1. Go to "My Orders" from the Account tab\n2. Tap on the order you want to track\n3. You\'ll see a real-time tracking timeline showing your order status\n\nOrder statuses: Placed > Accepted > Preparing > Ready > Picked Up > Out for Delivery > Delivered\n\nYou also receive push notifications for each status update!',
    quickReplies: ['Cancel order', 'Rate order', 'Order delayed'],
  },
  {
    keywords: ['cancel order', 'cancel my order', 'want to cancel', 'order cancel'],
    response: 'To cancel an order:\n\n1. After placing an order, a cancel button with a countdown timer appears\n2. You have 1 minute from the time of placing the order to cancel\n3. Once the 1-minute window expires, the cancel option is no longer available\n\nIf vouchers were used, they will be restored upon successful cancellation.',
    quickReplies: ['Refund', 'Vouchers', 'Contact support'],
  },
  {
    keywords: ['order history', 'past orders', 'previous orders', 'my orders', 'old orders'],
    response: 'You can view your order history by going to "My Orders" from the bottom navigation or from the Account menu. Your orders are displayed with filters so you can easily find any order. Tap on any order to view full details including items, pricing, and delivery info.',
    quickReplies: ['Track order', 'Rate order', 'Place order'],
  },
  {
    keywords: ['rate order', 'review order', 'feedback', 'rating', 'rate my order', 'give feedback'],
    response: 'To rate a delivered order:\n\n1. Go to "My Orders"\n2. Find the delivered order\n3. Tap on it and use the rating option\n4. Give a star rating and add comments\n\nYour feedback helps us improve our service and food quality!',
    quickReplies: ['My orders', 'Place order'],
  },
  {
    keywords: ['order delayed', 'late delivery', 'delivery late', 'not delivered', 'waiting for order', 'taking too long'],
    response: 'We\'re sorry about the delay! Here are some things to check:\n\n1. Track your order in "My Orders" for real-time updates\n2. Check if there are any notifications about your order status\n\nIf your order is significantly delayed, please contact our support team for immediate assistance.',
    quickReplies: ['Track order', 'Contact support'],
  },

  // ---- VOUCHERS ----
  {
    keywords: ['voucher', 'vouchers', 'my vouchers', 'voucher balance', 'how many vouchers', 'voucher count'],
    response: 'Vouchers are meal credits you get with subscription plans. You can:\n\n1. View your vouchers in "My Vouchers" from Account menu\n2. Check your balance on the Account screen (shown at the top)\n3. Filter by status: Available, Redeemed, Expired, Restored\n\nVouchers are automatically applied when you place orders. Each voucher covers one meal. Unused vouchers have an expiry date shown in the voucher details.',
    quickReplies: ['Buy vouchers', 'Meal plans', 'Voucher expired'],
  },
  {
    keywords: ['voucher expired', 'expired voucher', 'voucher expiry', 'voucher validity', 'when do vouchers expire'],
    response: 'Each voucher has an expiry date based on your subscription plan duration. You can check expiry dates in:\n\n1. Account screen - shows nearest expiry date\n2. "My Vouchers" - detailed view of each voucher with its expiry\n\nMake sure to use your vouchers before they expire! You can set up auto-ordering to use them automatically.',
    quickReplies: ['Auto-ordering', 'My vouchers', 'Buy more vouchers'],
  },
  {
    keywords: ['buy voucher', 'buy more vouchers', 'get vouchers', 'purchase voucher', 'more vouchers'],
    response: 'To get more vouchers, purchase a Meal Plan:\n\n1. Go to "Meal Plans" from Account menu or tap "Buy More" on the voucher card\n2. Browse available plans with different voucher counts\n3. Select a plan and complete the payment\n\nPlans come with daily vouchers for the plan duration. Some plans include bonus vouchers and special features!',
    quickReplies: ['Meal plans', 'Payment methods'],
  },

  // ---- MEAL PLANS / SUBSCRIPTIONS ----
  {
    keywords: ['meal plan', 'meal plans', 'subscription', 'subscribe', 'plan', 'buy plan', 'purchase plan', 'subscription plan'],
    response: 'Tiffsy offers various Meal Plans (subscriptions) that give you daily vouchers:\n\n1. Go to "Meal Plans" from the Account menu\n2. Browse plans - each shows duration, vouchers per day, total vouchers, and price\n3. Look for badges like "BEST VALUE", "POPULAR", or "FAMILY"\n4. Select a plan and complete payment via Razorpay\n\nWith an active plan, you can use auto-ordering to get meals delivered automatically!',
    quickReplies: ['Auto-ordering', 'Vouchers', 'Cancel subscription'],
  },
  {
    keywords: ['cancel subscription', 'cancel plan', 'cancel meal plan', 'stop subscription', 'unsubscribe'],
    response: 'To cancel your subscription:\n\n1. Go to "Meal Plans" or "Auto-Order Settings"\n2. Find your active subscription\n3. Look for the cancel option\n\nPlease note: Cancelling a subscription may affect your unused vouchers. Any available vouchers will remain valid until their expiry date. Refund eligibility depends on your plan terms.',
    quickReplies: ['Refund', 'Vouchers', 'Contact support'],
  },

  // ---- AUTO-ORDERING ----
  {
    keywords: ['auto order', 'auto-order', 'automatic order', 'auto ordering', 'auto-ordering', 'automatic ordering', 'schedule order', 'scheduled order'],
    response: 'Auto-ordering automatically places meal orders for you based on your schedule!\n\nTo set up:\n1. Go to "Auto-Order Settings" from Account menu\n2. Enable auto-ordering\n3. Set your default kitchen and delivery address\n4. Configure your weekly schedule (select Lunch/Dinner for each day)\n\nOrders are placed automatically at the kitchen\'s configured time. You can pause, resume, or skip specific meals anytime!',
    quickReplies: ['Pause auto-order', 'Skip a meal', 'Weekly schedule'],
  },
  {
    keywords: ['pause auto', 'pause order', 'pause auto-order', 'pause subscription', 'pause meals'],
    response: 'To pause auto-ordering:\n\n1. Go to "Auto-Order Settings" from Account menu (or tap "Pause" on Account screen)\n2. Choose to pause auto-ordering\n3. Select a date until when you want to pause\n\nAuto-ordering will automatically resume on your selected date. Your vouchers remain safe and won\'t expire while paused (they have their own expiry).',
    quickReplies: ['Resume auto-order', 'Skip a meal', 'Auto-ordering'],
  },
  {
    keywords: ['resume auto', 'resume order', 'resume auto-order', 'start auto-order again', 'unpause'],
    response: 'To resume auto-ordering:\n\n1. Go to "Auto-Order Settings"\n2. Tap "Resume" to restart your automatic meal orders\n\nAlternatively, on the Account screen, you\'ll see a "Resume" button on the voucher card if auto-ordering is paused. Orders will resume based on your existing weekly schedule.',
    quickReplies: ['Weekly schedule', 'Skip a meal'],
  },
  {
    keywords: ['skip meal', 'skip a meal', 'skip next meal', 'skip lunch', 'skip dinner', 'skip day', 'skip tomorrow'],
    response: 'To skip specific meals:\n\n1. Go to "Skip Meal Calendar" from Auto-Order Settings (or tap "Skip Next Meal" on Account screen)\n2. Select the date(s) you want to skip\n3. Choose which meal to skip (Lunch/Dinner)\n\nSkipped meals won\'t be auto-ordered and your vouchers won\'t be used for those slots. You can unskip anytime before the order time.',
    quickReplies: ['Auto-ordering', 'Weekly schedule'],
  },
  {
    keywords: ['weekly schedule', 'schedule meals', 'which days', 'set schedule', 'meal schedule', 'configure days'],
    response: 'Your weekly schedule controls which meals are auto-ordered:\n\n1. Go to "Auto-Order Settings"\n2. In the weekly schedule section, toggle Lunch and/or Dinner for each day (Monday through Sunday)\n3. The app shows how many meals are scheduled per week\n\nYou can change your schedule anytime. Changes apply from the next auto-order cycle.',
    quickReplies: ['Auto-ordering', 'Skip a meal'],
  },
  {
    keywords: ['auto order failed', 'auto-order failed', 'order failed', 'failed order', 'auto order failure', 'why did auto order fail'],
    response: 'Auto-order failures can happen for several reasons:\n\n- No Vouchers: You\'ve run out of available vouchers\n- No Address: No default delivery address set\n- No Zone: Your address isn\'t in a serviceable zone\n- No Kitchen: No kitchen available for your area\n- Menu Not Available: The menu hasn\'t been published yet\n- Transaction Failed: Voucher redemption issue\n\nYou\'ll receive a notification with details. Check "Auto-Order Settings" to fix the issue.',
    quickReplies: ['Buy vouchers', 'Saved addresses', 'Auto-ordering'],
  },

  // ---- SCHEDULED MEALS ----
  {
    keywords: ['scheduled meal', 'scheduled meals', 'schedule a meal', 'book ahead', 'advance order', 'pre-order', 'preorder'],
    response: 'Scheduled Meals let you book a meal for a specific date and time:\n\n1. Go to "Scheduled Meals" from Account menu\n2. Tap "Schedule a Meal"\n3. Select your date and meal window (Lunch or Dinner)\n4. Review the pricing\n5. Confirm your booking\n\nYou can view all your scheduled meals and cancel them if needed (refund may apply).',
    quickReplies: ['Cancel scheduled meal', 'My scheduled meals'],
  },
  {
    keywords: ['cancel scheduled', 'cancel booked meal', 'cancel advance order'],
    response: 'To cancel a scheduled meal:\n\n1. Go to "Scheduled Meals" from Account menu\n2. Find the meal you want to cancel\n3. Tap cancel\n\nCancellation and refund eligibility depends on how close it is to the scheduled time. A voucher may be restored if one was used.',
    quickReplies: ['Scheduled meals', 'Refund'],
  },

  // ---- PAYMENTS ----
  {
    keywords: ['payment', 'pay', 'payment method', 'how to pay', 'payment options', 'upi', 'card payment', 'wallet', 'netbanking'],
    response: 'Tiffsy supports multiple payment methods via Razorpay:\n\n- UPI (Google Pay, PhonePe, etc.)\n- Credit/Debit Cards\n- Wallets\n- Net Banking\n- Voucher-Only (when you have vouchers, no extra payment needed)\n\nPayments are processed securely. If a payment fails, you can retry from the order details.',
    quickReplies: ['Payment failed', 'Vouchers', 'Refund'],
  },
  {
    keywords: ['payment failed', 'payment issue', 'payment not working', 'payment error', 'transaction failed', 'payment declined'],
    response: 'If your payment failed:\n\n1. Go to "My Orders" and find the order\n2. Use the "Retry Payment" option\n3. Try a different payment method if the issue persists\n\nCommon reasons for failure: Insufficient balance, bank server issues, network timeout. If the amount was deducted but order not confirmed, it will be auto-refunded within 5-7 business days.\n\nStill having issues? Contact our support team.',
    quickReplies: ['Contact support', 'Payment methods'],
  },
  {
    keywords: ['refund', 'money back', 'get refund', 'refund status', 'when will i get refund', 'refund policy'],
    response: 'Refund information:\n\n- Cancelled orders: Vouchers are restored immediately. Monetary refunds take 5-7 business days.\n- Failed payments: Auto-refunded within 5-7 business days if amount was deducted.\n- Subscription cancellation: Refund eligibility depends on plan terms and usage.\n\nFor specific refund queries, please contact our support team with your order/payment details.',
    quickReplies: ['Contact support', 'Cancel order'],
  },

  // ---- COUPONS ----
  {
    keywords: ['coupon', 'coupons', 'promo code', 'discount', 'discount code', 'offer', 'deals', 'promotion'],
    response: 'To apply a coupon:\n\n1. Add items to your cart\n2. In the Cart screen, look for the coupon/promo section\n3. Enter your coupon code or browse available coupons\n4. The discount will be applied to your order total\n\nCoupon types include: Percentage off, Flat discount, Free delivery, Free add-ons, and Bonus vouchers. Check "My Vouchers" for available offers!',
    quickReplies: ['Place order', 'My vouchers'],
  },

  // ---- ADDRESSES ----
  {
    keywords: ['address', 'delivery address', 'change address', 'add address', 'saved address', 'update address', 'edit address', 'new address'],
    response: 'To manage your delivery addresses:\n\n1. Go to "Saved Addresses" from Account menu\n2. Add a new address or edit/delete existing ones\n3. Set a default address for auto-ordering\n\nYour address must be in a serviceable area (we check this via your pincode). Each address can have a label (Home, Work, etc.) and specific delivery instructions.',
    quickReplies: ['Auto-ordering', 'Place order'],
  },
  {
    keywords: ['pincode', 'service area', 'serviceable', 'delivery area', 'do you deliver', 'available in my area', 'available area', 'delivery zone', 'zone'],
    response: 'To check if we deliver to your area:\n\n1. Go to "Saved Addresses" and try adding your address\n2. Enter your pincode - we\'ll check if it\'s in a serviceable zone\n3. If serviceable, you can save the address and start ordering\n\nWe\'re expanding to new areas regularly! If your area isn\'t covered yet, stay tuned for updates.',
    quickReplies: ['Add address', 'Contact support'],
  },

  // ---- ACCOUNT / PROFILE ----
  {
    keywords: ['edit profile', 'change name', 'update profile', 'change email', 'profile picture', 'update photo', 'profile image', 'change phone'],
    response: 'To edit your profile:\n\n1. Go to Account tab\n2. Tap the edit icon next to your profile\n3. You can update: Name, Email, Profile Image, and Dietary Preferences (Veg/Non-Veg/Vegan)\n\nNote: Phone number is linked to your login and cannot be changed directly.',
    quickReplies: ['Dietary preferences', 'Delete account'],
  },
  {
    keywords: ['dietary', 'veg', 'non-veg', 'nonveg', 'vegan', 'food preference', 'diet preference', 'vegetarian'],
    response: 'Tiffsy supports dietary preferences:\n\n- VEG: Vegetarian meals only\n- NON-VEG: Includes non-vegetarian options\n- VEGAN: Plant-based meals only\n\nYou can set your preference in Edit Profile. The app will show menus tailored to your dietary choice. You can change it anytime!',
    quickReplies: ['Edit profile', 'Menu'],
  },
  {
    keywords: ['delete account', 'remove account', 'close account', 'deactivate'],
    response: 'To delete your account:\n\n1. Go to Account tab\n2. Scroll down and tap "Delete Account"\n3. Confirm the deletion\n\nYour account will be scheduled for deletion with a 10-day grace period. During this period, you can contact support to cancel the deletion. After 10 days, all your data will be permanently removed.',
    quickReplies: ['Contact support', 'Logout'],
  },
  {
    keywords: ['login', 'sign in', 'log in', 'register', 'sign up', 'create account', 'otp', 'verification'],
    response: 'Tiffsy uses phone-based login with OTP:\n\n1. Open the app and enter your phone number\n2. You\'ll receive an OTP via SMS\n3. Enter the OTP to verify\n4. If you\'re a new user, complete your profile (name, email, dietary preferences)\n5. Set up your delivery address\n\nYou can also browse as a guest, but you\'ll need to login to place orders and manage subscriptions.',
    quickReplies: ['Guest mode', 'Edit profile'],
  },
  {
    keywords: ['guest', 'guest mode', 'without login', 'browse without'],
    response: 'Yes! You can browse Tiffsy as a guest:\n\n- View menus and kitchens\n- Check meal plans and pricing\n- Explore the app features\n\nHowever, to place orders, save addresses, manage vouchers, and use auto-ordering, you\'ll need to create an account. Tap "Login / Register" on the Account screen to get started!',
    quickReplies: ['Login', 'Place order'],
  },
  {
    keywords: ['logout', 'log out', 'sign out'],
    response: 'To logout:\n\n1. Go to the Account tab\n2. Scroll down and tap "Logout"\n\nYou\'ll be signed out and returned to the login screen. Your data will be safely stored and available when you log back in.',
    quickReplies: ['Login', 'Delete account'],
  },

  // ---- MENU / FOOD ----
  {
    keywords: ['menu', 'food menu', 'what food', 'today menu', 'lunch menu', 'dinner menu', 'what\'s available', 'whats available'],
    response: 'To browse the menu:\n\n1. Go to the Home screen\n2. Select your delivery address (if not already set)\n3. Browse available kitchens in your area\n4. View the menu for Lunch or Dinner\n5. Each item shows description, price, and dietary type (Veg/Non-Veg/Vegan)\n\nMenus are updated daily by our kitchens. Add-ons are available for many items!',
    quickReplies: ['Place order', 'Dietary preferences', 'Add-ons'],
  },
  {
    keywords: ['addon', 'add-on', 'extra', 'extras', 'add ons', 'additional items', 'side dish', 'sides'],
    response: 'Add-ons are extra items you can add to your main meal:\n\n1. While adding an item to cart, look for available add-ons\n2. Select the add-ons you want\n3. They\'ll be added to your order with their individual pricing\n\nAdd-ons vary by kitchen and menu item. You can also add or remove add-ons from the Cart screen.',
    quickReplies: ['Place order', 'Menu'],
  },
  {
    keywords: ['kitchen', 'restaurant', 'which kitchen', 'kitchen info', 'cook', 'chef'],
    response: 'Tiffsy partners with local kitchens to deliver fresh, homestyle meals:\n\n1. Your available kitchens depend on your delivery zone\n2. Each kitchen has its own menu, operating hours, and specialties\n3. When ordering or setting up auto-ordering, you select your preferred kitchen\n\nBrowse kitchens on the Home screen to see what\'s available in your area!',
    quickReplies: ['Menu', 'Delivery area', 'Place order'],
  },
  {
    keywords: ['lunch', 'lunch time', 'lunch timing', 'lunch hours', 'lunch window'],
    response: 'Lunch orders are available during the Lunch meal window. The exact timing depends on your kitchen\'s operating hours. You can:\n\n1. Check available lunch menus on the Home screen\n2. Set up auto-ordering for lunch on specific days\n3. Schedule a lunch meal in advance\n\nMake sure to order before the kitchen\'s cutoff time!',
    quickReplies: ['Dinner', 'Auto-ordering', 'Menu'],
  },
  {
    keywords: ['dinner', 'dinner time', 'dinner timing', 'dinner hours', 'dinner window'],
    response: 'Dinner orders are available during the Dinner meal window. The exact timing depends on your kitchen\'s operating hours. You can:\n\n1. Check available dinner menus on the Home screen\n2. Set up auto-ordering for dinner on specific days\n3. Schedule a dinner meal in advance\n\nMake sure to order before the kitchen\'s cutoff time!',
    quickReplies: ['Lunch', 'Auto-ordering', 'Menu'],
  },

  // ---- BULK ORDERS ----
  {
    keywords: ['bulk order', 'bulk orders', 'large order', 'catering', 'party order', 'corporate order', 'office order', 'group order'],
    response: 'Bulk Orders are available for large group orders, events, or corporate needs:\n\n1. Go to "Bulk Orders" from the Account menu\n2. Explore bulk ordering options\n\nBulk orders are great for office meals, parties, or any large gathering. Contact our team for custom bulk order arrangements and pricing!',
    quickReplies: ['Contact support', 'Place order'],
  },

  // ---- NOTIFICATIONS ----
  {
    keywords: ['notification', 'notifications', 'push notification', 'alerts', 'notify', 'not getting notifications'],
    response: 'Tiffsy sends push notifications for:\n\n- Order updates (Accepted, Preparing, Ready, Out for Delivery, Delivered)\n- Auto-order success and failures\n- Voucher expiry reminders\n- Subscription updates\n- Scheduled meal updates\n- Menu updates and promotions\n\nView all notifications in the Notifications screen (bell icon). Make sure notifications are enabled in your phone settings!',
    quickReplies: ['Order tracking', 'Auto-ordering'],
  },

  // ---- APP GENERAL ----
  {
    keywords: ['about', 'about tiffsy', 'what is tiffsy', 'tiffsy app', 'about app', 'company'],
    response: 'Tiffsy is a meal delivery app that brings fresh, homestyle food right to your doorstep!\n\nKey features:\n- Daily meal delivery (Lunch & Dinner)\n- Subscription plans with meal vouchers\n- Auto-ordering with customizable weekly schedules\n- Multiple kitchens and cuisines\n- Scheduled meals for advance booking\n- Real-time order tracking\n\nVisit "About" in the Account menu to learn more about our journey!',
    quickReplies: ['Meal plans', 'How to order', 'Contact support'],
  },
  {
    keywords: ['how does it work', 'how it works', 'explain', 'new user', 'getting started', 'start', 'beginner', 'help me start'],
    response: 'Welcome to Tiffsy! Here\'s how to get started:\n\n1. Sign up with your phone number\n2. Add your delivery address\n3. Browse a Meal Plan and purchase one to get vouchers\n4. Set up auto-ordering OR manually order meals daily\n5. Enjoy fresh, homestyle meals delivered to your door!\n\nWith auto-ordering, you just set your schedule once and meals are automatically ordered for you using your vouchers.',
    quickReplies: ['Meal plans', 'Auto-ordering', 'How to order'],
  },
  {
    keywords: ['privacy', 'privacy policy', 'data', 'data privacy', 'personal information', 'data security'],
    response: 'Your privacy matters to us! You can view our complete Privacy Policy in the app:\n\n1. Go to Account > About\n2. Or access it during registration\n\nWe securely handle your personal information, payment data, and delivery details. For specific privacy concerns, please contact our support team.',
    quickReplies: ['Terms of service', 'Contact support'],
  },
  {
    keywords: ['terms', 'terms of service', 'terms and conditions', 'tos', 'conditions'],
    response: 'You can view our Terms of Service in the app:\n\n1. Go to Account > About\n2. Or access it during registration\n\nThe terms cover usage policies, payment terms, refund policies, and more. For specific questions about our terms, please contact support.',
    quickReplies: ['Privacy policy', 'Contact support'],
  },

  // ---- CART ----
  {
    keywords: ['cart', 'my cart', 'view cart', 'shopping cart', 'checkout', 'items in cart'],
    response: 'Your Cart shows all items you\'ve added:\n\n1. View items with quantities and add-ons\n2. Update quantities or remove items\n3. Apply vouchers or coupon codes for discounts\n4. See detailed pricing breakdown (subtotal, delivery fee, discounts)\n5. Proceed to payment when ready\n\nYou can access the cart from the cart icon on the Home screen.',
    quickReplies: ['Apply coupon', 'Payment methods', 'Place order'],
  },

  // ---- DELIVERY ----
  {
    keywords: ['delivery', 'delivery time', 'delivery fee', 'free delivery', 'delivery charge', 'shipping'],
    response: 'Delivery information:\n\n- Delivery is available during Lunch and Dinner windows\n- Delivery fees may vary based on your location and order\n- Some coupons offer free delivery\n- Real-time tracking is available for all orders\n\nMake sure your delivery address is correct and in a serviceable zone for the best experience!',
    quickReplies: ['Track order', 'Delivery area', 'Free delivery coupons'],
  },

  // ---- CONTACT / SUPPORT ----
  {
    keywords: ['contact', 'support', 'help', 'customer care', 'customer service', 'reach out', 'talk to someone', 'complaint', 'issue', 'problem', 'speak to', 'call', 'email'],
    response: 'You can reach our support team through:\n\nPhone: +91 98765-43210\n(Mon-Fri, 9 AM - 10 PM)\n\nEmail: info@tiffindabba.in\n\nYou can also visit "Help & Support" in the Account menu for FAQs and more contact options.\n\nWe\'re here to help with any questions, concerns, or feedback!',
    quickReplies: ['Call support', 'Email support', 'FAQs'],
  },

  // ---- ON DEMAND ----
  {
    keywords: ['on demand', 'ondemand', 'on-demand', 'instant order', 'quick order'],
    response: 'On-Demand ordering is a feature that lets you order meals instantly, outside of regular subscription schedules. This feature is currently being worked on and will be available soon!\n\nIn the meantime, you can place regular orders through the Home screen or use auto-ordering for scheduled deliveries.',
    quickReplies: ['Place order', 'Auto-ordering'],
  },
];

// Quick reply mapping to search terms
const QUICK_REPLY_SEARCH: Record<string, string> = {
  'Auto-ordering': 'auto-ordering',
  'Vouchers': 'vouchers',
  'Payment methods': 'payment methods',
  'Cancel order': 'cancel order',
  'Rate order': 'rate order',
  'Order delayed': 'order delayed',
  'Track order': 'track order',
  'Contact support': 'contact support',
  'Refund': 'refund',
  'Meal plans': 'meal plans',
  'Buy vouchers': 'buy more vouchers',
  'My vouchers': 'my vouchers',
  'Buy more vouchers': 'buy more vouchers',
  'Voucher expired': 'voucher expired',
  'Pause auto-order': 'pause auto-order',
  'Skip a meal': 'skip a meal',
  'Weekly schedule': 'weekly schedule',
  'Resume auto-order': 'resume auto-order',
  'Cancel subscription': 'cancel subscription',
  'Place order': 'how to order',
  'My orders': 'my orders',
  'Saved addresses': 'saved address',
  'Payment failed': 'payment failed',
  'Edit profile': 'edit profile',
  'Dietary preferences': 'dietary preferences',
  'Delete account': 'delete account',
  'Login': 'login',
  'Guest mode': 'guest mode',
  'Logout': 'logout',
  'Menu': 'menu',
  'Add-ons': 'add-ons',
  'Delivery area': 'delivery area',
  'Dinner': 'dinner',
  'Lunch': 'lunch',
  'Scheduled meals': 'scheduled meals',
  'Cancel scheduled meal': 'cancel scheduled meal',
  'My scheduled meals': 'my scheduled meals',
  'How to order': 'how to order',
  'Call support': 'contact support',
  'Email support': 'contact support',
  'FAQs': 'help',
  'Add address': 'add address',
  'Terms of service': 'terms of service',
  'Privacy policy': 'privacy policy',
  'Free delivery coupons': 'coupon',
  'Apply coupon': 'coupon',
};

const CONTACT_FALLBACK = 'I\'m not sure I understood your question. Let me connect you with our support team!\n\nPhone: +91 98765-43210\n(Mon-Fri, 9 AM - 10 PM)\n\nEmail: info@tiffindabba.in\n\nYou can also visit "Help & Support" from the Account menu for more assistance.';

function getResponse(input: string): { text: string; quickReplies?: string[] } {
  const lower = input.toLowerCase().trim();

  // Check greetings
  if (GREETING_KEYWORDS.some(k => lower === k || lower.startsWith(k + ' ') || lower.startsWith(k + '!'))) {
    return {
      text: 'Hello! Welcome to Tiffsy Support. How can I help you today? You can ask me about orders, meal plans, vouchers, auto-ordering, payments, delivery, and more!',
      quickReplies: ['How to order', 'Meal plans', 'Auto-ordering', 'Contact support'],
    };
  }

  // Check thanks
  if (THANKS_KEYWORDS.some(k => lower.includes(k))) {
    return {
      text: 'You\'re welcome! Is there anything else I can help you with?',
      quickReplies: ['How to order', 'Meal plans', 'Contact support'],
    };
  }

  // Check bye
  if (BYE_KEYWORDS.some(k => lower === k || lower.startsWith(k + ' ') || lower.startsWith(k + '!'))) {
    return {
      text: 'Goodbye! If you need help in the future, feel free to come back anytime. Enjoy your meals with Tiffsy!',
    };
  }

  // Score-based matching
  let bestMatch: ResponseRule | null = null;
  let bestScore = 0;

  for (const rule of RESPONSE_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) {
        // Longer keyword matches get higher score
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  if (bestMatch && bestScore > 0) {
    return {
      text: bestMatch.response,
      quickReplies: bestMatch.quickReplies,
    };
  }

  // Fallback
  return {
    text: CONTACT_FALLBACK,
    quickReplies: ['Call support', 'Email support', 'How to order', 'Meal plans'],
  };
}

// ============================================
// COMPONENT
// ============================================

type FeedbackState = null | 'pending' | 'yes' | 'no';

const ChatSupportScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputText, setInputText] = useState('');
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(null);
  const feedbackStateRef = useRef<FeedbackState>(null);

  const resetInactivityTimer = (hasExchange: boolean) => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (!hasExchange) return;
    inactivityTimer.current = setTimeout(() => {
      if (feedbackStateRef.current === null) {
        setFeedbackState('pending');
        feedbackStateRef.current = 'pending';
      }
    }, 4000);
  };

  // Keep ref in sync with state
  const handleSetFeedbackState = (state: FeedbackState) => {
    feedbackStateRef.current = state;
    setFeedbackState(state);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  };

  useEffect(() => {
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      text: 'Hello! I\'m Tiffsy Support Assistant. How can I help you today?',
      isUser: false,
      timestamp: new Date(),
      quickReplies: ['How to order', 'Meal plans', 'Auto-ordering', 'My orders', 'Vouchers', 'Contact support'],
    },
  ]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    // Simulate typing delay
    setTimeout(() => {
      const { text: responseText, quickReplies } = getResponse(text);
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        timestamp: new Date(),
        quickReplies,
      };
      setMessages(prev => {
        const updated = [...prev, botMessage];
        const isBye = BYE_KEYWORDS.some(k => text.toLowerCase().trim() === k || text.toLowerCase().startsWith(k + ' ') || text.toLowerCase().startsWith(k + '!'));
        if (isBye) {
          setTimeout(() => handleSetFeedbackState('pending'), 800);
        } else {
          resetInactivityTimer(updated.length > 2);
        }
        return updated;
      });
    }, 600);
  };

  const handleQuickReply = (reply: string) => {
    if (reply === 'Call support') {
      Linking.openURL('tel:+919876543210');
      return;
    }
    if (reply === 'Email support') {
      Linking.openURL('mailto:info@tiffindabba.in');
      return;
    }
    const searchTerm = QUICK_REPLY_SEARCH[reply] || reply.toLowerCase();
    // Show the quick reply as a user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: reply,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    setTimeout(() => {
      const { text: responseText, quickReplies } = getResponse(searchTerm);
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        timestamp: new Date(),
        quickReplies,
      };
      setMessages(prev => {
        const updated = [...prev, botMessage];
        const isBye = BYE_KEYWORDS.some(k => reply.toLowerCase().trim() === k || reply.toLowerCase().startsWith(k + ' '));
        if (isBye) {
          setTimeout(() => handleSetFeedbackState('pending'), 800);
        } else {
          resetInactivityTimer(updated.length > 2);
        }
        return updated;
      });
    }, 600);
  };

  const handleCall = () => {
    Linking.openURL('tel:+919876543210');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:info@tiffindabba.in');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient
        colors={['#FD9E2F', '#FF6636']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'relative', overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 24 }}
      >
        <SafeAreaView edges={['top']}>
        <View className="flex-row items-center justify-between px-5 pt-4 pb-6">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: TOUCH_TARGETS.minimum,
            height: TOUCH_TARGETS.minimum,
            borderRadius: TOUCH_TARGETS.minimum / 2,
            backgroundColor: 'white',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Polyline points="15,18 9,12 15,6" stroke="#FE8733" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>
            Tiffsy Support
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#86EFAC', marginRight: 6 }} />
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: FONT_SIZES.xs }}>
              Always Online
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={handleCall}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              source={require('../../assets/icons/call3.png')}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleEmail}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              source={require('../../assets/icons/mail3.png')}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Chat Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date label */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View
              style={{
                backgroundColor: 'rgba(0,0,0,0.06)',
                paddingHorizontal: 14,
                paddingVertical: 5,
                borderRadius: 12,
              }}
            >
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>Today</Text>
            </View>
          </View>

          {messages.map((msg) => (
            <View key={msg.id}>
              {/* Message Bubble */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: msg.isUser ? 'flex-end' : 'flex-start',
                  marginBottom: 4,
                }}
              >
                {!msg.isUser && (
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#FE8733',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                      marginTop: 4,
                    }}
                  >
                    <Image
                      source={require('../../assets/icons/Tiffsy.png')}
                      style={{ width: 22, height: 14 }}
                      resizeMode="contain"
                    />
                  </View>
                )}
                <View
                  style={{
                    maxWidth: '75%',
                    backgroundColor: msg.isUser ? '#FE8733' : '#FFFFFF',
                    borderRadius: 18,
                    borderTopRightRadius: msg.isUser ? 4 : 18,
                    borderTopLeftRadius: msg.isUser ? 18 : 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.06,
                    shadowRadius: 3,
                    elevation: 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: FONT_SIZES.base,
                      color: msg.isUser ? '#FFFFFF' : '#111827',
                      lineHeight: FONT_SIZES.base * 1.5,
                    }}
                  >
                    {msg.text}
                  </Text>
                  <Text
                    style={{
                      fontSize: FONT_SIZES.xs - 1,
                      color: msg.isUser ? 'rgba(255,255,255,0.7)' : '#9CA3AF',
                      marginTop: 4,
                      textAlign: 'right',
                    }}
                  >
                    {formatTime(msg.timestamp)}
                  </Text>
                </View>
              </View>

              {/* Quick Replies */}
              {msg.quickReplies && msg.quickReplies.length > 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    marginLeft: 40,
                    marginTop: 6,
                    marginBottom: 12,
                    gap: 6,
                  }}
                >
                  {msg.quickReplies.map((reply, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleQuickReply(reply)}
                      style={{
                        borderWidth: 1.5,
                        borderColor: '#FE8733',
                        borderRadius: 20,
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        backgroundColor: '#FFF7ED',
                      }}
                    >
                      <Text style={{ fontSize: FONT_SIZES.sm, color: '#FE8733', fontWeight: '600' }}>
                        {reply}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* Feedback Card */}
          {feedbackState === 'pending' && (
            <View style={{ alignItems: 'flex-start', marginTop: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FE8733', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 4 }}>
                  <Image source={require('../../assets/icons/Tiffsy.png')} style={{ width: 22, height: 14 }} resizeMode="contain" />
                </View>
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12, maxWidth: '75%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 }}>
                  <Text style={{ fontSize: FONT_SIZES.base, color: '#111827', lineHeight: FONT_SIZES.base * 1.5, marginBottom: 12 }}>
                    Was this conversation helpful? 😊
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => handleSetFeedbackState('yes')}
                      style={{ flex: 1, backgroundColor: '#FE8733', borderRadius: 20, paddingVertical: 8, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: FONT_SIZES.sm }}>👍  Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleSetFeedbackState('no')}
                      style={{ flex: 1, borderWidth: 1.5, borderColor: '#FE8733', borderRadius: 20, paddingVertical: 8, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#FE8733', fontWeight: '700', fontSize: FONT_SIZES.sm }}>👎  No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}

          {feedbackState === 'yes' && (
            <View style={{ alignItems: 'flex-start', marginTop: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FE8733', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 4 }}>
                  <Image source={require('../../assets/icons/Tiffsy.png')} style={{ width: 22, height: 14 }} resizeMode="contain" />
                </View>
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12, maxWidth: '75%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 }}>
                  <Text style={{ fontSize: FONT_SIZES.base, color: '#111827', lineHeight: FONT_SIZES.base * 1.5 }}>
                    Thank you for your feedback! 🙏{'\n'}We're glad we could help. Have a great day!
                  </Text>
                </View>
              </View>
            </View>
          )}

          {feedbackState === 'no' && (
            <View style={{ alignItems: 'flex-start', marginTop: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FE8733', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 4 }}>
                  <Image source={require('../../assets/icons/Tiffsy.png')} style={{ width: 22, height: 14 }} resizeMode="contain" />
                </View>
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12, maxWidth: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 }}>
                  <Text style={{ fontSize: FONT_SIZES.base, color: '#111827', lineHeight: FONT_SIZES.base * 1.5, marginBottom: 12 }}>
                    We're sorry we couldn't fully help! Please reach out to our team for better support:
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={handleCall}
                      style={{ flex: 1, backgroundColor: '#FE8733', borderRadius: 20, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    >
                      <Text style={{ fontSize: 14 }}>📞</Text>
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: FONT_SIZES.sm }}>Call Us</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleEmail}
                      style={{ flex: 1, borderWidth: 1.5, borderColor: '#FE8733', borderRadius: 20, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    >
                      <Text style={{ fontSize: 14 }}>✉️</Text>
                      <Text style={{ color: '#FE8733', fontWeight: '700', fontSize: FONT_SIZES.sm }}>Email Us</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              borderRadius: 24,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              minHeight: 46,
            }}
          >
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type your message..."
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                fontSize: FONT_SIZES.base,
                color: '#111827',
                paddingVertical: Platform.OS === 'ios' ? 12 : 8,
              }}
              multiline
              maxLength={500}
              onSubmitEditing={() => sendMessage(inputText)}
              blurOnSubmit
            />
          </View>
          <TouchableOpacity
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim()}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: inputText.trim() ? '#FE8733' : '#D1D5DB',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: inputText.trim() ? '#FE8733' : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: inputText.trim() ? 3 : 0,
            }}
          >
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginLeft: 2, marginTop: -1 }}>
              {'\u27A4'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ChatSupportScreen;
