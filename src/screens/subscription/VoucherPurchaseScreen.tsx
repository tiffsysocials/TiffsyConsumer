/**
 * Phase 11 — Voucher pack + auto-order setup full-page purchase screen.
 *
 * Replaces the old VoucherPaymentModal popup. The customer picks a plan on
 * MealPlansScreen → this screen opens → optionally configures auto-order →
 * one Razorpay charge covers the pack + all upcoming meal fees.
 *
 * UI style mirrors AutoOrderConfigScreen — orange gradient header, gray-50
 * scroll body, sectioned cards with orange-tab titles, reused
 * WeeklyScheduleGrid + WeeklyScheduleQuickSets for the schedule.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  StatusBar,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useAddress } from '../../context/AddressContext';
import DeliveryFeeInfoModal from '../../components/DeliveryFeeInfoModal';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAlert } from '../../context/AlertContext';
import paymentService from '../../services/payment.service';
import apiService, {
  AutoOrderSetupForm,
  AutoOrderPurchaseQuoteResponse,
  WeeklySchedule,
} from '../../services/api.service';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';
import WeeklyScheduleGrid from '../../components/WeeklyScheduleGrid';
import WeeklyScheduleQuickSets from '../../components/WeeklyScheduleQuickSets';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VoucherPurchase'>;
type Rt = RouteProp<RootStackParamList, 'VoucherPurchase'>;

const PRIMARY = '#FE8733';
const PRIMARY_TINT = '#FFF7ED';
const PRIMARY_BORDER = '#FED7AA';
const BG = '#F9FAFB';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const TEXT = '#111827';

// Render rupee amounts as whole rupees when integer, else 2 decimals.
function formatINR(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
}

function defaultWeekly(): WeeklySchedule {
  const w: WeeklySchedule = {};
  (['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const).forEach(d => {
    w[d] = { lunch: true, dinner: true };
  });
  return w;
}

export default function VoucherPurchaseScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const { planId } = route.params;

  const { addresses, getMainAddress } = useAddress();
  // Phase 11.1 hotfix — pull the refetch hooks so the success path can
  // refresh subscriptions + vouchers + auto-order configs before
  // navigating. Without this, post-purchase screens read stale state.
  const {
    plans,
    subscriptions,
    fetchSubscriptions,
    fetchVouchers,
    fetchAllAutoOrderConfigs,
  } = useSubscription();
  const { showAlert } = useAlert();
  const plan = useMemo(() => plans.find(p => p._id === planId), [plans, planId]);

  // Step 1: opt-in
  const [autoOrderYes, setAutoOrderYes] = useState<boolean | null>(null);

  // Step 2: form fields (only used when autoOrderYes === true)
  const defaultAddr = getMainAddress();
  const [addressId, setAddressId] = useState<string>(defaultAddr?.id ?? '');
  const [contactName, setContactName] = useState<string>(defaultAddr?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState<string>(defaultAddr?.contactPhone ?? '');
  const [thalisPerMeal, setThalisPerMeal] = useState<number>(1);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(defaultWeekly());

  // Derived from the weekly schedule — the standalone Meal Windows picker
  // is redundant since the schedule grid below already has lunch/dinner
  // toggles per day.
  const mealWindows = useMemo<Array<'LUNCH' | 'DINNER'>>(() => {
    const result: Array<'LUNCH' | 'DINNER'> = [];
    if (weeklySchedule && Object.values(weeklySchedule).some((d: any) => d?.lunch)) result.push('LUNCH');
    if (weeklySchedule && Object.values(weeklySchedule).some((d: any) => d?.dinner)) result.push('DINNER');
    return result;
  }, [weeklySchedule]);

  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<AutoOrderPurchaseQuoteResponse['data'] | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Collapsed by default — same UX as the cart's "To Pay" row.
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  // Phase 11.1 hotfix — refetch loading indicator for the post-success
  // refresh. Keeps the customer on the screen briefly so they don't land
  // on a stale destination.
  const [refreshing, setRefreshing] = useState(false);

  // Phase 11.1 hotfix — mirror AutoOrderSetupScreen's mount-fetch pattern.
  // If subscriptions/vouchers haven't been loaded into context yet, fetch
  // them now so live counts (wallet balance, voucher pool) are correct
  // when computing the quote downstream.
  useEffect(() => {
    if (subscriptions.length === 0) fetchSubscriptions();
    fetchVouchers();
    // Single-shot on mount; refetch hooks themselves are stable callbacks
    // from the context, so this won't loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form: AutoOrderSetupForm = useMemo(
    () => ({
      addressId,
      contactName,
      contactPhone,
      thalisPerMeal,
      mealWindows,
      weeklySchedule: weeklySchedule as any,
      addons: { mode: 'EVERYDAY_SAME', everydaySame: [] },
    }),
    [addressId, contactName, contactPhone, thalisPerMeal, mealWindows, weeklySchedule],
  );

  const formIsComplete =
    !!addressId &&
    !!contactName.trim() &&
    /^[6-9]\d{9}$/.test(contactPhone.trim()) &&
    mealWindows.length > 0;

  // Debounced quote
  useEffect(() => {
    if (autoOrderYes !== true) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    if (!formIsComplete) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    const t = setTimeout(async () => {
      try {
        const res = await apiService.getAutoOrderPurchaseQuote({ planId, ...form });
        if (res.success) {
          setQuote(res.data);
        } else {
          setQuoteError(res.message || 'Could not compute quote');
          setQuote(null);
        }
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || 'Quote failed';
        setQuoteError(msg);
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [autoOrderYes, formIsComplete, planId, form]);

  const selectedAddress = addresses.find(a => a.id === addressId);

  const handlePay = async () => {
    if (!plan) return;
    if (autoOrderYes === true && (!quote || quoteError)) {
      showAlert(
        'Please wait',
        'Wait for the price quote to load before paying.',
        undefined,
        'warning',
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await paymentService.processSubscriptionPayment(
        plan._id,
        autoOrderYes === true ? form : undefined,
      );
      if (!result.success) {
        if (result.error === 'Payment cancelled') return;
        showAlert('Payment failed', result.error || 'Try again', undefined, 'error');
        return;
      }

      // Phase 11.1 hotfix — refetch SubscriptionContext slices BEFORE
      // navigating so the destination screen reads live state. Each
      // fetcher catches its own error so a flaky one doesn't block the
      // landing. Branch-aware: vouchers + (autoOrderYes ? configs) so
      // we don't pay for an unused fetch.
      setRefreshing(true);
      await Promise.allSettled([
        fetchSubscriptions(),
        fetchVouchers(),
        ...(autoOrderYes === true ? [fetchAllAutoOrderConfigs()] : []),
      ]);
      setRefreshing(false);

      // Phase 11 — vouchers were issued but the auto-order setup half
      // failed and was auto-refunded. Customer keeps the pack; only the
      // prepaid fees came back. Still land on Account (the alert
      // explains the partial outcome).
      if (result.refunded) {
        showAlert(
          'Pack purchased — auto-order not set up',
          `Your ${plan.totalVouchers} vouchers have been added to your account.\n\nWe couldn't set up auto-order this time, so ₹${formatINR(result.refundAmount ?? 0)} of the auto-order fees has been refunded (will reach your account in 5–7 working days).\n\nYou can set up auto-order any time from Account → Auto-Order Settings.`,
          [{ text: 'OK', style: 'default', onPress: () => nav.navigate('Account') }],
          'warning',
        );
        return;
      }

      // Phase 11.1 hotfix — branch-aware success destination so the
      // customer immediately sees what they just bought:
      //   - autoOrderYes  → AutoOrderSettings (new setup + wallet card)
      //   - pack-only     → Vouchers          (freshly-issued vouchers)
      const successDestination = autoOrderYes === true ? 'AutoOrderSettings' : 'Vouchers';
      showAlert(
        'Pack purchased',
        autoOrderYes === true
          ? `Auto-order set up successfully. ₹${formatINR(quote?.totalFeesPrepaid ?? 0)} credited to your wallet for ${quote?.totalDeliveries ?? 0} upcoming deliveries.`
          : `${plan.totalVouchers} vouchers added to your account.`,
        [{ text: 'OK', style: 'default', onPress: () => nav.navigate(successDestination as never) }],
        'success',
      );
    } catch (e: any) {
      showAlert('Something went wrong', e?.message || 'Purchase failed', undefined, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!plan) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: MUTED }}>Plan not found</Text>
      </SafeAreaView>
    );
  }

  // For inclusive-GST plans totalPayable === price (no change to what's charged);
  // for exclusive-GST plans it's price + GST. Fall back to price for old plans.
  const packPayable = plan.totalPayable ?? plan.price;
  const grandTotal = autoOrderYes === true && quote ? quote.grandTotal : packPayable;
  const canPay =
    autoOrderYes !== null &&
    (autoOrderYes === false || (!!quote && !quoteLoading && !quoteError)) &&
    !submitting;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient
        colors={['#FD9E2F', '#FF6636']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientHeader}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Polyline points="15,18 9,12 15,6" stroke={PRIMARY} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>Buy Voucher Pack</Text>
            <View style={{ width: TOUCH_TARGETS.minimum }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom, paddingTop: SPACING.lg }}
      >
        {/* Plan card */}
        <Section title="Voucher Pack">
          <View style={styles.planCard}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="ticket-percent" size={24} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{plan.name}</Text>
              <Text style={styles.cardMeta}>
                {plan.totalVouchers} vouchers · valid {plan.voucherValidityDays} days
              </Text>
            </View>
            <Text style={styles.planPrice}>{`₹${formatINR(plan.price)}`}</Text>
          </View>
        </Section>

        {/* Auto-order opt-in */}
        <Section
          title="Auto-Order Setup"
          hint="Auto-order delivers your vouchers automatically. Pay once for the meal fees up-front — no surprise top-ups later."
        >
          <ChoiceCard
            icon="auto-mode"
            iconColor={autoOrderYes === true ? PRIMARY : MUTED}
            iconBg={autoOrderYes === true ? PRIMARY_TINT : '#F3F4F6'}
            title="Yes, auto-deliver"
            subtitle="Set delivery schedule, prepay meal fees, sit back."
            active={autoOrderYes === true}
            onPress={() => setAutoOrderYes(true)}
          />
          <View style={{ height: 12 }} />
          <ChoiceCard
            icon="cart-outline"
            iconColor={autoOrderYes === false ? PRIMARY : MUTED}
            iconBg={autoOrderYes === false ? PRIMARY_TINT : '#F3F4F6'}
            title="No, I'll order manually"
            subtitle="Just give me the vouchers."
            active={autoOrderYes === false}
            onPress={() => setAutoOrderYes(false)}
          />
        </Section>

        {autoOrderYes === true && (
          <>
            {/* Address */}
            <Section title="Delivery Address">
              <TouchableOpacity
                onPress={() => setShowAddressPicker(true)}
                activeOpacity={0.7}
                style={[
                  styles.card,
                  !selectedAddress && {
                    backgroundColor: PRIMARY_TINT,
                    borderStyle: 'dashed',
                    borderColor: PRIMARY_BORDER,
                    borderWidth: 2,
                  },
                ]}
              >
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons
                    name={selectedAddress ? 'map-marker' : 'map-marker-plus-outline'}
                    size={24}
                    color={PRIMARY}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  {selectedAddress ? (
                    <>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {selectedAddress.label}
                      </Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {selectedAddress.addressLine1}, {selectedAddress.locality}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '600', color: PRIMARY }}>
                      Select Delivery Address
                    </Text>
                  )}
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            </Section>

            {/* Contact */}
            <Section title="Delivery Contact">
              <View style={styles.card}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="account" size={22} color={PRIMARY} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Contact name"
                  placeholderTextColor={MUTED}
                  value={contactName}
                  onChangeText={setContactName}
                  autoCapitalize="words"
                />
              </View>
              <View style={{ height: 12 }} />
              <View style={styles.card}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="phone" size={22} color={PRIMARY} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="10-digit phone"
                  placeholderTextColor={MUTED}
                  value={contactPhone}
                  onChangeText={t => setContactPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </Section>

            {/* Thalis per meal */}
            <Section
              title="Thalis Per Meal"
              hint={`Each scheduled meal uses ${thalisPerMeal} voucher${thalisPerMeal === 1 ? '' : 's'}.`}
            >
              <View style={[styles.card, { justifyContent: 'space-between' }]}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="food" size={22} color={PRIMARY} />
                </View>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setThalisPerMeal(Math.max(1, thalisPerMeal - 1))}
                  >
                    <MaterialCommunityIcons name="minus" size={20} color={TEXT} />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{thalisPerMeal}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setThalisPerMeal(Math.min(10, thalisPerMeal + 1))}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color={TEXT} />
                  </TouchableOpacity>
                </View>
              </View>
            </Section>

            {/* Weekly Schedule — also picks which meal windows are active
                (lunch/dinner toggles per day inside the grid). */}
            <Section title="Weekly Schedule" hint="Customize which days and meals to auto-order.">
              <WeeklyScheduleQuickSets onSelectPattern={setWeeklySchedule} />
              <View style={{ height: 8 }} />
              <WeeklyScheduleGrid
                schedule={weeklySchedule}
                onChange={setWeeklySchedule}
                closedDays={quote?.kitchen?.closedDays || []}
              />
            </Section>

            {/* Live summary — collapsible, mirrors the cart's "To Pay" pattern. */}
            <CollapsibleSummary
              expanded={summaryExpanded}
              onToggle={() => setSummaryExpanded(v => !v)}
              total={quote ? quote.grandTotal : plan.price}
              loading={quoteLoading}
            >
              {quoteError && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{quoteError}</Text>
                </View>
              )}
              {quote && !quoteLoading && !quoteError && (
                <View>
                  <SummaryLine label="Voucher pack" value={`₹${formatINR(quote.plan?.price)}`} />
                  {!!quote.plan?.taxAmount && quote.plan.taxAmount > 0 && (
                    <SummaryLine
                      label={quote.plan.taxInclusive ? 'GST (incl.)' : 'GST'}
                      value={`₹${formatINR(quote.plan.taxAmount)}`}
                    />
                  )}
                  <SummaryLine
                    label="Total deliveries"
                    value={`${quote.totalDeliveries ?? 0}`}
                    sub={`Lunch: ${quote.perWindowDeliveries?.lunch ?? 0} · Dinner: ${quote.perWindowDeliveries?.dinner ?? 0}`}
                  />
                  <View style={styles.divider} />

                  {quote.perMealFees.lunch && quote.perWindowDeliveries.lunch > 0 && (
                    <FeeBreakdownGroup
                      title="Lunch"
                      icon="white-balance-sunny"
                      iconColor={PRIMARY}
                      deliveries={quote.perWindowDeliveries.lunch}
                      perMealFee={quote.perMealFees.lunch.total}
                      breakdown={quote.perMealFees.lunch}
                    />
                  )}
                  {quote.perMealFees.dinner && quote.perWindowDeliveries.dinner > 0 && (
                    <FeeBreakdownGroup
                      title="Dinner"
                      icon="moon-waning-crescent"
                      iconColor="#8B5CF6"
                      deliveries={quote.perWindowDeliveries.dinner}
                      perMealFee={quote.perMealFees.dinner.total}
                      breakdown={quote.perMealFees.dinner}
                    />
                  )}

                  <View style={styles.divider} />
                  <SummaryLine label="Wallet credit" value={`₹${formatINR(quote.totalFeesPrepaid)}`} bold />
                  <Text style={{ fontSize: FONT_SIZES.xs, color: MUTED, marginTop: 2 }}>
                    Used by the system to pay delivery & charges for each auto-order.
                  </Text>
                  <View style={styles.divider} />
                  <SummaryLine label="Pay now" value={`₹${formatINR(quote.grandTotal)}`} big />
                </View>
              )}
            </CollapsibleSummary>
          </>
        )}

        {autoOrderYes === false && (
          <CollapsibleSummary
            expanded={summaryExpanded}
            onToggle={() => setSummaryExpanded(v => !v)}
            total={packPayable}
            loading={false}
          >
            <SummaryLine label="Voucher pack" value={`₹${formatINR(plan.price)}`} />
            {!!plan.taxAmount && plan.taxAmount > 0 && (
              <SummaryLine
                label={plan.taxInclusive ? 'GST (incl.)' : 'GST'}
                value={`₹${formatINR(plan.taxAmount)}`}
              />
            )}
            <View style={styles.divider} />
            <SummaryLine label="Pay now" value={`₹${formatINR(packPayable)}`} big />
          </CollapsibleSummary>
        )}
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerLabel}>Total payable</Text>
          <Text style={styles.footerAmount}>{`₹${formatINR(grandTotal)}`}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, !canPay && { backgroundColor: '#D1D5DB' }]}
          disabled={!canPay}
          onPress={handlePay}
          activeOpacity={0.85}
        >
          {submitting || refreshing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payBtnText}>
              {autoOrderYes === true ? 'Pay & Set Up Auto-Order' : 'Pay for Vouchers'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Address picker modal */}
      <Modal
        visible={showAddressPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddressPicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddressPicker(false)}>
          <Pressable style={styles.sheetContainer} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetContent}>
              <Text style={styles.sheetTitle}>Select Address</Text>
              {addresses.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <Text style={{ fontSize: FONT_SIZES.base, color: MUTED, textAlign: 'center' }}>
                    No addresses yet. Add one first.
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 360 }}>
                  {addresses.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => {
                        setAddressId(a.id);
                        if (!contactName) setContactName(a.contactName || '');
                        if (!contactPhone) setContactPhone(a.contactPhone || '');
                        setShowAddressPicker(false);
                      }}
                      activeOpacity={0.7}
                      style={[
                        styles.addressRow,
                        addressId === a.id && {
                          borderColor: PRIMARY,
                          backgroundColor: PRIMARY_TINT,
                        },
                      ]}
                    >
                      <View style={styles.iconCircle}>
                        <MaterialCommunityIcons name="map-marker" size={22} color={PRIMARY} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{a.label}</Text>
                        <Text style={styles.cardMeta} numberOfLines={2}>
                          {a.addressLine1}, {a.locality}, {a.pincode}
                        </Text>
                      </View>
                      {addressId === a.id && (
                        <MaterialCommunityIcons name="check-circle" size={22} color={PRIMARY} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ────────── Section + atom components ──────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 6, height: 22, backgroundColor: PRIMARY, borderRadius: 999, marginRight: 10 }} />
        <Text style={{ fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: TEXT, flex: 1 }} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {hint && (
        <Text style={{ fontSize: FONT_SIZES.sm, color: MUTED, marginBottom: 10, paddingLeft: 2 }}>
          {hint}
        </Text>
      )}
      {children}
    </View>
  );
}

