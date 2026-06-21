/**
 * Phase 11 — Manage an EXISTING auto-order setup.
 *
 * Sectioned UI mirrors AutoOrderSetupScreen so the create + edit flows
 * feel like the same product. Editable here:
 *   - Pause / resume (enabled toggle)
 *   - Weekly schedule
 *
 * Locked (set at purchase, drives the prepaid-wallet math):
 *   - Delivery address
 *   - Thalis per meal
 *   - Per-meal fees snapshot
 *
 * Customer who wants to change a locked field cancels this setup
 * (toggle off) and runs the create flow again from MealPlans.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
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
import { useAlert } from '../../context/AlertContext';
import apiService, {
  WeeklySchedule,
} from '../../services/api.service';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';
import WeeklyScheduleGrid from '../../components/WeeklyScheduleGrid';
import WeeklyScheduleQuickSets from '../../components/WeeklyScheduleQuickSets';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AutoOrderManage'>;
type Rt = RouteProp<RootStackParamList, 'AutoOrderManage'>;

const PRIMARY = '#FE8733';
const PRIMARY_TINT = '#FFF7ED';
const BG = '#F9FAFB';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const TEXT = '#111827';
const LOCKED_BG = '#F3F4F6';

function formatINR(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? `${r}` : r.toFixed(2);
}

const DAY_LIST = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const;

export default function AutoOrderManageScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const { subscriptionId, addressId: addressIdParam } = route.params || ({} as any);

  const { addresses } = useAddress();
  const { subscriptions, fetchSubscriptions, fetchAllAutoOrderConfigs } = useSubscription();
  const { showAlert } = useAlert();

  // Pick the subscription whose autoOrderSetup we're editing.
  const subscription = useMemo(() => {
    if (subscriptionId) return subscriptions.find(s => s._id === subscriptionId) || null;
    // Else find the one whose setup.addressId matches the route param.
    if (addressIdParam) {
      return subscriptions.find(s =>
        (s as any).autoOrderSetup?.addressId?.toString?.() === addressIdParam ||
        (s as any).autoOrderSetup?.addressId === addressIdParam,
      ) || null;
    }
    // Else: newest ACTIVE with a setup.
    return subscriptions
      .filter(s => s.status === 'ACTIVE' && (s as any).autoOrderSetup)
      .sort((a, b) => new Date(b.startDate as any).getTime() - new Date(a.startDate as any).getTime())[0] || null;
  }, [subscriptionId, addressIdParam, subscriptions]);

  // Setup snapshot — initial values
  const setup = (subscription as any)?.autoOrderSetup;
  const initialEnabled: boolean = setup?.enabled !== false;
  const initialWeekly: WeeklySchedule = useMemo(() => {
    const ws: WeeklySchedule = {};
    if (setup?.weeklySchedule && typeof setup.weeklySchedule === 'object') {
      for (const d of DAY_LIST) {
        const v = (setup.weeklySchedule as any)[d];
        ws[d] = v ? { lunch: !!v.lunch, dinner: !!v.dinner } : { lunch: false, dinner: false };
      }
    } else {
      for (const d of DAY_LIST) ws[d] = { lunch: true, dinner: true };
    }
    return ws;
  }, [setup]);

  const [isEnabled, setIsEnabled] = useState<boolean>(initialEnabled);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(initialWeekly);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (subscriptions.length === 0) fetchSubscriptions();
  }, [subscriptions.length, fetchSubscriptions]);

  // Re-seed local state if subscription changes (e.g. after a fetch)
  useEffect(() => {
    if (setup) {
      setIsEnabled(setup.enabled !== false);
      setWeeklySchedule(initialWeekly);
    }
  }, [setup, initialWeekly]);

  // Address + kitchen display
  const address = addresses.find(a => a.id === (setup?.addressId?.toString?.() || setup?.addressId));
  const kitchenName = setup?.perMealFeesSnapshot?.sourceKitchenId ? 'Linked kitchen' : null;
  void kitchenName;

  // Derived meal windows from the schedule (same logic as setup screen)
  const derivedMealWindows = useMemo<Array<'LUNCH' | 'DINNER'>>(() => {
    const result: Array<'LUNCH' | 'DINNER'> = [];
    if (Object.values(weeklySchedule).some((d: any) => d?.lunch)) result.push('LUNCH');
    if (Object.values(weeklySchedule).some((d: any) => d?.dinner)) result.push('DINNER');
    return result;
  }, [weeklySchedule]);

  const dirty =
    isEnabled !== initialEnabled ||
    JSON.stringify(weeklySchedule) !== JSON.stringify(initialWeekly);

  const handleSave = async () => {
    if (!subscription) return;
    if (derivedMealWindows.length === 0) {
      showAlert(
        'Schedule is empty',
        'Pick at least one day with lunch or dinner enabled.',
        undefined,
        'warning',
      );
      return;
    }
    setIsSaving(true);
    try {
      await apiService.updateAutoOrderSetup(subscription._id, {
        enabled: isEnabled,
        weeklySchedule,
        mealWindows: derivedMealWindows,
      });
      // Refresh so the settings list mirrors the new state.
      try { await fetchAllAutoOrderConfigs(); } catch {}
      try { await fetchSubscriptions(); } catch {}
      showAlert(
        'Auto-order updated',
        isEnabled
          ? 'Your changes have been saved.'
          : 'Auto-order paused. We won\'t place new orders until you turn it back on.',
        [{ text: 'OK', style: 'default', onPress: () => nav.goBack() }],
        'success',
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to save';
      showAlert('Could not save', msg, undefined, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!subscription || !setup) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={MUTED} />
        <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: '700', color: TEXT, marginTop: 12, textAlign: 'center' }}>
          No auto-order found
        </Text>
        <Text style={{ fontSize: FONT_SIZES.sm, color: MUTED, marginTop: 6, textAlign: 'center' }}>
          Set up auto-order from the Auto-Order Settings screen.
        </Text>
        <TouchableOpacity
          style={[styles.payBtn, { marginTop: 24, paddingHorizontal: 24 }]}
          onPress={() => nav.navigate('AutoOrderSetup')}
        >
          <Text style={styles.payBtnText}>Set Up Auto-Order</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const walletBalance = (subscription as any).globalWallet?.balance ?? 0;
  const thalisPerMeal = setup.thalisPerMeal || 1;

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
            <Text style={styles.headerTitle} numberOfLines={1}>Manage Auto-Order</Text>
            <View style={{ width: TOUCH_TARGETS.minimum }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom, paddingTop: SPACING.lg }}
      >
        {/* Wallet card — most useful info up top */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={walletCardStyles.card}>
            <View style={walletCardStyles.iconWrap}>
              <MaterialCommunityIcons name="wallet" size={28} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={walletCardStyles.bigNumber}>{`₹${formatINR(walletBalance)}`}</Text>
              <Text style={walletCardStyles.label}>Prepaid wallet balance</Text>
            </View>
          </View>
        </View>

        {/* Status toggle */}
        <Section title="Status">
          <View style={[styles.card, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.iconCircle, { backgroundColor: isEnabled ? PRIMARY_TINT : LOCKED_BG }]}>
                <MaterialCommunityIcons
                  name={isEnabled ? 'auto-mode' : 'pause-circle'}
                  size={22}
                  color={isEnabled ? PRIMARY : MUTED}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {isEnabled ? 'Auto-order is ON' : 'Auto-order is OFF'}
                </Text>
                <Text style={styles.cardMeta}>
                  {isEnabled
                    ? 'New orders will be placed automatically.'
                    : 'No new orders will be placed until you turn it back on.'}
                </Text>
              </View>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={setIsEnabled}
              trackColor={{ false: '#E5E7EB', true: '#FE873360' }}
              thumbColor={isEnabled ? PRIMARY : '#f4f3f4'}
            />
          </View>
        </Section>

        {/* Delivery details (read-only — locked at purchase) */}
        <Section title="Delivery Details" hint="Locked at purchase. To change, cancel this setup and create a new one.">
          {address ? (
            <View style={[styles.card, styles.lockedCard]}>
              <View style={[styles.iconCircle, { backgroundColor: LOCKED_BG }]}>
                <MaterialCommunityIcons name="map-marker" size={22} color={MUTED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{address.label}</Text>
                <Text style={styles.cardMeta} numberOfLines={2}>
                  {address.addressLine1}, {address.locality}
                </Text>
              </View>
              <MaterialCommunityIcons name="lock" size={18} color={MUTED} />
            </View>
          ) : (
            <View style={[styles.card, styles.lockedCard]}>
              <Text style={styles.cardMeta}>Address details unavailable</Text>
            </View>
          )}
          <View style={{ height: 12 }} />
          <View style={[styles.card, styles.lockedCard, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.iconCircle, { backgroundColor: LOCKED_BG }]}>
                <MaterialCommunityIcons name="food" size={22} color={MUTED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{thalisPerMeal} thali{thalisPerMeal === 1 ? '' : 's'} per meal</Text>
                <Text style={styles.cardMeta}>Set at purchase</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="lock" size={18} color={MUTED} />
          </View>
        </Section>

        {/* Weekly Schedule (editable) */}
        <Section title="Weekly Schedule" hint="Change which days and meals auto-order runs.">
          <WeeklyScheduleQuickSets onSelectPattern={setWeeklySchedule} disabled={!isEnabled} />
          <View style={{ height: 8 }} />
          <WeeklyScheduleGrid
            schedule={weeklySchedule}
            onChange={setWeeklySchedule}
            disabled={!isEnabled}
          />
        </Section>

        {/* Per-meal snapshot (read-only) */}
        {setup.perMealFeesSnapshot && (
          <Section title="Locked Per-Meal Fees" hint="These prices are fixed for this auto-order until the pack ends.">
            <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch', padding: 16 }]}>
              {setup.perMealFeesSnapshot.lunch && (
                <SummaryLine
                  label="Lunch"
                  value={`₹${formatINR(setup.perMealFeesSnapshot.lunch.total)}`}
                />
              )}
              {setup.perMealFeesSnapshot.dinner && (
                <SummaryLine
                  label="Dinner"
                  value={`₹${formatINR(setup.perMealFeesSnapshot.dinner.total)}`}
                />
              )}
              <View style={styles.divider} />
              <SummaryLine
                label="Prepaid deliveries"
                value={`${setup.totalDeliveriesPrepaid ?? 0}`}
              />
              <SummaryLine
                label="Total fees prepaid"
                value={`₹${formatINR(setup.totalFeesPrepaid ?? 0)}`}
              />
            </View>
          </Section>
        )}
      </ScrollView>

      {/* Sticky save bar */}
      <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerLabel}>{dirty ? 'You have unsaved changes' : 'All changes saved'}</Text>
          <Text style={styles.footerAmount}>{dirty ? 'Tap save to apply' : '—'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, (!dirty || isSaving) && { backgroundColor: '#D1D5DB' }]}
          disabled={!dirty || isSaving}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ───── shared atoms (same as AutoOrderSetupScreen) ─────

function Section({
  title, hint, children,
}: { title: string; hint?: string; children: React.ReactNode }) {
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

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontSize: FONT_SIZES.base, color: TEXT }}>{label}</Text>
      <Text style={{ fontSize: FONT_SIZES.base, color: TEXT, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  gradientHeader: {
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    paddingBottom: 16, overflow: 'hidden',
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
  lockedCard: { backgroundColor: LOCKED_BG, borderColor: '#E5E7EB' },
  iconCircle: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: TEXT },
  cardMeta: { fontSize: FONT_SIZES.sm, color: MUTED, marginTop: 2 },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#fff',
  },
  footerLabel: { fontSize: FONT_SIZES.xs, color: MUTED },
  footerAmount: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: TEXT },
  payBtn: {
    backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', minWidth: 160,
  },
  payBtnText: { color: '#fff', fontSize: FONT_SIZES.base, fontWeight: 'bold' },
});

const walletCardStyles = StyleSheet.create({
  card: {
    backgroundColor: PRIMARY_TINT, borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  bigNumber: { fontSize: 28, fontWeight: 'bold', color: PRIMARY, lineHeight: 32 },
  label: { fontSize: FONT_SIZES.sm, color: '#9A3412', fontWeight: '600', marginTop: 2 },
});
