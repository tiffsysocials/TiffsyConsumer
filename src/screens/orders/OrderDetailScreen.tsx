// src/screens/orders/OrderDetailScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { MainTabParamList } from '../../types/navigation';
import { useAlert } from '../../context/AlertContext';
import apiService, { Order, OrderStatus, KitchenSummary } from '../../services/api.service';
import paymentService from '../../services/payment.service';
import dataPreloader from '../../services/dataPreloader.service';
import CancelOrderModal from '../../components/CancelOrderModal';
import RateOrderModal from '../../components/RateOrderModal';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES, LINE_HEIGHTS } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'OrderDetail'>;

// Status color mapping
const getStatusColor = (status: OrderStatus): string => {
  switch (status) {
    case 'PENDING_KITCHEN_ACCEPTANCE':
      return '#D97706'; // Amber
    case 'PLACED':
      return '#A0522D'; // Light brown
    case 'ACCEPTED':
      return '#06B6D4'; // Cyan
    case 'PREPARING':
      return '#FE8733'; // Orange
    case 'READY':
      return '#FE8733'; // Orange
    case 'PICKED_UP':
      return '#8B5CF6'; // Purple
    case 'OUT_FOR_DELIVERY':
      return '#6366F1'; // Indigo
    case 'DELIVERED':
      return '#22C55E'; // Green
    case 'CANCELLED':
    case 'REJECTED':
      return '#EF4444'; // Red
    default:
      return '#6B7280'; // Gray
  }
};