function ChoiceCard({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  active,
  onPress,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        active && { borderColor: PRIMARY, borderWidth: 2, backgroundColor: PRIMARY_TINT },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardMeta}>{subtitle}</Text>
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: active ? PRIMARY : '#D1D5DB',
          backgroundColor: active ? PRIMARY : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Order Summary in a collapsible card. Header always visible — shows
 * "Order Summary" + the live total + a chevron. Tapping toggles the body.
 * Mirrors the cart's "To Pay" pattern so both screens feel the same.
 */
function CollapsibleSummary({
  expanded,
  onToggle,
  total,
  loading,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  total: number;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch', padding: 0 }]}>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={summaryHeaderStyles.row}>
          <View style={summaryHeaderStyles.left}>
            <View style={{ width: 6, height: 22, backgroundColor: PRIMARY, borderRadius: 999, marginRight: 10 }} />
            <Text style={summaryHeaderStyles.title}>Order Summary</Text>
            <MaterialCommunityIcons
              name="information-outline"
              size={16}
              color="#9CA3AF"
              style={{ marginLeft: 6 }}
            />
          </View>
          <View style={summaryHeaderStyles.right}>
            {loading ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Text style={summaryHeaderStyles.totalText}>{`₹${formatINR(total)}`}</Text>
            )}
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={22}
              color="#9CA3AF"
              style={{ marginLeft: 6 }}
            />
          </View>
        </TouchableOpacity>
        {expanded && <View style={summaryHeaderStyles.body}>{children}</View>}
      </View>
    </View>
  );
}

