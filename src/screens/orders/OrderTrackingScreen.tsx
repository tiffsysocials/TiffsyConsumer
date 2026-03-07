// src/screens/orders/OrderTrackingScreen.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainTabParamList } from '../../types/navigation';
import { useAlert } from '../../context/AlertContext';
import apiService, { OrderTrackingData, Order, OrderStatus } from '../../services/api.service';
import CancelOrderModal from '../../components/CancelOrderModal';
import RateOrderModal from '../../components/RateOrderModal';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'OrderTracking'>;

// Order status steps for progress tracker
const STATUS_STEPS: OrderStatus[] = ['PLACED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

// Map status to step index
const getStepIndex = (status: OrderStatus): number => {
  switch (status) {
    case 'PENDING_KITCHEN_ACCEPTANCE':
    case 'PLACED':
    case 'ACCEPTED':
      return 0;
    case 'PREPARING':
    case 'READY':
    case 'PICKED_UP':
      return 1;
    case 'OUT_FOR_DELIVERY':
      return 2;
    case 'DELIVERED':
      return 3;
    case 'CANCELLED':
    case 'REJECTED':
      return -1;
    default:
      return 0;
  }
};

// Get status display text
const getStatusDisplayText = (status: OrderStatus): string => {
  switch (status) {
    case 'PENDING_KITCHEN_ACCEPTANCE':
      return 'Waiting for kitchen confirmation';
    case 'PLACED':
      return 'Order placed';
    case 'ACCEPTED':
      return 'Order confirmed';
    case 'PREPARING':
      return 'Meal is cooking';
    case 'READY':
      return 'Ready for pickup';
    case 'PICKED_UP':
      return 'Picked up';
    case 'OUT_FOR_DELIVERY':
      return 'Out for delivery';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Order cancelled';
    case 'REJECTED':
      return 'Order rejected';
    default:
      return status;
  }
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

// Check if order is out for delivery (status where OTP should be shown)
const isOutForDeliveryStatus = (status: OrderStatus): boolean => {
  return status === 'PICKED_UP' || status === 'OUT_FOR_DELIVERY';
};

const OrderTrackingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId } = route.params;
  const { showAlert } = useAlert();
  const { isSmallDevice, width, height } = useResponsive();

  const [tracking, setTracking] = useState<OrderTrackingData | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [deliveryOtp, setDeliveryOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickupNotes, setPickupNotes] = useState('');
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [isRating, setIsRating] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved notes from AsyncStorage on mount
  useEffect(() => {
    const loadSavedNotes = async () => {
      try {
        const storageKey = `@order_notes_${orderId}`;
        const storedNotes = await AsyncStorage.getItem(storageKey);
        if (storedNotes) {
          setSavedNotes(JSON.parse(storedNotes));
        }
      } catch (error) {
        console.error('[OrderTracking] Error loading saved notes:', error);
      }
    };
    loadSavedNotes();
  }, [orderId]);

  // Fetch tracking data
  const fetchTracking = async () => {
    try {
      console.log('[OrderTracking] Fetching tracking for order:', orderId);
      setError(null);

      // Fetch both tracking and order data in parallel for complete information
      const [trackingResponse, orderResponse] = await Promise.all([
        apiService.trackOrder(orderId),
        apiService.getOrder(orderId),
      ]);

      console.log('[OrderTracking] Tracking Response:', JSON.stringify(trackingResponse, null, 2));
      console.log('[OrderTracking] Order Response:', JSON.stringify(orderResponse, null, 2));

      // Parse tracking response - API returns: { success: true, data: OrderTrackingData }
      const isTrackingSuccess = trackingResponse.success === true || (trackingResponse as any).message === true;
      const trackingData = trackingResponse.data || (trackingResponse as any).error;

      // Parse order response
      const isOrderSuccess = orderResponse.success === true || (orderResponse as any).message === true;
      let orderData: Order | null = null;

      const resp = orderResponse as any;
      let orderDeliveryOtp: string | null = null;
      if (resp?.data?.order?._id) {
        orderData = resp.data.order;
        orderDeliveryOtp = resp.data.deliveryOtp || null;
      } else if (resp?.error?.order?._id) {
        orderData = resp.error.order;
        orderDeliveryOtp = resp.error.deliveryOtp || null;
      } else if (resp?.data?._id) {
        orderData = resp.data;
        orderDeliveryOtp = resp.deliveryOtp || null;
      }

      console.log('[OrderTracking] Tracking success:', isTrackingSuccess, 'Order success:', isOrderSuccess);

      if (isTrackingSuccess && trackingData && trackingData.status) {
        console.log('[OrderTracking] Tracking loaded - Status:', trackingData.status);
        setTracking(trackingData);

        // Extract deliveryOtp from tracking or order response
        // The API returns deliveryOtp in the data object when status is PICKED_UP or OUT_FOR_DELIVERY
        const otpFromTracking = trackingData.deliveryOtp || (trackingResponse as any).data?.deliveryOtp;
        const otpFromResponse = otpFromTracking || orderDeliveryOtp || null;
        if (otpFromResponse) {
          console.log('[OrderTracking] Delivery OTP received:', otpFromResponse);
          setDeliveryOtp(otpFromResponse);
        } else if (!isOutForDeliveryStatus(trackingData.status)) {
          // Clear OTP if not in delivery status
          setDeliveryOtp(null);
        }

        // Use order from tracking response if available, otherwise use fetched order
        const finalOrder = trackingData.order || orderData;
        if (finalOrder) {
          setOrder(finalOrder);
        }
      } else {
        console.log('[OrderTracking] Failed to load tracking - No valid data found');
        setError('Failed to load tracking information');
      }
    } catch (err: any) {
      console.error('[OrderTracking] Error fetching tracking:', err.message);
      setError(err.message || 'Failed to load tracking information');
    } finally {
      setLoading(false);
    }
  };

  // Start polling for updates
  const startPolling = () => {
    // Poll every 30 seconds
    pollingRef.current = setInterval(() => {
      fetchTracking();
    }, 30000);
  };

  // Stop polling
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Fetch on mount and focus
  useFocusEffect(
    useCallback(() => {
      fetchTracking();
      startPolling();

      return () => {
        stopPolling();
      };
    }, [orderId])
  );

  // Handle call delivery guy
  const handleCallDelivery = () => {
    if (tracking?.driver?.phone) {
      Linking.openURL(`tel:${tracking.driver.phone}`);
    } else {
      showAlert('Not Available', 'Driver contact is not available yet', undefined, 'warning');
    }
  };

  // Handle message delivery guy
  const handleMessageDelivery = () => {
    if (tracking?.driver?.phone) {
      Linking.openURL(`sms:${tracking.driver.phone}`);
    } else {
      showAlert('Not Available', 'Driver contact is not available yet', undefined, 'warning');
    }
  };

  // Handle cancel order - open modal
  const handleCancelOrder = () => {
    console.log('[OrderTracking] Opening cancel modal for order:', orderId);
    setShowCancelModal(true);
  };

  // Handle confirm cancel - called from modal
  const handleConfirmCancel = async (reason: string) => {
    try {
      console.log('[OrderTracking] Cancelling order:', orderId, 'Reason:', reason);
      setIsCancelling(true);
      const response = await apiService.cancelOrder(orderId, reason);
      console.log('[OrderTracking] Cancel response:', JSON.stringify(response, null, 2));

      // Handle API response format: {message: true/false, data: string, error?: object}
      // or standard format: {success: boolean, message: string, data?: object}
      const isSuccess = response.success === true || (response as any).message === true;
      const responseData = (response as any).error || response.data;

      if (isSuccess) {
        console.log('[OrderTracking] Order cancelled successfully');
        setShowCancelModal(false);

        const successMessage = responseData?.message ||
          (typeof response.data === 'string' ? response.data : 'Order cancelled successfully.');

        showAlert('Order Cancelled', successMessage, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ], 'success');
      } else {
        const errorMessage = typeof response.data === 'string'
          ? response.data
          : (response.message && typeof response.message === 'string' ? response.message : 'Failed to cancel order');
        console.log('[OrderTracking] Cancel failed:', errorMessage);
        setShowCancelModal(false);
        // Hide cancel button after failed attempt (window likely expired)
        if (order) {
          setOrder({ ...order, canCancel: false });
        }
        showAlert('Cannot Cancel Order', errorMessage, undefined, 'error');
      }
    } catch (err: any) {
      console.error('[OrderTracking] Error cancelling order:', err.message);
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

  // Handle rate order - open modal
  const handleRateOrder = () => {
    console.log('[OrderTracking] Opening rate modal for order:', orderId);
    setShowRateModal(true);
  };

  // Handle confirm rating - called from modal
  const handleConfirmRating = async (stars: number, comment?: string) => {
    try {
      console.log('[OrderTracking] Rating order:', orderId, 'Stars:', stars);
      setIsRating(true);
      const response = await apiService.rateOrder(orderId, stars, comment);
      console.log('[OrderTracking] Rating response:', JSON.stringify(response, null, 2));

      // Handle API response format: {message: true/false, data: string, error?: object}
      const isSuccess = response.success === true || (response as any).message === true;

      if (isSuccess) {
        console.log('[OrderTracking] Order rated successfully');
        setShowRateModal(false);
        // Update local order state with rating
        if (order) {
          setOrder({
            ...order,
            rating: { stars, comment, ratedAt: new Date().toISOString() },
            canRate: false,
          });
        }
        showAlert('Thank you!', 'Your rating has been submitted successfully', undefined, 'success');
      } else {
        const errorMessage = typeof response.data === 'string'
          ? response.data
          : (response.message && typeof response.message === 'string' ? response.message : 'Failed to submit rating');
        console.log('[OrderTracking] Rating failed:', errorMessage);
        showAlert('Error', errorMessage, undefined, 'error');
      }
    } catch (err: any) {
      console.error('[OrderTracking] Error rating order:', err.message);
      showAlert('Error', err.message || 'Failed to submit rating', undefined, 'error');
    } finally {
      setIsRating(false);
    }
  };

  const handleViewReceipt = () => {
    // TODO: Implement receipt view/download
    showAlert('Coming Soon', 'Receipt download will be available soon!', undefined, 'default');
  };

  const handleSavePickupNotes = async () => {
    if (!pickupNotes.trim()) {
      showAlert('Empty Notes', 'Please enter pickup notes before saving', undefined, 'warning');
      return;
    }

    try {
      setIsSavingNotes(true);
      // TODO: Add API call to save pickup notes
      // await apiService.updateOrderNotes(orderId, pickupNotes);

      // Add the note to saved notes list
      const updatedNotes = [...savedNotes, pickupNotes.trim()];
      setSavedNotes(updatedNotes);

      // Save to AsyncStorage
      const storageKey = `@order_notes_${orderId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedNotes));

      showAlert('Notes Saved', 'Your pickup notes have been saved successfully', undefined, 'success');
      // Clear the input field after successful save
      setPickupNotes('');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to save pickup notes', undefined, 'error');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Current step in progress tracker
  const currentStep = tracking ? getStepIndex(tracking.status) : 0;
  const isCancelledOrRejected = tracking?.status === 'CANCELLED' || tracking?.status === 'REJECTED';

  // Check if we should show OTP (only when out for delivery)
  const shouldShowOtp = tracking && isOutForDeliveryStatus(tracking.status);
  const otpDigits = deliveryOtp ? deliveryOtp.split('') : [];

  // Debug logging
  console.log('[OrderTracking] Status:', tracking?.status, 'Current Step:', currentStep);

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#FE8733" />
        <Text className="text-gray-500 mt-4" style={{ fontSize: FONT_SIZES.base }}>Loading tracking info...</Text>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-5">
        <Text className="text-gray-500 mb-4 text-center" style={{ fontSize: FONT_SIZES.base }}>{error}</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            fetchTracking();
          }}
          className="rounded-full px-6"
          style={{ backgroundColor: '#FE8733', minHeight: TOUCH_TARGETS.comfortable }}
        >
          <Text className="text-white font-semibold" style={{ fontSize: FONT_SIZES.base }}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center" style={{ backgroundColor: 'rgba(237, 239, 241, 1)', paddingHorizontal: isSmallDevice ? SPACING.lg : SPACING.xl, paddingVertical: SPACING.md }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="rounded-full bg-orange-400 items-center justify-center"
            style={{ minWidth: TOUCH_TARGETS.minimum, minHeight: TOUCH_TARGETS.minimum }}
          >
            <Image
              source={require('../../assets/icons/arrow.png')}
              style={{ width: SPACING.iconLg, height: SPACING.iconLg }}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text className="flex-1 text-center font-bold text-gray-900 mr-10" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>
            Order Tracking
          </Text>
        </View>

        {/* Illustration */}
        <View className="items-center py-2" style={{ backgroundColor: 'rgba(237, 239, 241, 1)' }}>
          <Image
            source={require('../../assets/images/trackorder/tracking2.png')}
            style={{ width: width * 0.7, height: height * 0.22 }}
            resizeMode="contain"
          />
        </View>

        {/* Order Status - Combined Container */}
        <View className="bg-white px-5 py-6 mb-2">
          {/* Status Header */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xl font-bold text-gray-900">
              {tracking ? getStatusDisplayText(tracking.status) : 'Loading...'}
            </Text>
            <Text className="text-sm text-gray-500">
              Order ID - #{order?.orderNumber || '...'}
            </Text>
          </View>

          {/* Estimated Delivery */}
          {tracking?.estimatedDelivery && !isCancelledOrRejected && (
            <Text className="text-sm text-gray-600 mb-6">
              Arriving at <Text className="font-bold text-gray-900">{formatTime(tracking.estimatedDelivery)}</Text>
            </Text>
          )}

          {isCancelledOrRejected && (
            <Text className="text-sm text-red-500 mb-6">
              {tracking?.statusMessage || 'This order has been cancelled'}
            </Text>
          )}

          {/* Progress Tracker */}
          {!isCancelledOrRejected && (
            <View className="flex-row items-center justify-between mb-6">
              {/* Preparing */}
              <View className="items-center" style={{ width: 80 }}>
                <View className="w-12 h-12 rounded-full items-center justify-center mb-2">
                  <Image
                    source={require('../../assets/icons/prepared2.png')}
                    style={{
                      width: 40,
                      height: 40,
                      opacity: currentStep >= 0 ? 1 : 0.4,
                    }}
                    resizeMode="contain"
                  />
                </View>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: currentStep >= 0 ? '#FDB766' : '#9CA3AF' }}
                >
                  Preparing
                </Text>
              </View>

              {/* Line 1 */}
              <View style={{ flex: 1, height: 2, marginHorizontal: 4, marginBottom: 24 }}>
                <View
                  style={{
                    flex: 1,
                    height: 2,
                    backgroundColor: currentStep >= 1 ? 'rgba(255, 136, 0, 1)' : '#D1D5DB',
                  }}
                />
              </View>

              {/* Out For Delivery */}
              <View className="items-center" style={{ width: 80 }}>
                <View
                  className="items-center justify-center mb-2"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: currentStep >= 2 ? '#FE8733' : '#9CA3AF',
                  }}
                >
                  <MaterialCommunityIcons
                    name="truck-delivery"
                    size={24}
                    color="#FFFFFF"
                  />
                </View>
                <Text
                  className="text-xs font-semibold text-center"
                  style={{ color: currentStep >= 2 ? '#FDB766' : '#9CA3AF' }}
                >
                  Out For Delivery
                </Text>
              </View>

              {/* Line 2 */}
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: currentStep >= 2 ? 'rgba(255, 136, 0, 1)' : '#D1D5DB',
                  marginHorizontal: 4,
                  marginBottom: 24,
                }}
              />

              {/* Delivered */}
              <View className="items-center" style={{ width: 80 }}>
                <View
                  className="items-center justify-center mb-2"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: currentStep >= 3 ? '#FE8733' : '#9CA3AF',
                  }}
                >
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={23}
                    color="#FFFFFF"
                  />
                </View>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: currentStep >= 3 ? '#FDB766' : '#9CA3AF' }}
                >
                  Delivered
                </Text>
              </View>
            </View>
          )}

          {/* Call Delivery Guy */}
          {tracking?.canContactDriver && tracking?.driver && (
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center flex-1">
                <Image
                  source={require('../../assets/images/homepage/lunchThali.png')}
                  style={{ width: 56, height: 56, borderRadius: 28 }}
                  resizeMode="cover"
                />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-bold text-gray-900">Call Delivery Guy</Text>
                  <Text className="text-sm text-gray-500">{tracking.driver.name}</Text>
                </View>
              </View>

              <View className="flex-row">
                <TouchableOpacity
                  onPress={handleMessageDelivery}
                  className="rounded-full bg-orange-50 items-center justify-center mr-2"
                  style={{ minWidth: TOUCH_TARGETS.comfortable, minHeight: TOUCH_TARGETS.comfortable }}
                >
                  <Image
                    source={require('../../assets/icons/mail2.png')}
                    style={{ width: SPACING.iconLg, height: SPACING.iconLg }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCallDelivery}
                  className="rounded-full bg-orange-50 items-center justify-center"
                  style={{ minWidth: TOUCH_TARGETS.comfortable, minHeight: TOUCH_TARGETS.comfortable }}
                >
                  <Image
                    source={require('../../assets/icons/call3.png')}
                    style={{ width: SPACING.iconLg, height: SPACING.iconLg }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Pickup Notes */}
          {!isCancelledOrRejected && tracking?.status !== 'DELIVERED' && (
            <View
              className="flex-row items-center rounded-full mb-6"
              style={{ height: 48, backgroundColor: 'rgba(241, 241, 241, 1)', paddingHorizontal: 16 }}
              pointerEvents="box-none"
            >
              <TextInput
                placeholder="Any Pickup Notes?"
                placeholderTextColor="rgba(143, 143, 143, 1)"
                value={pickupNotes}
                onChangeText={setPickupNotes}
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: '#111827',
                  paddingRight: 8,
                }}
                multiline={false}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={handleSavePickupNotes}
                disabled={isSavingNotes}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FE8733',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  gap: 4,
                }}
              >
                {isSavingNotes ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Image
                      source={require('../../assets/icons/pen2.png')}
                      style={{ width: 16, height: 16, tintColor: 'white' }}
                      resizeMode="contain"
                    />
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>Add</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Saved Pickup Notes */}
          {savedNotes.length > 0 && !isCancelledOrRejected && tracking?.status !== 'DELIVERED' && (
            <View className="px-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Pickup Notes:</Text>
              {savedNotes.map((note, index) => (
                <View
                  key={index}
                  className="bg-orange-50 rounded-lg px-4 py-3 mb-2"
                  style={{ borderLeftWidth: 3, borderLeftColor: '#FE8733' }}
                >
                  <Text className="text-sm text-gray-800">{note}</Text>
                </View>
              ))}
            </View>
          )}

          {/* OTP Section - Only show when out for delivery */}
          {shouldShowOtp && deliveryOtp && (
            <View
              style={{
                backgroundColor: '#E8F5E9',
                borderRadius: 12,
                padding: 20,
                borderWidth: 2,
                borderColor: '#4CAF50',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: '#388E3C',
                  fontWeight: '600',
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                Your Delivery OTP
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                {otpDigits.map((digit, index) => (
                  <View
                    key={index}
                    style={{
                      width: 50,
                      height: 60,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 8,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: '#4CAF50',
                    }}
                  >
                    <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#2E7D32' }}>
                      {digit}
                    </Text>
                  </View>
                ))}
              </View>
              <Text
                style={{
                  fontSize: 12,
                  color: '#666666',
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                Share this code with your delivery partner
              </Text>
            </View>
          )}

          {/* OTP Error - Show when out for delivery but OTP is missing */}
          {shouldShowOtp && !deliveryOtp && (
            <View
              style={{
                backgroundColor: '#FFF3E0',
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: '#FFB74D',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: '#E65100',
                  textAlign: 'center',
                }}
              >
                Delivery OTP not available. Please contact support if the driver arrives.
              </Text>
            </View>
          )}
        </View>

        {/* Order Summary */}
        {order && (
          <View className="bg-white px-5 py-5 mb-2" style={{ borderRadius: 25 }}>
            <Text className="text-xl font-bold text-gray-900 mb-4">Order Summary</Text>

            {/* Order Items */}
            {order.items.map((item, index) => (
              <View key={index}>
                <View className="flex-row justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-sm text-gray-900">{item.name}</Text>
                    <Text className="text-sm text-gray-500 ml-2">x{item.quantity}</Text>
                  </View>
                  {order.voucherUsage && order.voucherUsage.mainCoursesCovered > 0 && index === 0 ? (
                    <Text
                      style={{
                        textDecorationLine: 'line-through',
                        color: 'rgba(227, 22, 22, 1)',
                        fontWeight: '600',
                        fontSize: 14,
                      }}
                    >
                      ₹{item.totalPrice.toFixed(2)}
                    </Text>
                  ) : (
                    <Text style={{ color: 'rgba(0, 0, 0, 1)', fontWeight: '600', fontSize: 14 }}>
                      ₹{item.totalPrice.toFixed(2)}
                    </Text>
                  )}
                </View>

                {/* Addons */}
                {item.addons?.map((addon, addonIndex) => (
                  <View key={addonIndex} className="flex-row justify-between mb-3 ml-4">
                    <View className="flex-row items-center flex-1">
                      <Text className="text-sm text-gray-600">+ {addon.name}</Text>
                      <Text className="text-sm text-gray-500 ml-2">x{addon.quantity}</Text>
                    </View>
                    <Text style={{ color: 'rgba(0, 0, 0, 1)', fontWeight: '600', fontSize: 14 }}>
                      ₹{addon.totalPrice.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Voucher Applied */}
            {order.voucherUsage && order.voucherUsage.voucherCount > 0 && (
              <View className="flex-row items-center mb-3">
                <Text className="text-xs font-semibold" style={{ color: '#16A34A' }}>
                  {order.voucherUsage.voucherCount} Voucher Applied
                </Text>
                <View
                  className="ml-2 w-4 h-4 rounded-full items-center justify-center"
                  style={{ backgroundColor: '#16A34A' }}
                >
                  <Text className="text-white text-xs font-bold">✓</Text>
                </View>
              </View>
            )}

            {/* Other Charges */}
            {order.charges && (
              <View className="flex-row justify-between mb-4 pb-4 border-b border-gray-200">
                <Text className="text-sm text-gray-900">Other Charges</Text>
                <Text style={{ color: 'rgba(0, 0, 0, 1)', fontWeight: '600', fontSize: 14 }}>
                  ₹{(
                    (order.charges.deliveryFee || 0) +
                    (order.charges.serviceFee || 0) +
                    (order.charges.packagingFee || 0) +
                    (order.charges.taxAmount || 0)
                  ).toFixed(2)}
                </Text>
              </View>
            )}

            {/* Total Amount */}
            <View className="flex-row justify-between">
              <Text className="text-lg font-bold text-gray-900">Total Amount:</Text>
              <Text className="text-lg font-bold" style={{ color: '#FE8733' }}>
                ₹{order.amountPaid.toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* View Receipt Button */}
        <View style={{ paddingHorizontal: isSmallDevice ? SPACING.lg : SPACING.xl, marginBottom: SPACING.md }}>
          <TouchableOpacity
            onPress={handleViewReceipt}
            className="rounded-full flex-row items-center justify-center"
            style={{ backgroundColor: 'rgba(255, 245, 242, 1)', minHeight: TOUCH_TARGETS.comfortable }}
          >
            <Image
              source={require('../../assets/icons/reciept.png')}
              style={{ width: SPACING.iconSm, height: SPACING.iconSm, marginRight: 8 }}
              resizeMode="contain"
            />
            <Text className="font-bold" style={{ color: 'rgba(255, 136, 0, 1)', fontSize: FONT_SIZES.base }}>
              View Receipt
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cancel Order Button - Only show if order can be cancelled (within 1-min window) */}
        {!isCancelledOrRejected && tracking?.status !== 'DELIVERED' && order?.canCancel === true && (
          <View style={{ paddingHorizontal: isSmallDevice ? SPACING.lg : SPACING.xl, marginBottom: SPACING.md }}>
            <TouchableOpacity
              onPress={handleCancelOrder}
              disabled={isCancelling}
              className="rounded-full items-center justify-center"
              style={{
                backgroundColor: isCancelling ? '#FCA5A5' : 'rgba(255, 136, 0, 1)',
                minHeight: TOUCH_TARGETS.comfortable,
              }}
            >
              {isCancelling ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold" style={{ fontSize: FONT_SIZES.base }}>Cancel Order</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Rate Order Button - Only show for delivered orders that haven't been rated */}
        {tracking?.status === 'DELIVERED' && !order?.rating && (order?.canRate !== false) && (
          <View style={{ paddingHorizontal: isSmallDevice ? SPACING.lg : SPACING.xl, marginBottom: SPACING.md }}>
            <TouchableOpacity
              onPress={handleRateOrder}
              disabled={isRating}
              className="rounded-full items-center"
              style={{
                backgroundColor: isRating ? '#FDE68A' : '#F59E0B',
                minHeight: TOUCH_TARGETS.comfortable,
              }}
            >
              {isRating ? (
                <ActivityIndicator color="white" />
              ) : (
                <View className="flex-row items-center">
                  <Image
                    source={require('../../assets/icons/star.png')}
                    style={{ width: SPACING.iconSm, height: SPACING.iconSm, tintColor: 'white', marginRight: 8 }}
                    resizeMode="contain"
                  />
                  <Text className="text-white font-bold" style={{ fontSize: FONT_SIZES.base }}>Rate Your Order</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Already Rated Display */}
        {tracking?.status === 'DELIVERED' && order?.rating && (
          <View className="px-5 mb-4">
            <View className="bg-green-50 rounded-xl p-4 flex-row items-center">
              <View className="flex-row items-center mr-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Image
                    key={star}
                    source={require('../../assets/icons/star.png')}
                    style={{
                      width: 16,
                      height: 16,
                      tintColor: star <= order.rating!.stars ? '#F59E0B' : '#D1D5DB',
                      marginRight: 2,
                    }}
                    resizeMode="contain"
                  />
                ))}
              </View>
              <Text className="text-green-700 font-semibold">Thanks for your rating!</Text>
            </View>
          </View>
        )}

        {/* Order Timeline */}
        {tracking?.timeline && tracking.timeline.length > 0 && (
          <View className="bg-white px-5 py-5 mb-8">
            <Text className="text-lg font-bold text-gray-900 mb-4">Order Timeline</Text>
            {tracking.timeline.map((event, index) => {
              const isCurrentStatus = event.status === tracking.status;
              return (
                <View key={index} className="flex-row mb-3">
                  <View className="items-center mr-3">
                    <View
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: isCurrentStatus ? '#FE8733' : '#D1D5DB',
                      }}
                    />
                    {index < tracking.timeline.length - 1 && (
                      <View
                        style={{
                          width: 2,
                          height: 30,
                          backgroundColor: '#D1D5DB',
                        }}
                      />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900">
                      {event.message || event.status}
                    </Text>
                    <Text className="text-xs text-gray-500">{formatTime(event.timestamp)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Cancel Order Modal */}
      <CancelOrderModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
        orderNumber={order?.orderNumber}
        isLoading={isCancelling}
      />

      {/* Rate Order Modal */}
      <RateOrderModal
        visible={showRateModal}
        onClose={() => setShowRateModal(false)}
        onSubmit={handleConfirmRating}
        orderNumber={order?.orderNumber}
        isLoading={isRating}
      />
    </SafeAreaView>
  );
};

export default OrderTrackingScreen;
