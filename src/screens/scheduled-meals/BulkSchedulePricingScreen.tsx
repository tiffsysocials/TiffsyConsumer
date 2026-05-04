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
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import { useAlert } from '../../context/AlertContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAddress } from '../../context/AddressContext';
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
  const { addresses, getMainAddress } = useAddress();

  // Local address state — initialized from route params, synced with main address
  // when the user changes their default from the Address screen and returns here.
  const [localAddressId, setLocalAddressId] = useState<string>(deliveryAddressId);
  const initialFocusRef = useRef(true);

  const [pricingData, setPricingData] = useState<BulkPricingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vouchersToUse, setVouchersToUse] = useState(0);
  const [cookingInstructions, setCookingInstructions] = useState('');
  const [showCookingInput, setShowCookingInput] = useState(false);
  const [leaveAtDoor, setLeaveAtDoor] = useState(false);
  const [doNotContact, setDoNotContact] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [allowAutoOrderConflict, setAllowAutoOrderConflict] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

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
        deliveryAddressId: localAddressId,
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
  }, [localAddressId, buildSlotsWithAddons]);

  useEffect(() => {
    fetchPricing(vouchersToUse);
  }, [vouchersToUse, localAddressId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When user returns from the Address screen, pick up the new main address.
  // First focus is the initial mount — keep the address that was passed in via route params.
  useFocusEffect(
    useCallback(() => {
      if (initialFocusRef.current) {
        initialFocusRef.current = false;
        return;
      }
      const mainId = getMainAddress()?.id;
      if (mainId && mainId !== localAddressId) {
        setLocalAddressId(mainId);
      }
    }, [getMainAddress, localAddressId])
  );

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
        deliveryAddressId: localAddressId,
        slots: buildSlotsWithAddons(),
        vouchersToUse,
        couponCode: appliedCoupon || undefined,
        specialInstructions: cookingInstructions.trim() || undefined,
        leaveAtDoor: leaveAtDoor || undefined,
        doNotContact: doNotContact || undefined,
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
    pricingData, isSubmitting, localAddressId, buildSlotsWithAddons, vouchersToUse, appliedCoupon,
    cookingInstructions, leaveAtDoor, doNotContact, allowDuplicates, allowAutoOrderConflict, navigation,
    showAlert, fetchVouchers,
  ]);

  const renderSlotBreakdown = (slot: BulkSlotPricing, index: number) => {
    const mealIcon = slot.mealWindow === 'LUNCH' ? 'white-balance-sunny' : 'moon-waning-crescent';
    const mealLabel = slot.mealWindow === 'LUNCH' ? 'Lunch' : 'Dinner';
    const mealAccent = slot.mealWindow === 'LUNCH' ? '#F59E0B' : '#6366F1';
    const mealAccentBg = slot.mealWindow === 'LUNCH' ? '#FEF3C7' : '#E0E7FF';
    const itemName = slot.items?.[0]?.name || 'Thali';
    const hasVoucher = slot.pricing.voucherCoverage && slot.pricing.voucherCoverage.voucherCount > 0;
    const addonCount = slot.items?.[0]?.addons?.reduce((s, a) => s + (a.quantity || 0), 0) || 0;
    const thumbnail = slot.mealWindow === 'LUNCH'
      ? require('../../assets/images/homepage/lunchThali.png')
      : require('../../assets/images/homepage/dinnerThali.png');
    const isLast = index === (pricingData?.perSlotBreakdown.length || 0) - 1;

    return (
      <View
        key={`${slot.date}_${slot.mealWindow}`}
        style={{
          paddingVertical: 12,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: '#F3F4F6',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Thumbnail */}
          <Image
            source={thumbnail}
            style={{ width: 56, height: 56, borderRadius: 28 }}
            resizeMode="cover"
          />

          {/* Details */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginRight: 6 }}>
                {itemName}
              </Text>
              <View style={{
                backgroundColor: mealAccentBg,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: mealAccent }}>{mealLabel.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
              {formatSlotDate(slot.date)}{addonCount > 0 ? ` \u00B7 +${addonCount} add-on${addonCount > 1 ? 's' : ''}` : ''}
            </Text>
            {hasVoucher && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <MaterialCommunityIcons name="ticket-percent" size={12} color="#16A34A" style={{ marginRight: 3 }} />
                <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '600' }}>Voucher Applied</Text>
              </View>
            )}
          </View>

          {/* Price */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{
              fontSize: 15, fontWeight: '700',
              color: slot.pricing.amountToPay === 0 ? '#10B981' : '#111827',
            }}>
              {slot.pricing.amountToPay === 0 ? 'Covered' : `\u20B9${slot.pricing.amountToPay}`}
            </Text>
            {slot.pricing.amountToPay > 0 && slot.pricing.subtotal !== slot.pricing.amountToPay && (
              <Text style={{ fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through', marginTop: 1 }}>
                {'\u20B9'}{slot.pricing.subtotal + slot.pricing.addonsTotal}
              </Text>
            )}
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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

            {/* Delivery Address Card */}
            {(() => {
              const selectedAddress = addresses.find(a => a.id === localAddressId) || addresses[0];
              const isHomeLabel = selectedAddress?.label?.toLowerCase() === 'home';
              return (
                <View style={{
                  marginHorizontal: SPACING.lg,
                  marginTop: SPACING.lg,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  padding: SPACING.lg,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                    <MaterialCommunityIcons name="map-marker-outline" size={20} color="#FE8733" style={{ marginRight: SPACING.sm }} />
                    <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>Delivery Address</Text>
                  </View>
                  {!selectedAddress ? (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Address' as any)}
                      style={{ paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6' }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: '#FE8733', fontWeight: '600', fontSize: 14 }}>+ Add Delivery Address</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Address' as any)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4 }}
                      activeOpacity={0.7}
                    >
                      <View style={{
                        width: 40, height: 40, borderRadius: 10,
                        backgroundColor: '#FFF7ED',
                        alignItems: 'center', justifyContent: 'center',
                        marginRight: 12,
                      }}>
                        <MaterialCommunityIcons
                          name={isHomeLabel ? 'home-outline' : 'briefcase-outline'}
                          size={22}
                          color="#FE8733"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{selectedAddress.label}</Text>
                        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={2}>
                          {selectedAddress.addressLine1}
                          {selectedAddress.locality ? `, ${selectedAddress.locality}` : ''}
                          {selectedAddress.city ? `, ${selectedAddress.city}` : ''}
                        </Text>
                      </View>
                      <Text style={{ color: '#FE8733', fontWeight: '600', fontSize: 13, marginLeft: 8 }}>Change</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}

            {/* Voucher Card */}
            {(() => {
              const noVouchers = pricingData.vouchers.available <= 0;
              return (
                <View style={{
                  margin: SPACING.lg,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  padding: SPACING.lg,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  opacity: noVouchers ? 0.6 : 1,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
                    <MaterialCommunityIcons name="ticket-percent-outline" size={20} color={noVouchers ? '#9CA3AF' : '#10B981'} style={{ marginRight: SPACING.sm }} />
                    <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>Vouchers</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Available</Text>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: noVouchers ? '#9CA3AF' : '#1F2937' }}>
                      {pricingData.vouchers.available} voucher{pricingData.vouchers.available !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  {/* Voucher stepper */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Use</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={handleVoucherDecrement}
                        disabled={noVouchers || vouchersToUse <= 0 || isLoading}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: '#F3F4F6',
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1, borderColor: '#E5E7EB',
                        }}
                      >
                        <MaterialCommunityIcons name="minus" size={20} color={(noVouchers || vouchersToUse <= 0) ? '#D1D5DB' : '#FE8733'} />
                      </TouchableOpacity>
                      <Text style={{
                        fontSize: FONT_SIZES.lg, fontWeight: '700', color: noVouchers ? '#9CA3AF' : '#1F2937',
                        minWidth: 40, textAlign: 'center',
                      }}>
                        {vouchersToUse}
                      </Text>
                      <TouchableOpacity
                        onPress={handleVoucherIncrement}
                        disabled={noVouchers || vouchersToUse >= maxVouchers || isLoading}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: (noVouchers || vouchersToUse >= maxVouchers) ? '#F3F4F6' : '#FFF7ED',
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1, borderColor: (noVouchers || vouchersToUse >= maxVouchers) ? '#E5E7EB' : '#FE8733',
                        }}
                      >
                        <MaterialCommunityIcons name="plus" size={20} color={(noVouchers || vouchersToUse >= maxVouchers) ? '#D1D5DB' : '#FE8733'} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {noVouchers ? (
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', marginTop: SPACING.sm, fontStyle: 'italic' }}>
                      No vouchers available. Earn vouchers via referrals or subscriptions.
                    </Text>
                  ) : vouchersToUse > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm }}>
                      <Text style={{ fontSize: FONT_SIZES.xs, color: '#10B981' }}>Remaining after</Text>
                      <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#10B981' }}>
                        {pricingData.vouchers.remainingAfter} voucher{pricingData.vouchers.remainingAfter !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Global Lunch Add-ons (hidden in per-slot mode) */}
            {!customizePerSlot && hasLunchSlots && (() => {
              const lunchSlotCount = selectedSlots.filter(s => s.mealWindow === 'LUNCH').length;
              const noAddons = !addonsLoading && lunchAddons.length === 0;
              return (
                <View style={{
                  marginHorizontal: SPACING.lg,
                  marginBottom: SPACING.lg,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  padding: SPACING.lg,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  opacity: noAddons ? 0.6 : 1,
                }}>
                  {noAddons ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                        <MaterialCommunityIcons name="food-outline" size={20} color="#9CA3AF" style={{ marginRight: SPACING.sm }} />
                        <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>
                          Lunch Add-ons{lunchSlotCount > 0 ? ` (for ${lunchSlotCount} meal${lunchSlotCount > 1 ? 's' : ''})` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', fontStyle: 'italic' }}>
                        No add-ons available for this kitchen.
                      </Text>
                    </>
                  ) : (
                    <AddonSelector
                      availableAddons={lunchAddons}
                      selectedAddons={selectedLunchAddons}
                      onAdd={handleLunchAddonAdd}
                      onRemove={handleLunchAddonRemove}
                      onQuantityChange={handleLunchAddonQuantityChange}
                      loading={addonsLoading}
                      title={`Lunch Add-ons (for ${lunchSlotCount} meal${lunchSlotCount > 1 ? 's' : ''})`}
                    />
                  )}
                </View>
              );
            })()}

            {/* Global Dinner Add-ons (hidden in per-slot mode) */}
            {!customizePerSlot && hasDinnerSlots && (() => {
              const dinnerSlotCount = selectedSlots.filter(s => s.mealWindow === 'DINNER').length;
              const noAddons = !addonsLoading && dinnerAddons.length === 0;
              return (
                <View style={{
                  marginHorizontal: SPACING.lg,
                  marginBottom: SPACING.lg,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  padding: SPACING.lg,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  opacity: noAddons ? 0.6 : 1,
                }}>
                  {noAddons ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                        <MaterialCommunityIcons name="food-outline" size={20} color="#9CA3AF" style={{ marginRight: SPACING.sm }} />
                        <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>
                          Dinner Add-ons{dinnerSlotCount > 0 ? ` (for ${dinnerSlotCount} meal${dinnerSlotCount > 1 ? 's' : ''})` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', fontStyle: 'italic' }}>
                        No add-ons available for this kitchen.
                      </Text>
                    </>
                  ) : (
                    <AddonSelector
                      availableAddons={dinnerAddons}
                      selectedAddons={selectedDinnerAddons}
                      onAdd={handleDinnerAddonAdd}
                      onRemove={handleDinnerAddonRemove}
                      onQuantityChange={handleDinnerAddonQuantityChange}
                      loading={addonsLoading}
                      title={`Dinner Add-ons (for ${dinnerSlotCount} meal${dinnerSlotCount > 1 ? 's' : ''})`}
                    />
                  )}
                </View>
              );
            })()}

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
              {/* Collapsed Header — always visible (tap to toggle) */}
              <TouchableOpacity
                onPress={() => setSummaryExpanded(!summaryExpanded)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>To Pay</Text>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={18}
                    color="#9CA3AF"
                    style={{ marginLeft: 6 }}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FE8733" />
                  ) : (
                    <Text style={{
                      fontSize: 18, fontWeight: '700',
                      color: pricingData.summary.totalAmountToPay === 0 ? '#10B981' : '#111827',
                    }}>
                      {pricingData.summary.totalAmountToPay === 0
                        ? 'Fully Covered'
                        : `₹${pricingData.summary.totalAmountToPay.toFixed(2)}`}
                    </Text>
                  )}
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={20}
                    color="#9CA3AF"
                    style={{
                      marginLeft: 6,
                      transform: [{ rotate: summaryExpanded ? '180deg' : '0deg' }],
                    }}
                  />
                </View>
              </TouchableOpacity>

              {/* Expanded Breakdown */}
              {summaryExpanded && (
              <View style={{ marginTop: 14 }}>
                {/* Subtotal */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: '#374151' }}>
                    Subtotal ({pricingData.totalSlots} meal{pricingData.totalSlots > 1 ? 's' : ''})
                  </Text>
                  <Text style={{ fontSize: 14, color: '#374151' }}>
                    {'\u20B9'}{pricingData.summary.totalSubtotal.toFixed(2)}
                  </Text>
                </View>

                {/* Add-ons */}
                {pricingData.summary.totalAddons > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, color: '#374151' }}>Add-ons</Text>
                    <Text style={{ fontSize: 14, color: '#374151' }}>
                      {'\u20B9'}{pricingData.summary.totalAddons.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Charges & Taxes Breakdown */}
                {pricingData.summary.totalCharges > 0 && (() => {
                  const agg = pricingData.perSlotBreakdown.reduce(
                    (acc, slot) => {
                      const c: any = slot.pricing.charges;
                      acc.deliveryFee += c.deliveryFee || 0;
                      acc.serviceFee += c.serviceFee || 0;
                      acc.packagingFee += c.packagingFee || 0;
                      acc.handlingFee += c.handlingFee || 0;
                      acc.platformFee += c.platformFee || 0;
                      acc.surgeFee += c.surgeFee || 0;
                      acc.smallOrderFee += c.smallOrderFee || 0;
                      acc.lateNightFee += c.lateNightFee || 0;
                      acc.taxAmount += c.taxAmount || 0;
                      if (!acc.taxRate && c.taxBreakdown?.[0]?.rate) acc.taxRate = c.taxBreakdown[0].rate;
                      return acc;
                    },
                    { deliveryFee: 0, serviceFee: 0, packagingFee: 0, handlingFee: 0, platformFee: 0, surgeFee: 0, smallOrderFee: 0, lateNightFee: 0, taxAmount: 0, taxRate: 0 as number }
                  );
                  const rowStyle = { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 6 };
                  const labelStyle = { fontSize: 13, color: '#6B7280' };
                  const valueStyle = { fontSize: 13, color: '#374151' };
                  const Row = ({ label, value }: { label: string; value: number }) => (
                    <View style={rowStyle}>
                      <Text style={labelStyle}>{label}</Text>
                      <Text style={valueStyle}>{'\u20B9'}{value.toFixed(2)}</Text>
                    </View>
                  );
                  return (
                    <>
                      {agg.deliveryFee > 0 && <Row label="Delivery Fee" value={agg.deliveryFee} />}
                      {agg.serviceFee > 0 && <Row label="Service Charge" value={agg.serviceFee} />}
                      {agg.packagingFee > 0 && <Row label="Packaging" value={agg.packagingFee} />}
                      {agg.handlingFee > 0 && <Row label="Handling Fee" value={agg.handlingFee} />}
                      {agg.platformFee > 0 && <Row label="Platform Fee" value={agg.platformFee} />}
                      {agg.surgeFee > 0 && <Row label="Surge Fee" value={agg.surgeFee} />}
                      {agg.smallOrderFee > 0 && <Row label="Small Order Fee" value={agg.smallOrderFee} />}
                      {agg.lateNightFee > 0 && <Row label="Late Night Fee" value={agg.lateNightFee} />}
                      {agg.taxAmount > 0 && <Row label={`GST${agg.taxRate ? ` (${agg.taxRate}%)` : ''}`} value={agg.taxAmount} />}
                    </>
                  );
                })()}

                {/* Coupon Discount */}
                {pricingData.summary.totalDiscount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, color: '#10B981' }}>
                      {pricingData.summary.appliedCouponType === 'FREE_DELIVERY'
                        ? `Free Delivery${appliedCoupon ? ` (${appliedCoupon})` : ''}`
                        : `Coupon Discount${appliedCoupon ? ` (${appliedCoupon})` : ''}`}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#10B981' }}>
                      -{'\u20B9'}{pricingData.summary.totalDiscount.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Bonus Vouchers */}
                {(pricingData.summary.totalExtraVouchers || 0) > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, color: '#2563EB' }}>
                      Bonus Vouchers{appliedCoupon ? ` (${appliedCoupon})` : ''}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#2563EB' }}>
                      +{pricingData.summary.totalExtraVouchers}
                    </Text>
                  </View>
                )}

                {/* Voucher Savings */}
                {pricingData.summary.voucherSavings > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, color: '#10B981' }}>
                      Voucher{pricingData.summary.vouchersApplied > 1 ? `s (${pricingData.summary.vouchersApplied} used)` : ''}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#10B981' }}>
                      -{'\u20B9'}{pricingData.summary.voucherSavings.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Dashed divider */}
                <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', borderStyle: 'dashed', marginVertical: 10 }} />

                {/* Total Amount */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Total Amount:</Text>
                  <Text style={{
                    fontSize: 18, fontWeight: '700',
                    color: pricingData.summary.totalAmountToPay === 0 ? '#10B981' : '#111827',
                  }}>
                    {pricingData.summary.totalAmountToPay === 0
                      ? 'Fully Covered'
                      : `\u20B9${pricingData.summary.totalAmountToPay.toFixed(2)}`}
                  </Text>
                </View>
              </View>
              )}
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

            {/* Booking Instructions Card */}
            <View style={{
              marginHorizontal: SPACING.lg,
              marginBottom: SPACING.lg,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingHorizontal: SPACING.lg,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}>
              {/* Cooking Instructions */}
              <TouchableOpacity
                onPress={() => setShowCookingInput(!showCookingInput)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
              >
                <View
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    backgroundColor: showCookingInput || cookingInstructions ? '#FFF7ED' : '#F3F4F6',
                  }}
                >
                  <MaterialCommunityIcons
                    name="note-edit-outline"
                    size={20}
                    color={showCookingInput || cookingInstructions ? '#FE8733' : '#6B7280'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Cooking Instructions</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                    {cookingInstructions || 'Add special requests for your meal'}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={18}
                  color="#9CA3AF"
                  style={{ transform: [{ rotate: showCookingInput ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>
              {showCookingInput && (
                <TextInput
                  value={cookingInstructions}
                  onChangeText={setCookingInstructions}
                  placeholder="E.g., Less spicy, no onions..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                  autoCorrect
                  autoCapitalize="sentences"
                  blurOnSubmit={false}
                  returnKeyType="default"
                  style={{
                    fontSize: 14,
                    color: '#111827',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
                    minHeight: 60,
                    marginTop: 8,
                    marginBottom: 8,
                    textAlignVertical: 'top',
                  }}
                />
              )}

              {/* Leave at Door */}
              <TouchableOpacity
                onPress={() => setLeaveAtDoor(!leaveAtDoor)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
              >
                <View
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    backgroundColor: leaveAtDoor ? '#FFF7ED' : '#F3F4F6',
                  }}
                >
                  <MaterialCommunityIcons
                    name="door-open"
                    size={20}
                    color={leaveAtDoor ? '#FE8733' : '#6B7280'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Leave at Door</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Drop off without ringing the bell</Text>
                </View>
                <View
                  style={{
                    width: 20, height: 20, borderRadius: 4,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: leaveAtDoor ? '#FE8733' : '#D1D5DB',
                    backgroundColor: leaveAtDoor ? '#FE8733' : 'white',
                  }}
                >
                  {leaveAtDoor && (
                    <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>{'✓'}</Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Do Not Contact */}
              <TouchableOpacity
                onPress={() => setDoNotContact(!doNotContact)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
              >
                <View
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    backgroundColor: doNotContact ? '#FFF7ED' : '#F3F4F6',
                  }}
                >
                  <MaterialCommunityIcons
                    name="bell-off-outline"
                    size={20}
                    color={doNotContact ? '#FE8733' : '#6B7280'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Do Not Contact</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Avoid calls or messages on delivery</Text>
                </View>
                <View
                  style={{
                    width: 20, height: 20, borderRadius: 4,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: doNotContact ? '#FE8733' : '#D1D5DB',
                    backgroundColor: doNotContact ? '#FE8733' : 'white',
                  }}
                >
                  {doNotContact && (
                    <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>{'✓'}</Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Sticky Bottom Bar */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'white',
              paddingBottom: Math.max(insets.bottom + 8, 16),
              paddingTop: 12,
              paddingHorizontal: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            {(() => {
              const isDisabled = isSubmitting || isLoading
                || (hasConflicts && !allowDuplicates && pricingData.conflicts.duplicates.length > 0)
                || (hasConflicts && !allowAutoOrderConflict && pricingData.conflicts.autoOrderConflicts.length > 0);
              const isCovered = pricingData.summary.totalAmountToPay === 0;
              return (
                <View
                  style={{
                    backgroundColor: '#FE8733',
                    borderRadius: 28,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 56,
                    paddingLeft: 20,
                    paddingRight: 6,
                    opacity: isDisabled ? 0.7 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1 }}>
                    {isCovered ? (
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
                        Fully Covered
                      </Text>
                    ) : (
                      <>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', marginRight: 6 }}>
                          {'\u20B9'}{pricingData.summary.totalAmountToPay.toFixed(2)}
                        </Text>
                        <Text style={{ color: 'white', fontSize: 13, opacity: 0.9 }}>Total</Text>
                      </>
                    )}
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 22,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 44,
                      paddingHorizontal: 20,
                      minWidth: 130,
                    }}
                    onPress={handleScheduleAndPay}
                    disabled={isDisabled}
                    activeOpacity={0.8}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FE8733" />
                    ) : (
                      <>
                        <Text style={{ color: '#FE8733', fontWeight: '700', fontSize: 15, marginRight: 6 }}>
                          {isCovered
                            ? `Schedule ${pricingData.totalSlots}`
                            : 'Schedule & Pay'}
                        </Text>
                        <MaterialCommunityIcons
                          name={isCovered ? 'check' : 'arrow-right'}
                          size={16}
                          color="#FE8733"
                        />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })()}
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