/**
 * Render the distance-pricing formula behind a delivery fee as a small
 * sub-line. Returns null when there's nothing meaningful to say.
 */
function deliveryFormulaText(dp?: import('../../services/api.service').DeliveryFeeBreakdown): string | null {
  if (!dp) return null;
  if (!dp.formulaEnabled) {
    if (dp.source === 'flat') {
      return dp.distKm != null ? `Flat rate · ${formatINR(dp.distKm)} km away` : 'Flat rate';
    }
    return dp.distKm != null ? `${formatINR(dp.distKm)} km away` : null;
  }
  const parts: string[] = [];
  if (dp.baseFeeEnabled && dp.baseFee > 0) parts.push(`₹${formatINR(dp.baseFee)} base`);
  if (dp.extraKm > 0 && dp.perKmAfterFree > 0) {
    parts.push(`${formatINR(dp.extraKm)} km × ₹${formatINR(dp.perKmAfterFree)}`);
  } else if (dp.distKm != null && dp.baseFreeUptoKm > 0) {
    parts.push(`within ${formatINR(dp.baseFreeUptoKm)} km free zone`);
  }
  if (parts.length === 0 && dp.distKm != null) {
    return `${formatINR(dp.distKm)} km away`;
  }
  return parts.join(' + ');
}

