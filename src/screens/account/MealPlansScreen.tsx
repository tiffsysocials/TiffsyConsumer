// src/screens/account/MealPlansScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import Svg, { Path } from 'react-native-svg';
import { MainTabParamList } from '../../types/navigation';
import { useSubscription } from '../../context/SubscriptionContext';
import { useUser } from '../../context/UserContext';
import { usePayment } from '../../context/PaymentContext';
import { SubscriptionPlan, PurchaseSubscriptionResponse, CancelSubscriptionResponse } from '../../services/api.service';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'MealPlans'>;

const MealPlansScreen: React.FC<Props> = ({ navigation }) => {
  const { user, isGuest } = useUser();
  const {
    plans,
    plansLoading,
    subscriptions,
    activeSubscription,
    voucherSummary,
    usableVouchers,
    loading,
    error,
    fetchPlans,
    fetchSubscriptions,
    fetchVouchers,
    cancelSubscription,
    clearError,
  } = useSubscription();
  const { processSubscriptionPayment, isProcessing: isPaymentProcessing } = usePayment();
  const { isSmallDevice } = useResponsive();

  // Modal states
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCancelSuccessModal, setShowCancelSuccessModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseSubscriptionResponse | null>(null);
  const [cancelResult, setCancelResult] = useState<CancelSubscriptionResponse | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSubscriptionDetails, setShowSubscriptionDetails] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');

  // Fetch plans on mount
  useEffect(() => {
    console.log('[MealPlansScreen] useEffect - Fetching plans');
    fetchPlans();
  }, [fetchPlans]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    console.log('[MealPlansScreen] onRefresh - Starting refresh');
    setRefreshing(true);
    await Promise.all([fetchPlans(), fetchSubscriptions()]);
    setRefreshing(false);
    console.log('[MealPlansScreen] onRefresh - Refresh complete');
  }, [fetchPlans, fetchSubscriptions]);

  // Handle subscribe button press
  const handleSubscribe = (plan: SubscriptionPlan) => {
    console.log('[MealPlansScreen] handleSubscribe - Plan selected:', plan.name);
    setSelectedPlan(plan);
    setShowPurchaseModal(true);
  };

  // Confirm purchase with Razorpay payment
  const confirmPurchase = async () => {
    if (!selectedPlan) return;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('[MealPlansScreen] BEFORE PURCHASE:');
    console.log('  - usableVouchers:', usableVouchers);
    console.log('  - voucherSummary:', JSON.stringify(voucherSummary));
    console.log('  - active subscriptions:', subscriptions.filter(sub => sub.status === 'ACTIVE').length);
    console.log('  - purchasing plan:', selectedPlan.name);
    console.log('  - plan vouchers:', selectedPlan.totalVouchers);
    console.log('═══════════════════════════════════════════════════════════');

    setIsProcessing(true);
    setShowPurchaseModal(false); // Close modal before opening Razorpay

    try {
      // Process payment via Razorpay
      const paymentResult = await processSubscriptionPayment(selectedPlan._id);

      if (!paymentResult.success) {
        // Payment failed or cancelled
        if (paymentResult.error === 'Payment cancelled') {
          console.log('[MealPlansScreen] Payment cancelled by user');
          // Just close, user can try again
          return;
        }

        // Payment failed
        console.log('[MealPlansScreen] Payment failed:', paymentResult.error);
        setFailureMessage(paymentResult.error || 'Payment could not be processed. Please try again.');
        setShowFailureModal(true);
        return;
      }

      // Payment successful - refresh data
      console.log('[MealPlansScreen] Payment successful, refreshing data...');
      await Promise.all([fetchSubscriptions(), fetchVouchers()]);

      console.log('═══════════════════════════════════════════════════════════');
      console.log('[MealPlansScreen] AFTER PURCHASE:');
      console.log('  - Payment ID:', paymentResult.paymentId);
      console.log('  - Subscription ID:', paymentResult.subscriptionId);
      console.log('  - NEW usableVouchers:', usableVouchers);
      console.log('  - NEW voucherSummary:', JSON.stringify(voucherSummary));
      console.log('  - EXPECTED total:', usableVouchers, '+', selectedPlan.totalVouchers, '=', usableVouchers + selectedPlan.totalVouchers);
      console.log('═══════════════════════════════════════════════════════════');

      // Calculate estimated expiry date (plan duration from purchase date)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + selectedPlan.durationDays);

      // Set purchase result for success modal
      setPurchaseResult({
        success: true,
        message: 'Subscription purchased successfully',
        data: {
          subscription: {
            _id: paymentResult.subscriptionId || '',
            planId: selectedPlan._id,
            status: 'ACTIVE',
            startDate: new Date().toISOString(),
            endDate: expiryDate.toISOString(),
          },
          vouchersIssued: selectedPlan.totalVouchers,
          voucherExpiryDate: expiryDate.toISOString(),
        },
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      console.log('[MealPlansScreen] confirmPurchase - Purchase failed:', err.message || err);
      setFailureMessage(err.message || 'Failed to complete purchase. Please try again.');
      setShowFailureModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle cancel subscription
  const handleCancelSubscription = () => {
    console.log('[MealPlansScreen] handleCancelSubscription - Opening cancel modal');
    setShowCancelModal(true);
  };

  // Confirm cancellation
  const confirmCancellation = async () => {
    if (!activeSubscription) return;

    console.log('[MealPlansScreen] confirmCancellation - Starting cancellation');
    setIsProcessing(true);
    try {
      const result = await cancelSubscription(activeSubscription._id, cancelReason || undefined);
      console.log('[MealPlansScreen] confirmCancellation - Cancellation successful');
      setCancelResult(result);
      setShowCancelModal(false);
      setShowCancelSuccessModal(true);
      setCancelReason('');
      setShowSubscriptionDetails(false);
    } catch (err: any) {
      console.log('[MealPlansScreen] confirmCancellation - Cancellation failed:', err.message || err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: '2-digit' };
    return date.toLocaleDateString('en-IN', options);
  };

  // Calculate savings - first plan uses originalPrice, others compare against first plan's per-voucher rate
  const calculateSavings = (plan: SubscriptionPlan, index: number) => {
    if (index === 0 || plans.length === 0) {
      return plan.originalPrice - plan.price;
    }
    const basePricePerVoucher = Math.round(plans[0].price / plans[0].totalVouchers);
    const thisPricePerVoucher = Math.round(plan.price / plan.totalVouchers);
    return (basePricePerVoucher - thisPricePerVoucher) * plan.totalVouchers;
  };

  // Calculate price per voucher
  const calculatePricePerVoucher = (plan: SubscriptionPlan) => {
    return Math.round(plan.price / plan.totalVouchers);
  };

  // Render loading skeleton
  const renderLoadingSkeleton = () => (
    <View className="px-5 mb-6">
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          className="mb-4 bg-gray-200 rounded-3xl"
          style={{ height: 160, opacity: 0.5 }}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#0A1F2E' }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F2E" />

      <ScrollView
        className="flex-1 bg-gray-50"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FE8733']} />
        }
      >
        {/* Background Image - positioned to extend behind Purchase Vouchers */}
        <Image
          source={require('../../assets/images/myaccount/mealplansbackground.png')}
          style={{
            position: 'absolute',
            width: Dimensions.get('window').width + 34,
            height: 535,
            top: 0,
            left: -17,
            opacity: 1,
          }}
          resizeMode="cover"
        />

        {/* Top Header - Profile, Location, Notification */}
        <View>
          <View className="px-5 pt-3 pb-[68px]">
            <View className="flex-row items-center justify-between mb-4">
              {/* Back Button */}
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

              <View className="flex-1" />

              {/* Voucher Button */}
              <TouchableOpacity
                onPress={() => navigation.navigate('Vouchers')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  borderRadius: 20,
                  paddingVertical: SPACING.sm,
                  paddingHorizontal: SPACING.md,
                  gap: SPACING.sm,
                  minHeight: TOUCH_TARGETS.minimum,
                }}
              >
                <Image
                  source={require('../../assets/icons/voucher5.png')}
                  style={{ width: SPACING.iconSize, height: SPACING.iconSize }}
                  resizeMode="contain"
                />
                <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#FE8733' }}>{usableVouchers}</Text>
              </TouchableOpacity>
            </View>

            {/* Greeting Text */}
            <View>
              <Text
                className="text-white"
                style={{
                  fontFamily: 'DMSans-SemiBold',
                  fontWeight: '600',
                  fontSize: 36,
                  lineHeight: 42,
                }}
              >
                Hello {user?.name?.split(' ')[0] || 'there'}
              </Text>
              <Text
                className="text-white"
                style={{
                  fontFamily: 'DMSans-SemiBold',
                  fontWeight: '600',
                  fontSize: 36,
                  lineHeight: 42,
                }}
              >
                Enjoy Experience
              </Text>
            </View>
          </View>
        </View>

        {/* Purchase Vouchers Section */}
        <View
          style={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 33,
            borderTopRightRadius: 33,
            marginTop: -40,
            alignSelf: 'center',
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 24,
          }}
        >
          {/* Purchase Vouchers Heading */}
          <Text
            style={{
              fontFamily: 'DMSans-SemiBold',
              fontWeight: '600',
              fontSize: 20,
              lineHeight: 30,
              color: '#000000',
              marginBottom: 16,
            }}
          >
            Purchase Vouchers
          </Text>

          {/* Current Voucher Balance */}
          <View style={{ borderRadius: 33, overflow: 'hidden' }}>
            <Image
              source={require('../../assets/images/myaccount/voucherbackgound.png')}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            <View style={{ padding: 20 }}>
              {/* Icon */}
              <View style={{ marginBottom: 16 }}>
                <Image
                  source={require('../../assets/icons/newvoucher2.png')}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
              </View>

              {/* Vouchers Count */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#1F2937' }}>
                  {usableVouchers}{' '}
                  <Text style={{ fontSize: 16, fontWeight: 'normal', color: '#374151' }}>vouchers</Text>
                </Text>
              </View>

              {/* Description */}
              <Text style={{ fontSize: 14, lineHeight: 20, color: 'rgba(71, 71, 71, 1)' }}>
                {subscriptions.filter(sub => sub.status === 'ACTIVE').length > 0
                  ? subscriptions.filter(sub => sub.status === 'ACTIVE').length === 1
                    ? `Active plan: ${activeSubscription?.planName || 'Subscription'}`
                    : `${subscriptions.filter(sub => sub.status === 'ACTIVE').length} active subscriptions`
                  : 'Purchase a plan to get vouchers for your meals'}
              </Text>

              {/* View All Vouchers Link */}
              {!isGuest && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Vouchers')}
                  style={{ marginTop: 12 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FE8733' }}>
                    View All Vouchers →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Choose Your Plan */}
        <View
          style={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            alignSelf: 'center',
            paddingHorizontal: 24,
            paddingTop: 14,
            paddingBottom: 16,
          }}
        >
          <Text
            style={{
              fontFamily: 'DMSans-SemiBold',
              fontWeight: '600',
              fontSize: 20,
              lineHeight: 30,
              color: '#000000',
              marginBottom: 19,
            }}
          >
            Choose Your Plan
          </Text>

          {/* Loading State */}
          {plansLoading && renderLoadingSkeleton()}

          {/* Error State */}
          {error && !plansLoading && (
            <View className="bg-red-50 rounded-xl p-4 mb-4">
              <Text className="text-red-600 text-center">{error}</Text>
              <TouchableOpacity onPress={() => { clearError(); fetchPlans(); }} className="mt-2">
                <Text className="text-center text-red-600 font-semibold">Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Plans List */}
          {!plansLoading &&
            plans.map((plan, index) => {
              const savings = calculateSavings(plan, index);
              const pricePerVoucher = calculatePricePerVoucher(plan);
              const activeSubscriptionsForPlan = subscriptions.filter(
                sub => sub.status === 'ACTIVE' && sub.planSnapshot?.name === plan.name
              );
              const hasActivePlan = activeSubscriptionsForPlan.length > 0;

              return (
                <TouchableOpacity
                  key={plan._id}
                  onPress={() => !isGuest && handleSubscribe(plan)}
                  activeOpacity={0.8}
                  style={{
                    width: '100%',
                    minHeight: 130,
                    borderRadius: 28,
                    borderWidth: 1,
                    borderColor: '#FE8733',
                    marginBottom: 16,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {/* Background Image */}
                  <Image
                    source={require('../../assets/images/myaccount/voucherbackgound.png')}
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />

                  {/* Content */}
                  <View style={{ flex: 1, padding: 16 }}>
                    {/* Voucher Icon + Plan Name */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Image
                        source={require('../../assets/icons/newvoucher2.png')}
                        style={{ width: 22, height: 22, marginRight: 8 }}
                        resizeMode="contain"
                      />
                      <Text
                        style={{
                          fontFamily: 'DMSans-SemiBold',
                          fontWeight: '600',
                          fontSize: 14,
                          color: '#000000',
                        }}
                      >
                        {plan.name}
                      </Text>
                    </View>

                    {/* Save Badge - positioned top right */}
                    {savings > 0 && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 14,
                          right: 14,
                          backgroundColor: 'rgba(233, 255, 238, 1)',
                          borderRadius: 16,
                          paddingHorizontal: 10,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'DMSans-SemiBold',
                            fontWeight: '600',
                            fontSize: 11,
                            color: 'rgba(0, 139, 30, 1)',
                          }}
                        >
                          Save ₹{savings}
                        </Text>
                      </View>
                    )}

                    {/* Price Row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View>
                        {/* Price */}
                        <Text
                          style={{
                            fontFamily: 'DMSans-SemiBold',
                            fontWeight: '600',
                            fontSize: 24,
                            lineHeight: 28,
                            color: '#000000',
                          }}
                        >
                          ₹{plan.price.toFixed(2)}
                        </Text>

                        {/* Vouchers and Meals */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                          <Text
                            style={{
                              fontFamily: 'Inter',
                              fontWeight: '400',
                              fontSize: 12,
                              color: '#000000',
                            }}
                          >
                            {plan.totalVouchers} Vouchers
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'Inter',
                              fontWeight: '400',
                              fontSize: 12,
                              color: '#000000',
                              marginHorizontal: 6,
                            }}
                          >
                            •
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'Inter',
                              fontWeight: '400',
                              fontSize: 12,
                              color: '#000000',
                            }}
                          >
                            {plan.vouchersPerDay} Meals/Day
                          </Text>
                        </View>
                      </View>

                      {/* Days */}
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                          <Text
                            style={{
                              fontFamily: 'DMSans-SemiBold',
                              fontWeight: '600',
                              fontSize: 30,
                              lineHeight: 34,
                              color: '#000000',
                            }}
                          >
                            {plan.durationDays}
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'DMSans-Medium',
                              fontWeight: '500',
                              fontSize: 15,
                              lineHeight: 22,
                              color: '#000000',
                              marginLeft: 3,
                            }}
                          >
                            Days
                          </Text>
                        </View>

                        {/* Price per voucher */}
                        <Text
                          style={{
                            fontFamily: 'Inter',
                            fontWeight: '400',
                            fontSize: 12,
                            color: '#000000',
                            marginTop: 3,
                          }}
                        >
                          ₹{pricePerVoucher}/Voucher
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

          {/* Empty State */}
          {!plansLoading && plans.length === 0 && !error && (
            <View className="bg-gray-100 rounded-xl p-6">
              <Text className="text-center text-gray-600">No plans available at the moment</Text>
            </View>
          )}
        </View>

        {/* How Vouchers Work */}
        <View
          style={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            alignSelf: 'center',
            borderRadius: 24,
            paddingHorizontal: 24,
            paddingVertical: 20,
          }}
        >
          <Text
            style={{
              fontFamily: 'DMSans-SemiBold',
              fontWeight: '600',
              fontSize: 20,
              lineHeight: 30,
              color: '#000000',
              marginBottom: 16,
            }}
          >
            How voucher's work?
          </Text>

          <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FE8733', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5z"
                    stroke="#FFFFFF"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#1F2937', marginBottom: 4 }}>
                  1 Voucher = 1 Meal
                </Text>
                <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}>
                  Purchase vouchers in advance to enjoy convenient and hassle-free meal deliveries
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FE8733', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"
                    stroke="#FFFFFF"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#1F2937', marginBottom: 4 }}>
                  Valid for Plan Duration
                </Text>
                <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}>
                  Each voucher can be redeemed for one meal of your choice
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FE8733', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                    stroke="#FFFFFF"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#1F2937', marginBottom: 4 }}>
                  Add-ons available
                </Text>
                <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}>
                  Vouchers are valid for the duration specified in your plan
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>

      {/* Purchase Confirmation Modal */}
      <Modal visible={showPurchaseModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-5">
          <View className="bg-white rounded-3xl w-full max-w-md p-6">
            <Text className="text-xl font-bold text-gray-900 mb-4 text-center">
              Confirm Purchase
            </Text>

            {selectedPlan && (
              <>
                {/* Show helpful message if user already has this plan active */}
                {subscriptions.filter(sub => sub.status === 'ACTIVE' && sub.planSnapshot?.name === selectedPlan.name).length > 0 && (
                  <View className="bg-blue-50 rounded-xl p-3 mb-4">
                    <Text className="text-sm text-blue-800 text-center">
                      You already have this plan active. Purchasing again will add {selectedPlan.totalVouchers} more vouchers to your account!
                    </Text>
                  </View>
                )}

                <View className="bg-gray-50 rounded-xl p-4 mb-4">
                  <Text className="text-lg font-semibold text-gray-900 mb-2">
                    {selectedPlan.name}
                  </Text>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-gray-600">Duration</Text>
                    <Text className="font-semibold">{selectedPlan.durationDays} days</Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-gray-600">Vouchers</Text>
                    <Text className="font-semibold">{selectedPlan.totalVouchers}</Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-gray-600">Price</Text>
                    <Text className="font-semibold text-lg">Rs.{selectedPlan.price}</Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-gray-600">After Purchase</Text>
                    <Text className="font-semibold text-green-600">{usableVouchers + selectedPlan.totalVouchers} total vouchers</Text>
                  </View>
                </View>

                <Text className="text-sm text-gray-500 text-center mb-4">
                  By subscribing, you agree to our terms and conditions. Payment will be processed immediately.
                </Text>
              </>
            )}

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowPurchaseModal(false)}
                className="flex-1 rounded-full border border-gray-300"
                style={{
                  paddingVertical: SPACING.md,
                  minHeight: TOUCH_TARGETS.comfortable,
                  justifyContent: 'center',
                }}
                disabled={isProcessing}
              >
                <Text className="text-center text-gray-600 font-semibold" style={{ fontSize: FONT_SIZES.base }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmPurchase}
                className="flex-1 rounded-full bg-orange-400"
                style={{
                  paddingVertical: SPACING.md,
                  minHeight: TOUCH_TARGETS.comfortable,
                  justifyContent: 'center',
                }}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-center text-white font-semibold" style={{ fontSize: FONT_SIZES.base }}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Purchase Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-5">
          <View className="bg-white rounded-3xl w-full max-w-md p-6 items-center">
            <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
              <Text className="text-3xl">✓</Text>
            </View>

            <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
              {subscriptions.filter(sub => sub.status === 'ACTIVE').length > 1
                ? 'Subscription Added!'
                : 'Purchase Successful!'}
            </Text>

            {purchaseResult && (
              <>
                <Text className="text-gray-600 text-center mb-4">
                  {purchaseResult.data.vouchersIssued} vouchers have been added to your account
                </Text>
                <View className="bg-gray-50 rounded-xl p-4 w-full mb-4">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-gray-600">Vouchers Issued</Text>
                    <Text className="font-semibold">{purchaseResult.data.vouchersIssued}</Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-gray-600">Total Vouchers Available</Text>
                    <Text className="font-semibold text-green-600">{usableVouchers}</Text>
                  </View>
                  {subscriptions.filter(sub => sub.status === 'ACTIVE').length > 1 && (
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-gray-600">Active Subscriptions</Text>
                      <Text className="font-semibold">{subscriptions.filter(sub => sub.status === 'ACTIVE').length}</Text>
                    </View>
                  )}
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600">Valid Until</Text>
                    <Text className="font-semibold">
                      {formatDate(purchaseResult.data.voucherExpiryDate)}
                    </Text>
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              onPress={() => {
                setShowSuccessModal(false);
                setPurchaseResult(null);
                setSelectedPlan(null);
              }}
              className="w-full py-3 rounded-full bg-orange-400"
            >
              <Text className="text-center text-white font-semibold">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Purchase Failed Modal */}
      <Modal visible={showFailureModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-5">
          <View className="bg-white rounded-3xl w-full max-w-md p-6 items-center">
            <View
              style={{
                width: 64,
                height: 64,
                backgroundColor: '#FEE2E2',
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 28, color: '#EF4444' }}>✕</Text>
            </View>

            <Text
              style={{
                fontFamily: 'DMSans-SemiBold',
                fontWeight: '600',
                fontSize: 20,
                color: '#111827',
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Purchase Failed
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: '#6B7280',
                textAlign: 'center',
                marginBottom: 20,
                lineHeight: 20,
              }}
            >
              {failureMessage}
            </Text>

            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                onPress={() => {
                  setShowFailureModal(false);
                  setFailureMessage('');
                  setSelectedPlan(null);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowFailureModal(false);
                  setFailureMessage('');
                  if (selectedPlan) {
                    setShowPurchaseModal(true);
                  }
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 999,
                  backgroundColor: '#FE8733',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Subscription Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-5">
          <View className="bg-white rounded-3xl w-full max-w-md p-6">
            <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
              Cancel Subscription
            </Text>

            <Text className="text-gray-600 text-center mb-4">
              Are you sure you want to cancel your subscription? This action cannot be undone.
            </Text>

            <TextInput
              placeholder="Reason for cancellation (optional)"
              value={cancelReason}
              onChangeText={setCancelReason}
              className="bg-gray-50 rounded-xl px-4 py-3 mb-4"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                className="flex-1 py-3 rounded-full border border-gray-300"
                disabled={isProcessing}
              >
                <Text className="text-center text-gray-600 font-semibold">Keep Plan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmCancellation}
                className="flex-1 py-3 rounded-full bg-red-500"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-center text-white font-semibold">Cancel Plan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancellation Success Modal */}
      <Modal visible={showCancelSuccessModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-5">
          <View className="bg-white rounded-3xl w-full max-w-md p-6 items-center">
            <View className="w-16 h-16 bg-orange-100 rounded-full items-center justify-center mb-4">
              <Text className="text-3xl">!</Text>
            </View>

            <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
              Subscription Cancelled
            </Text>

            {cancelResult && (
              <>
                <Text className="text-gray-600 text-center mb-4">
                  {cancelResult.data.vouchersCancelled} unused vouchers have been cancelled
                </Text>
                <View className="bg-gray-50 rounded-xl p-4 w-full mb-4">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-gray-600">Refund Eligible</Text>
                    <Text className="font-semibold">
                      {cancelResult.data.refundEligible ? 'Yes' : 'No'}
                    </Text>
                  </View>
                  {cancelResult.data.refundEligible && cancelResult.data.refundAmount && (
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-gray-600">Refund Amount</Text>
                      <Text className="font-semibold text-green-600">
                        Rs.{cancelResult.data.refundAmount}
                      </Text>
                    </View>
                  )}
                  <Text className="text-sm text-gray-500 mt-2">
                    {cancelResult.data.refundReason}
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              onPress={() => {
                setShowCancelSuccessModal(false);
                setCancelResult(null);
              }}
              className="w-full py-3 rounded-full bg-orange-400"
            >
              <Text className="text-center text-white font-semibold">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Global Loading Overlay */}
      {loading && !plansLoading && (
        <View className="absolute inset-0 bg-black/30 justify-center items-center">
          <View className="bg-white rounded-xl p-6">
            <ActivityIndicator size="large" color="#FE8733" />
            <Text className="mt-2 text-gray-600">Processing...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default MealPlansScreen;
