/**
 * Phase 11 — Voucher pack + auto-order setup full-page purchase screen.
 *
 * Replaces the old VoucherPaymentModal popup at order time. The customer
 * picks a plan on MealPlansScreen → this screen opens → they optionally
 * configure auto-order → one Razorpay charge covers the pack + all
 * upcoming meal fees.
 *
 * Live quote: every form change debounces a POST /subscriptions/purchase/quote
 * call so the summary reflects current per-meal fees + total.
 *
 * Submit: initiateSubscriptionPayment(planId, autoOrderSetup?) — the
 * backend re-quotes server-side, sets Razorpay amount, stashes the form
 * in PaymentTransaction.metadata. After Razorpay verify, the backend
 * writes Subscription.autoOrderSetup + credits globalWallet.
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
  Alert,
  Platform,
  StatusBar,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useAddress } from '../../context/AddressContext';
import { useSubscription } from '../../context/SubscriptionContext';
import paymentService from '../../services/payment.service';
import apiService, {
  AutoOrderSetupForm,
  AutoOrderPurchaseQuoteResponse,
  DayName,
} from '../../services/api.service';
import { Colors } from '../../constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VoucherPurchase'>;
type Rt = RouteProp<RootStackParamList, 'VoucherPurchase'>;

const PRIMARY = Colors.primary;
const PRIMARY_TINT = '#FFF7ED';
const BORDER = Colors.border;
const MUTED = Colors.text.secondary;
const SLATE = Colors.text.primary;
const SURFACE = Colors.surface;

const DAYS: { key: DayName; label: string }[] = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

function defaultWeekly(lunch = true, dinner = true) {
  const w: Record<string, { lunch: boolean; dinner: boolean }> = {};
  for (const d of DAYS) w[d.key] = { lunch, dinner };
  return w;
}

export default function VoucherPurchaseScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { planId } = route.params;

  const { addresses, getMainAddress } = useAddress();
  const { plans } = useSubscription();
  const plan = useMemo(() => plans.find(p => p._id === planId), [plans, planId]);

  // Step 1: opt-in
  const [autoOrderYes, setAutoOrderYes] = useState<boolean | null>(null);

  // Step 2: form fields (only used when autoOrderYes === true)
  const defaultAddr = getMainAddress();
  const [addressId, setAddressId] = useState<string>(defaultAddr?.id ?? '');
  const [contactName, setContactName] = useState<string>(defaultAddr?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState<string>(defaultAddr?.contactPhone ?? '');
  const [thalisPerMeal, setThalisPerMeal] = useState<number>(1);
  const [mealWindows, setMealWindows] = useState<Array<'LUNCH' | 'DINNER'>>(['LUNCH', 'DINNER']);
  const [weeklySchedule, setWeeklySchedule] = useState(defaultWeekly());

  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<AutoOrderPurchaseQuoteResponse['data'] | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const toggleMealWindow = (w: 'LUNCH' | 'DINNER') => {
    setMealWindows(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w].sort() as any,
    );
  };

  const toggleDay = (day: DayName, slot: 'lunch' | 'dinner') => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [slot]: !prev[day][slot] },
    }));
  };

  const handlePay = async () => {
    if (!plan) return;
    if (autoOrderYes === true && (!quote || quoteError)) {
      Alert.alert('Wait for quote', 'Please wait for the price quote to load before paying.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await paymentService.processSubscriptionPayment(
        plan._id,
        autoOrderYes === true ? form : undefined,
      );
      if (!result.success) {
        if (result.error === 'Payment cancelled') {
          return;
        }
        Alert.alert('Payment failed', result.error || 'Try again');
        return;
      }
      Alert.alert(
        'Pack purchased',
        autoOrderYes === true
          ? `Auto-order set up successfully. ₹${quote?.totalFeesPrepaid ?? 0} credited to your wallet for ${quote?.totalDeliveries ?? 0} upcoming deliveries.`
          : `${plan.totalVouchers} vouchers added to your account.`,
        [{ text: 'OK', onPress: () => nav.navigate('Account') }],
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!plan) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <Text>Plan not found</Text>
      </View>
    );
  }

  const grandTotal =
    autoOrderYes === true && quote ? quote.grandTotal : plan.price;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color={SLATE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buy Voucher Pack</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Plan card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voucher Pack</Text>
          <View style={styles.planCard}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planMeta}>
              {plan.totalVouchers} vouchers · valid {plan.voucherValidityDays} days
            </Text>
            <Text style={styles.planPrice}>₹{plan.price}</Text>
          </View>
        </View>

        {/* Auto-order opt-in */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Set up auto-ordering?</Text>
          <Text style={styles.sectionHint}>
            Auto-order delivers your vouchers automatically. Pay the meal fees once now — no
            top-ups, no surprises.
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <RadioCard
              label="No, I'll order manually"
              icon="cancel"
              active={autoOrderYes === false}
              onPress={() => setAutoOrderYes(false)}
            />
            <RadioCard
              label="Yes, auto-deliver"
              icon="auto-mode"
              active={autoOrderYes === true}
              onPress={() => setAutoOrderYes(true)}
            />
          </View>
        </View>

        {autoOrderYes === true && (
          <>
            {/* Address */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery address</Text>
              <TouchableOpacity
                style={styles.addressBtn}
                onPress={() => setShowAddressPicker(true)}
              >
                {addressId ? (
                  <>
                    <Icon name="place" size={20} color={PRIMARY} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.addressLabel}>
                        {addresses.find(a => a.id === addressId)?.label || 'Address'}
                      </Text>
                      <Text style={styles.addressDetail} numberOfLines={1}>
                        {addresses.find(a => a.id === addressId)?.addressLine1},{' '}
                        {addresses.find(a => a.id === addressId)?.locality}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={{ color: MUTED }}>Pick an address</Text>
                )}
                <Icon name="chevron-right" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>

            {/* Contact */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery contact</Text>
              <View style={styles.input}>
                <Icon name="person" size={18} color={MUTED} />
                <TextInput
                  style={styles.inputText}
                  placeholder="Name"
                  placeholderTextColor={MUTED}
                  value={contactName}
                  onChangeText={setContactName}
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.input, { marginTop: 8 }]}>
                <Icon name="phone" size={18} color={MUTED} />
                <TextInput
                  style={styles.inputText}
                  placeholder="10-digit phone"
                  placeholderTextColor={MUTED}
                  value={contactPhone}
                  onChangeText={t => setContactPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
              <Text style={[styles.sectionHint, { marginTop: 6 }]}>
                Used only for this auto-order's delivery contact.
              </Text>
            </View>

            {/* Meal windows */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Meal windows</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                {(['LUNCH', 'DINNER'] as const).map(w => (
                  <Pill
                    key={w}
                    label={w}
                    active={mealWindows.includes(w)}
                    onPress={() => toggleMealWindow(w)}
                  />
                ))}
              </View>
            </View>

            {/* Thalis per meal */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thalis per meal</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setThalisPerMeal(Math.max(1, thalisPerMeal - 1))}
                >
                  <Icon name="remove" size={20} color={SLATE} />
                </TouchableOpacity>
                <Text style={styles.stepValue}>{thalisPerMeal}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setThalisPerMeal(Math.min(10, thalisPerMeal + 1))}
                >
                  <Icon name="add" size={20} color={SLATE} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.sectionHint, { marginTop: 6 }]}>
                Each scheduled meal uses {thalisPerMeal} voucher{thalisPerMeal === 1 ? '' : 's'}.
              </Text>
            </View>

            {/* Weekly schedule */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weekly schedule</Text>
              {DAYS.map(d => (
                <View key={d.key} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{d.label}</Text>
                  <View style={{ flexDirection: 'row' }}>
                    {mealWindows.includes('LUNCH') && (
                      <Pill
                        small
                        label="Lunch"
                        active={weeklySchedule[d.key]?.lunch}
                        onPress={() => toggleDay(d.key, 'lunch')}
                      />
                    )}
                    {mealWindows.includes('DINNER') && (
                      <Pill
                        small
                        label="Dinner"
                        active={weeklySchedule[d.key]?.dinner}
                        onPress={() => toggleDay(d.key, 'dinner')}
                      />
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Live summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order summary</Text>
              {quoteLoading && (
                <View style={[styles.summaryRow, { justifyContent: 'center', paddingVertical: 12 }]}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                  <Text style={{ color: MUTED, marginLeft: 8 }}>Calculating…</Text>
                </View>
              )}
              {quoteError && (
                <View style={styles.errorBox}>
                  <Icon name="error-outline" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{quoteError}</Text>
                </View>
              )}
              {quote && !quoteLoading && !quoteError && (
                <View>
                  <SummaryLine label="Voucher pack" value={`₹${quote.plan.price}`} />
                  <SummaryLine
                    label="Total deliveries"
                    value={`${quote.totalDeliveries}`}
                    sub={`L: ${quote.perWindowDeliveries.lunch} · D: ${quote.perWindowDeliveries.dinner}`}
                  />
                  {quote.perMealFees.lunch && (
                    <SummaryLine
                      label="Per-meal fees (Lunch)"
                      value={`₹${quote.perMealFees.lunch.total}`}
                    />
                  )}
                  {quote.perMealFees.dinner && (
                    <SummaryLine
                      label="Per-meal fees (Dinner)"
                      value={`₹${quote.perMealFees.dinner.total}`}
                    />
                  )}
                  <SummaryLine
                    label="Wallet credit"
                    value={`₹${quote.totalFeesPrepaid}`}
                    bold
                  />
                  <View style={styles.divider} />
                  <SummaryLine
                    label="Pay now"
                    value={`₹${quote.grandTotal}`}
                    big
                  />
                </View>
              )}
            </View>
          </>
        )}

        {autoOrderYes === false && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order summary</Text>
            <SummaryLine label="Voucher pack" value={`₹${plan.price}`} />
            <View style={styles.divider} />
            <SummaryLine label="Pay now" value={`₹${plan.price}`} big />
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerAmount}>₹{grandTotal}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.payBtn,
            (autoOrderYes === null ||
              (autoOrderYes === true && (!quote || quoteLoading || !!quoteError)) ||
              submitting) && { opacity: 0.5 },
          ]}
          disabled={
            autoOrderYes === null ||
            (autoOrderYes === true && (!quote || quoteLoading || !!quoteError)) ||
            submitting
          }
          onPress={handlePay}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payBtnText}>
              {autoOrderYes === true ? 'Pay & set up auto-order' : 'Pay for vouchers'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Address picker modal */}
      <Modal
        visible={showAddressPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddressPicker(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowAddressPicker(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sectionTitle}>Choose address</Text>
          <ScrollView style={{ maxHeight: 380, marginTop: 8 }}>
            {addresses.map(a => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.addressRow,
                  addressId === a.id && { borderColor: PRIMARY, backgroundColor: PRIMARY_TINT },
                ]}
                onPress={() => {
                  setAddressId(a.id);
                  if (!contactName) setContactName(a.contactName || '');
                  if (!contactPhone) setContactPhone(a.contactPhone || '');
                  setShowAddressPicker(false);
                }}
              >
                <Icon name="place" size={20} color={PRIMARY} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.addressLabel}>{a.label}</Text>
                  <Text style={styles.addressDetail} numberOfLines={2}>
                    {a.addressLine1}, {a.locality}, {a.pincode}
                  </Text>
                </View>
                {addressId === a.id && <Icon name="check-circle" size={20} color={PRIMARY} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function RadioCard({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.radioCard, active && styles.radioCardActive]}
      onPress={onPress}
    >
      <Icon name={icon} size={22} color={active ? PRIMARY : MUTED} />
      <Text style={[styles.radioLabel, active && { color: PRIMARY, fontWeight: '600' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Pill({
  label,
  active,
  onPress,
  small,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pill,
        small && styles.pillSmall,
        active && styles.pillActive,
      ]}
    >
      <Text style={[styles.pillText, active && { color: '#fff', fontWeight: '600' }]}>
        {label}
      </Text>
    </TouchableOpacity>
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
      <View>
        <Text
          style={[
            styles.summaryLabel,
            bold && { fontWeight: '600', color: SLATE },
            big && { fontSize: 16, fontWeight: '700', color: SLATE },
          ]}
        >
          {label}
        </Text>
        {!!sub && <Text style={styles.summarySub}>{sub}</Text>}
      </View>
      <Text
        style={[
          styles.summaryValue,
          bold && { fontWeight: '600' },
          big && { fontSize: 18, fontWeight: '700', color: PRIMARY },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 12 : 14,
    paddingTop: Platform.OS === 'ios' ? 56 : 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: SLATE, textAlign: 'center' },
  section: { padding: 16, borderBottomWidth: 8, borderBottomColor: '#F9FAFB' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: SLATE },
  sectionHint: { fontSize: 12, color: MUTED, marginTop: 4 },
  planCard: {
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 12,
    backgroundColor: PRIMARY_TINT,
  },
  planName: { fontSize: 16, fontWeight: '700', color: SLATE },
  planMeta: { fontSize: 13, color: MUTED, marginTop: 2 },
  planPrice: { fontSize: 20, fontWeight: '700', color: PRIMARY, marginTop: 6 },
  radioCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    marginRight: 8,
  },
  radioCardActive: { borderColor: PRIMARY, backgroundColor: PRIMARY_TINT },
  radioLabel: { marginLeft: 8, fontSize: 13, color: SLATE, flex: 1 },
  addressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
  },
  addressLabel: { fontSize: 14, fontWeight: '600', color: SLATE },
  addressDetail: { fontSize: 12, color: MUTED, marginTop: 2 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    marginTop: 8,
  },
  inputText: { marginLeft: 8, fontSize: 14, color: SLATE, flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  stepBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
  },
  stepValue: { fontSize: 18, fontWeight: '700', color: SLATE, marginHorizontal: 18 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: BORDER,
    borderRadius: 999, marginRight: 8,
  },
  pillSmall: { paddingHorizontal: 10, paddingVertical: 4 },
  pillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pillText: { fontSize: 13, color: SLATE },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  dayLabel: { fontSize: 14, color: SLATE, fontWeight: '500', width: 50 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14, color: SLATE },
  summarySub: { fontSize: 11, color: MUTED, marginTop: 2 },
  summaryValue: { fontSize: 14, color: SLATE },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: '#FEF2F2', borderRadius: 8, marginTop: 8,
  },
  errorText: { color: '#DC2626', fontSize: 12, marginLeft: 6, flex: 1 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#fff',
  },
  footerLabel: { fontSize: 12, color: MUTED },
  footerAmount: { fontSize: 20, fontWeight: '700', color: SLATE },
  payBtn: {
    backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff', padding: 16,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  addressRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderWidth: 1, borderColor: BORDER, borderRadius: 10, marginBottom: 8,
  },
});