/**
 * Per-window fee breakdown card. Same shape as AutoOrderSetupScreen.
 */
function FeeBreakdownGroup({
  title,
  icon,
  iconColor,
  deliveries,
  perMealFee,
  breakdown,
}: {
  title: string;
  icon: string;
  iconColor: string;
  deliveries: number;
  perMealFee: number;
  breakdown: {
    deliveryFee?: number;
    platformFee?: number;
    serviceFee?: number;
    packagingFee?: number;
    handlingFee?: number;
    taxAmount?: number;
    addonsCost?: number;
    deliveryBreakdown?: import('../../services/api.service').DeliveryFeeBreakdown;
  };
}) {
  const subtotal = Math.round(perMealFee * deliveries * 100) / 100;
  // Delivery fee gets a tappable ⓘ icon instead of an inline sub-line — see
  // the JSX below. Other lines stay simple value-only rows.
  const lines: Array<{ label: string; value: number; isDelivery?: boolean }> = [
    { label: 'Delivery fee', value: breakdown.deliveryFee || 0, isDelivery: true },
    { label: 'Platform fee', value: breakdown.platformFee || 0 },
    { label: 'Service fee', value: breakdown.serviceFee || 0 },
    { label: 'Packaging', value: breakdown.packagingFee || 0 },
    { label: 'Handling', value: breakdown.handlingFee || 0 },
    { label: 'Add-ons', value: breakdown.addonsCost || 0 },
    { label: 'Tax (GST)', value: breakdown.taxAmount || 0 },
  ].filter((l) => l.value > 0);
  const [showDeliveryInfo, setShowDeliveryInfo] = useState(false);
  const deliveryFormula = deliveryFormulaText(breakdown.deliveryBreakdown);

  return (
    <View style={feeStyles.group}>
      <View style={feeStyles.header}>
        <View style={feeStyles.headerLeft}>
          <View style={[feeStyles.iconBubble, { backgroundColor: `${iconColor}15` }]}>
            <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
          </View>
          <Text style={feeStyles.title}>{title}</Text>
          <Text style={feeStyles.deliveryCount}>{` · ${deliveries} ${deliveries === 1 ? 'delivery' : 'deliveries'}`}</Text>
        </View>
        <Text style={feeStyles.subtotal}>{`₹${formatINR(subtotal)}`}</Text>
      </View>
      <Text style={feeStyles.formula}>
        {`Per meal: ₹${formatINR(perMealFee)} × ${deliveries}`}
      </Text>
      <View style={feeStyles.lines}>
        {lines.map((l, idx) => (
          <View key={idx} style={feeStyles.lineRow}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={feeStyles.lineLabel}>{l.label}</Text>
              {l.isDelivery && (
                <TouchableOpacity
                  onPress={() => setShowDeliveryInfo(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 4 }}
                >
                  <MaterialCommunityIcons name="information-outline" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={feeStyles.lineValue}>{`₹${formatINR(l.value)}`}</Text>
          </View>
        ))}
      </View>
      <DeliveryFeeInfoModal
        visible={showDeliveryInfo}
        onClose={() => setShowDeliveryInfo(false)}
        formula={deliveryFormula}
        deliveryFee={breakdown.deliveryFee || 0}
      />
    </View>
  );
}

function SummaryLine({
  label,
  value,
  sub,
  bold,
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  big?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text
          style={[
            { fontSize: FONT_SIZES.base, color: TEXT },
            bold && { fontWeight: '600' },
            big && { fontSize: FONT_SIZES.lg, fontWeight: '700' },
          ]}
        >
          {label}
        </Text>
        {!!sub && <Text style={{ fontSize: FONT_SIZES.xs, color: MUTED, marginTop: 2 }}>{sub}</Text>}
      </View>
      <Text
        style={[
          { fontSize: FONT_SIZES.base, color: TEXT, fontWeight: '600' },
          big && { fontSize: FONT_SIZES.xl, color: PRIMARY, fontWeight: '700' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  gradientHeader: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: TOUCH_TARGETS.minimum,
    height: TOUCH_TARGETS.minimum,
    borderRadius: TOUCH_TARGETS.minimum / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: FONT_SIZES.h4,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: TEXT },
  cardMeta: { fontSize: FONT_SIZES.sm, color: MUTED, marginTop: 2 },
  planPrice: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: PRIMARY },
  chev: { fontSize: 22, color: '#9CA3AF' },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.base,
    color: TEXT,
    paddingVertical: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  stepBtn: {
    width: 38, height: 38, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: TEXT,
    marginHorizontal: 18,
    minWidth: 24,
    textAlign: 'center',
  },
  mealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  mealPillText: {
    marginLeft: 6,
    fontSize: FONT_SIZES.base,
    color: TEXT,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
  },
  errorText: { color: '#DC2626', fontSize: FONT_SIZES.sm, marginLeft: 6, flex: 1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: '#fff',
  },
  footerLabel: { fontSize: FONT_SIZES.xs, color: MUTED },
  footerAmount: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: TEXT },
  payBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  payBtnText: { color: '#fff', fontSize: FONT_SIZES.base, fontWeight: 'bold' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContainer: {
    width: '88%',
    maxWidth: 480,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  sheetContent: { padding: 20 },
  sheetTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: TEXT,
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    marginBottom: 10,
  },
});

const summaryHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: TEXT },
  totalText: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: TEXT },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
});

const feeStyles = StyleSheet.create({
  group: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  iconBubble: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  title: { fontSize: FONT_SIZES.base, fontWeight: '700', color: TEXT },
  deliveryCount: { fontSize: FONT_SIZES.sm, color: MUTED },
  subtotal: { fontSize: FONT_SIZES.base, fontWeight: '700', color: TEXT },
  formula: { fontSize: FONT_SIZES.xs, color: MUTED, marginTop: 4, marginLeft: 34 },
  lines: {
    marginTop: 8, marginLeft: 34, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  lineLabel: { fontSize: FONT_SIZES.sm, color: MUTED },
  lineSubLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' },
  lineValue: { fontSize: FONT_SIZES.sm, color: TEXT, fontWeight: '500' },
});
