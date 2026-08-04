// src/screens/account/BulkOrdersScreen.tsx
//
// Bulk Order — one date, one meal window, many thalis, one delivery, paid once.
// This is deliberately NOT the Schedule Meals flow (which spreads single thalis
// across days): it is the flow for an office lunch, a function, an event.
//
// It rides the existing bulk-schedule pipeline with `bulkOrder: true` and a
// single slot, so pricing, vouchers, coupons, payment and order creation are
// the same reviewed server code the scheduling flow uses. The quantity band and
// lead-time rules come from the server (`bulkOrder` config); the per-thali rates
// come from the same `bulkDiscount` tiers the server actually charges from, so
// this screen can never advertise a price checkout won't honour.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import { useAlert } from '../../context/AlertContext';
import { useAddress } from '../../context/AddressContext';
import { useSubscription } from '../../context/SubscriptionContext';
import apiService, {
  AddonItem,
  BulkOrderAvailability,
  BulkPricingData,
  BulkTierConfig,
} from '../../services/api.service';
import bulkTiersService, { BulkConfig, resolveTier, nextTier } from '../../services/bulkTiers.service';
import paymentService from '../../services/payment.service';
import AddonSelector, { SelectedAddon } from '../../components/AddonSelector';
import CouponSheet from '../../components/CouponSheet';
import DeliveryPreferenceToggles, { DeliveryPreferences } from '../../components/DeliveryPreferenceToggles';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS, BORDER_RADIUS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'BulkOrders'>;

const ORANGE = '#FE8733';
const MEAL_WINDOWS: Array<'LUNCH' | 'DINNER'> = ['LUNCH', 'DINNER'];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Split a YYYY-MM-DD into display parts without going through UTC parsing. */
function parseDateParts(dateStr: string): { day: string; date: number; month: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return { day: DAY_NAMES[date.getDay()], date: d, month: MONTH_NAMES[m - 1] };
}

/**
 * How a tier reads on the pricing table. UNIT_PRICE is the shipped shape
 * ("₹85 a thali"); the rest are covered so an admin switching tier types
 * doesn't leave this screen rendering nonsense.
 */
function describeTier(tier: BulkTierConfig): { headline: string; unit: string | null; note: string } {
  switch (tier.type) {
    case 'UNIT_PRICE':
      return { headline: `₹${tier.value}`, unit: 'per thali', note: 'Excluding taxes' };
    case 'PERCENTAGE':
      return {
        headline: `${tier.value}% off`,
        unit: null,
        note: tier.maxDiscountAmount ? `Up to ₹${tier.maxDiscountAmount}` : 'On your meal subtotal',
      };
    case 'FLAT':
      return { headline: `₹${tier.value} off`, unit: null, note: 'On your order total' };
    case 'FREE_DELIVERY':
      return { headline: 'Free delivery', unit: null, note: 'On this order' };
    case 'FREE_MEALS':
      return {
        headline: `${tier.value} free meal${tier.value > 1 ? 's' : ''}`,
        unit: null,
        note: 'Added at no cost',
      };
    case 'BONUS_VOUCHER':
      return {
        headline: `+${tier.value} voucher${tier.value > 1 ? 's' : ''}`,
        unit: null,
        note: 'Credited after the order',
      };
    case 'FREE_ADDON_VALUE':
      return { headline: `₹${tier.value} add-ons`, unit: 'free', note: 'Capped at your add-ons total' };
    case 'CASHBACK':
      return { headline: `₹${tier.value} back`, unit: null, note: 'To your wallet after delivery' };
    default:
      return { headline: 'Bulk rate', unit: null, note: 'Applied automatically' };
  }
}

/** "8 – 19 thalis" for a tier with one above it, "20+ thalis" for the top tier. */
function tierRangeLabel(tiers: BulkTierConfig[], index: number): string {
  const tier = tiers[index];
  const above = tiers[index + 1];
  if (!above) return `${tier.minMeals}+ thalis`;
  const upper = above.minMeals - 1;
  if (upper <= tier.minMeals) return `${tier.minMeals} thalis`;
  return `${tier.minMeals} – ${upper} thalis`;
}

const BulkOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const { isSmallDevice } = useResponsive();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { addresses, getMainAddress } = useAddress();
  const { fetchVouchers } = useSubscription();

  // Config + availability
  const [config, setConfig] = useState<BulkConfig | null>(null);
  const [availability, setAvailability] = useState<BulkOrderAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Order being built
  const [addressId, setAddressId] = useState<string | undefined>(() => getMainAddress()?.id);
  const [quantity, setQuantity] = useState(0); // 0 until config lands
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<'LUNCH' | 'DINNER' | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [availableAddons, setAvailableAddons] = useState<AddonItem[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [vouchersToUse, setVouchersToUse] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [showCouponSheet, setShowCouponSheet] = useState(false);
  const [prefs, setPrefs] = useState<DeliveryPreferences>({ leaveAtDoor: false, doNotContact: false });
  const [instructions, setInstructions] = useState('');

  // Pricing + submit
  const [pricing, setPricing] = useState<BulkPricingData | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Memoized so the `?? []` fallback doesn't hand the tier memos below a fresh
  // array identity on every render.
  const tiers = useMemo(() => config?.tiers ?? [], [config]);
  const limits = config?.limits ?? null;
  // The availability response is authoritative once it lands (an admin can
  // change the band while the app is open); app config is the pre-address seed.
  const minThalis = availability?.minThalisPerOrder ?? limits?.minThalisPerOrder ?? 8;
  const maxThalis = availability?.maxThalisPerOrder ?? limits?.maxThalisPerOrder ?? 100;
  const minLeadHours = availability?.minLeadHours ?? limits?.minLeadHours ?? 0;

  // ── Config ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    bulkTiersService.fetchConfig().then(fetched => {
      if (!alive) return;
      setConfig(fetched);
      setQuantity(q => (q > 0 ? q : fetched.limits.minThalisPerOrder));
    });
    return () => { alive = false; };
  }, []);

  // Pick up a new main address when the user returns from the Address screen.
  useFocusEffect(
    useCallback(() => {
      const mainId = getMainAddress()?.id;
      if (mainId && mainId !== addressId) setAddressId(mainId);
    }, [getMainAddress, addressId])
  );

  // ── Availability ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!addressId) return;
    let alive = true;
    setAvailabilityError(null);
    apiService
      .getBulkOrderAvailability(addressId)
      .then(res => {
        if (!alive) return;
        if (!res.success) {
          setAvailabilityError(res.message || 'Could not load available dates');
          return;
        }
        setAvailability(res.data);
        const days = res.data.days || [];
        // Default to the earliest orderable slot, and drop a stale selection
        // if the previously chosen day is no longer offered.
        setSelectedDate(prev => {
          const stillValid = prev && days.some(d => d.date === prev);
          return stillValid ? prev : days[0]?.date ?? null;
        });
      })
      .catch(err => {
        if (alive) setAvailabilityError(err?.message || 'Could not load available dates');
      });
    return () => { alive = false; };
  }, [addressId]);

  const windowsForSelectedDate = useMemo(() => {
    const day = availability?.days?.find(d => d.date === selectedDate);
    return day?.mealWindows ?? [];
  }, [availability, selectedDate]);

  // Keep the meal window valid for whichever date is selected.
  useEffect(() => {
    if (windowsForSelectedDate.length === 0) {
      setSelectedWindow(null);
      return;
    }
    setSelectedWindow(prev =>
      prev && windowsForSelectedDate.includes(prev) ? prev : windowsForSelectedDate[0]
    );
  }, [windowsForSelectedDate]);

  // ── Pricing ─────────────────────────────────────────────────────────────
  // Debounced: the quantity stepper fires fast and each call is a round trip.
  const pricingRunRef = useRef(0);

  const slotPayload = useMemo(() => {
    if (!selectedDate || !selectedWindow || quantity <= 0) return null;
    const base = { date: selectedDate, mealWindow: selectedWindow, quantity };
    if (selectedAddons.length === 0) return base;
    return {
      ...base,
      addons: selectedAddons.map(a => ({ addonId: a.addonId, quantity: a.quantity })),
    };
  }, [selectedDate, selectedWindow, quantity, selectedAddons]);

  useEffect(() => {
    if (!addressId || !slotPayload) {
      setPricing(null);
      return;
    }
    if (quantity < minThalis || quantity > maxThalis) {
      // Out of band — the server would 400 anyway; show the rule instead of a
      // round trip, and clear stale pricing so the pay bar can't use it.
      setPricing(null);
      setPricingError(null);
      return;
    }

    const run = ++pricingRunRef.current;
    setPricingLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiService.getBulkSchedulePricing({
          deliveryAddressId: addressId,
          slots: [slotPayload],
          vouchersToUse,
          couponCode: appliedCoupon || undefined,
          bulkOrder: true,
        });
        if (run !== pricingRunRef.current) return; // superseded
        if (res.success) {
          setPricing(res.data);
          setPricingError(null);
        } else {
          setPricing(null);
          setPricingError(res.message || 'Could not price this order');
        }
      } catch (err: any) {
        if (run !== pricingRunRef.current) return;
        setPricing(null);
        setPricingError(err?.message || 'Could not price this order');
      } finally {
        if (run === pricingRunRef.current) setPricingLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [addressId, slotPayload, vouchersToUse, appliedCoupon, quantity, minThalis, maxThalis]);

  // ── Add-ons ─────────────────────────────────────────────────────────────
  const kitchenId = pricing?.kitchen?.id;
  const addonsFetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!kitchenId || !selectedWindow) return;
    const key = `${kitchenId}_${selectedWindow}`;
    if (addonsFetchedFor.current === key) return;
    addonsFetchedFor.current = key;

    let alive = true;
    setAddonsLoading(true);
    apiService
      .getKitchenMenu(kitchenId, 'MEAL_MENU')
      .then(res => {
        if (!alive) return;
        const menu = res.data.mealMenu;
        const forWindow = selectedWindow === 'LUNCH' ? menu.lunch : menu.dinner;
        setAvailableAddons(forWindow?.addonIds || []);
      })
      .catch(() => { if (alive) setAvailableAddons([]); })
      .finally(() => { if (alive) setAddonsLoading(false); });
    return () => { alive = false; };
  }, [kitchenId, selectedWindow]);

  // Switching meal window can invalidate the chosen add-ons (menus differ).
  useEffect(() => { setSelectedAddons([]); }, [selectedWindow]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const activeTier = useMemo(() => resolveTier(tiers, quantity), [tiers, quantity]);
  const upcomingTier = useMemo(() => nextTier(tiers, quantity), [tiers, quantity]);
  const selectedAddress = addresses.find(a => a.id === addressId) || addresses[0];
  const maxVouchers = pricing ? Math.min(pricing.vouchers.available, quantity) : 0;
  const quantityInBand = quantity >= minThalis && quantity <= maxThalis;
  const canPay = !!pricing && !pricingLoading && !submitting && quantityInBand && !!selectedDate && !!selectedWindow;

  const adjustQuantity = useCallback((delta: number) => {
    setQuantity(prev => Math.min(maxThalis, Math.max(1, prev + delta)));
  }, [maxThalis]);

  // Vouchers cover thalis 1:1 — shrinking the order must shrink the redemption.
  useEffect(() => {
    setVouchersToUse(v => Math.min(v, quantity));
  }, [quantity]);

  const handleAddonAdd = useCallback((addon: AddonItem) => {
    setSelectedAddons(prev =>
      prev.some(a => a.addonId === addon._id)
        ? prev
        : [...prev, { addonId: addon._id, name: addon.name, quantity: 1, unitPrice: addon.price }]
    );
  }, []);

  const handleAddonRemove = useCallback((addonId: string) => {
    setSelectedAddons(prev => prev.filter(a => a.addonId !== addonId));
  }, []);

  const handleAddonQuantityChange = useCallback((addonId: string, qty: number) => {
    setSelectedAddons(prev =>
      qty <= 0
        ? prev.filter(a => a.addonId !== addonId)
        : prev.map(a => (a.addonId === addonId ? { ...a, quantity: qty } : a))
    );
  }, []);

  // ── Place the order ─────────────────────────────────────────────────────
  const handlePlaceOrder = useCallback(async () => {
    if (!pricing || !addressId || !slotPayload || submitting) return;

    setSubmitting(true);
    try {
      const res = await apiService.createBulkScheduledMeals({
        deliveryAddressId: addressId,
        slots: [slotPayload],
        vouchersToUse,
        couponCode: appliedCoupon || undefined,
        specialInstructions: instructions.trim() || undefined,
        leaveAtDoor: prefs.leaveAtDoor || undefined,
        doNotContact: prefs.doNotContact || undefined,
        bulkOrder: true,
      });

      if (!res.success) {
        throw new Error(res.message || 'Could not place the bulk order');
      }

      const result = res.data;
      const thaliText = `${quantity} thali${quantity > 1 ? 's' : ''}`;

      if (result.paymentRequired && result.payment) {
        const payment = await paymentService.processBulkPayment({
          razorpayOrderId: result.payment.razorpayOrderId,
          amount: result.payment.amount,
          key: result.payment.key,
          currency: result.payment.currency || 'INR',
          prefill: result.payment.prefill,
          batchId: result.batchId,
          totalOrders: result.totalOrders,
        });

        if (payment.success) {
          fetchVouchers?.();
          showAlert(
            'Bulk Order Placed!',
            `${thaliText} confirmed and paid. We'll notify you as the kitchen prepares your order.`,
            [{ text: 'View Orders', onPress: () => navigation.navigate('MyScheduledMeals') }, { text: 'Done' }],
            'success'
          );
        } else if (payment.error === 'Payment cancelled') {
          showAlert('Payment Cancelled', `Your bulk order was not placed. You can try again.`, undefined, 'warning');
        } else {
          showAlert('Payment Failed', payment.error || 'Payment could not be completed.', undefined, 'error');
        }
      } else {
        fetchVouchers?.();
        showAlert(
          'Bulk Order Placed!',
          `${thaliText} confirmed — fully covered by your vouchers.`,
          [{ text: 'View Orders', onPress: () => navigation.navigate('MyScheduledMeals') }, { text: 'Done' }],
          'success'
        );
      }
    } catch (err: any) {
      showAlert('Could not place order', err?.message || 'Please try again.', undefined, 'error');
    } finally {
      setSubmitting(false);
    }
  }, [
    pricing, addressId, slotPayload, submitting, vouchersToUse, appliedCoupon,
    instructions, prefs, quantity, fetchVouchers, showAlert, navigation,
  ]);

  // ── Render helpers ──────────────────────────────────────────────────────
  const cardStyle = {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: SPACING.lg,
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  } as const;

  const sectionTitle = (icon: string, text: string, trailing?: React.ReactNode) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <MaterialCommunityIcons name={icon} size={20} color={ORANGE} style={{ marginRight: SPACING.sm }} />
        <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: '700', color: '#111827' }}>{text}</Text>
      </View>
      {trailing}
    </View>
  );

  const days = availability?.days ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={{ backgroundColor: '#FFFFFF' }} edges={['top']} />

      {/* Header */}
      <View style={{
        backgroundColor: '#FFFFFF',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: SPACING.iconXl,
            height: SPACING.iconXl,
            borderRadius: SPACING.iconXl / 2,
            backgroundColor: ORANGE,
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
        <Text style={{
          fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3,
          fontWeight: '700',
          color: '#111827',
        }}>
          Bulk Order
        </Text>
        <View style={{ minWidth: TOUCH_TARGETS.minimum, minHeight: TOUCH_TARGETS.minimum }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: SPACING['5xl'] * 2 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {/* Hero */}
          <LinearGradient
            colors={['#FE8733', '#F56B4C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              marginHorizontal: SPACING.xl,
              marginTop: SPACING.lg,
              borderRadius: BORDER_RADIUS.xl,
              padding: SPACING.xl,
              flexDirection: 'row',
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            <View style={{ flex: 1, paddingRight: SPACING.sm }}>
              <Text style={{ color: '#FFFFFF', fontSize: FONT_SIZES.h4, fontWeight: '800' }}>
                Feeding a crowd?
              </Text>
              <Text style={{
                color: 'rgba(255,255,255,0.92)',
                fontSize: FONT_SIZES.base,
                lineHeight: FONT_SIZES.base * 1.5,
                marginTop: SPACING.xs,
              }}>
                Order thalis in bulk for one date and one meal — delivered together,
                at a flat per-thali rate.
              </Text>
            </View>
            <Image
              source={require('../../assets/images/Bulkorders/Bulkthali.png')}
              style={{ width: SPACING['5xl'] * 1.8, height: SPACING['5xl'] * 1.8 }}
              resizeMode="contain"
            />
          </LinearGradient>

          {/* Pricing table */}
          <View style={cardStyle}>
            {sectionTitle('tag-multiple-outline', 'Bulk rates')}
            {config === null ? (
              <View style={{ paddingVertical: SPACING.xl, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={ORANGE} />
              </View>
            ) : tiers.length === 0 ? (
              <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', lineHeight: FONT_SIZES.sm * 1.6 }}>
                Bulk rates aren't running right now. You can still place a large
                order at the regular per-thali price.
              </Text>
            ) : (
              <>
                {tiers.map((tier, index) => {
                  const { headline, unit, note } = describeTier(tier);
                  const isActive = activeTier?.minMeals === tier.minMeals;
                  const isBest = index === tiers.length - 1;
                  return (
                    <View
                      key={`${tier.minMeals}_${tier.type}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isActive ? ORANGE : '#E5E7EB',
                        backgroundColor: isActive ? '#FFF7ED' : '#FFFFFF',
                        borderRadius: BORDER_RADIUS.md,
                        padding: SPACING.md,
                        marginBottom: index === tiers.length - 1 ? 0 : SPACING.sm,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#111827' }}>
                            {tierRangeLabel(tiers, index)}
                          </Text>
                          {isBest && (
                            <View style={{
                              backgroundColor: '#DCFCE7',
                              borderRadius: BORDER_RADIUS.xs,
                              paddingHorizontal: SPACING.xs + 2,
                              paddingVertical: 1,
                              marginLeft: SPACING.xs + 2,
                            }}>
                              <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '800', color: '#15803D' }}>
                                BEST RATE
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: 2 }}>{note}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: FONT_SIZES.h5, fontWeight: '800', color: ORANGE }}>
                          {headline}
                        </Text>
                        {unit && (
                          <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', marginTop: 1 }}>{unit}</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
                <Text style={{
                  fontSize: FONT_SIZES.xs,
                  color: '#9CA3AF',
                  marginTop: SPACING.md,
                  lineHeight: FONT_SIZES.xs * 1.6,
                }}>
                  All rates are exclusive of taxes. Taxes, delivery and add-ons are
                  shown before you pay, and the best rate you qualify for is applied
                  automatically.
                </Text>
              </>
            )}
          </View>

          {/* Delivery address */}
          <View style={cardStyle}>
            {sectionTitle('map-marker-outline', 'Delivery address')}
            {!selectedAddress ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('Address' as any)}
                style={{ paddingVertical: SPACING.md, alignItems: 'center' }}
                activeOpacity={0.7}
              >
                <Text style={{ color: ORANGE, fontWeight: '600', fontSize: FONT_SIZES.base }}>
                  + Add a delivery address
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => navigation.navigate('Address' as any)}
                style={{ flexDirection: 'row', alignItems: 'center' }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: SPACING.iconXl,
                  height: SPACING.iconXl,
                  borderRadius: BORDER_RADIUS.md,
                  backgroundColor: '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: SPACING.md,
                }}>
                  <MaterialCommunityIcons
                    name={selectedAddress.label?.toLowerCase() === 'home' ? 'home-outline' : 'briefcase-outline'}
                    size={22}
                    color={ORANGE}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#111827' }}>
                    {selectedAddress.label}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: 2 }} numberOfLines={2}>
                    {selectedAddress.addressLine1}
                    {selectedAddress.locality ? `, ${selectedAddress.locality}` : ''}
                    {selectedAddress.city ? `, ${selectedAddress.city}` : ''}
                  </Text>
                </View>
                <Text style={{ color: ORANGE, fontWeight: '600', fontSize: FONT_SIZES.sm, marginLeft: SPACING.sm }}>
                  Change
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quantity */}
          <View style={cardStyle}>
            {sectionTitle('silverware-fork-knife', 'How many thalis?')}

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F9FAFB',
              borderRadius: BORDER_RADIUS.md,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.md,
            }}>
              <TouchableOpacity
                onPress={() => adjustQuantity(-1)}
                disabled={quantity <= 1}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: SPACING.iconXl,
                  height: SPACING.iconXl,
                  borderRadius: SPACING.iconXl / 2,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: quantity <= 1 ? 0.4 : 1,
                }}
              >
                <MaterialCommunityIcons name="minus" size={20} color={ORANGE} />
              </TouchableOpacity>

              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: FONT_SIZES.h2, fontWeight: '800', color: '#111827' }}>
                  {quantity}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>
                  thali{quantity === 1 ? '' : 's'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => adjustQuantity(1)}
                disabled={quantity >= maxThalis}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: SPACING.iconXl,
                  height: SPACING.iconXl,
                  borderRadius: SPACING.iconXl / 2,
                  backgroundColor: quantity >= maxThalis ? '#FFFFFF' : '#FFF7ED',
                  borderWidth: 1,
                  borderColor: quantity >= maxThalis ? '#E5E7EB' : ORANGE,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: quantity >= maxThalis ? 0.4 : 1,
                }}
              >
                <MaterialCommunityIcons name="plus" size={20} color={ORANGE} />
              </TouchableOpacity>
            </View>

            {/* Quick picks, anchored to the real tier thresholds */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.md }}>
              {Array.from(
                new Set(
                  [minThalis, ...tiers.map(t => t.minMeals), minThalis * 2, 50]
                    .filter(n => n >= minThalis && n <= maxThalis)
                )
              )
                .sort((a, b) => a - b)
                .slice(0, 5)
                .map(count => {
                  const selected = quantity === count;
                  return (
                    <TouchableOpacity
                      key={count}
                      onPress={() => setQuantity(count)}
                      style={{
                        borderRadius: BORDER_RADIUS.full,
                        borderWidth: 1,
                        borderColor: selected ? ORANGE : '#E5E7EB',
                        backgroundColor: selected ? '#FFF7ED' : '#FFFFFF',
                        paddingHorizontal: SPACING.md,
                        paddingVertical: SPACING.xs + 2,
                        marginRight: SPACING.sm,
                        marginBottom: SPACING.sm,
                      }}
                    >
                      <Text style={{
                        fontSize: FONT_SIZES.sm,
                        fontWeight: '600',
                        color: selected ? ORANGE : '#6B7280',
                      }}>
                        {count}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>

            {!quantityInBand ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FEF2F2',
                borderRadius: BORDER_RADIUS.sm,
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
              }}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={16}
                  color="#B91C1C"
                  style={{ marginRight: SPACING.xs + 2 }}
                />
                <Text style={{ fontSize: FONT_SIZES.sm, color: '#B91C1C', flex: 1 }}>
                  {quantity < minThalis
                    ? `Bulk orders start at ${minThalis} thalis.`
                    : `Bulk orders are limited to ${maxThalis} thalis. Contact support for anything larger.`}
                </Text>
              </View>
            ) : upcomingTier ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFF7ED',
                borderRadius: BORDER_RADIUS.sm,
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
              }}>
                <MaterialCommunityIcons
                  name="arrow-up-circle-outline"
                  size={16}
                  color={ORANGE}
                  style={{ marginRight: SPACING.xs + 2 }}
                />
                <Text style={{ fontSize: FONT_SIZES.sm, color: '#9A3412', flex: 1 }}>
                  Add {upcomingTier.mealsAway} more thali{upcomingTier.mealsAway > 1 ? 's' : ''} to get{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {describeTier(upcomingTier).headline}
                    {describeTier(upcomingTier).unit ? ` ${describeTier(upcomingTier).unit}` : ''}
                  </Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* When */}
          <View style={cardStyle}>
            {sectionTitle('calendar-clock', 'When do you need it?')}

            {!addressId ? (
              <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280' }}>
                Add a delivery address to see available dates.
              </Text>
            ) : availabilityError ? (
              <Text style={{ fontSize: FONT_SIZES.sm, color: '#B91C1C' }}>{availabilityError}</Text>
            ) : !availability ? (
              <View style={{ paddingVertical: SPACING.lg, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={ORANGE} />
              </View>
            ) : !availability.enabled ? (
              <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', lineHeight: FONT_SIZES.sm * 1.6 }}>
                Bulk ordering is paused right now. Please contact support to arrange
                a large order.
              </Text>
            ) : days.length === 0 ? (
              <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', lineHeight: FONT_SIZES.sm * 1.6 }}>
                No dates are open for bulk orders right now. Please check back later
                or contact support.
              </Text>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: SPACING.md }}
                >
                  {days.map(day => {
                    const { day: dayName, date, month } = parseDateParts(day.date);
                    const selected = selectedDate === day.date;
                    return (
                      <TouchableOpacity
                        key={day.date}
                        onPress={() => setSelectedDate(day.date)}
                        style={{
                          width: SPACING['4xl'] * 1.5,
                          paddingVertical: SPACING.md,
                          borderRadius: BORDER_RADIUS.md,
                          borderWidth: 1,
                          borderColor: selected ? ORANGE : '#E5E7EB',
                          backgroundColor: selected ? '#FFF7ED' : '#FFFFFF',
                          alignItems: 'center',
                          marginRight: SPACING.sm,
                        }}
                      >
                        <Text style={{
                          fontSize: FONT_SIZES.xs,
                          color: selected ? ORANGE : '#9CA3AF',
                          fontWeight: '600',
                        }}>
                          {dayName}
                        </Text>
                        <Text style={{
                          fontSize: FONT_SIZES.h5,
                          fontWeight: '800',
                          color: selected ? ORANGE : '#111827',
                          marginVertical: 1,
                        }}>
                          {date}
                        </Text>
                        <Text style={{
                          fontSize: FONT_SIZES.xs,
                          color: selected ? ORANGE : '#9CA3AF',
                        }}>
                          {month}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={{ flexDirection: 'row', marginTop: SPACING.md }}>
                  {MEAL_WINDOWS.map(window => {
                    const offered = windowsForSelectedDate.includes(window);
                    const selected = selectedWindow === window;
                    return (
                      <TouchableOpacity
                        key={window}
                        onPress={() => offered && setSelectedWindow(window)}
                        disabled={!offered}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: BORDER_RADIUS.md,
                          borderWidth: 1,
                          borderColor: selected ? ORANGE : '#E5E7EB',
                          backgroundColor: selected ? '#FFF7ED' : '#FFFFFF',
                          paddingVertical: SPACING.md,
                          marginRight: window === 'LUNCH' ? SPACING.sm : 0,
                          opacity: offered ? 1 : 0.4,
                        }}
                      >
                        <MaterialCommunityIcons
                          name={window === 'LUNCH' ? 'white-balance-sunny' : 'moon-waning-crescent'}
                          size={18}
                          color={selected ? ORANGE : '#9CA3AF'}
                          style={{ marginRight: SPACING.xs + 2 }}
                        />
                        <Text style={{
                          fontSize: FONT_SIZES.base,
                          fontWeight: '700',
                          color: selected ? ORANGE : '#6B7280',
                        }}>
                          {window === 'LUNCH' ? 'Lunch' : 'Dinner'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {minLeadHours > 0 && (
                  <Text style={{
                    fontSize: FONT_SIZES.xs,
                    color: '#9CA3AF',
                    marginTop: SPACING.md,
                    lineHeight: FONT_SIZES.xs * 1.6,
                  }}>
                    Bulk orders need {minLeadHours} hours' notice so the kitchen can
                    prepare for your headcount — only dates we can still cook for are shown.
                  </Text>
                )}
              </>
            )}
          </View>

          {/* Add-ons */}
          {(addonsLoading || availableAddons.length > 0) && (
            <View style={cardStyle}>
              <AddonSelector
                availableAddons={availableAddons}
                selectedAddons={selectedAddons}
                onAdd={handleAddonAdd}
                onRemove={handleAddonRemove}
                onQuantityChange={handleAddonQuantityChange}
                loading={addonsLoading}
                title="Add-ons (per thali)"
              />
            </View>
          )}

          {/* Vouchers */}
          {!!pricing && pricing.vouchers.available > 0 && (
            <View style={cardStyle}>
              {sectionTitle('ticket-percent-outline', 'Vouchers')}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280' }}>
                  {pricing.vouchers.available} available
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => setVouchersToUse(v => Math.max(0, v - 1))}
                    disabled={vouchersToUse <= 0}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: '#F3F4F6',
                      borderWidth: 1, borderColor: '#E5E7EB',
                      alignItems: 'center', justifyContent: 'center',
                      opacity: vouchersToUse <= 0 ? 0.4 : 1,
                    }}
                  >
                    <MaterialCommunityIcons name="minus" size={18} color={ORANGE} />
                  </TouchableOpacity>
                  <Text style={{
                    fontSize: FONT_SIZES.lg,
                    fontWeight: '700',
                    color: '#111827',
                    minWidth: 40,
                    textAlign: 'center',
                  }}>
                    {vouchersToUse}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setVouchersToUse(v => Math.min(maxVouchers, v + 1))}
                    disabled={vouchersToUse >= maxVouchers}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: vouchersToUse >= maxVouchers ? '#F3F4F6' : '#FFF7ED',
                      borderWidth: 1, borderColor: vouchersToUse >= maxVouchers ? '#E5E7EB' : ORANGE,
                      alignItems: 'center', justifyContent: 'center',
                      opacity: vouchersToUse >= maxVouchers ? 0.4 : 1,
                    }}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={ORANGE} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Coupon */}
          {!!pricing && (
            <View style={cardStyle}>
              {sectionTitle('tag-outline', 'Coupon')}
              {appliedCoupon ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#15803D' }}>
                    {appliedCoupon}
                  </Text>
                  <TouchableOpacity onPress={() => setAppliedCoupon(null)}>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#B91C1C' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setShowCouponSheet(true)}>
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '600', color: ORANGE }}>
                    Apply a coupon
                  </Text>
                </TouchableOpacity>
              )}
              {/* A coupon and a bulk rate never stack — the server keeps whichever
                  is worth more, so say so rather than letting it look broken. */}
              {!!appliedCoupon && !!pricing.bulkPotential && (
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', marginTop: SPACING.sm }}>
                  Coupons and bulk rates don't stack — you're charged whichever saves more.
                </Text>
              )}
            </View>
          )}

          {/* Delivery preferences + instructions */}
          <View style={cardStyle}>
            {sectionTitle('truck-outline', 'Delivery preferences')}
            <DeliveryPreferenceToggles value={prefs} onChange={setPrefs} variant="editable" />
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Cooking or delivery instructions (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              style={{
                marginTop: SPACING.md,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: BORDER_RADIUS.md,
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
                minHeight: SPACING['4xl'] * 1.6,
                textAlignVertical: 'top',
                fontSize: FONT_SIZES.base,
                color: '#111827',
              }}
            />
          </View>

          {/* Summary */}
          <View style={cardStyle}>
            <TouchableOpacity
              onPress={() => setSummaryExpanded(v => !v)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: '700', color: '#111827' }}>To pay</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {pricingLoading ? (
                  <ActivityIndicator size="small" color={ORANGE} />
                ) : (
                  <Text style={{
                    fontSize: FONT_SIZES.xl,
                    fontWeight: '800',
                    color: pricing?.summary.totalAmountToPay === 0 ? '#10B981' : '#111827',
                  }}>
                    {!pricing
                      ? '—'
                      : pricing.summary.totalAmountToPay === 0
                        ? 'Covered'
                        : `₹${pricing.summary.totalAmountToPay.toFixed(2)}`}
                  </Text>
                )}
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color="#9CA3AF"
                  style={{ marginLeft: 6, transform: [{ rotate: summaryExpanded ? '180deg' : '0deg' }] }}
                />
              </View>
            </TouchableOpacity>

            {pricingError && (
              <Text style={{ fontSize: FONT_SIZES.sm, color: '#B91C1C', marginTop: SPACING.sm }}>
                {pricingError}
              </Text>
            )}

            {summaryExpanded && pricing && (
              <View style={{ marginTop: SPACING.md }}>
                {[
                  { label: `Thalis (${quantity})`, value: pricing.summary.totalSubtotal },
                  ...(pricing.summary.totalAddons > 0
                    ? [{ label: 'Add-ons', value: pricing.summary.totalAddons }]
                    : []),
                  { label: 'Taxes & charges', value: pricing.summary.totalCharges },
                ].map(row => (
                  <View
                    key={row.label}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}
                  >
                    <Text style={{ fontSize: FONT_SIZES.base, color: '#374151' }}>{row.label}</Text>
                    <Text style={{ fontSize: FONT_SIZES.base, color: '#374151' }}>
                      ₹{row.value.toFixed(2)}
                    </Text>
                  </View>
                ))}

                {(pricing.summary.bulkDiscount?.totalAmount || 0) > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                    <Text style={{ fontSize: FONT_SIZES.base, color: '#15803D' }}>
                      Bulk rate
                      {pricing.summary.bulkDiscount?.tier
                        ? ` (${pricing.summary.bulkDiscount.tier.minMeals}+ thalis)`
                        : ''}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZES.base, color: '#15803D' }}>
                      -₹{pricing.summary.bulkDiscount!.totalAmount.toFixed(2)}
                    </Text>
                  </View>
                )}

                {pricing.summary.totalDiscount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                    <Text style={{ fontSize: FONT_SIZES.base, color: '#15803D' }}>Coupon</Text>
                    <Text style={{ fontSize: FONT_SIZES.base, color: '#15803D' }}>
                      -₹{pricing.summary.totalDiscount.toFixed(2)}
                    </Text>
                  </View>
                )}

                {pricing.summary.voucherSavings > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                    <Text style={{ fontSize: FONT_SIZES.base, color: '#15803D' }}>
                      Vouchers ({pricing.summary.vouchersApplied})
                    </Text>
                    <Text style={{ fontSize: FONT_SIZES.base, color: '#15803D' }}>
                      -₹{pricing.summary.voucherSavings.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky pay bar */}
      <View style={{
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.md,
      }}>
        <SafeAreaView edges={['bottom']}>
          <TouchableOpacity
            onPress={handlePlaceOrder}
            disabled={!canPay}
            activeOpacity={0.85}
            style={{
              backgroundColor: canPay ? ORANGE : '#E5E7EB',
              borderRadius: BORDER_RADIUS.md,
              paddingVertical: SPACING.md + 2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: SPACING.md,
            }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="cart-check"
                  size={20}
                  color={canPay ? '#FFFFFF' : '#9CA3AF'}
                  style={{ marginRight: SPACING.sm }}
                />
                <Text style={{
                  color: canPay ? '#FFFFFF' : '#9CA3AF',
                  fontSize: FONT_SIZES.lg,
                  fontWeight: '700',
                }}>
                  {pricing && pricing.summary.totalAmountToPay > 0
                    ? `Place order · ₹${pricing.summary.totalAmountToPay.toFixed(2)}`
                    : 'Place bulk order'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {!!pricing && (
        <CouponSheet
          visible={showCouponSheet}
          onClose={() => setShowCouponSheet(false)}
          onApply={code => { setAppliedCoupon(code); setShowCouponSheet(false); }}
          menuType="MEAL_MENU"
          kitchenId={pricing.kitchen.id}
          orderValue={pricing.summary.totalSubtotal + pricing.summary.totalAddons}
          itemCount={quantity}
          hasAddons={selectedAddons.length > 0}
        />
      )}
    </View>
  );
};

export default BulkOrdersScreen;
