/**
 * Corporate Meals — pack purchase screen.
 *
 * Mirrors VoucherPurchaseScreen's look and opt-in pattern: orange gradient
 * header, gray-50 scroll body, sectioned cards with orange-tab titles, the
 * same "Yes, auto-deliver / No, I'll order manually" ChoiceCard opt-in.
 *
 * Simpler than the personal flow — no address/contact picker (corporate
 * delivery is always the locked office address) and no live quote fetch
 * (the plan's price + per-meal delivery fee are fixed and already prepay
 * the wallet on every purchase, whether or not auto-order is ever set up).
 * So choosing "Yes" here costs nothing extra — it just also creates the
 * CorporateAutoOrderSetup right after the same purchase succeeds, in the
 * same screen, instead of sending the customer to a separate screen later.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainTabParamList } from '../../types/navigation';
import { useAlert } from '../../context/AlertContext';
import paymentService from '../../services/payment.service';
import apiService, { CorporatePlan, CorporatePurchaseQuote, WeeklySchedule } from '../../services/api.service';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';
import WeeklyScheduleGrid from '../../components/WeeklyScheduleGrid';
import WeeklyScheduleQuickSets from '../../components/WeeklyScheduleQuickSets';

type Nav = StackNavigationProp<MainTabParamList, 'CorporatePurchase'>;
type Rt = RouteProp<MainTabParamList, 'CorporatePurchase'>;

const PRIMARY = '#FE8733';
const PRIMARY_TINT = '#FFF7ED';
const PRIMARY_BORDER = '#FED7AA';
const BG = '#F9FAFB';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const TEXT = '#111827';

function formatINR(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
}

function defaultWeekly(closedDays: string[] = []): WeeklySchedule {
  const closed = new Set(closedDays.map((d) => d.toLowerCase()));
  const w: WeeklySchedule = {};
  (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const).forEach((d) => {
    w[d] = closed.has(d) ? { lunch: false, dinner: false } : { lunch: true, dinner: true };
  });
  return w;
}

export default function CorporatePurchaseScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const { planId } = route.params;
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<CorporatePlan | null>(null);
  const [maxMealsPerWindow, setMaxMealsPerWindow] = useState(2);
  // Recurring weekly off-days for the kitchen serving the locked office
  // address (admin-configured, e.g. Sunday) — greyed out in the schedule
  // grid below instead of letting the customer schedule a day that's
  // always skipped by the auto-order cron.
  const [closedDays, setClosedDays] = useState<string[]>([]);
  // Server-computed quote (pack + GST + distance-tier per-meal fee stack +
  // prepaid total + grand total). The fee can't be computed on the phone —
  // it comes from the same engine the order will charge against.
  const [quote, setQuote] = useState<CorporatePurchaseQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Step 1: opt-in
  const [autoOrderYes, setAutoOrderYes] = useState<boolean | null>(null);
  // Step 2: form fields (only used when autoOrderYes === true).
  const [thalisPerMeal, setThalisPerMeal] = useState<number>(1);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(defaultWeekly());
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiService.getMyCorporate(),
      apiService.getCorporatePurchaseQuote(planId).catch((e: any) => {
        if (!cancelled) setQuoteError(e?.response?.data?.message || e?.message || 'Could not load pricing');
        return null;
      }),
    ])
      .then(([homeResp, quoteResp]) => {
        if (cancelled) return;
        if (homeResp.success) {
          const found = (homeResp.data.plans || []).find((p) => p._id === planId) || null;
          setPlan(found);
          setMaxMealsPerWindow(homeResp.data.corporate?.maxMealsPerWindow || 2);
          const closed = homeResp.data.corporate?.closedDays || [];
          setClosedDays(closed);
          setWeeklySchedule(defaultWeekly(closed));
        }
        if (quoteResp?.success) setQuote(quoteResp.data.quote);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  // Collapsed by default — same UX as VoucherPurchaseScreen's Order Summary.
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const hasAnyDay = useMemo(
    () => weeklySchedule && Object.values(weeklySchedule).some((d: any) => d?.lunch || d?.dinner),
    [weeklySchedule],
  );

  const canPay = !!quote && autoOrderYes !== null && (autoOrderYes === false || !!hasAnyDay) && !submitting;

  const executePurchase = async () => {
    if (!plan) return;
    setSubmitting(true);
    try {
      const result = await paymentService.processCorporatePurchase(plan._id);
      if (!result.success) {
        if (result.error !== 'Payment cancelled') {
          showAlert('Payment failed', result.error || 'Try again', undefined, 'error');
        }
        return;
      }

      // Pack purchased. If they opted in, chain the auto-order setup right
      // here — no separate screen visit needed. Purchase already prepaid the
      // delivery wallet, so this call itself costs nothing extra.
      if (autoOrderYes === true) {
        try {
          const setupResp = await apiService.createCorporateAutoOrderSetup({
            weeklySchedule,
            thalisPerMeal,
          });
          if (!setupResp.success) {
            showAlert(
              'Pack purchased — auto-order not set up',
              `Your ${plan.voucherCount} vouchers have been added to your account.\n\n${setupResp.message || "We couldn't set up auto-order this time."} You can try again anytime from Manage Auto-Order.`,
              [{ text: 'OK', style: 'default', onPress: () => nav.navigate('CorporateMeals') }],
              'warning',
            );
            return;
          }
          showAlert(
            'All set!',
            `${plan.voucherCount} vouchers added and auto-order is now running on your schedule.`,
            [{ text: 'OK', style: 'default', onPress: () => nav.navigate('CorporateAutoOrder') }],
            'success',
          );
          return;
        } catch (setupErr: any) {
          showAlert(
            'Pack purchased — auto-order not set up',
            `Your ${plan.voucherCount} vouchers have been added to your account.\n\n${setupErr?.response?.data?.message || setupErr?.message || "We couldn't set up auto-order this time."} You can try again anytime from Manage Auto-Order.`,
            [{ text: 'OK', style: 'default', onPress: () => nav.navigate('CorporateMeals') }],
            'warning',
          );
          return;
        }
      }

      showAlert(
        'Pack purchased',
        `${plan.voucherCount} vouchers added to your account.`,
        [{ text: 'OK', style: 'default', onPress: () => nav.navigate('CorporateMeals') }],
        'success',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = () => {
    if (!plan) return;
    if (autoOrderYes === true && !hasAnyDay) {
      showAlert('Pick a schedule', 'Select at least one day/meal in the weekly schedule', undefined, 'warning');
      return;
    }
    executePurchase();
  };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: MUTED }}>Plan not found</Text>
      </SafeAreaView>
    );
  }

  // All money comes from the server quote (the same buildCorporatePurchaseQuote
  // the purchase will charge against) — the phone can't run the pricing engine.
  const taxInclusive = quote?.planSnapshot?.taxInclusive ?? (plan.taxInclusive ?? true);
  const taxAmount = quote?.taxAmount ?? 0;
  const perMealFees = quote?.perMealFees ?? null;
  const totalPrepaid = quote?.feesPrepaid ?? 0;
  const grandTotal = quote?.grandTotal ?? plan.price;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

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
                {plan.voucherCount} vouchers · valid {plan.voucherValidityDays} days
              </Text>
              {!!perMealFees && perMealFees.total > 0 && (
                <Text style={styles.cardMeta}>
                  + ₹{formatINR(perMealFees.total)}/meal delivery & charges (prepaid to wallet)
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.planPrice}>{`₹${formatINR(plan.price)}`}</Text>
              {!!plan.originalPrice && plan.originalPrice > plan.price && (
                <Text style={styles.strikePrice}>{`₹${formatINR(plan.originalPrice)}`}</Text>
              )}
            </View>
          </View>
        </Section>

        {/* Auto-order opt-in */}
        <Section
          title="Auto-Order Setup"
          hint="Auto-order delivers your meals to the office automatically on your schedule — your delivery wallet is already prepaid by this purchase, so there's nothing extra to pay."
        >
          <ChoiceCard
            icon="autorenew"
            iconColor={autoOrderYes === true ? PRIMARY : MUTED}
            iconBg={autoOrderYes === true ? PRIMARY_TINT : '#F3F4F6'}
            title="Yes, auto-deliver"
            subtitle="Set a weekly schedule, sit back."
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
            {/* Thalis per meal */}
            <Section
              title="Thalis Per Meal"
              hint={`Each scheduled meal uses ${thalisPerMeal} voucher${thalisPerMeal === 1 ? '' : 's'}. Capped at your corporate's limit of ${maxMealsPerWindow} per window.`}
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
                    onPress={() => setThalisPerMeal(Math.min(maxMealsPerWindow, thalisPerMeal + 1))}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color={TEXT} />
                  </TouchableOpacity>
                </View>
              </View>
            </Section>

            {/* Weekly Schedule */}
            <Section title="Weekly Schedule" hint="Customize which days and meals to auto-order.">
              <WeeklyScheduleQuickSets onSelectPattern={setWeeklySchedule} />
              <View style={{ height: 8 }} />
              <WeeklyScheduleGrid schedule={weeklySchedule} onChange={setWeeklySchedule} closedDays={closedDays} />
            </Section>
          </>
        )}

        {/* Summary — collapsible, mirrors VoucherPurchaseScreen's Order
            Summary. Delivery + platform/service/packaging/GST per meal come
            live from the distance-tier engine for the locked office and are
            prepaid for the WHOLE pack (perMealTotal × voucherCount). Every
            order — manual or auto — draws from that prepaid wallet. */}
        <CollapsibleSummary
          expanded={summaryExpanded}
          onToggle={() => setSummaryExpanded((v) => !v)}
          total={grandTotal}
        >
          {!quote ? (
            <View style={{ paddingVertical: 8 }}>
              {quoteError ? (
                <Text style={{ fontSize: FONT_SIZES.sm, color: '#DC2626' }}>{quoteError}</Text>
              ) : (
                <ActivityIndicator size="small" color={PRIMARY} />
              )}
            </View>
          ) : (
            <>
              {/* Full pack price (not the tax base) so it matches what's
                  charged; GST as a separate line — "(incl.)" when the plan is
                  tax inclusive, exactly like the personal Voucher screen. */}
              <SummaryLine label="Voucher pack" value={`₹${formatINR(plan.price)}`} />
              {taxAmount > 0 && (
                <SummaryLine
                  label={taxInclusive ? 'GST (incl.)' : 'GST'}
                  value={`₹${formatINR(taxAmount)}`}
                />
              )}

              <SummaryLine
                label="What you get"
                value={`${plan.voucherCount} meals`}
                sub={`${plan.voucherCount} vouchers · 1 voucher = 1 meal · valid ${plan.voucherValidityDays} days`}
              />

              <View style={styles.divider} />

              {perMealFees && perMealFees.total > 0 ? (
                <>
                  {/* Per-meal fee breakdown (distance-tier), then the whole-pack
                      prepay = per-meal total × vouchers. */}
                  <View style={styles.feeGroup}>
                    <View style={styles.feeGroupHeader}>
                      <View style={styles.feeIconBubble}>
                        <MaterialCommunityIcons name="moped" size={16} color={PRIMARY} />
                      </View>
                      <Text style={styles.feeGroupTitle}>Delivery & charges (per meal)</Text>
                      <Text style={styles.feeGroupPerMeal}>{`₹${formatINR(perMealFees.total)}`}</Text>
                    </View>
                    <View style={styles.feeLines}>
                      {perMealFees.deliveryFee > 0 && (
                        <FeeLine
                          label="Delivery fee"
                          value={perMealFees.deliveryFee}
                          sub={perMealFees.distanceKm != null ? `${formatINR(perMealFees.distanceKm)} km from kitchen` : undefined}
                        />
                      )}
                      {perMealFees.platformFee > 0 && <FeeLine label="Platform fee" value={perMealFees.platformFee} />}
                      {perMealFees.serviceFee > 0 && <FeeLine label="Service fee" value={perMealFees.serviceFee} />}
                      {perMealFees.packagingFee > 0 && <FeeLine label="Packaging" value={perMealFees.packagingFee} />}
                      {perMealFees.handlingFee > 0 && <FeeLine label="Handling" value={perMealFees.handlingFee} />}
                      {perMealFees.taxAmount > 0 && <FeeLine label="GST" value={perMealFees.taxAmount} />}
                    </View>
                  </View>

                  <SummaryLine
                    label="Wallet credit (delivery & charges)"
                    value={`₹${formatINR(totalPrepaid)}`}
                    sub={`₹${formatINR(perMealFees.total)}/meal × ${plan.voucherCount} meals, prepaid now — every order (manual or auto) draws from this.`}
                  />
                </>
              ) : (
                <SummaryLine
                  label="Delivery & charges"
                  value="Free"
                  sub="This pack includes free delivery to your office for every order."
                />
              )}

              <View style={styles.divider} />
              <SummaryLine label="Pay now" value={`₹${formatINR(grandTotal)}`} big />
            </>
          )}
        </CollapsibleSummary>
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
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payBtnText}>
              {autoOrderYes === true ? 'Pay & Set Up Auto-Order' : 'Pay for Vouchers'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ────────── Section + atom components (mirrors VoucherPurchaseScreen) ──────────

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
        <Text style={{ fontSize: FONT_SIZES.sm, color: MUTED, marginBottom: 10, paddingLeft: 2 }}>{hint}</Text>
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
      style={[styles.card, active && { borderColor: PRIMARY, borderWidth: 2, backgroundColor: PRIMARY_TINT }]}
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

function SummaryLine({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[{ fontSize: FONT_SIZES.base, color: TEXT }, big && { fontSize: FONT_SIZES.lg, fontWeight: '700' }]}>
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

// A single per-meal fee line inside the "Delivery & charges" group.
function FeeLine({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <View style={styles.feeLineRow}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={styles.feeLineLabel}>{label}</Text>
        {!!sub && <Text style={styles.feeLineSub}>{sub}</Text>}
      </View>
      <Text style={styles.feeLineValue}>{`₹${formatINR(value)}`}</Text>
    </View>
  );
}

/**
 * Order Summary in a collapsible card — header always visible (title + live
 * total + chevron), body expands on tap. Mirrors VoucherPurchaseScreen so
 * both purchase flows feel the same.
 */
function CollapsibleSummary({
  expanded,
  onToggle,
  total,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch', padding: 0 }]}>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={summaryHeaderStyles.row}>
          <View style={summaryHeaderStyles.left}>
            <View style={{ width: 6, height: 22, backgroundColor: PRIMARY, borderRadius: 999, marginRight: 10 }} />
            <Text style={summaryHeaderStyles.title}>Order Summary</Text>
            <MaterialCommunityIcons name="information-outline" size={16} color="#9CA3AF" style={{ marginLeft: 6 }} />
          </View>
          <View style={summaryHeaderStyles.right}>
            <Text style={summaryHeaderStyles.totalText}>{`₹${formatINR(total)}`}</Text>
            <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#9CA3AF" style={{ marginLeft: 6 }} />
          </View>
        </TouchableOpacity>
        {expanded && <View style={summaryHeaderStyles.body}>{children}</View>}
      </View>
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
  headerTitle: { color: '#fff', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1, textAlign: 'center' },
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
  strikePrice: { fontSize: FONT_SIZES.xs, color: '#9CA3AF', textDecorationLine: 'line-through' },
  stepper: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: TEXT, marginHorizontal: 18, minWidth: 24, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8 },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
  // Per-meal fee breakdown group (mirrors the personal screen's FeeBreakdownGroup).
  feeGroup: { backgroundColor: BG, borderRadius: 12, padding: 12, marginBottom: 8 },
  feeGroupHeader: { flexDirection: 'row', alignItems: 'center' },
  feeIconBubble: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  feeGroupTitle: { flex: 1, fontSize: FONT_SIZES.sm, fontWeight: '700', color: TEXT },
  feeGroupPerMeal: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: TEXT },
  feeLines: { marginTop: 8, marginLeft: 34, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER },
  feeLineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 3 },
  feeLineLabel: { fontSize: FONT_SIZES.sm, color: MUTED },
  feeLineSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  feeLineValue: { fontSize: FONT_SIZES.sm, color: TEXT, fontWeight: '500' },
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
});

const summaryHeaderStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: TEXT },
  totalText: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: TEXT },
  body: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, borderTopWidth: 1, borderTopColor: BORDER },
});
