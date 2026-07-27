/**
 * Corporate Meals — Auto-Order setup/manage.
 *
 * Mirrors AutoOrderSetupScreen/AutoOrderManageScreen (the personal system),
 * simplified since a corporate employee has exactly one possible delivery
 * address (the corporate's locked office) — no address picker, no addons,
 * no fee snapshot (each purchase's own delivery fee is read at order time).
 *
 * No setup yet → create form: weekly schedule + thali stepper (capped by the
 *   corporate's per-window limit) → POST /api/corporate/auto-order.
 * Setup exists  → manage view: enabled/paused toggle + editable schedule
 *   (thali count locked — delete + recreate to change) → PATCH/DELETE.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import apiService, { CorporateAutoOrderSetup, WeeklySchedule } from '../../services/api.service';
import { useAlert } from '../../context/AlertContext';
import { SPACING } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';
import WeeklyScheduleGrid from '../../components/WeeklyScheduleGrid';
import WeeklyScheduleQuickSets from '../../components/WeeklyScheduleQuickSets';

type Props = StackScreenProps<MainTabParamList, 'CorporateAutoOrder'>;

const PRIMARY = '#FE8733';

const cardStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: 14,
  padding: SPACING.lg,
  borderWidth: 1,
  borderColor: '#F3F4F6',
} as const;

const Header: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: PRIMARY }}>
    <TouchableOpacity onPress={onBack} style={{ marginRight: SPACING.md }}>
      <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
    </TouchableOpacity>
    <Text style={{ color: '#fff', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>Corporate Auto-Order</Text>
  </View>
);

const CorporateAutoOrderScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [maxMealsPerWindow, setMaxMealsPerWindow] = useState(2);
  const [setup, setSetup] = useState<CorporateAutoOrderSetup | null>(null);
  // Gates the create form — must have bought at least one pack (server
  // enforces this too; this just avoids a dead-end "buy a pack" error after
  // filling out the whole schedule).
  const [hasPurchasedAnyPack, setHasPurchasedAnyPack] = useState(false);

  // Create-form state
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(null);
  const [thalisPerMeal, setThalisPerMeal] = useState(1);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await apiService.getMyCorporate();
      if (resp.success && resp.data.corporate) {
        setMaxMealsPerWindow(resp.data.corporate.maxMealsPerWindow || 2);
        setSetup(resp.data.autoOrderSetup || null);
        setHasPurchasedAnyPack(!!resp.data.hasPurchasedAnyPack);
      }
    } catch {
      // Non-fatal — leave whatever we had.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleCreate = async () => {
    const hasAnyDay = weeklySchedule && Object.values(weeklySchedule).some((d) => d?.lunch || d?.dinner);
    if (!hasAnyDay) {
      showAlert('Pick a schedule', 'Select at least one day/meal in the weekly schedule', undefined, 'warning');
      return;
    }
    setSaving(true);
    try {
      const resp = await apiService.createCorporateAutoOrderSetup({
        weeklySchedule: weeklySchedule!,
        thalisPerMeal,
      });
      if (resp.success) {
        showAlert('Auto-order set up!', 'Meals will be ordered automatically on your schedule.', undefined, 'success');
        await load();
      } else {
        showAlert('Could not set up', resp.message, undefined, 'error');
      }
    } catch (err: any) {
      showAlert('Could not set up', err?.response?.data?.message || err?.message || 'Try again', undefined, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = async (next: WeeklySchedule) => {
    setSaving(true);
    try {
      const resp = await apiService.updateCorporateAutoOrderSetup({ weeklySchedule: next });
      if (resp.success) {
        setSetup(resp.data.autoOrderSetup);
      } else {
        showAlert('Could not save', resp.message, undefined, 'error');
      }
    } catch (err: any) {
      showAlert('Could not save', err?.response?.data?.message || err?.message || 'Try again', undefined, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!setup) return;
    setSaving(true);
    try {
      const resp = await apiService.updateCorporateAutoOrderSetup({ enabled: !setup.enabled });
      if (resp.success) setSetup(resp.data.autoOrderSetup);
    } catch (err: any) {
      showAlert('Could not update', err?.response?.data?.message || err?.message || 'Try again', undefined, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    showAlert(
      'Remove auto-order?',
      'You can set it up again anytime. Your vouchers and wallet balance are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteCorporateAutoOrderSetup();
              setSetup(null);
              setWeeklySchedule(null);
              setThalisPerMeal(1);
            } catch (err: any) {
              showAlert('Error', err?.response?.data?.message || err?.message || 'Failed to remove', undefined, 'error');
            }
          },
        },
      ],
      'warning',
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <SafeAreaView style={{ backgroundColor: PRIMARY }} edges={['top']} />
        <Header onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <SafeAreaView style={{ backgroundColor: PRIMARY }} edges={['top']} />
      <Header onBack={() => navigation.goBack()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 40 }}>
        {setup ? (
          <>
            {/* Status card */}
            <View style={cardStyle}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="auto-mode" size={22} color={PRIMARY} />
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginLeft: 8 }}>
                    {setup.enabled ? 'Auto-order is ON' : 'Auto-order is OFF'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleToggleEnabled}
                  disabled={saving}
                  style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: setup.enabled ? '#10B981' : '#D1D5DB', justifyContent: 'center', paddingHorizontal: 3 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: setup.enabled ? 'flex-end' : 'flex-start' }} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: SPACING.sm }}>
                {setup.thalisPerMeal} thali{setup.thalisPerMeal > 1 ? 's' : ''} per meal · locked — remove and set up again to change
              </Text>
            </View>

            {/* Editable weekly schedule */}
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
              Weekly Schedule
            </Text>
            <WeeklyScheduleQuickSets onSelectPattern={handleSaveSchedule} disabled={saving} />
            <View style={{ height: 8 }} />
            <WeeklyScheduleGrid schedule={setup.weeklySchedule} onChange={handleSaveSchedule} disabled={saving} />

            {/* Danger zone */}
            <TouchableOpacity
              onPress={handleRemove}
              disabled={saving}
              style={{ marginTop: SPACING.xl, alignItems: 'center', paddingVertical: SPACING.md, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12 }}
            >
              <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: FONT_SIZES.sm }}>Remove this auto-order</Text>
            </TouchableOpacity>
          </>
        ) : !hasPurchasedAnyPack ? (
          // Server enforces this too (createAutoOrderSetup 400s without a
          // purchase) — this just avoids sending the user through the whole
          // schedule form only to hit that error at the end.
          <View style={cardStyle}>
            <MaterialCommunityIcons name="ticket-percent-outline" size={32} color="#D1D5DB" />
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginTop: SPACING.sm }}>
              Buy a voucher pack first
            </Text>
            <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: 4 }}>
              Auto-order needs corporate vouchers to work with. Buy a pack from the Corporate Meals
              page, then come back here to set up your schedule.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.lg }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: FONT_SIZES.sm }}>Go to Voucher Plans</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={cardStyle}>
              <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937' }}>Set up Auto-Order</Text>
              <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: 4 }}>
                Pick your days and meals — we'll order and deliver to your office automatically,
                using your corporate vouchers and delivery wallet.
              </Text>
            </View>

            {/* Thali stepper — capped by the corporate's per-window limit */}
            <View style={[cardStyle, { marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937' }}>Thalis per meal</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => setThalisPerMeal((q) => Math.max(1, q - 1))}
                  style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialCommunityIcons name="minus" size={16} color={PRIMARY} />
                </TouchableOpacity>
                <Text style={{ marginHorizontal: 16, fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>{thalisPerMeal}</Text>
                <TouchableOpacity
                  onPress={() => setThalisPerMeal((q) => Math.min(maxMealsPerWindow, q + 1))}
                  style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={PRIMARY} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', marginTop: 4 }}>
              Capped at your corporate's limit of {maxMealsPerWindow} meal{maxMealsPerWindow > 1 ? 's' : ''} per window.
            </Text>

            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
              Weekly Schedule
            </Text>
            <WeeklyScheduleQuickSets onSelectPattern={setWeeklySchedule} disabled={saving} />
            <View style={{ height: 8 }} />
            <WeeklyScheduleGrid schedule={weeklySchedule} onChange={setWeeklySchedule} disabled={saving} />

            <TouchableOpacity
              onPress={handleCreate}
              disabled={saving}
              style={{ backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.lg }}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: FONT_SIZES.sm }}>Set Up Auto-Order</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default CorporateAutoOrderScreen;