// Status text mapping
const getStatusText = (status: OrderStatus): string => {
  switch (status) {
    case 'PENDING_KITCHEN_ACCEPTANCE':
      return 'Awaiting Kitchen';
    case 'PLACED':
      return 'Order Placed';
    case 'ACCEPTED':
      return 'Preparing';
    case 'PREPARING':
      return 'Preparing';
    case 'READY':
      return 'Ready for Pickup';
    case 'PICKED_UP':
      return 'Out for Delivery';
    case 'OUT_FOR_DELIVERY':
      return 'Out for Delivery';
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

// Active statuses
const ACTIVE_STATUSES: OrderStatus[] = [
  'PENDING_KITCHEN_ACCEPTANCE',
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
];

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Format time
const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Format full datetime
const formatDateTime = (dateString: string): string => {
  return `${formatDate(dateString)} at ${formatTime(dateString)}`;
};

const OrderDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId } = route.params;
  const { showAlert } = useAlert();
  const { isSmallDevice } = useResponsive();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  // Fetch order details
  const fetchOrder = async () => {
    try {
      setError(null);
      console.log('[OrderDetailScreen] Fetching order:', orderId);
      const response = await apiService.getOrder(orderId);
      const orderData = response?.data?.order;

      if (orderData?._id) {
        console.log('[OrderDetailScreen] Order fetched:', orderData.orderNumber);
        setOrder(orderData);
      } else {
        console.log('[OrderDetailScreen] Failed to fetch order:', response?.message);
        setError(response?.message || 'Failed to load order details');
      }
    } catch (err: any) {
      console.error('[OrderDetailScreen] Error fetching order:', err.message || err);
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and focus
  useFocusEffect(
    useCallback(() => {
      fetchOrder();
    }, [orderId])
  );

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrder();
    setRefreshing(false);
  }, [orderId]);

  // Handle cancel order
  const handleCancelOrder = async (reason: string) => {
    try {
      setIsCancelling(true);
      console.log('[OrderDetailScreen] Cancelling order:', orderId);
      const response = await apiService.cancelOrder(orderId, reason);
      console.log('[OrderDetailScreen] Cancel response:', JSON.stringify(response, null, 2));

      if (response.success) {
        console.log('[OrderDetailScreen] Order cancelled successfully');
        setShowCancelModal(false);

        const successMessage = response.data?.message || 'Order cancelled successfully.';

        showAlert('Order Cancelled', successMessage, [
          { text: 'OK', onPress: () => fetchOrder() },
        ], 'success');
      } else {
        const errorMessage = response.message || 'Failed to cancel order';
        console.log('[OrderDetailScreen] Cancel failed:', errorMessage);
        setShowCancelModal(false);
        // Hide cancel button after failed attempt (window likely expired)
        if (order) {
          setOrder({ ...order, canCancel: false });
        }
        showAlert('Cannot Cancel Order', errorMessage, undefined, 'error');
      }
    } catch (err: any) {
      console.error('[OrderDetailScreen] Cancel error:', err.message || err);
      setShowCancelModal(false);
      // Hide cancel button after error (window likely expired)
      if (order) {
        setOrder({ ...order, canCancel: false });
      }
      showAlert('Error', err.message || 'Failed to cancel order', undefined, 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle rate order
  const handleRateOrder = async (stars: number, comment?: string) => {
    try {
      setIsRating(true);
      console.log('[OrderDetailScreen] Rating order:', orderId, 'Stars:', stars);
      const response = await apiService.rateOrder(orderId, stars, comment);
      console.log('[OrderDetailScreen] Rating response:', JSON.stringify(response, null, 2));

      if (response.success) {
        console.log('[OrderDetailScreen] Order rated successfully');
        setShowRateModal(false);
        showAlert('Thank You!', 'Your feedback helps us improve.', [
          { text: 'OK', onPress: () => fetchOrder() },
        ], 'success');
      } else {
        const errorMessage = response.message || 'Failed to submit rating';
        console.log('[OrderDetailScreen] Rating failed:', errorMessage);
        showAlert('Error', errorMessage, undefined, 'error');
      }
    } catch (err: any) {
      console.error('[OrderDetailScreen] Rating error:', err.message || err);
      showAlert('Error', err.message || 'Failed to submit rating', undefined, 'error');
    } finally {
      setIsRating(false);
    }
  };

  // Handle track order
  const handleTrackOrder = () => {
    navigation.navigate('OrderTracking', { orderId });
  };

  // Handle call kitchen
  const handleCallKitchen = () => {
    const kitchen = order?.kitchenId as KitchenSummary;
    if (kitchen?.phone) {
      Linking.openURL(`tel:${kitchen.phone}`);
    } else {
      showAlert('Not Available', 'Kitchen contact is not available', undefined, 'warning');
    }
  };

  // Get kitchen info
  const getKitchenInfo = (): KitchenSummary | null => {
    if (!order) return null;
    if (typeof order.kitchenId === 'object') {
      return order.kitchenId;
    }
    return null;
  };

  // Check if order is active
  const isActiveOrder = order && ACTIVE_STATUSES.includes(order.status);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#FE8733" />
        <Text className="text-gray-500 mt-4" style={{ fontSize: FONT_SIZES.base }}>
          Loading order details...
        </Text>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !order) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-5">
        <Text className="text-gray-500 mb-4 text-center" style={{ fontSize: FONT_SIZES.base }}>
          {error || 'Order not found'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            fetchOrder();
          }}
          className="rounded-full px-6 mb-4"
          style={{ backgroundColor: '#FE8733', minHeight: TOUCH_TARGETS.comfortable }}
        >
          <Text className="text-white font-semibold" style={{ fontSize: FONT_SIZES.base }}>
            Retry
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ minHeight: TOUCH_TARGETS.minimum }}
        >
          <Text className="text-gray-500" style={{ fontSize: FONT_SIZES.base }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const kitchen = getKitchenInfo();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View className="bg-white flex-row items-center border-b border-gray-100" style={{ paddingHorizontal: isSmallDevice ? SPACING.lg : SPACING.xl, paddingVertical: SPACING.md }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: SPACING.iconXl,
            height: SPACING.iconXl,
            borderRadius: SPACING.iconXl / 2,
            backgroundColor: '#FE8733',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={SPACING.iconSize - 2} height={SPACING.iconSize - 2} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15.75 19.5 8.25 12l7.5-7.5"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text className="flex-1 text-center font-bold text-gray-900 mr-10" style={{ fontSize: isSmallDevice ? FONT_SIZES.h5 : FONT_SIZES.h4 }}>
          Order Details
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FE8733']}
          />
        }
      >
        {/* Order Header */}
        <View className="bg-white mb-2" style={{ padding: isSmallDevice ? SPACING.lg : SPACING.xl }}>
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <Text className="font-bold text-gray-900" style={{ fontSize: FONT_SIZES.lg }}>
                #{order.orderNumber}
              </Text>
              <View style={{ marginLeft: 6, alignItems: 'center' }}>
                {copiedOrderId && (
                  <Text style={{ fontSize: FONT_SIZES.xs - 1, color: '#16A34A', fontWeight: '600', marginBottom: 2 }}>Copied!</Text>
                )}
                <TouchableOpacity
                  onPress={() => {
                    Clipboard.setString(order.orderNumber);
                    setCopiedOrderId(true);
                    setTimeout(() => setCopiedOrderId(false), 2000);
                  }}
                  style={{ padding: 2 }}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="#6B7280" />
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View
                className="rounded-full"
                style={{ backgroundColor: `${getStatusColor(order.status)}20`, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm }}
              >
                <Text
                  className="font-semibold"
                  style={{ color: getStatusColor(order.status), fontSize: FONT_SIZES.sm }}
                >
                  {getStatusText(order.status)}
                </Text>
              </View>
            </View>
          </View>
          <Text className="text-gray-500" style={{ fontSize: FONT_SIZES.sm }}>
            Placed on {formatDateTime(order.placedAt)}
          </Text>

          {/* Rating Display */}
          {order.rating && (
            <View className="flex-row items-center mt-3">
              <Text className="text-gray-600 mr-2" style={{ fontSize: FONT_SIZES.sm }}>Your Rating:</Text>
              <View className="flex-row">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Image
                    key={star}
                    source={require('../../assets/icons/star.png')}
                    style={{
                      width: SPACING.iconSm,
                      height: SPACING.iconSm,
                      tintColor: star <= order.rating!.stars ? '#F59E0B' : '#D1D5DB',
                      marginRight: 2,
                    }}
                    resizeMode="contain"
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Auto-Order Info Section */}
        {(order.isAutoOrder || order.orderSource === 'AUTO_ORDER') && (
          <View className="px-5 py-4 mb-2" style={{ backgroundColor: '#F3E8FF' }}>
            <View className="flex-row items-center mb-2">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: '#8B5CF6' }}
              >
                <Text className="text-lg">⚡</Text>
              </View>
              <Text className="text-lg font-bold" style={{ color: '#6B21A8' }}>
                Auto-Order Info
              </Text>
            </View>
            <Text className="text-sm" style={{ color: '#6B21A8', marginBottom: 4 }}>
              This meal was automatically ordered based on your subscription.
            </Text>
            <Text className="text-xs" style={{ color: '#7C3AED', fontWeight: '500' }}>
              Auto-orders are placed to ensure you never miss a meal during your subscription period.
            </Text>
          </View>
        )}

        {/* Scheduled Order Info Section */}
        {order.orderSource === 'SCHEDULED' && (
          <View className="px-5 py-4 mb-2" style={{ backgroundColor: '#F5E6DF' }}>
            <View className="flex-row items-center mb-2">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: '#642714' }}
              >
                <Text className="text-lg">📅</Text>
              </View>
              <Text className="text-lg font-bold" style={{ color: '#642714' }}>
                Scheduled Order
              </Text>
            </View>
            <Text className="text-sm" style={{ color: '#642714', marginBottom: 4 }}>
              This meal was pre-scheduled for delivery.
            </Text>
            {order.scheduledFor && (
              <Text className="text-xs" style={{ color: '#642714', fontWeight: '500' }}>
                Scheduled for: {new Date(order.scheduledFor).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            )}
          </View>
        )}

        {/* Kitchen Info */}
        {kitchen && (
          <View className="bg-white mb-2" style={{ padding: isSmallDevice ? SPACING.lg : SPACING.xl }}>
            <Text className="font-bold text-gray-900 mb-3" style={{ fontSize: FONT_SIZES.lg }}>Kitchen</Text>
            <View>
              <Text className="font-semibold text-gray-900" style={{ fontSize: FONT_SIZES.base }}>
                {kitchen.name}
              </Text>
              {kitchen.phone && (
                <TouchableOpacity onPress={handleCallKitchen} style={{ minHeight: TOUCH_TARGETS.minimum }}>
                  <Text className="mt-1" style={{ color: '#FE8733', fontSize: FONT_SIZES.sm }}>
                    Tap to call
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Items Section */}
        <View className="bg-white mb-2" style={{ padding: isSmallDevice ? SPACING.lg : SPACING.xl }}>
          <Text className="font-bold text-gray-900 mb-3" style={{ fontSize: FONT_SIZES.lg }}>Items</Text>

          {order.items.map((item, index) => (
            <View key={index} className="mb-3">
              <View className="flex-row justify-between">
                <View className="flex-row items-center flex-1">
                  <Text className="text-sm text-gray-900">{item.name}</Text>
                  <Text className="text-sm text-gray-500 ml-2">x{item.quantity}</Text>
                </View>
                <Text className="text-sm font-semibold text-gray-900">
                  ₹{item.totalPrice.toFixed(2)}
                </Text>
              </View>

              {/* Addons */}
              {item.addons?.map((addon, addonIndex) => (
                <View key={addonIndex} className="flex-row justify-between ml-4 mt-1">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-sm text-gray-600">+ {addon.name}</Text>
                    <Text className="text-sm text-gray-500 ml-2">x{addon.quantity}</Text>
                  </View>
                  <Text className="text-sm text-gray-600">
                    ₹{addon.totalPrice.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          ))}

          {/* Special Instructions */}
          {order.specialInstructions && (
            <View className="mt-3 pt-3 border-t border-gray-100">
              <Text className="text-sm font-semibold text-gray-700 mb-1">
                Special Instructions
              </Text>
              <Text className="text-sm text-gray-600">{order.specialInstructions}</Text>
            </View>
          )}
        </View>

        {/* Pricing Breakdown */}
        <View className="bg-white mb-2" style={{ padding: isSmallDevice ? SPACING.lg : SPACING.xl }}>
          <Text className="font-bold text-gray-900 mb-3" style={{ fontSize: FONT_SIZES.lg }}>Payment Details</Text>


          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600">Subtotal</Text>
            <Text className="text-sm text-gray-900">₹{order.subtotal.toFixed(2)}</Text>
          </View>

          {order.charges.deliveryFee > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Delivery Fee</Text>
              <Text className="text-sm text-gray-900">₹{order.charges.deliveryFee.toFixed(2)}</Text>
            </View>
          )}

          {order.charges.serviceFee > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Service Fee</Text>
              <Text className="text-sm text-gray-900">₹{order.charges.serviceFee.toFixed(2)}</Text>
            </View>
          )}

          {order.charges.packagingFee > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Packaging Fee</Text>
              <Text className="text-sm text-gray-900">₹{order.charges.packagingFee.toFixed(2)}</Text>
            </View>
          )}

          {order.charges.platformFee > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Platform Fee</Text>
              <Text className="text-sm text-gray-900">₹{order.charges.platformFee.toFixed(2)}</Text>
            </View>
          )}

          {order.charges.surgeFee > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Surge Fee</Text>
              <Text className="text-sm text-gray-900">₹{order.charges.surgeFee.toFixed(2)}</Text>
            </View>
          )}

          {order.charges.smallOrderFee > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Small Order Fee</Text>
              <Text className="text-sm text-gray-900">₹{order.charges.smallOrderFee.toFixed(2)}</Text>
            </View>
          )}

          {order.charges.lateNightFee > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Late Night Fee</Text>
              <Text className="text-sm text-gray-900">₹{order.charges.lateNightFee.toFixed(2)}</Text>
            </View>
          )}

          {order.charges.taxAmount > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Tax</Text>
              <Text className="text-sm text-gray-900">₹{order.charges.taxAmount.toFixed(2)}</Text>
            </View>
          )}

          {/* Coupon Discount */}
          {order.discount?.couponCode && order.discount.discountType === 'FREE_DELIVERY' && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-green-600">
                Free Delivery ({order.discount.couponCode})
              </Text>
              <Text className="text-sm text-green-600">Applied</Text>
            </View>
          )}
          {order.discount?.couponCode && ((order.discount.discountAmount || 0) + (order.discount.addonDiscountAmount || 0)) > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-green-600">
                Discount ({order.discount.couponCode})
              </Text>
              <Text className="text-sm text-green-600">
                - ₹{((order.discount.discountAmount || 0) + (order.discount.addonDiscountAmount || 0)).toFixed(2)}
              </Text>
            </View>
          )}
          {order.discount?.extraVouchersIssued && order.discount.extraVouchersIssued > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm" style={{ color: '#2563EB' }}>
                Bonus Vouchers ({order.discount.couponCode})
              </Text>
              <Text className="text-sm" style={{ color: '#2563EB' }}>
                +{order.discount.extraVouchersIssued} issued
              </Text>
            </View>
          )}

          {/* Voucher Coverage */}
          {order.voucherUsage && order.voucherUsage.voucherCount > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-green-600">
                Voucher ({order.voucherUsage.voucherCount} used)
              </Text>
              <Text className="text-sm text-green-600">
                - ₹{(order.voucherUsage.mainCoursesCovered * (order.items[0]?.unitPrice || 0)).toFixed(2)}
              </Text>
            </View>
          )}

          <View className="flex-row justify-between pt-3 mt-2 border-t border-gray-200">
            <Text className="font-bold text-gray-900" style={{ fontSize: FONT_SIZES.base }}>Grand Total</Text>
            <Text className="font-bold text-gray-900" style={{ fontSize: FONT_SIZES.base }}>₹{order.grandTotal.toFixed(2)}</Text>
          </View>

          <View className="flex-row justify-between mt-2">
            <Text className="text-gray-600" style={{ fontSize: FONT_SIZES.sm }}>Amount Paid</Text>
            <Text className="font-semibold" style={{ color: '#FE8733', fontSize: FONT_SIZES.sm }}>
              ₹{order.amountPaid.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Delivery Address */}
        <View className="bg-white mb-2" style={{ padding: isSmallDevice ? SPACING.lg : SPACING.xl }}>
          <Text className="font-bold text-gray-900 mb-3" style={{ fontSize: FONT_SIZES.lg }}>Delivery Address</Text>

          <Text className="text-sm font-semibold text-gray-900">
            {order.deliveryAddress.contactName}
          </Text>
          <Text className="text-sm text-gray-600 mt-1">
            {order.deliveryAddress.addressLine1}
            {order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}
          </Text>
          <Text className="text-sm text-gray-600">
            {order.deliveryAddress.locality}, {order.deliveryAddress.city} - {order.deliveryAddress.pincode}
          </Text>
          {order.deliveryAddress.landmark && (
            <Text className="text-sm text-gray-500 mt-1">
              Landmark: {order.deliveryAddress.landmark}
            </Text>
          )}
          <Text className="text-sm text-gray-600 mt-2">
            Phone: {order.deliveryAddress.contactPhone}
          </Text>

          {order.deliveryNotes && (
            <View className="mt-3 pt-3 border-t border-gray-100">
              <Text className="text-sm font-semibold text-gray-700 mb-1">
                Delivery Notes
              </Text>
              <Text className="text-sm text-gray-600">{order.deliveryNotes}</Text>
            </View>
          )}
        </View>

        {/* Cancellation Info */}
        {order.status === 'CANCELLED' && order.cancellationReason && (
          <View className="bg-red-50 mx-5 rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-red-700 mb-1">
              Cancellation Reason
            </Text>
            <Text className="text-sm text-red-600">{order.cancellationReason}</Text>
            {order.cancelledAt && (
              <Text className="text-xs text-red-500 mt-2">
                Cancelled on {formatDateTime(order.cancelledAt)}
              </Text>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ padding: isSmallDevice ? SPACING.lg : SPACING.xl, marginBottom: SPACING['2xl'] }}>
          {/* Track Order - for active orders */}
          {isActiveOrder && (
            <TouchableOpacity
              onPress={handleTrackOrder}
              className="rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: '#FE8733', minHeight: TOUCH_TARGETS.comfortable }}
            >
              <Text className="text-white font-bold" style={{ fontSize: FONT_SIZES.base }}>Track Order</Text>
            </TouchableOpacity>
          )}

          {/* Cancel Order - if canCancel is true */}
          {order.canCancel && (
            <TouchableOpacity
              onPress={() => setShowCancelModal(true)}
              className="rounded-full items-center mb-3"
              style={{ borderWidth: 2, borderColor: '#EF4444', minHeight: TOUCH_TARGETS.comfortable }}
            >
              <Text className="font-bold" style={{ color: '#EF4444', fontSize: FONT_SIZES.base }}>
                Cancel Order
              </Text>
            </TouchableOpacity>
          )}

          {/* Rate Order - if canRate is true */}
          {order.canRate && !order.rating && (
            <TouchableOpacity
              onPress={() => setShowRateModal(true)}
              className="rounded-full items-center mb-3"
              style={{ backgroundColor: '#F59E0B', minHeight: TOUCH_TARGETS.comfortable }}
            >
              <Text className="text-white font-bold" style={{ fontSize: FONT_SIZES.base }}>Rate Order</Text>
            </TouchableOpacity>
          )}

          {/* Reorder - for delivered orders */}
          {order.status === 'DELIVERED' && (
            <TouchableOpacity
              onPress={() => showAlert('Coming Soon', 'Reorder functionality will be available soon!', undefined, 'default')}
              className="rounded-full items-center flex-row justify-center"
              style={{ backgroundColor: '#FFF7ED', minHeight: TOUCH_TARGETS.comfortable }}
            >
              <Image
                source={require('../../assets/icons/reorder2.png')}
                style={{ width: SPACING.iconSm, height: SPACING.iconSm, tintColor: '#FE8733', marginRight: 8 }}
                resizeMode="contain"
              />
              <Text className="font-bold" style={{ color: '#FE8733', fontSize: FONT_SIZES.base }}>
                Reorder
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Cancel Order Modal */}
      <CancelOrderModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelOrder}
        orderNumber={order.orderNumber}
        isLoading={isCancelling}
      />

      {/* Rate Order Modal */}
      <RateOrderModal
        visible={showRateModal}
        onClose={() => setShowRateModal(false)}
        onSubmit={handleRateOrder}
        orderNumber={order.orderNumber}
        isLoading={isRating}
      />
    </SafeAreaView>
  );
};

export default OrderDetailScreen;
