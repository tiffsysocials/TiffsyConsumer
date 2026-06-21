/**
 * Phase 11 — Set up auto-order on an EXISTING subscription.
 *
 * Customer already owns vouchers (bought a pack without opting into auto-
 * order, or has a migrated legacy subscription). This screen lets them
 * configure auto-order + prepay the per-meal fees in one Razorpay charge.
 *
 * UI mirrors VoucherPurchaseScreen (same orange gradient header, sectioned
 * cards, WeeklyScheduleGrid, etc). The only differences vs. the pack-buy
 * version:
 *   - Top card shows the existing subscription's vouchers-remaining (no
 *     plan price line)
 *   - No "Yes / No" opt-in (already opted in by reaching this screen)
 *   - Razorpay charge = totalFeesPrepaid only (no pack price)
 *
 * Backend: POST /api/payment/auto-order-setup/initiate
 *          → Razorpay → POST /api/payment/verify (AUTO_ORDER_SETUP branch
 *            writes Subscription.autoOrderSetup + credits globalWallet).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
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
import { useSubscription } from '../../context/SubscriptionContext';
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

type Nav = NativeStackNavigationProp<RootStackParamList, 'AutoOrderSetup'>;
type Rt = RouteProp<RootStackParamList, 'AutoOrderSetup'>;

const PRIMARY = '#FE8733';
const PRIMARY_TINT = '#FFF7ED';
const PRIMARY_BORDER = '#FED7AA';
const BG = '#F9FAFB';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const TEXT = '#111827';

function defaultWeekly(): WeeklySchedule {
  const w: WeeklySchedule = {};
  (['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const).forEach(d => {
    w[d] = { lunch: true, dinner: true };
  });
  return w;
}

export default function AutoOrderSetupScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const { subscriptionId, addressId: prefilledAddressId } = route.params || ({} as any);

  const { addresses, getMainAddress } = useAddress();
  const { subscriptions, fetchSubscriptions } = useSubscription();

  // Pick the subscription: explicit param wins; else newest ACTIVE.
  const subscription = useMemo(() => {
    if (subscriptionId) return subscriptions.find(s => s._id === subscriptionId) || null;
    return (
      subscriptions
        .filter(s => s.status === 'ACTIVE')
        .sort((a, b) => new Date(b.startDate as any).getTime() - new Date(a.startDate as any).getTime())[0] || null
    );
  }, [subscriptionId, subscriptions]);

  const defaultAddr = useMemo(
    () => addresses.find(a => a.id === prefilledAddressId) || getMainAddress(),
    [addresses, prefilledAddressId, getMainAddress],
  );

  const [addressId, setAddressId] = useState<string>(defaultAddr?.id ?? '');
  const [contactName, setContactName] = useState<string>(defaultAddr?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState<string>(defaultAddr?.contactPhone ?? '');
  const [thalisPerMeal, setThalisPerMeal] = useState<number>(1);
  const [mealWindows, setMealWindows] = useState<Array<'LUNCH' | 'DINNER'>>(['LUNCH', 'DINNER']);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(defaultWeekly());

  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<AutoOrderPurchaseQuoteResponse['data'] | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (subscriptions.length === 0) fetchSubscriptions();
  }, [subscriptions.length, fetchSubscriptions]);

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
    !!subscription &&
    !!addressId &&
    !!contactName.trim() &&
    /^[6-9]\d{9}$/.test(contactPhone.trim()) &&
    mealWindows.length > 0;

  // Debounced quote against the subscription
  useEffect(() => {
    if (!subscription || !formIsComplete) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    const t = setTimeout(async () => {
      try {
        const res = await apiService.getAutoOrderPurchaseQuote({
          subscriptionId: subscription._id,
          ...form,
        });
        if (res.success) setQuote(res.data);
        else {
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
  }, [subscription, formIsComplete, form]);

  const toggleMealWindow = (w: 'LUNCH' | 'DINNER') => {
    setMealWindows(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : ([...prev, w].sort() as any),
    );
  };

  const selectedAddress = addresses.find(a => a.id === addressId);

  const handlePay = async () => {
    if (!subscription || !quote || quoteError) {
      Alert.alert('Please wait', 'Wait for the price quote to load before paying.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await paymentService.processAutoOrderSetupPayment(subscription._id, form);
      if (!result.success) {
        if (result.error === 'Payment cancelled') return;
        Alert.alert('Payment failed', result.error || 'Try again');
        return;
      }
      Alert.alert(
        'Auto-order set up',
        `₹${quote.totalFeesPrepaid} credited to your wallet for ${quote.totalDeliveries} upcoming deliveries.`,
        [{ text: 'OK', onPress: () => nav.navigate('AutoOrderSettings') }],
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!subscription) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={MUTED} />
        <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: '700', color: TEXT, marginTop: 12, textAlign: 'center' }}>
          No active subscription found
        </Text>
        <Text style={{ fontSize: FONT_SIZES.sm, color: MUTED, marginTop: 6, textAlign: 'center' }}>
          Buy a voucher pack first, then come back to set up auto-order.
        </Text>
        <TouchableOpacity
          style={[styles.payBtn, { marginTop: 24, paddingHorizontal: 24 }]}
          onPress={() => nav.navigate('MealPlans')}
        >
          <Text style={styles.payBtnText}>View Plans</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const grandTotal = quote?.grandTotal ?? 0;
  const canPay = !!quote && !quoteLoading && !quoteError && !submitting;

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
            <Text style={styles.headerTitle} numberOfLines={1}>Set Up Auto-Order</Text>
            <View style={{ width: TOUCH_TARGETS.minimum }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom, paddingTop: SPACING.lg }}
      >
        {/* Subscription card */}
        <Section title="Your Subscription">
          <View style={styles.planCard}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="ticket-percent" size={24} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {subscription.planId?.name || subscription.planSnapshot?.name || 'Voucher Pack'}
              </Text>
              <Text style={styles.cardMeta}>
                {`${(subscription as any).vouchersRemaining ?? subscription.totalVouchersIssued - subscription.vouchersUsed} vouchers remaining`}
              </Text>
            </View>
          </View>
        </Section>

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
                  <Text style={styles.cardTitle} numberOfLines={1}>{selectedAddress.label}</Text>
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

        {/* Thalis */}
        <Section
          title="Thalis Per Meal"
          hint={`Each scheduled meal uses ${thalisPerMeal} voucher${thalisPerMeal === 1 ? '' : 's'}.`}
        >
          <View style={[styles.card, { justifyContent: 'space-between' }]}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="food" size={22} color={PRIMARY} />
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setThalisPerMeal(Math.max(1, thalisPerMeal - 1))}>
                <MaterialCommunityIcons name="minus" size={20} color={TEXT} />
              </TouchableOpacity>
              <Text style={styles.stepValue}>{thalisPerMeal}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setThalisPerMeal(Math.min(10, thalisPerMeal + 1))}>
                <MaterialCommunityIcons name="plus" size={20} color={TEXT} />
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* Meal windows */}
        <Section title="Meal Windows" hint="Pick which meals you want auto-delivered.">
          <View style={{ flexDirection: 'row' }}>
            {(['LUNCH', 'DINNER'] as const).map(w => (
              <TouchableOpacity
                key={w}
                onPress={() => toggleMealWindow(w)}
                activeOpacity={0.7}
                style={[
                  styles.mealPill,
                  mealWindows.includes(w) && { backgroundColor: PRIMARY, borderColor: PRIMARY },
                ]}
              >
                <MaterialCommunityIcons
                  name={w === 'LUNCH' ? 'white-balance-sunny' : 'moon-waning-crescent'}
                  size={18}
                  color={mealWindows.includes(w) ? '#fff' : (w === 'LUNCH' ? PRIMARY : '#8B5CF6')}
                />
                <Text style={[styles.mealPillText, mealWindows.includes(w) && { color: '#fff', fontWeight: '700' }]}>
                  {w === 'LUNCH' ? 'Lunch' : 'Dinner'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Weekly Schedule */}
        <Section title="Weekly Schedule" hint="Customize which days and meals to auto-order.">
          <WeeklyScheduleQuickSets onSelectPattern={setWeeklySchedule} />
          <View style={{ height: 8 }} />
          <WeeklyScheduleGrid schedule={weeklySchedule} onChange={setWeeklySchedule} />
        </Section>

        {/* Summary */}
        <Section title="Order Summary">
          <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch', padding: 16 }]}>
            {quoteLoading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={{ color: MUTED, marginLeft: 8 }}>Calculating…</Text>
              </View>
            )}
            {quoteError && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{quoteError}</Text>
              </View>
            )}
            {quote && !quoteLoading && !quoteError && (
              <View>
                <SummaryLine
                  label="Total deliveries"
                  value={`${quote.totalDeliveries}`}
                  sub={`Lunch: ${quote.perWindowDeliveries.lunch} · Dinner: ${quote.perWindowDeliveries.dinner}`}
                />
                {quote.perMealFees.lunch && (
                  <SummaryLine label="Per-meal fees (Lunch)" value={`₹${quote.perMealFees.lunch.total}`} />
                )}
                {quote.perMealFees.dinner && (
                  <SummaryLine label="Per-meal fees (Dinner)" value={`₹${quote.perMealFees.dinner.total}`} />
                )}
                <SummaryLine label="Wallet credit" value={`₹${quote.totalFeesPrepaid}`} bold />
                <View style={styles.divider} />
                <SummaryLine label="Pay now" value={`₹${quote.grandTotal}`} big />
              </View>
            )}
          </View>
        </Section>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerLabel}>Total payable</Text>
          <Text style={styles.footerAmount}>{`₹${grandTotal}`}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, !canPay && { backgroundColor: '#D1D5DB' }]}
          disabled={!canPay}
          onPress={handlePay}
          activeOpacity={0.85}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Pay & Set Up Auto-Order</Text>}
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

