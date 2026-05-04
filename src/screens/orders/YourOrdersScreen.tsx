// src/screens/orders/YourOrdersScreen.tsx
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainTabParamList } from '../../types/navigation';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAlert } from '../../context/AlertContext';
import apiService, { Order, OrderStatus } from '../../services/api.service';
import dataPreloader from '../../services/dataPreloader.service';
import paymentService from '../../services/payment.service';
import { isPaymentPending } from '../../utils/paymentStatus';

import { useResponsive } from '../../hooks/useResponsive';
import { SPACING } from '../../constants/spacing';

type Props = StackScreenProps<MainTabParamList, 'YourOrders'>;

// Current order statuses (orders still in progress)
const CURRENT_STATUSES: OrderStatus[] = [
  'SCHEDULED',
  'PENDING_KITCHEN_ACCEPTANCE',
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
];

// History order statuses (completed or cancelled)
const HISTORY_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'REJECTED'];

// Map order status to user-friendly message
const getStatusMessage = (status: OrderStatus): string => {
  switch (status) {
    case 'SCHEDULED':
      return 'Scheduled for upcoming delivery';
    case 'PENDING_KITCHEN_ACCEPTANCE':
      return 'Waiting for kitchen confirmation';
    case 'PLACED':
      return 'Order placed';
    case 'ACCEPTED':
      return 'Order accepted';
    case 'PREPARING':
      return 'Meal is being prepared';
    case 'READY':
      return 'Ready for pickup';
    case 'PICKED_UP':
      return 'Picked up by driver';
    case 'OUT_FOR_DELIVERY':
      return 'Out for delivery';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Cancelled';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
};

// Format date + time (Today / Yesterday / date + time)
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();

  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Check if today
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return `Today, ${time}`;

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return `Yesterday, ${time}`;

  // Otherwise show full date
  const dateStr = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${dateStr}, ${time}`;
};

// Get item image based on menu type and meal window
const getOrderImage = (order: Order) => {
  if (order.menuType === 'MEAL_MENU') {
    if (order.mealWindow === 'DINNER') {
      return require('../../assets/images/homepage/dinnerThali.png');
    }
    return require('../../assets/images/homepage/lunchThali.png');
  }
  return require('../../assets/images/homepage/lunchThali.png');
};

// Get order title
const getOrderTitle = (order: Order): string => {
  if (order.items.length === 1) {
    return order.items[0].name;
  }
  if (order.menuType === 'MEAL_MENU' && order.items.length > 0) {
    // Use the actual meal name from the order instead of fallback
    return order.items[0].name;
  }
  return `${order.items.length} items`;
};

// Get quantity string
const getQuantityString = (order: Order): string => {
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (order.menuType === 'MEAL_MENU') {
    return `${totalItems} Thali`;
  }
  return `${totalItems} item${totalItems > 1 ? 's' : ''}`;
};

const YourOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const { usableVouchers } = useSubscription();
  const { showAlert } = useAlert();
  const { isSmallDevice } = useResponsive();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'Current' | 'History' | 'Auto'>('Current');

  // Current orders state
  const [currentOrders, setCurrentOrders] = useState<Order[]>([]);
  const [currentLoading, setCurrentLoading] = useState(false); // Start with false - will be set to true only if cache miss
  const [currentError, setCurrentError] = useState<string | null>(null);

  // History orders state
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false); // Start with false - will be set to true only if cache miss
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  // Track if data has been loaded to prevent unnecessary fetches
  const hasLoadedDataRef = useRef(false);


  // Fetch current orders
  const fetchCurrentOrders = async () => {
    try {
      setCurrentError(null);

      // 🚀 Try cache first for instant display (non-blocking check)
      const cachedOrders = dataPreloader.getCachedOrders();
      if (cachedOrders && !dataPreloader.isCacheExpired('orders')) {
        console.log('[YourOrdersScreen] ✓ Using cached orders from preload:', cachedOrders.length);
        const current = cachedOrders.filter((order: Order) =>
          CURRENT_STATUSES.includes(order.status)
        );
        setCurrentOrders(current);
        setCurrentLoading(false);
        return;
      }

      // Cache miss or expired - show loading and fetch from API
      console.log('[YourOrdersScreen] ⚠️ Cache miss, fetching orders from API');
      setCurrentLoading(true);
      // Note: Backend doesn't support comma-separated status values
      // Fetch all orders and filter client-side
      const response = await apiService.getMyOrders({ limit: 50 });
      console.log('[YourOrdersScreen] API Response:', JSON.stringify(response, null, 2));

      const responseData = response.data;

      if (response.success && responseData?.orders) {
        // Use activeOrders from API if available, otherwise filter by status
        let current: Order[];
        if (responseData.activeOrders && responseData.activeOrders.length > 0) {
          current = responseData.orders.filter((order: Order) =>
            responseData.activeOrders!.includes(order._id)
          );
        } else {
          current = responseData.orders.filter((order: Order) =>
            CURRENT_STATUSES.includes(order.status)
          );
        }
        console.log('[YourOrdersScreen] Current orders count:', current.length);
        setCurrentOrders(current);
      } else {
        console.log('[YourOrdersScreen] Failed to load current orders - Response:', response);
        setCurrentError(response.message || 'Failed to load orders');
      }
    } catch (error: any) {
      console.error('[YourOrdersScreen] Error fetching current orders:', error.message || error);
      console.error('[YourOrdersScreen] Full error:', JSON.stringify(error, null, 2));
      setCurrentError(error.message || 'Failed to load orders');
    } finally {
      setCurrentLoading(false);
    }
  };

  // Helper to extract orders from API response
  const extractOrdersFromResponse = (response: any): { orders: Order[]; hasMore: boolean } => {
    const responseData = response.data;

    if (response.success && responseData?.orders) {
      const hasMore = responseData.pagination
        ? responseData.pagination.page < responseData.pagination.totalPages
        : false;
      return { orders: responseData.orders, hasMore };
    }
    return { orders: [], hasMore: false };
  };

  // Fetch history orders with pagination using status filters
  const fetchHistoryOrders = async (page: number = 1, append: boolean = false) => {
    try {
      if (!append) {
        setHistoryError(null);
        setHistoryLoading(true);
      }
      console.log('[YourOrdersScreen] Fetching history orders - Page:', page);

      // Use status filters to fetch only history orders directly from the API
      // This ensures we get actual delivered/cancelled orders instead of fetching
      // all orders and filtering client-side (which missed most history orders)
      const apiCalls: Promise<any>[] = [
        apiService.getMyOrders({ page, limit: 50, status: 'DELIVERED' }),
      ];

      // On first load, also fetch cancelled and rejected orders
      if (page === 1) {
        apiCalls.push(apiService.getMyOrders({ page: 1, limit: 50, status: 'CANCELLED' }));
        apiCalls.push(apiService.getMyOrders({ page: 1, limit: 50, status: 'REJECTED' }));
      }

      const results = await Promise.allSettled(apiCalls);

      let allHistory: Order[] = [];
      let deliveredHasMore = false;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled') {
          const extracted = extractOrdersFromResponse(result.value);
          allHistory = [...allHistory, ...extracted.orders];
          // Track pagination only for delivered orders (index 0) since they're most common
          if (i === 0) {
            deliveredHasMore = extracted.hasMore;
          }
        }
      }

      // Sort by date (newest first)
      allHistory.sort((a: Order, b: Order) =>
        new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
      );
      console.log('[YourOrdersScreen] History orders count:', allHistory.length);

      if (append) {
        setHistoryOrders(prev => [...prev, ...allHistory]);
      } else {
        setHistoryOrders(allHistory);
      }

      setHistoryHasMore(deliveredHasMore);
      setHistoryPage(page);
    } catch (error: any) {
      console.error('[YourOrdersScreen] Error fetching history orders:', error.message || error);
      if (!append) {
        setHistoryError(error.message || 'Failed to load order history');
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fetch all orders
  const fetchAllOrders = async () => {
    // Don't set loading states here - let individual fetch functions handle them
    // This allows cache to display instantly without showing loading state
    await Promise.all([fetchCurrentOrders(), fetchHistoryOrders(1, false)]);
  };

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    dataPreloader.invalidateCache('orders');
    await fetchAllOrders();
    setRefreshing(false);
  }, []);

  // Load more history orders
  const loadMoreHistory = () => {
    if (historyHasMore && !historyLoading) {
      fetchHistoryOrders(historyPage + 1, true);
    }
  };

  // Fetch orders on mount and when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('[YourOrdersScreen] useFocusEffect triggered');

      // If data already loaded, skip fetch (only load once)
      if (hasLoadedDataRef.current) {
        console.log('[YourOrdersScreen] ✓ Data already loaded, skipping fetch');
        return;
      }

      // Use cache for current orders only (instant display)
      const cachedOrders = dataPreloader.getCachedOrders();
      if (cachedOrders && !dataPreloader.isCacheExpired('orders')) {
        console.log('[YourOrdersScreen] 🚀 Cache hit - using for current orders');
        const current = cachedOrders.filter((order: Order) =>
          CURRENT_STATUSES.includes(order.status)
        );
        setCurrentOrders(current);
        setCurrentLoading(false);
      } else {
        // Cache miss - fetch current orders from API
        fetchCurrentOrders();
      }

      // Always fetch history orders from API with status filters
      // (cache only stores ~50 orders which may not include enough history orders)
      fetchHistoryOrders(1, false);

      hasLoadedDataRef.current = true;
    }, [])
  );


  // Navigate to order detail
  const handleViewOrderDetail = (orderId: string) => {
    console.log('[YourOrdersScreen] Navigating to order detail:', orderId);
    navigation.navigate('OrderDetail', { orderId });
  };

  const handleTrackOrder = (orderId: string) => {
    console.log('[YourOrdersScreen] Navigating to order tracking:', orderId);
    navigation.navigate('OrderTracking', { orderId });
  };

  const handleReorder = (orderId: string) => {
    console.log('[YourOrdersScreen] Reorder:', orderId);
    showAlert('Coming Soon', 'Reorder functionality will be available soon!', undefined, 'default');
  };

  const handlePayNow = async (orderId: string) => {
    if (payingOrderId) return;
    try {
      setPayingOrderId(orderId);
      const result = await paymentService.retryOrderPayment(orderId);
      if (result.success) {
        dataPreloader.invalidateCache('orders');
        await fetchCurrentOrders();
        showAlert(
          'Payment Successful',
          'Your order has been confirmed.',
          undefined,
          'success',
        );
      } else if (result.error && result.error !== 'Payment cancelled') {
        showAlert('Payment Failed', result.error, undefined, 'error');
      }
    } catch (err: any) {
      showAlert(
        'Payment Failed',
        err?.message || 'Unable to complete payment. Please try again.',
        undefined,
        'error',
      );
    } finally {
      setPayingOrderId(null);
    }
  };

  // Render current order card
  const renderCurrentOrderCard = (order: Order) => {
    const paymentPending = isPaymentPending(order);
    const amountDue = order.grandTotal - order.amountPaid;
    const isPayingThisOrder = payingOrderId === order._id;
    return (
    <TouchableOpacity
      key={order._id}
      onPress={() => handleViewOrderDetail(order._id)}
      activeOpacity={0.7}
      className="bg-white rounded-3xl mb-4"
      style={{
        padding: isSmallDevice ? SPACING.md : SPACING.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Order Header */}
      <View className="flex-row items-center mb-3">
        <Image
          source={getOrderImage(order)}
          style={{ width: 64, height: 64, borderRadius: 12 }}
          resizeMode="cover"
        />

        <View className="flex-1 ml-3">
          {/* Row 1: Title | Price */}
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-lg font-bold text-gray-900 flex-1" numberOfLines={1} style={{ marginRight: 8 }}>
              {getOrderTitle(order)}
            </Text>
            <Text className="text-base font-bold text-gray-900">₹{order.amountPaid.toFixed(2)}</Text>
          </View>

          {/* Row 2: Order ID */}
          <View className="flex-row items-center mb-1">
            <Text className="text-sm" style={{ color: 'rgba(145, 145, 145, 1)' }} numberOfLines={1}>
              Order ID - #{order.orderNumber}
            </Text>
            <View style={{ marginLeft: 4, alignItems: 'center' }}>
              {copiedOrderId === order.orderNumber && (
                <Text style={{ fontSize: 9, color: '#16A34A', fontWeight: '600', marginBottom: 1 }}>Copied!</Text>
              )}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Clipboard.setString(order.orderNumber);
                  setCopiedOrderId(order.orderNumber);
                  setTimeout(() => setCopiedOrderId(null), 2000);
                }}
                style={{ padding: 2 }}
              >
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="rgba(145,145,145,1)" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>

          {/* Row 3: Date & Time | Auto Badge */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-sm" style={{ color: 'rgba(145, 145, 145, 1)' }}>
                {formatDateTime(order.placedAt)}
              </Text>
              {order.voucherUsage && order.voucherUsage.voucherCount > 0 && (
                <Text className="text-xs" style={{ color: '#16A34A', marginTop: 2, fontWeight: '600' }}>
                  {order.voucherUsage.voucherCount} voucher{order.voucherUsage.voucherCount > 1 ? 's' : ''} used
                </Text>
              )}
            </View>
            {(order.isAutoOrder || order.orderSource === 'AUTO_ORDER') && (
              <View
                className="px-2.5 py-1 rounded-full flex-row items-center"
                style={{
                  backgroundColor: '#8B5CF6',
                  shadowColor: '#8B5CF6',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.3,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <Text className="text-white text-xs mr-1">⚡</Text>
                <Text className="text-xs font-bold text-white">Auto</Text>
              </View>
            )}
            {order.orderSource === 'SCHEDULED' && (
              <View
                className="px-2.5 py-1 rounded-full flex-row items-center"
                style={{
                  backgroundColor: '#642714',
                  shadowColor: '#642714',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.3,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <Text className="text-white text-xs mr-1">📅</Text>
                <Text className="text-xs font-bold text-white">Scheduled</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Row 4: Status */}
      <View className="mb-4 flex-row items-center">
        {paymentPending && (
          <View
            className="rounded-full mr-2"
            style={{ width: 8, height: 8, backgroundColor: '#D97706' }}
          />
        )}
        <Text
          className="text-sm font-semibold"
          style={{ color: paymentPending ? '#D97706' : '#6B7280' }}
        >
          {paymentPending
            ? 'Payment pending — complete to confirm'
            : getStatusMessage(order.status)}
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="flex-row justify-center">
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            if (paymentPending) {
              handlePayNow(order._id);
            } else {
              handleTrackOrder(order._id);
            }
          }}
          disabled={isPayingThisOrder}
          className="py-2 rounded-full items-center justify-center"
          style={{
            width: 280,
            backgroundColor: 'rgba(255, 136, 0, 1)',
            opacity: isPayingThisOrder ? 0.7 : 1,
          }}
        >
          {isPayingThisOrder ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">
              {paymentPending ? `Pay Now ₹${amountDue.toFixed(2)}` : 'Track Order'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
    );
  };

  // Render history order card
  const renderHistoryOrderCard = (order: Order) => (
    <TouchableOpacity
      key={order._id}
      onPress={() => handleViewOrderDetail(order._id)}
      activeOpacity={0.7}
      className="bg-white rounded-2xl mb-3"
      style={{
        padding: isSmallDevice ? SPACING.md : SPACING.lg,
        minHeight: 160,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
        justifyContent: 'space-between',
      }}
    >
      {/* Order Info */}
      <View className="flex-row">
        <Image
          source={getOrderImage(order)}
          style={{ width: 56, height: 56, borderRadius: 12 }}
          resizeMode="cover"
        />

        <View className="flex-1 ml-3">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-base font-bold text-gray-900 flex-1" numberOfLines={1} style={{ marginRight: 8 }}>
              {getOrderTitle(order)}
            </Text>
            <Text className="text-base font-bold text-gray-900">₹{order.amountPaid.toFixed(2)}</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-sm" style={{ color: 'rgba(145, 145, 145, 1)' }} numberOfLines={1}>
              Order ID - #{order.orderNumber}
            </Text>
            <View style={{ marginLeft: 4, alignItems: 'center' }}>
              {copiedOrderId === order.orderNumber && (
                <Text style={{ fontSize: 9, color: '#16A34A', fontWeight: '600', marginBottom: 1 }}>Copied!</Text>
              )}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Clipboard.setString(order.orderNumber);
                  setCopiedOrderId(order.orderNumber);
                  setTimeout(() => setCopiedOrderId(null), 2000);
                }}
                style={{ padding: 2 }}
              >
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="rgba(145,145,145,1)" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>
          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-1">
              <Text className="text-sm" style={{ color: 'rgba(145, 145, 145, 1)' }}>
                {formatDateTime(order.placedAt)}
              </Text>
              {order.voucherUsage && order.voucherUsage.voucherCount > 0 && (
                <Text className="text-xs" style={{ color: '#16A34A', marginTop: 2, fontWeight: '600' }}>
                  {order.voucherUsage.voucherCount} voucher{order.voucherUsage.voucherCount > 1 ? 's' : ''} used
                </Text>
              )}
            </View>
            {(order.isAutoOrder || order.orderSource === 'AUTO_ORDER') && (
              <View
                className="px-2.5 py-1.5 rounded-full flex-row items-center"
                style={{
                  backgroundColor: '#8B5CF6',
                  shadowColor: '#8B5CF6',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.3,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <Text className="text-white text-xs mr-1">⚡</Text>
                <Text className="text-xs font-bold text-white">Auto</Text>
              </View>
            )}
            {order.orderSource === 'SCHEDULED' && (
              <View
                className="px-2.5 py-1.5 rounded-full flex-row items-center"
                style={{
                  backgroundColor: '#642714',
                  shadowColor: '#642714',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.3,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <Text className="text-white text-xs mr-1">📅</Text>
                <Text className="text-xs font-bold text-white">Scheduled</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Status and Re-order */}
      <View className="mt-3">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <View
              className="w-2 h-2 rounded-full mr-2"
              style={{
                backgroundColor: order.status === 'DELIVERED' ? '#16A34A' : '#EF4444',
              }}
            />
            <Text
              className="text-sm font-semibold"
              style={{
                color: order.status === 'DELIVERED' ? '#16A34A' : '#EF4444',
              }}
            >
              {getStatusMessage(order.status)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            handleReorder(order._id);
          }}
          className="rounded-full py-2.5 flex-row items-center justify-center"
          style={{
            backgroundColor: '#FE8733',
            shadowColor: '#FE8733',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Image
            source={require('../../assets/icons/reorder2.png')}
            style={{ width: 16, height: 16, tintColor: 'white', marginRight: 6 }}
            resizeMode="contain"
          />
          <Text className="font-bold text-sm text-white">Re-order</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Render loading state
  const renderLoading = () => (
    <View className="items-center justify-center py-20">
      <ActivityIndicator size="large" color="#FE8733" />
      <Text className="text-base text-gray-500 mt-4">Loading orders...</Text>
    </View>
  );

  // Render error state
  const renderError = (message: string, onRetry: () => void) => (
    <View className="items-center justify-center py-20">
      <Text className="text-base text-gray-500 mb-4">{message}</Text>
      <TouchableOpacity
        onPress={onRetry}
        className="rounded-full px-6 py-2"
        style={{ backgroundColor: 'rgba(255, 136, 0, 1)' }}
      >
        <Text className="text-white font-semibold">Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // Render empty state
  const renderEmpty = (message: string) => (
    <View className="items-center justify-center py-20">
      <Image
        source={require('../../assets/icons/cart3.png')}
        style={{ width: 60, height: 60, tintColor: '#D1D5DB', marginBottom: 16 }}
        resizeMode="contain"
      />
      <Text className="text-base text-gray-500">{message}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header and Tabs Container */}
      <LinearGradient colors={['#FD9E2F', '#FF6636']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'relative', overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 24 }}>
        <SafeAreaView edges={['top']}>
        {/* Decorative Background Elements */}
        <Image
          source={require('../../assets/images/homepage/halfcircle.png')}
          style={{ position: 'absolute', top: insets.top - 90, right: -125, width: 300, height: 380 }}
          resizeMode="contain"
        />
        <Image
          source={require('../../assets/images/homepage/halfline.png')}
          style={{ position: 'absolute', top: insets.top + 30, right: -150, width: 380, height: 150 }}
          resizeMode="contain"
        />

        {/* Header */}
        <View className="px-5 py-4 flex-row items-center">
          <View
            className="w-10 h-10 rounded-full  items-center justify-center"
            style={{ marginLeft: 8, marginRight: 20 }}
          >
            <Image
              source={require('../../assets/icons/Tiffsy.png')}
              style={{ width: 58, height: 58 }}
              resizeMode="contain"
            />
          </View>

          {/* My Orders Title */}
          <View className="flex-1 items-center">
            <Text className="text-white text-xl font-bold">My Orders</Text>
          </View>

          {/* Voucher Button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('MealPlans')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'white',
              borderRadius: 20,
              paddingVertical: 6,
              paddingHorizontal: 10,
              gap: 6,
            }}
          >
            <Image
              source={require('../../assets/icons/voucher5.png')}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FE8733' }}>
              {usableVouchers}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View className="px-5 mt-4">
          <View className="flex-row bg-gray-100 rounded-full p-1">
            <TouchableOpacity
              onPress={() => setActiveTab('Current')}
              className={`flex-1 rounded-full ${
                activeTab === 'Current' ? 'bg-white' : 'bg-transparent'
              }`}
              style={{
                shadowColor: activeTab === 'Current' ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: activeTab === 'Current' ? 0.1 : 0,
                shadowRadius: 2,
                elevation: activeTab === 'Current' ? 2 : 0,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                className={`text-center font-semibold ${
                  activeTab === 'Current' ? 'text-gray-900' : 'text-gray-500'
                }`}
                style={{ fontSize: 13 }}
              >
                Current {currentOrders.length > 0 && `(${currentOrders.length})`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('History')}
              className={`flex-1 rounded-full ${
                activeTab === 'History' ? 'bg-white' : 'bg-transparent'
              }`}
              style={{
                shadowColor: activeTab === 'History' ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: activeTab === 'History' ? 0.1 : 0,
                shadowRadius: 2,
                elevation: activeTab === 'History' ? 2 : 0,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                className={`text-center font-semibold ${
                  activeTab === 'History' ? 'text-gray-900' : 'text-gray-500'
                }`}
                style={{ fontSize: 13 }}
              >
                History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('Auto')}
              className={`flex-1 rounded-full ${
                activeTab === 'Auto' ? 'bg-white' : 'bg-transparent'
              }`}
              style={{
                shadowColor: activeTab === 'Auto' ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: activeTab === 'Auto' ? 0.1 : 0,
                shadowRadius: 2,
                elevation: activeTab === 'Auto' ? 2 : 0,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                className={`text-center font-semibold ${
                  activeTab === 'Auto' ? 'text-gray-900' : 'text-gray-500'
                }`}
                style={{ fontSize: 13 }}
              >
                Auto Order
              </Text>
            </TouchableOpacity>
          </View>
        </View>
              </SafeAreaView>
      </LinearGradient>

      {/* Orders List */}
      <ScrollView
        className="flex-1 bg-white px-5 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FE8733']}
            tintColor="#FE8733"
          />
        }
      >
        {activeTab === 'Current' ? (
          // Current Orders Layout (all current orders including auto)
          <>
            {currentLoading ? (
              renderLoading()
            ) : currentError ? (
              renderError(currentError, fetchCurrentOrders)
            ) : currentOrders.length === 0 ? (
              renderEmpty('No current orders')
            ) : (
              currentOrders.map(renderCurrentOrderCard)
            )}
          </>
        ) : activeTab === 'History' ? (
          // History Orders Layout (all completed/cancelled orders)
          <>
            {historyLoading && historyOrders.length === 0 ? (
              renderLoading()
            ) : historyError ? (
              renderError(historyError, () => fetchHistoryOrders(1, false))
            ) : historyOrders.length === 0 ? (
              renderEmpty('No order history')
            ) : (
              <>
                {historyOrders.map(renderHistoryOrderCard)}

                {/* Load More Button */}
                {historyHasMore && (
                  <TouchableOpacity
                    onPress={loadMoreHistory}
                    className="items-center py-4 mb-6 flex-row justify-center"
                    disabled={historyLoading}
                  >
                    {historyLoading ? (
                      <ActivityIndicator size="small" color="#FE8733" />
                    ) : (
                      <>
                        <Image
                          source={require('../../assets/icons/down2.png')}
                          style={{ width: 16, height: 16, tintColor: 'rgba(255, 136, 0, 1)', marginRight: 6 }}
                          resizeMode="contain"
                        />
                        <Text className="font-semibold text-base" style={{ color: 'rgba(255, 136, 0, 1)' }}>
                          Load More Orders
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        ) : (
          // Auto Orders Layout (both current and history auto orders)
          <>
            {currentLoading || historyLoading ? (
              renderLoading()
            ) : [...currentOrders, ...historyOrders].filter(o => o.isAutoOrder || o.orderSource === 'AUTO_ORDER').length === 0 ? (
              <View className="items-center justify-center py-16">
                <Image
                  source={require('../../assets/icons/cart3.png')}
                  style={{ width: 60, height: 60, tintColor: '#D1D5DB', marginBottom: 16 }}
                  resizeMode="contain"
                />
                <Text className="text-base font-semibold text-gray-500 mb-2">No auto-orders yet</Text>
                <Text className="text-sm text-gray-400 text-center px-8 mb-6" style={{ lineHeight: 20 }}>
                  Set up auto-ordering from your Account to get meals delivered automatically
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Account')}
                  className="rounded-full px-6 py-2.5"
                  style={{ backgroundColor: '#FE8733' }}
                >
                  <Text className="text-white font-semibold text-sm">Go to Auto-Order Settings</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {currentOrders.filter(o => o.isAutoOrder || o.orderSource === 'AUTO_ORDER').map(renderCurrentOrderCard)}
                {historyOrders.filter(o => o.isAutoOrder || o.orderSource === 'AUTO_ORDER').map(renderHistoryOrderCard)}
              </>
            )}
          </>
        )}

        {/* Bottom Spacing for Navigation Bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

    </View>
  );
};

export default YourOrdersScreen;
