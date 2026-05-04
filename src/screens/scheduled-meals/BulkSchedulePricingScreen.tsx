import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useAlert } from '../../context/AlertContext';
import { useSubscription } from '../../context/SubscriptionContext';
import apiService, { BulkPricingData, BulkSlotPricing, AddonItem } from '../../services/api.service';
import AddonSelector, { SelectedAddon } from '../../components/AddonSelector';
import CouponSheet from '../../components/CouponSheet';
import paymentService from '../../services/payment.service';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'BulkSchedulePricing'>;

const formatSlotDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
};

const BulkSchedulePricingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { deliveryAddressId, selectedSlots } = route.params;
  const { isSmallDevice } = useResponsive();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { fetchVouchers } = useSubscription();

  const [pricingData, setPricingData] = useState<BulkPricingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vouchersToUse, setVouchersToUse] = useState(0);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [allowAutoOrderConflict, setAllowAutoOrderConflict] = useState(false);

  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [showCouponSheet, setShowCouponSheet] = useState(false);

  // Per-meal-window addon state
  const [lunchAddons, setLunchAddons] = useState<AddonItem[]>([]);
  const [dinnerAddons, setDinnerAddons] = useState<AddonItem[]>([]);
  const [selectedLunchAddons, setSelectedLunchAddons] = useState<SelectedAddon[]>([]);
  const [selectedDinnerAddons, setSelectedDinnerAddons] = useState<SelectedAddon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [addonsFetched, setAddonsFetched] = useState(false);

  // Refs for stable callbacks
  const selectedLunchAddonsRef = useRef(selectedLunchAddons);
  selectedLunchAddonsRef.current = selectedLunchAddons;
  const selectedDinnerAddonsRef = useRef(selectedDinnerAddons);
  selectedDinnerAddonsRef.current = selectedDinnerAddons;

  // Derived
  const hasLunchSlots = selectedSlots.some(s => s.mealWindow === 'LUNCH');
  const hasDinnerSlots = selectedSlots.some(s => s.mealWindow === 'DINNER');

  // Per-slot customize mode
  const [customizePerSlot, setCustomizePerSlot] = useState(false);
  const [perSlotAddons, setPerSlotAddons] = useState<Record<string, SelectedAddon[]>>({});
  const perSlotAddonsRef = useRef(perSlotAddons);
  perSlotAddonsRef.current = perSlotAddons;

  // Build slots with addons (supports both global and per-slot modes)
  const buildSlotsWithAddons = useCallback(
    (overrideLunch?: SelectedAddon[], overrideDinner?: SelectedAddon[], overridePerSlot?: Record<string, SelectedAddon[]>) => {
      // Per-slot mode: use overridePerSlot if passed, else perSlotAddonsRef when customizePerSlot is on
      const usePerSlot = overridePerSlot !== undefined || customizePerSlot;

      if (usePerSlot) {
        const slotAddonsMap = overridePerSlot ?? perSlotAddonsRef.current;
        return selectedSlots.map(slot => {
          const key = `${slot.date}_${slot.mealWindow}`;
          const addons = slotAddonsMap[key] || [];
          if (addons.length === 0) return { date: slot.date, mealWindow: slot.mealWindow };
          return {
            date: slot.date,
            mealWindow: slot.mealWindow,
            addons: addons.map(a => ({ addonId: a.addonId, quantity: a.quantity })),
          };
        });
      }

      // Global per-meal-window mode
      const lunch = overrideLunch ?? selectedLunchAddonsRef.current;
      const dinner = overrideDinner ?? selectedDinnerAddonsRef.current;
      return selectedSlots.map(slot => {
        const addonsForWindow = slot.mealWindow === 'LUNCH' ? lunch : dinner;
        if (addonsForWindow.length === 0) return { date: slot.date, mealWindow: slot.mealWindow };
        return {
          date: slot.date,
          mealWindow: slot.mealWindow,
          addons: addonsForWindow.map(a => ({ addonId: a.addonId, quantity: a.quantity })),
        };
      });
    },
    [selectedSlots, customizePerSlot]
  );

  const appliedCouponRef = useRef(appliedCoupon);
  appliedCouponRef.current = appliedCoupon;

  const fetchPricing = useCallback(async (vouchers: number, slotsOverride?: any[], coupon?: string | null) => {
    try {
      setError(null);
      setIsLoading(true);
      const effectiveCoupon = coupon !== undefined ? coupon : appliedCouponRef.current;
      const response = await apiService.getBulkSchedulePricing({
        deliveryAddressId,
        slots: slotsOverride || buildSlotsWithAddons(),
        vouchersToUse: vouchers,
        couponCode: effectiveCoupon || undefined,
      });
      if (response.success) {
        setPricingData(response.data);
      } else {
        setError(response.message || 'Failed to fetch pricing');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pricing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [deliveryAddressId, buildSlotsWithAddons]);

  useEffect(() => {
    fetchPricing(vouchersToUse);
  }, [vouchersToUse]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch available addons once kitchen ID is known from pricing response
  useEffect(() => {
    if (!pricingData?.kitchen?.id || addonsFetched) return;

    const fetchAddonMenus = async () => {
      setAddonsLoading(true);
      try {
        const menuResponse = await apiService.getKitchenMenu(pricingData.kitchen.id, 'MEAL_MENU');
        const mealMenu = menuResponse.data.mealMenu;
        if (hasLunchSlots && mealMenu.lunch?.addonIds) {
          setLunchAddons(mealMenu.lunch.addonIds);
        }
        if (hasDinnerSlots && mealMenu.dinner?.addonIds) {
          setDinnerAddons(mealMenu.dinner.addonIds);
        }
      } catch (err) {
        console.log('[BulkSchedulePricing] Failed to fetch addons:', err);
        setLunchAddons([]);
        setDinnerAddons([]);
      } finally {
        setAddonsLoading(false);
        setAddonsFetched(true);
      }
    };

    fetchAddonMenus();
  }, [pricingData?.kitchen?.id, addonsFetched, hasLunchSlots, hasDinnerSlots]);

  const maxVouchers = pricingData
    ? Math.min(pricingData.vouchers.available, pricingData.totalSlots)
    : 0;

  const handleVoucherIncrement = useCallback(() => {
    setVouchersToUse(prev => Math.min(prev + 1, maxVouchers));
  }, [maxVouchers]);

  const handleVoucherDecrement = useCallback(() => {
    setVouchersToUse(prev => Math.max(prev - 1, 0));
  }, []);

  // Lunch addon handlers
  const handleLunchAddonAdd = useCallback((addon: AddonItem) => {
    const prev = selectedLunchAddonsRef.current;
    if (prev.find(a => a.addonId === addon._id)) return;
    const next = [...prev, { addonId: addon._id, name: addon.name, quantity: 1, unitPrice: addon.price }];
    setSelectedLunchAddons(next);
    fetchPricing(vouchersToUse, buildSlotsWithAddons(next, undefined));
  }, [fetchPricing, vouchersToUse, buildSlotsWithAddons]);

  const handleLunchAddonRemove = useCallback((addonId: string) => {
    const next = selectedLunchAddonsRef.current.filter(a => a.addonId !== addonId);
    setSelectedLunchAddons(next);
    fetchPricing(vouchersToUse, buildSlotsWithAddons(next, undefined));
  }, [fetchPricing, vouchersToUse, buildSlotsWithAddons]);

  const handleLunchAddonQuantityChange = useCallback((addonId: string, quantity: number) => {
    let next: SelectedAddon[];
    if (quantity <= 0) {
      next = selectedLunchAddonsRef.current.filter(a => a.addonId !== addonId);
    } else {
      next = selectedLunchAddonsRef.current.map(a => a.addonId === addonId ? { ...a, quantity } : a);
    }
    setSelectedLunchAddons(next);
    fetchPricing(vouchersToUse, buildSlotsWithAddons(next, undefined));
  }, [fetchPricing, vouchersToUse, buildSlotsWithAddons]);

  // Dinner addon handlers
  const handleDinnerAddonAdd = useCallback((addon: AddonItem) => {
    const prev = selectedDinnerAddonsRef.current;
    if (prev.find(a => a.addonId === addon._id)) return;
    const next = [...prev, { addonId: addon._id, name: addon.name, quantity: 1, unitPrice: addon.price }];
    setSelectedDinnerAddons(next);
    fetchPricing(vouchersToUse, buildSlotsWithAddons(undefined, next));
  }, [fetchPricing, vouchersToUse, buildSlotsWithAddons]);

  const handleDinnerAddonRemove = useCallback((addonId: string) => {
    const next = selectedDinnerAddonsRef.current.filter(a => a.addonId !== addonId);
    setSelectedDinnerAddons(next);
    fetchPricing(vouchersToUse, buildSlotsWithAddons(undefined, next));
  }, [fetchPricing, vouchersToUse, buildSlotsWithAddons]);

  const handleDinnerAddonQuantityChange = useCallback((addonId: string, quantity: number) => {
    let next: SelectedAddon[];
    if (quantity <= 0) {
      next = selectedDinnerAddonsRef.current.filter(a => a.addonId !== addonId);
    } else {
      next = selectedDinnerAddonsRef.current.map(a => a.addonId === addonId ? { ...a, quantity } : a);
    }
    setSelectedDinnerAddons(next);
    fetchPricing(vouchersToUse, buildSlotsWithAddons(undefined, next));
  }, [fetchPricing, vouchersToUse, buildSlotsWithAddons]);

  // Toggle between global and per-slot addon modes
  const handleToggleCustomizePerSlot = useCallback(() => {
    if (!customizePerSlot) {
      // Switching to per-slot: copy global addons to each slot
      const initial: Record<string, SelectedAddon[]> = {};
      selectedSlots.forEach(slot => {
        const key = `${slot.date}_${slot.mealWindow}`;
        initial[key] = slot.mealWindow === 'LUNCH'
          ? [...selectedLunchAddonsRef.current]
          : [...selectedDinnerAddonsRef.current];
      });
      setPerSlotAddons(initial);
      setCustomizePerSlot(true);
      // No re-fetch needed — same addons, just distributed per-slot
    } else {
      // Switching back to global: re-fetch with global addons
      setCustomizePerSlot(false);
      const lunch = selectedLunchAddonsRef.current;
      const dinner = selectedDinnerAddonsRef.current;
      const slots = selectedSlots.map(slot => {
        const addonsForWindow = slot.mealWindow === 'LUNCH' ? lunch : dinner;
        if (addonsForWindow.length === 0) return { date: slot.date, mealWindow: slot.mealWindow };
        return {
          date: slot.date,
          mealWindow: slot.mealWindow,
          addons: addonsForWindow.map(a => ({ addonId: a.addonId, quantity: a.quantity })),
        };
      });
      fetchPricing(vouchersToUse, slots);
    }
  }, [customizePerSlot, selectedSlots, fetchPricing, vouchersToUse]);

  // Per-slot addon handlers
  const handlePerSlotAddonAdd = useCallback((slotKey: string, addon: AddonItem) => {
    const current = perSlotAddonsRef.current;
    const slotAddons = current[slotKey] || [];
    if (slotAddons.find(a => a.addonId === addon._id)) return;
    const updated = {
      ...current,
      [slotKey]: [...slotAddons, { addonId: addon._id, name: addon.name, quantity: 1, unitPrice: addon.price }],
    };
    setPerSlotAddons(updated);
    fetchPricing(vouchersToUse, buildSlotsWithAddons(undefined, undefined, updated));
  }, [fetchPricing, vouchersToUse, buildSlotsWithAddons]);

  const handlePerSlotAddonRemove = useCallback((slotKey: string, addonId: string) => {
    const current = perSlotAddonsRef.current;
    const updated = {
      ...current,
      [slotKey]: (current[slotKey] || []).filter(a => a.addonId !== addonId),
    };
    setPerSlotAddons(updated);
    fetchPricing(vouchersToUse, buildSlotsWithAddons(undefined, undefined, updated));
  }, [fetchPricing, vouchersToUse, buildSlotsWithAddons]);

  const handlePerSlotAddonQuantityChange = useCallback((slotKey: string, addonId: string, quantity: number) => {
    const current = perSlotAddonsRef.current;
    const slotAddons = current[slotKey] || [];
    const updated = {
      ...current,
      [slotKey]: quantity <= 0
        ? slotAddons.filter(a => a.addonId !== addonId)
        : slotAddons.map(a => a.addonId === addonId ? { ...a, quantity } : a),
    };
    setPerSlotAddons(updated);
    fetchPricing(vouchersToUse, buildSlotsWithAddons(undefined, undefined, updated));
  }, [fetchPricing, vouchersToUse, buildSlotsWithAddons]);

  // Coupon handlers — CouponSheet validates internally and passes valid code via onApply
  const handleApplyCoupon = useCallback((code: string) => {
    setAppliedCoupon(code);
    setShowCouponSheet(false);
    // Re-fetch pricing with the new coupon
    fetchPricing(vouchersToUse, undefined, code);
  }, [fetchPricing, vouchersToUse]);

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    fetchPricing(vouchersToUse, undefined, null);
  }, [fetchPricing, vouchersToUse]);

  const hasConflicts = !!(pricingData && (
    pricingData.conflicts.duplicates.length > 0 ||
    pricingData.conflicts.autoOrderConflicts.length > 0
  ));

  const handleScheduleAndPay = useCallback(async () => {
    if (!pricingData || isSubmitting) return;

    // Check for unresolved conflicts
    if (pricingData.conflicts.duplicates.length > 0 && !allowDuplicates) {
      showAlert(
        'Duplicate Slots',
        'Some selected slots already have scheduled meals. Enable "Allow Duplicates" to continue.',
        undefined,
        'warning'
      );
      return;
    }
    if (pricingData.conflicts.autoOrderConflicts.length > 0 && !allowAutoOrderConflict) {
      showAlert(
        'Auto-Order Conflicts',
        'Some selected slots conflict with your auto-order schedule. Enable "Allow Conflicts" to continue.',
        undefined,
        'warning'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiService.createBulkScheduledMeals({
        deliveryAddressId,
        slots: buildSlotsWithAddons(),
        vouchersToUse,
        couponCode: appliedCoupon || undefined,
        specialInstructions: specialInstructions.trim() || undefined,
        allowDuplicates: allowDuplicates || undefined,
        allowAutoOrderConflict: allowAutoOrderConflict || undefined,
      });

      if (!response.success) {
        // Check for 409 conflict response
        if (response.message?.includes('conflict') || response.message?.includes('duplicate')) {
          showAlert('Conflict', response.message, undefined, 'warning');
          return;
        }
        throw new Error(response.message || 'Failed to create scheduled meals');
      }

      const result = response.data;

      const mealCount = result.totalOrders;
      const mealText = `${mealCount} meal${mealCount > 1 ? 's' : ''}`;

      if (result.paymentRequired && result.payment) {
        // Payment required - orders not created yet, process payment first
        const paymentResult = await paymentService.processBulkPayment({
          razorpayOrderId: result.payment.razorpayOrderId,
          amount: result.payment.amount,
          key: result.payment.key,
          currency: result.payment.currency || 'INR',
          prefill: result.payment.prefill,
          batchId: result.batchId,
          totalOrders: mealCount,
        });

        if (paymentResult.success) {
          fetchVouchers?.();
          showAlert(
            'Meals Scheduled!',
            `${mealText} scheduled and paid successfully.`,
            [
              { text: 'View Scheduled Meals', onPress: () => navigation.navigate('MyScheduledMeals') },
              { text: 'OK', onPress: () => navigation.navigate('MealCalendar') },
            ],
            'success'
          );
        } else if (paymentResult.error === 'Payment cancelled') {
          showAlert(
            'Payment Cancelled',
            `${mealText} not scheduled. You can try again.`,
            [
              { text: 'OK' },
            ],
            'warning'
          );
        } else {
          showAlert(
            'Payment Failed',
            paymentResult.error || 'Payment could not be completed. Please try again.',
            [
              { text: 'OK' },
            ],
            'error'
          );
        }
      } else {
        // Fully covered by vouchers — no payment needed, orders already created
        fetchVouchers?.();
        showAlert(
          'Meals Scheduled!',
          `${mealText} scheduled successfully — fully covered by vouchers!`,
          [
            { text: 'View Scheduled Meals', onPress: () => navigation.navigate('MyScheduledMeals') },
            { text: 'OK', onPress: () => navigation.navigate('MealCalendar') },
          ],
          'success'
        );
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to schedule meals. Please try again.', undefined, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    pricingData, isSubmitting, deliveryAddressId, buildSlotsWithAddons, vouchersToUse, appliedCoupon,
    specialInstructions, allowDuplicates, allowAutoOrderConflict, navigation,
    showAlert, fetchVouchers,
  ]);

  const renderSlotBreakdown = (slot: BulkSlotPricing, index: number) => {
    const mealIcon = slot.mealWindow === 'LUNCH' ? 'white-balance-sunny' : 'moon-waning-crescent';
    const mealIconColor = slot.mealWindow === 'LUNCH' ? '#F59E0B' : '#6366F1';
    const mealLabel = slot.mealWindow === 'LUNCH' ? 'Lunch' : 'Dinner';
    const itemName = slot.items?.[0]?.name || 'Thali';
    const hasVoucher = slot.pricing.voucherCoverage && slot.pricing.voucherCoverage.voucherCount > 0;

    return (
      <View
        key={`${slot.date}_${slot.mealWindow}`}
        style={{
          paddingVertical: SPACING.md,
          borderBottomWidth: index < (pricingData?.perSlotBreakdown.length || 0) - 1 ? 1 : 0,
          borderBottomColor: '#F3F4F6',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs }}>
          <MaterialCommunityIcons name={mealIcon} size={18} color={mealIconColor} style={{ marginRight: SPACING.sm }} />
          <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '700', color: '#1F2937', flex: 1 }}>
            {formatSlotDate(slot.date)} - {mealLabel}
          </Text>
        </View>
        <View style={{ marginLeft: SPACING.sm + 18, gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>{itemName}</Text>
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#1F2937' }}>
              {'\u20B9'}{slot.pricing.subtotal}
            </Text>
          </View>
          {slot.pricing.addonsTotal > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>Add-ons</Text>
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#1F2937' }}>
                {'\u20B9'}{slot.pricing.addonsTotal}
              </Text>
            </View>
          )}
          {(slot.pricing.charges.deliveryFee + slot.pricing.charges.serviceFee +
            slot.pricing.charges.packagingFee + slot.pricing.charges.handlingFee +
            slot.pricing.charges.taxAmount) > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>Charges</Text>
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#1F2937' }}>
                {'\u20B9'}{slot.pricing.charges.deliveryFee + slot.pricing.charges.serviceFee +
                  slot.pricing.charges.packagingFee + slot.pricing.charges.handlingFee +
                  slot.pricing.charges.taxAmount}
              </Text>
            </View>
          )}
          {slot.pricing.discount && (
            slot.pricing.discount.discountAmount > 0 ||
            (slot.pricing.discount.addonDiscountAmount || 0) > 0 ||
            (slot.pricing.discount.deliveryDiscount || 0) > 0 ||
            (slot.pricing.discount.extraVouchersToIssue || 0) > 0
          ) && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#10B981' }}>
                {slot.pricing.discount.discountType === 'FREE_DELIVERY'
                  ? 'Free Delivery'
                  : slot.pricing.discount.discountType === 'FREE_EXTRA_VOUCHER'
                  ? `+${slot.pricing.discount.extraVouchersToIssue} Bonus Voucher${(slot.pricing.discount.extraVouchersToIssue || 0) !== 1 ? 's' : ''}`
                  : 'Coupon'}
              </Text>
              {slot.pricing.discount.discountType !== 'FREE_EXTRA_VOUCHER' && (
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#10B981' }}>
                  -{'\u20B9'}{(slot.pricing.discount.discountAmount || 0) + (slot.pricing.discount.addonDiscountAmount || 0) + (slot.pricing.discount.deliveryDiscount || 0)}
                </Text>
              )}
            </View>
          )}
          {hasVoucher && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#10B981' }}>Voucher</Text>
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#10B981' }}>
                -{'\u20B9'}{slot.pricing.voucherCoverage!.value}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#1F2937' }}>Pay</Text>
            <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: slot.pricing.amountToPay === 0 ? '#10B981' : '#1F2937' }}>
              {slot.pricing.amountToPay === 0 ? 'Covered' : `\u20B9${slot.pricing.amountToPay}`}
            </Text>
          </View>
        </View>

        {/* Per-slot addon selector when customizing per day */}
        {customizePerSlot && !addonsLoading && (
          (slot.mealWindow === 'LUNCH' ? lunchAddons : dinnerAddons).length > 0
        ) && (() => {
          const slotKey = `${slot.date}_${slot.mealWindow}`;
          const availableForSlot = slot.mealWindow === 'LUNCH' ? lunchAddons : dinnerAddons;
          return (
            <View style={{ marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
              <AddonSelector
                availableAddons={availableForSlot}
                selectedAddons={perSlotAddons[slotKey] || []}
                onAdd={(addon) => handlePerSlotAddonAdd(slotKey, addon)}
                onRemove={(addonId) => handlePerSlotAddonRemove(slotKey, addonId)}
                onQuantityChange={(addonId, qty) => handlePerSlotAddonQuantityChange(slotKey, addonId, qty)}
                title="Add-ons"
              />
            </View>
          );
        })()}
      </View>
    );
  };

  if (error && !pricingData) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <StatusBar barStyle="light-content" backgroundColor="#FE8733" />
        <SafeAreaView style={{ backgroundColor: '#FE8733' }} edges={['top']} />
        <View style={{ backgroundColor: '#FE8733', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>Schedule Meals</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={{ fontSize: FONT_SIZES.base, color: '#6B7280', textAlign: 'center', marginTop: SPACING.md }}>{error}</Text>
          <TouchableOpacity
            onPress={() => fetchPricing(vouchersToUse)}
            style={{ marginTop: SPACING.lg, backgroundColor: '#FE8733', borderRadius: 10, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="light-content" backgroundColor="#FE8733" />
      <SafeAreaView style={{ backgroundColor: '#FE8733' }} edges={['top']} />

      {/* Header */}
      <View style={{ backgroundColor: '#FE8733', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1 }}>Schedule Meals</Text>
      </View>

      {isLoading && !pricingData ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FE8733" />
          <Text style={{ marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Calculating pricing...</Text>
        </View>
      ) : pricingData ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            {/* Slot Count Badge */}
            <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg }}>
              <View style={{
                backgroundColor: '#FFF7ED',
                borderRadius: 10,
                paddingVertical: SPACING.sm,
                paddingHorizontal: SPACING.md,
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
              }}>
                <MaterialCommunityIcons name="calendar-multiple" size={18} color="#FE8733" style={{ marginRight: SPACING.xs }} />
                <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#FE8733' }}>
                  {pricingData.totalSlots} meal{pricingData.totalSlots > 1 ? 's' : ''} selected
                </Text>
              </View>
            </View>

            {/* Voucher Card */}
            {pricingData.vouchers.available > 0 && (
              <View style={{
                margin: SPACING.lg,
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: SPACING.lg,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
                  <MaterialCommunityIcons name="ticket-percent-outline" size={20} color="#10B981" style={{ marginRight: SPACING.sm }} />
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>Vouchers</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Available</Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937' }}>
                    {pricingData.vouchers.available} voucher{pricingData.vouchers.available !== 1 ? 's' : ''}
                  </Text>
                </View>

                {/* Voucher stepper */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Use</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={handleVoucherDecrement}
                      disabled={vouchersToUse <= 0 || isLoading}
                      style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: vouchersToUse <= 0 ? '#F3F4F6' : '#FFF7ED',
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: vouchersToUse <= 0 ? '#E5E7EB' : '#FE8733',
                      }}
                    >
                      <MaterialCommunityIcons name="minus" size={20} color={vouchersToUse <= 0 ? '#D1D5DB' : '#FE8733'} />
                    </TouchableOpacity>
                    <Text style={{
                      fontSize: FONT_SIZES.lg, fontWeight: '700', color: '#1F2937',
                      minWidth: 40, textAlign: 'center',
                    }}>
                      {vouchersToUse}
                    </Text>
                    <TouchableOpacity
                      onPress={handleVoucherIncrement}
                      disabled={vouchersToUse >= maxVouchers || isLoading}
                      style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: vouchersToUse >= maxVouchers ? '#F3F4F6' : '#FFF7ED',
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: vouchersToUse >= maxVouchers ? '#E5E7EB' : '#FE8733',
                      }}
                    >
                      <MaterialCommunityIcons name="plus" size={20} color={vouchersToUse >= maxVouchers ? '#D1D5DB' : '#FE8733'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {vouchersToUse > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm }}>
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#10B981' }}>Remaining after</Text>
                    <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#10B981' }}>
                      {pricingData.vouchers.remainingAfter} voucher{pricingData.vouchers.remainingAfter !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Global Lunch Add-ons (hidden in per-slot mode) */}
            {!customizePerSlot && hasLunchSlots && (addonsLoading || lunchAddons.length > 0) && (
              <View style={{
                marginHorizontal: SPACING.lg,
                marginBottom: SPACING.lg,
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: SPACING.lg,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}>
                <AddonSelector
                  availableAddons={lunchAddons}
                  selectedAddons={selectedLunchAddons}
                  onAdd={handleLunchAddonAdd}
                  onRemove={handleLunchAddonRemove}
                  onQuantityChange={handleLunchAddonQuantityChange}
                  loading={addonsLoading}
                  title={`Lunch Add-ons (for ${selectedSlots.filter(s => s.mealWindow === 'LUNCH').length} meal${selectedSlots.filter(s => s.mealWindow === 'LUNCH').length > 1 ? 's' : ''})`}
                />
              </View>
            )}

            {/* Global Dinner Add-ons (hidden in per-slot mode) */}
            {!customizePerSlot && hasDinnerSlots && (addonsLoading || dinnerAddons.length > 0) && (
              <View style={{
                marginHorizontal: SPACING.lg,
                marginBottom: SPACING.lg,
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: SPACING.lg,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}>
                <AddonSelector
                  availableAddons={dinnerAddons}
                  selectedAddons={selectedDinnerAddons}
                  onAdd={handleDinnerAddonAdd}
                  onRemove={handleDinnerAddonRemove}
                  onQuantityChange={handleDinnerAddonQuantityChange}
                  loading={addonsLoading}
                  title={`Dinner Add-ons (for ${selectedSlots.filter(s => s.mealWindow === 'DINNER').length} meal${selectedSlots.filter(s => s.mealWindow === 'DINNER').length > 1 ? 's' : ''})`}
                />
              </View>
            )}

            {/* Customize per day toggle */}
            {addonsFetched && (lunchAddons.length > 0 || dinnerAddons.length > 0) && selectedSlots.length > 1 && (
              <TouchableOpacity
                onPress={handleToggleCustomizePerSlot}
                style={{
                  marginHorizontal: SPACING.lg,
                  marginBottom: SPACING.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={customizePerSlot ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color={customizePerSlot ? '#FE8733' : '#9CA3AF'}
                  style={{ marginRight: SPACING.sm }}
                />
                <Text style={{ fontSize: FONT_SIZES.sm, color: customizePerSlot ? '#FE8733' : '#6B7280', fontWeight: '500' }}>
                  Customize add-ons per day
                </Text>
              </TouchableOpacity>
            )}

            {/* Per-Slot Breakdown */}
            <View style={{
              marginHorizontal: SPACING.lg,
              marginBottom: SPACING.lg,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: SPACING.lg,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#FE8733" style={{ marginRight: SPACING.sm }} />
                <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>Per-Meal Breakdown</Text>
              </View>
              {isLoading && (
                <View style={{ position: 'absolute', top: 0, right: SPACING.lg, bottom: 0, justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color="#FE8733" />
                </View>
              )}
              {pricingData.perSlotBreakdown.map((slot, index) => renderSlotBreakdown(slot, index))}
            </View>

            {/* Summary Card */}
            <View style={{
              marginHorizontal: SPACING.lg,
              marginBottom: SPACING.lg,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: SPACING.lg,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
                <MaterialCommunityIcons name="receipt" size={20} color="#FE8733" style={{ marginRight: SPACING.sm }} />
                <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>Summary</Text>
              </View>

              <View style={{ gap: SPACING.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280' }}>
                    Subtotal ({pricingData.totalSlots} meal{pricingData.totalSlots > 1 ? 's' : ''})
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#1F2937' }}>
                    {'\u20B9'}{pricingData.summary.totalSubtotal}
                  </Text>
                </View>

                {pricingData.summary.totalAddons > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Add-ons</Text>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#1F2937' }}>
                      {'\u20B9'}{pricingData.summary.totalAddons}
                    </Text>
                  </View>
                )}

                {pricingData.summary.totalCharges > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Total Charges</Text>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#1F2937' }}>
                      {'\u20B9'}{pricingData.summary.totalCharges}
                    </Text>
                  </View>
                )}

                {pricingData.summary.totalDiscount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#10B981' }}>
                      {pricingData.summary.appliedCouponType === 'FREE_DELIVERY'
                        ? `Free Delivery${appliedCoupon ? ` (${appliedCoupon})` : ''}`
                        : `Coupon Discount${appliedCoupon ? ` (${appliedCoupon})` : ''}`}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#10B981' }}>
                      -{'\u20B9'}{pricingData.summary.totalDiscount}
                    </Text>
                  </View>
                )}

                {(pricingData.summary.totalExtraVouchers || 0) > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#10B981' }}>
                      Bonus Vouchers{appliedCoupon ? ` (${appliedCoupon})` : ''}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#10B981' }}>
                      +{pricingData.summary.totalExtraVouchers}
                    </Text>
                  </View>
                )}

                {pricingData.summary.voucherSavings > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#10B981' }}>Voucher Savings</Text>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#10B981' }}>
                      -{'\u20B9'}{pricingData.summary.voucherSavings}
                    </Text>
                  </View>
                )}

                <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: SPACING.xs }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>Total to Pay</Text>
                  <Text style={{
                    fontSize: FONT_SIZES.base, fontWeight: '700',
                    color: pricingData.summary.totalAmountToPay === 0 ? '#10B981' : '#1F2937',
                  }}>
                    {pricingData.summary.totalAmountToPay === 0
                      ? 'Fully Covered'
                      : `\u20B9${pricingData.summary.totalAmountToPay}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Coupon Section */}
            <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
              {appliedCoupon && (pricingData.summary.totalDiscount > 0 || (pricingData.summary.totalExtraVouchers || 0) > 0) ? (
                /* Applied Coupon Card — matches CartScreen style */
                <View style={{
                  borderWidth: 1,
                  borderColor: '#BBF7D0',
                  backgroundColor: '#F0FDF4',
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons name="ticket-percent" size={22} color="#16A34A" />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#15803D' }}>
                          {appliedCoupon} Applied
                        </Text>
                        <Text style={{ fontSize: 12, color: '#16A34A', marginTop: 1 }}>
                          {pricingData.summary.appliedCouponType === 'FREE_DELIVERY'
                            ? `Free delivery on all ${pricingData.totalSlots} meal${pricingData.totalSlots !== 1 ? 's' : ''}`
                            : pricingData.summary.appliedCouponType === 'FREE_EXTRA_VOUCHER'
                            ? `${pricingData.summary.totalExtraVouchers} bonus voucher${pricingData.summary.totalExtraVouchers !== 1 ? 's' : ''} will be issued`
                            : `You save \u20B9${pricingData.summary.totalDiscount}`}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={handleRemoveCoupon}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: 'white',
                        borderWidth: 1.5,
                        borderColor: '#FE8733',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 16 }}>{'\u00D7'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* Promotional Coupon Banner — matches CartScreen style */
                <TouchableOpacity
                  onPress={() => setShowCouponSheet(true)}
                  activeOpacity={0.8}
                  style={{
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#FE8733',
                  }}
                >
                  <MaterialCommunityIcons name="ticket-percent" size={24} color="white" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>
                      Save more with coupons!
                    </Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 }}>
                      View all coupons {'>'}
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: 'white',
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}>
                    <Text style={{ color: '#FE8733', fontWeight: '700', fontSize: 13 }}>Apply</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Conflict Warnings */}
            {hasConflicts && (
              <View style={{
                marginHorizontal: SPACING.lg,
                marginBottom: SPACING.lg,
                backgroundColor: '#FFFBEB',
                borderRadius: 14,
                padding: SPACING.lg,
                borderWidth: 1,
                borderColor: '#FDE68A',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
                  <MaterialCommunityIcons name="alert-outline" size={20} color="#D97706" style={{ marginRight: SPACING.sm }} />
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#92400E' }}>Conflicts</Text>
                </View>

                {pricingData.conflicts.duplicates.map((dup, i) => (
                  <View key={`dup-${i}`} style={{ marginBottom: SPACING.xs }}>
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#92400E' }}>
                      {formatSlotDate(dup.date)} {dup.mealWindow}: Already scheduled ({dup.existingOrderNumber})
                    </Text>
                  </View>
                ))}

                {pricingData.conflicts.autoOrderConflicts.map((conflict, i) => (
                  <View key={`auto-${i}`} style={{ marginBottom: SPACING.xs }}>
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#92400E' }}>
                      {formatSlotDate(conflict.date)} {conflict.mealWindow}: {conflict.reason}
                    </Text>
                  </View>
                ))}

                <View style={{ marginTop: SPACING.sm, gap: SPACING.sm }}>
                  {pricingData.conflicts.duplicates.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setAllowDuplicates(!allowDuplicates)}
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <MaterialCommunityIcons
                        name={allowDuplicates ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={22}
                        color={allowDuplicates ? '#FE8733' : '#9CA3AF'}
                        style={{ marginRight: SPACING.sm }}
                      />
                      <Text style={{ fontSize: FONT_SIZES.sm, color: '#92400E' }}>Allow duplicate scheduling</Text>
                    </TouchableOpacity>
                  )}
                  {pricingData.conflicts.autoOrderConflicts.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setAllowAutoOrderConflict(!allowAutoOrderConflict)}
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <MaterialCommunityIcons
                        name={allowAutoOrderConflict ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={22}
                        color={allowAutoOrderConflict ? '#FE8733' : '#9CA3AF'}
                        style={{ marginRight: SPACING.sm }}
                      />
                      <Text style={{ fontSize: FONT_SIZES.sm, color: '#92400E' }}>Allow auto-order conflicts</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Special Instructions */}
            <View style={{
              marginHorizontal: SPACING.lg,
              marginBottom: SPACING.lg,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: SPACING.lg,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}>
              <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937', marginBottom: SPACING.sm }}>
                Special Instructions (optional)
              </Text>
              <TextInput
                value={specialInstructions}
                onChangeText={setSpecialInstructions}
                placeholder="e.g., Less spicy, no onion..."
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
                style={{
                  fontSize: FONT_SIZES.sm,
                  color: '#1F2937',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 10,
                  padding: SPACING.md,
                  minHeight: 60,
                  textAlignVertical: 'top',
                }}
              />
            </View>
          </ScrollView>

          {/* Sticky CTA Button */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: SPACING.xl,
            paddingVertical: SPACING.md,
            paddingBottom: SPACING.md + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 4,
          }}>
            <TouchableOpacity
              onPress={handleScheduleAndPay}
              disabled={isSubmitting || isLoading || (hasConflicts && !allowDuplicates && pricingData.conflicts.duplicates.length > 0) || (hasConflicts && !allowAutoOrderConflict && pricingData.conflicts.autoOrderConflicts.length > 0)}
              style={{
                backgroundColor: isSubmitting || isLoading ? '#fbb36b' : '#FE8733',
                borderRadius: 12,
                paddingVertical: SPACING.md,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={pricingData.summary.totalAmountToPay === 0 ? 'check-circle-outline' : 'credit-card-outline'}
                    size={20}
                    color="white"
                    style={{ marginRight: SPACING.sm }}
                  />
                  <Text style={{ color: 'white', fontSize: FONT_SIZES.base, fontWeight: '700' }}>
                    {pricingData.summary.totalAmountToPay === 0
                      ? `Schedule ${pricingData.totalSlots} Meal${pricingData.totalSlots > 1 ? 's' : ''} (Fully Covered)`
                      : `Schedule & Pay \u20B9${pricingData.summary.totalAmountToPay}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {/* Coupon Bottom Sheet */}
      {pricingData?.kitchen?.id && (
        <CouponSheet
          visible={showCouponSheet}
          onClose={() => setShowCouponSheet(false)}
          onApply={handleApplyCoupon}
          menuType="MEAL_MENU"
          kitchenId={pricingData.kitchen.id}
          orderValue={pricingData.summary.totalSubtotal}
          itemCount={selectedSlots.length}
          hasAddons={selectedLunchAddons.length > 0 || selectedDinnerAddons.length > 0}
        />
      )}
    </View>
  );
};

export default BulkSchedulePricingScreen;
