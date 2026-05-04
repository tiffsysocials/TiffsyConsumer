import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import { usePayment } from '../../context/PaymentContext';
import { useAlert } from '../../context/AlertContext';
import apiService, { ScheduledMealPricingData, AddonItem } from '../../services/api.service';
import paymentService from '../../services/payment.service';
import AddonSelector, { SelectedAddon } from '../../components/AddonSelector';
import { useResponsive, useScaling } from '../../hooks/useResponsive';
import { SPACING } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'ScheduledMealPricing'>;

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
};

const ScheduledMealPricingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { deliveryAddressId, mealWindow, scheduledDate, voucherCount } = route.params;
  const { width } = useResponsive();
  const { scale } = useScaling();
  const insets = useSafeAreaInsets();
  const { processOrderPayment } = usePayment();
  const { showAlert } = useAlert();

  const [pricingData, setPricingData] = useState<ScheduledMealPricingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Add-on state
  const [availableAddons, setAvailableAddons] = useState<AddonItem[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [addonsFetched, setAddonsFetched] = useState(false);

  const fetchPricing = useCallback(async (coupon?: string, itemsOverride?: Array<{ menuItemId: string; quantity: number; addons?: Array<{ addonId: string; quantity: number }> }>) => {
    try {
      setError(null);
      const response = await apiService.getScheduledMealPricing({
        deliveryAddressId,
        mealWindow,
        scheduledDate,
        voucherCount: voucherCount || undefined,
        couponCode: coupon || undefined,
        ...(itemsOverride ? { items: itemsOverride } : {}),
      });
      if (response.success) {
        setPricingData(response.data);
      } else {
        setError(response.message || 'Failed to load pricing');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pricing');
    } finally {
      setIsLoading(false);
    }
  }, [deliveryAddressId, mealWindow, scheduledDate, voucherCount]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  // Fetch available add-ons once pricing loads (need kitchen.id)
  useEffect(() => {
    console.log('[ScheduledMealPricing] Addon fetch check:', {
      hasKitchen: !!pricingData?.kitchen,
      kitchenId: pricingData?.kitchen?.id,
      addonsFetched,
    });
    if (!pricingData?.kitchen?.id || addonsFetched) return;

    const fetchAddons = async () => {
      setAddonsLoading(true);
      try {
        console.log('[ScheduledMealPricing] Fetching addons for kitchen:', pricingData.kitchen.id, 'mealWindow:', mealWindow);
        const menuResponse = await apiService.getKitchenMenu(pricingData.kitchen.id, 'MEAL_MENU');
        console.log('[ScheduledMealPricing] Kitchen menu response:', JSON.stringify(menuResponse.data?.mealMenu ? {
          hasLunch: !!menuResponse.data.mealMenu.lunch,
          hasDinner: !!menuResponse.data.mealMenu.dinner,
          lunchAddons: menuResponse.data.mealMenu.lunch?.addonIds?.length || 0,
          dinnerAddons: menuResponse.data.mealMenu.dinner?.addonIds?.length || 0,
        } : 'no mealMenu'));
        const mealMenu = menuResponse.data.mealMenu;
        const menuItem = mealWindow === 'LUNCH' ? mealMenu.lunch : mealMenu.dinner;
        const addons = menuItem?.addonIds || [];
        console.log('[ScheduledMealPricing] Available addons:', addons.length, addons.map(a => a.name));
        setAvailableAddons(addons);
      } catch (err) {
        console.log('[ScheduledMealPricing] Failed to fetch addons:', err);
        setAvailableAddons([]);
      } finally {
        setAddonsLoading(false);
        setAddonsFetched(true);
      }
    };

    fetchAddons();
  }, [pricingData?.kitchen?.id, mealWindow, addonsFetched]);

  // Build items array with addons for pricing/creation
  const buildItemsWithAddons = useCallback(() => {
    if (!pricingData) return undefined;
    if (selectedAddons.length === 0) return undefined;
    return pricingData.items.map(item => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      addons: selectedAddons.map(a => ({ addonId: a.addonId, quantity: a.quantity })),
    }));
  }, [pricingData, selectedAddons]);

  // Re-fetch pricing when addons change
  const handleAddonsChanged = useCallback((newAddons: SelectedAddon[]) => {
    if (!pricingData) return;
    const items = newAddons.length > 0
      ? pricingData.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          addons: newAddons.map(a => ({ addonId: a.addonId, quantity: a.quantity })),
        }))
      : undefined;
    fetchPricing(appliedCoupon || undefined, items);
  }, [pricingData, appliedCoupon, fetchPricing]);

  // Add-on handlers
  const selectedAddonsRef = React.useRef(selectedAddons);
  selectedAddonsRef.current = selectedAddons;

  const handleAddonAdd = useCallback((addon: AddonItem) => {
    const prev = selectedAddonsRef.current;
    if (prev.find(a => a.addonId === addon._id)) return;
    const next = [...prev, { addonId: addon._id, name: addon.name, quantity: 1, unitPrice: addon.price }];
    setSelectedAddons(next);
    handleAddonsChanged(next);
  }, [handleAddonsChanged]);

  const handleAddonRemove = useCallback((addonId: string) => {
    const next = selectedAddonsRef.current.filter(a => a.addonId !== addonId);
    setSelectedAddons(next);
    handleAddonsChanged(next);
  }, [handleAddonsChanged]);

  const handleAddonQuantityChange = useCallback((addonId: string, quantity: number) => {
    let next: SelectedAddon[];
    if (quantity <= 0) {
      next = selectedAddonsRef.current.filter(a => a.addonId !== addonId);
    } else {
      next = selectedAddonsRef.current.map(a => a.addonId === addonId ? { ...a, quantity } : a);
    }
    setSelectedAddons(next);
    handleAddonsChanged(next);
  }, [handleAddonsChanged]);

  const handleApplyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;

    setIsApplyingCoupon(true);
    setCouponError(null);

    try {
      const response = await apiService.getScheduledMealPricing({
        deliveryAddressId,
        mealWindow,
        scheduledDate,
        voucherCount: voucherCount || undefined,
        couponCode: couponCode.trim().toUpperCase(),
        ...(buildItemsWithAddons() ? { items: buildItemsWithAddons() } : {}),
      });

      if (response.success) {
        if (response.data.pricing.discount) {
          setPricingData(response.data);
          setAppliedCoupon(couponCode.trim().toUpperCase());
          setCouponError(null);
        } else {
          setCouponError('Coupon is not applicable to this order');
        }
      } else {
        setCouponError(response.message || 'Invalid coupon code');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Failed to apply coupon');
    } finally {
      setIsApplyingCoupon(false);
    }
  }, [couponCode, deliveryAddressId, mealWindow, scheduledDate, voucherCount, buildItemsWithAddons]);

  const handleRemoveCoupon = useCallback(async () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
    setIsLoading(true);
    await fetchPricing(undefined, buildItemsWithAddons());
  }, [fetchPricing, buildItemsWithAddons]);

  const handleScheduleAndPay = useCallback(async () => {
    if (!pricingData || isCreating) return;

    setIsCreating(true);
    try {
      const response = await apiService.createScheduledMeal({
        deliveryAddressId,
        mealWindow,
        scheduledDate,
        voucherCount: voucherCount || undefined,
        couponCode: appliedCoupon || undefined,
        specialInstructions: specialInstructions.trim() || undefined,
        deliveryNotes: deliveryNotes.trim() || undefined,
        ...(buildItemsWithAddons() ? { items: buildItemsWithAddons() } : {}),
      });

      if (!response.success) {
        showAlert('Error', response.message || 'Failed to schedule meal', undefined, 'error');
        setIsCreating(false);
        return;
      }

      const { paymentRequired, payment, order } = response.data;

      if (paymentRequired && payment) {
        // Payment required - order not created yet, process payment first
        console.log('[ScheduledMealPricing] Payment required, opening Razorpay:', payment.razorpayOrderId);

        const paymentResult = await paymentService.processDirectPayment({
          razorpayOrderId: payment.razorpayOrderId,
          amount: payment.amount,
          key: payment.key,
          prefill: payment.prefill,
          description: `Scheduled ${mealWindow.toLowerCase()} meal`,
        });

        console.log('[ScheduledMealPricing] Payment result:', JSON.stringify(paymentResult));

        if (paymentResult.success) {
          showAlert('Meal Scheduled!', `Your ${mealWindow.toLowerCase()} thali for ${formatDate(scheduledDate)} has been scheduled successfully.`, [
            { text: 'View Scheduled Meals', onPress: () => navigation.navigate('MyScheduledMeals') },
            { text: 'OK', style: 'cancel', onPress: () => navigation.goBack() },
          ], 'success');
        } else if (paymentResult.error === 'Payment cancelled') {
          showAlert('Payment Cancelled', 'Your meal was not scheduled. You can try again.', undefined, 'warning');
        } else {
          showAlert('Payment Failed', paymentResult.error || 'Payment could not be completed. Please try again.', undefined, 'error');
        }
      } else {
        // No payment needed (voucher-only) - order already created
        console.log('[ScheduledMealPricing] No payment required, order created:', order?.orderNumber);
        showAlert('Meal Scheduled!', `Your ${mealWindow.toLowerCase()} thali for ${formatDate(scheduledDate)} has been scheduled.`, [
          { text: 'View Scheduled Meals', onPress: () => navigation.navigate('MyScheduledMeals') },
          { text: 'OK', style: 'cancel', onPress: () => navigation.goBack() },
        ], 'success');
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to schedule meal. Please try again.', undefined, 'error');
    } finally {
      setIsCreating(false);
    }
  }, [pricingData, isCreating, deliveryAddressId, mealWindow, scheduledDate, voucherCount, appliedCoupon, specialInstructions, deliveryNotes, showAlert, navigation, buildItemsWithAddons]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <StatusBar barStyle="light-content" backgroundColor="#FE8733" />
        <SafeAreaView style={{ backgroundColor: '#FE8733' }} edges={['top']} />
        <View style={{ backgroundColor: '#FE8733', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>Meal Preview</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FE8733" />
          <Text style={{ marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Loading pricing...</Text>
        </View>
      </View>
    );
  }

  if (error || !pricingData) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <StatusBar barStyle="light-content" backgroundColor="#FE8733" />
        <SafeAreaView style={{ backgroundColor: '#FE8733' }} edges={['top']} />
        <View style={{ backgroundColor: '#FE8733', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>Meal Preview</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={{ marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: '#6B7280', textAlign: 'center' }}>{error || 'Something went wrong'}</Text>
          <TouchableOpacity
            onPress={() => { setIsLoading(true); fetchPricing(appliedCoupon || undefined); }}
            style={{ marginTop: SPACING.lg, backgroundColor: '#FE8733', borderRadius: 10, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl }}
          >
            <Text style={{ color: 'white', fontWeight: '600', fontSize: FONT_SIZES.sm }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { items, pricing } = pricingData;
  const mainItem = items.find(i => i.isMainCourse) || items[0];

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="light-content" backgroundColor="#FE8733" />
      <SafeAreaView style={{ backgroundColor: '#FE8733' }} edges={['top']} />

      {/* Header */}
      <View style={{ backgroundColor: '#FE8733', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>Meal Preview</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Date & Meal Window Badge */}
          <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="calendar" size={18} color="#FE8733" style={{ marginRight: SPACING.xs }} />
            <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937' }}>{formatDate(scheduledDate)}</Text>
            <View style={{
              marginLeft: SPACING.sm,
              backgroundColor: mealWindow === 'LUNCH' ? '#FEF3C7' : '#E0E7FF',
              borderRadius: 8,
              paddingHorizontal: SPACING.sm,
              paddingVertical: 2,
            }}>
              <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: mealWindow === 'LUNCH' ? '#92400E' : '#3730A3' }}>
                {mealWindow === 'LUNCH' ? '☀️ Lunch' : '🌙 Dinner'}
              </Text>
            </View>
          </View>

          {/* Items Card */}
          <View style={{ margin: SPACING.lg, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' }}>
            <View style={{ width: '100%', height: 100, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="food-variant" size={48} color="#FE8733" />
            </View>
            <View style={{ padding: SPACING.lg }}>
              {items.map((item, index) => (
                <View key={item.menuItemId || index} style={{ marginBottom: index < items.length - 1 ? SPACING.sm : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#1F2937', flex: 1 }}>{item.name}</Text>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937' }}>₹{item.unitPrice}</Text>
                  </View>
                  {item.quantity > 1 && (
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>Qty: {item.quantity}</Text>
                  )}
                  {item.addons && item.addons.length > 0 && (
                    <View style={{ marginTop: SPACING.xs }}>
                      {item.addons.map((addon, ai) => (
                        <Text key={ai} style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>
                          + {addon.name} (₹{addon.unitPrice}{addon.quantity > 1 ? ` x${addon.quantity}` : ''})
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Add-ons Section */}
          {(addonsLoading || availableAddons.length > 0) && (
            <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, backgroundColor: '#FFFFFF', borderRadius: 16, padding: SPACING.lg, borderWidth: 1, borderColor: '#E5E7EB' }}>
              <AddonSelector
                availableAddons={availableAddons}
                selectedAddons={selectedAddons}
                onAdd={handleAddonAdd}
                onRemove={handleAddonRemove}
                onQuantityChange={handleAddonQuantityChange}
                loading={addonsLoading}
              />
            </View>
          )}

          {/* Price Breakdown */}
          <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginBottom: SPACING.md }}>Price Breakdown</Text>
            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: SPACING.lg }}>
              {/* Item price */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>{mainItem?.name || 'Meal'}</Text>
                <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937' }}>₹{pricing.subtotal}</Text>
              </View>

              {/* Delivery Fee */}
              {pricing.charges.deliveryFee > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>Delivery</Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>₹{pricing.charges.deliveryFee}</Text>
                </View>
              )}

              {/* Service Fee */}
              {pricing.charges.serviceFee > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>Service Fee</Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>₹{pricing.charges.serviceFee}</Text>
                </View>
              )}

              {/* Packaging */}
              {pricing.charges.packagingFee > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>Packaging</Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>₹{pricing.charges.packagingFee}</Text>
                </View>
              )}

              {/* Platform Fee */}
              {pricing.charges.platformFee > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>Platform Fee</Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>₹{pricing.charges.platformFee}</Text>
                </View>
              )}

              {/* Surge Fee */}
              {pricing.charges.surgeFee > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>Surge Fee</Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>₹{pricing.charges.surgeFee}</Text>
                </View>
              )}

              {/* Small Order Fee */}
              {pricing.charges.smallOrderFee > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>Small Order Fee</Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>₹{pricing.charges.smallOrderFee}</Text>
                </View>
              )}

              {/* Late Night Fee */}
              {pricing.charges.lateNightFee > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>Late Night Fee</Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>₹{pricing.charges.lateNightFee}</Text>
                </View>
              )}

              {/* Tax */}
              {pricing.charges.taxAmount > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>
                    GST{pricing.charges.taxBreakdown?.[0] ? ` (${pricing.charges.taxBreakdown[0].rate}%)` : ''}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563' }}>₹{pricing.charges.taxAmount}</Text>
                </View>
              )}

              {/* Voucher Coverage */}
              {pricing.voucherCoverage && pricing.voucherCoverage.voucherCount > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#10B981' }}>
                    Voucher Applied ({pricing.voucherCoverage.voucherCount}x)
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#10B981', fontWeight: '600' }}>-₹{pricing.voucherCoverage.value}</Text>
                </View>
              )}

              {/* Discount */}
              {pricing.discount && (
                pricing.discount.discountAmount > 0 ||
                (pricing.discount.addonDiscountAmount || 0) > 0 ||
                (pricing.discount.deliveryDiscount || 0) > 0 ||
                (pricing.discount.extraVouchersToIssue || 0) > 0
              ) && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#10B981' }}>
                    {pricing.discount!.discountType === 'FREE_DELIVERY'
                      ? 'Free Delivery'
                      : pricing.discount!.discountType === 'FREE_EXTRA_VOUCHER'
                      ? `+${pricing.discount!.extraVouchersToIssue} Bonus Voucher${(pricing.discount!.extraVouchersToIssue || 0) !== 1 ? 's' : ''}`
                      : `Discount (${pricing.discount!.couponCode})`}
                  </Text>
                  {pricing.discount!.discountType !== 'FREE_EXTRA_VOUCHER' && (
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#10B981', fontWeight: '600' }}>
                      -₹{(pricing.discount!.discountAmount || 0) + (pricing.discount!.addonDiscountAmount || 0) + (pricing.discount!.deliveryDiscount || 0)}
                    </Text>
                  )}
                </View>
              )}

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: SPACING.sm }} />

              {/* Total */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937' }}>
                  {pricing.voucherCoverage?.voucherCount ? 'Amount to Pay' : 'Total'}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937' }}>₹{pricing.amountToPay}</Text>
              </View>
            </View>
          </View>

          {/* Coupon Section */}
          <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginBottom: SPACING.sm }}>Apply Coupon</Text>
            {appliedCoupon ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#D1FAE5',
                borderRadius: 10,
                padding: SPACING.md,
                borderWidth: 1,
                borderColor: '#6EE7B7',
              }}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" style={{ marginRight: SPACING.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#065F46' }}>{appliedCoupon} applied</Text>
                  {pricing.discount && (
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#047857' }}>
                      {pricing.discount.discountType === 'FREE_DELIVERY'
                        ? 'Free delivery applied!'
                        : pricing.discount.discountType === 'FREE_EXTRA_VOUCHER'
                        ? `${pricing.discount.extraVouchersToIssue} bonus voucher${(pricing.discount.extraVouchersToIssue || 0) !== 1 ? 's' : ''} will be issued`
                        : `You save ₹${(pricing.discount.discountAmount || 0) + (pricing.discount.addonDiscountAmount || 0) + (pricing.discount.deliveryDiscount || 0)}`}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={handleRemoveCoupon}>
                  <MaterialCommunityIcons name="close-circle" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                  <TextInput
                    value={couponCode}
                    onChangeText={(text) => { setCouponCode(text.toUpperCase()); setCouponError(null); }}
                    placeholder="Enter coupon code"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    style={{
                      flex: 1,
                      backgroundColor: '#F9FAFB',
                      borderRadius: 10,
                      paddingHorizontal: SPACING.md,
                      paddingVertical: SPACING.sm + 2,
                      fontSize: FONT_SIZES.sm,
                      color: '#1F2937',
                      borderWidth: 1,
                      borderColor: couponError ? '#FCA5A5' : '#E5E7EB',
                      letterSpacing: 0.5,
                    }}
                  />
                  <TouchableOpacity
                    onPress={handleApplyCoupon}
                    disabled={!couponCode.trim() || isApplyingCoupon}
                    style={{
                      backgroundColor: couponCode.trim() ? '#FE8733' : '#D1D5DB',
                      borderRadius: 10,
                      paddingHorizontal: SPACING.lg,
                      justifyContent: 'center',
                    }}
                  >
                    {isApplyingCoupon ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={{ color: 'white', fontWeight: '600', fontSize: FONT_SIZES.sm }}>Apply</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {couponError && (
                  <Text style={{ fontSize: FONT_SIZES.xs, color: '#EF4444', marginTop: SPACING.xs }}>{couponError}</Text>
                )}
              </View>
            )}
          </View>

          {/* Special Instructions */}
          <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginBottom: SPACING.sm }}>Special Instructions</Text>
            <TextInput
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              placeholder="Any special requests? e.g., Less spicy (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              style={{
                backgroundColor: '#F9FAFB',
                borderRadius: 10,
                padding: SPACING.md,
                fontSize: FONT_SIZES.sm,
                color: '#1F2937',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                minHeight: 60,
                textAlignVertical: 'top',
              }}
            />
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', marginTop: 4, textAlign: 'right' }}>
              {specialInstructions.length}/500
            </Text>
          </View>

          {/* Delivery Notes */}
          <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginBottom: SPACING.sm }}>Delivery Notes</Text>
            <TextInput
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              placeholder="Delivery instructions, e.g., Ring the bell twice (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={200}
              style={{
                backgroundColor: '#F9FAFB',
                borderRadius: 10,
                padding: SPACING.md,
                fontSize: FONT_SIZES.sm,
                color: '#1F2937',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                minHeight: 60,
                textAlignVertical: 'top',
              }}
            />
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', marginTop: 4, textAlign: 'right' }}>
              {deliveryNotes.length}/200
            </Text>
          </View>

          <View style={{ height: 100 + insets.bottom }} />
        </ScrollView>

        {/* CTA Button */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: SPACING.lg,
          paddingTop: SPACING.md,
          paddingBottom: insets.bottom + SPACING.md,
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        }}>
          <TouchableOpacity
            onPress={handleScheduleAndPay}
            disabled={isCreating}
            style={{
              backgroundColor: isCreating ? '#FDBA74' : '#FE8733',
              borderRadius: 14,
              paddingVertical: SPACING.md + 2,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
            }}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color="white" style={{ marginRight: SPACING.sm }} />
            ) : (
              <MaterialCommunityIcons name="calendar-check" size={20} color="white" style={{ marginRight: SPACING.sm }} />
            )}
            <Text style={{ color: 'white', fontSize: FONT_SIZES.lg, fontWeight: 'bold' }}>
              {isCreating ? 'Processing...' : `Schedule & Pay ₹${pricing.amountToPay}`}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ScheduledMealPricingScreen;