// ───────── shared atoms (identical to VoucherPurchaseScreen) ─────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
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

function SummaryLine({
  label, value, sub, bold, big,
}: { label: string; value: string; sub?: string; bold?: boolean; big?: boolean }) {
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
  },
  backBtn: {
    width: TOUCH_TARGETS.minimum, height: TOUCH_TARGETS.minimum,
    borderRadius: TOUCH_TARGETS.minimum / 2, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1, textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER,
    flexDirection: 'row', alignItems: 'center',
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  planCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER,
    flexDirection: 'row', alignItems: 'center',
  },
  cardTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: TEXT },
  cardMeta: { fontSize: FONT_SIZES.sm, color: MUTED, marginTop: 2 },
  chev: { fontSize: 22, color: '#9CA3AF' },
  input: { flex: 1, fontSize: FONT_SIZES.base, color: TEXT, paddingVertical: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  stepBtn: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValue: {
    fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: TEXT,
    marginHorizontal: 18, minWidth: 24, textAlign: 'center',
  },
  mealPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff', marginRight: 10,
  },
  mealPillText: { marginLeft: 6, fontSize: FONT_SIZES.base, color: TEXT, fontWeight: '600' },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8,
  },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: '#FEF2F2', borderRadius: 10,
  },
  errorText: { color: '#DC2626', fontSize: FONT_SIZES.sm, marginLeft: 6, flex: 1 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#fff',
  },
  footerLabel: { fontSize: FONT_SIZES.xs, color: MUTED },
  footerAmount: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: TEXT },
  payBtn: {
    backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', minWidth: 180,
  },
  payBtnText: { color: '#fff', fontSize: FONT_SIZES.base, fontWeight: 'bold' },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  sheetContainer: {
    width: '88%', maxWidth: 480, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
  },
  sheetContent: { padding: 20 },
  sheetTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: TEXT, marginBottom: 16 },
  addressRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderWidth: 1, borderColor: BORDER, borderRadius: 14, marginBottom: 10,
  },
});
