import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import { useAlert } from '../../context/AlertContext';
import apiService, {
  AutoOrderAddonSlot,
  AutoOrderAddonPricingData,
  AddonItem,
  extractKitchensFromResponse,
} from '../../services/api.service';
import AddonSelector, { SelectedAddon } from '../../components/AddonSelector';
import paymentService from '../../services/payment.service';
import { SPACING } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'AutoOrderAddons'>;

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

const slotKey = (date: string, mealWindow: string) => `${date}_${mealWindow}`;

const AutoOrderAddonScreen: React.FC<Props> = ({ navigation, route }) => {
  const { addressId } = route.params;
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  // Data
  const [slots, setSlots] = useState<AutoOrderAddonSlot[]>([]);
  const [availableAddons, setAvailableAddons] = useState<AddonItem[]>([]);
  const [kitchenId, setKitchenId] = useState<string | null>(null);
  const [pricingData, setPricingData] = useState<AutoOrderAddonPricingData | null>(null);

  // Selection
  const [selectedSlotKeys, setSelectedSlotKeys] = useState<Set<string>>(new Set());
  const [perSlotAddons, setPerSlotAddons] = useState<Record<string, SelectedAddon[]>>({});
  const perSlotAddonsRef = useRef(perSlotAddons);
  perSlotAddonsRef.current = perSlotAddons;

  // Loading / error
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<
    'no_subscription' | 'not_enabled' | 'no_config' | 'no_upcoming' | null
  >(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived: slots with addons selected (for pricing + submit)
  const buildSlotsPayload = useCallback(
    (overridePerSlot?: Record<string, SelectedAddon[]>) => {
      const map = overridePerSlot ?? perSlotAddonsRef.current;
      return Array.from(selectedSlotKeys)
        .filter(key => (map[key] || []).length > 0)
        .map(key => {
          const [date, mealWindow] = key.split('_');
          return {
            date,
            mealWindow,
            addons: (map[key] || []).map(a => ({ addonId: a.addonId, quantity: a.quantity })),
          };
        });
    },
    [selectedSlotKeys]
  );

  const grandTotal = pricingData?.grandTotal ?? 0;
  const activeSlotCount = buildSlotsPayload().length;

  // ---------------------------------------------------------------------------
  // Fetch slots + resolve kitchen on mount
  // ---------------------------------------------------------------------------

  const fetchSlots = useCallback(async () => {
    try {
      setError(null);
      setEmptyReason(null);
      const response = await apiService.getAutoOrderAddonSlots(addressId);
      if (response.success) {
        const slots = response.data?.slots ?? [];
        setSlots(slots);
        if (slots.length === 0) {
          const msg = (response.message || '').toLowerCase();
          if (msg.includes('not enabled') || msg.includes('auto-ordering is not')) {
            setEmptyReason('not_enabled');
          } else if (msg.includes('no active auto-order') || msg.includes('no auto-order config')) {
            setEmptyReason('no_config');
          } else {
            setEmptyReason('no_upcoming');
          }
        }
      } else {
        const msg = (response.message || '').toLowerCase();
        if (msg.includes('subscription')) {
          setEmptyReason('no_subscription');
          setSlots([]);
        } else if (msg.includes('config') || msg.includes('auto-order')) {
          setEmptyReason('no_config');
          setSlots([]);
        } else {
          setError(response.message || 'Failed to load upcoming slots');
        }
      }
    } catch (err: any) {
      const msg = (err.message || '').toLowerCase();
      const isNetworkError =
        err.data?.error === 'NETWORK_ERROR' || err.data?.error === 'UNKNOWN_ERROR';

      if (msg.includes('subscription')) {
        setEmptyReason('no_subscription');
        setSlots([]);
      } else if (msg.includes('not enabled') || msg.includes('auto-ordering is not')) {
        setEmptyReason('not_enabled');
        setSlots([]);
      } else if (msg.includes('config') || msg.includes('auto-order') || msg.includes('auto order')) {
        setEmptyReason('no_config');
        setSlots([]);
      } else if (!isNetworkError && err.success === false) {
        // Other API-level rejection — treat as not set up
        setEmptyReason('no_config');
        setSlots([]);
      } else {
        setError(err.message || 'Failed to load upcoming slots');
      }
    }
  }, [addressId]);

  const resolveKitchenAndAddons = useCallback(async () => {
    try {
      setAddonsLoading(true);
      const kitchenResp = await apiService.getAddressKitchens(addressId, 'MEAL_MENU');
      const kitchenList = extractKitchensFromResponse(kitchenResp);
      if (kitchenList.length === 0) return;

      const kitchen = kitchenList.find((k: any) => k.type === 'TIFFSY') || kitchenList[0];
      setKitchenId(kitchen._id);

      const menuResp = await apiService.getKitchenMenu(kitchen._id, 'MEAL_MENU');
      const { lunch, dinner } = menuResp.data.mealMenu;
      // Merge lunch + dinner addons, deduplicate
      const merged: AddonItem[] = [];
      const seen = new Set<string>();
      const addUnique = (items?: AddonItem[]) => {
        items?.forEach(a => {
          if (!seen.has(a._id)) {
            seen.add(a._id);
            merged.push(a);
          }
        });
      };
      addUnique(lunch?.addonIds);
      addUnique(dinner?.addonIds);
      setAvailableAddons(merged);
    } catch (err) {
      console.log('[AutoOrderAddonScreen] Failed to resolve kitchen/addons:', err);
    } finally {
      setAddonsLoading(false);
    }
  }, [addressId]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchSlots(), resolveKitchenAndAddons()]);
      setIsLoading(false);
    };
    load();
  }, [fetchSlots, resolveKitchenAndAddons]);

  // ---------------------------------------------------------------------------
  // Pricing
  // ---------------------------------------------------------------------------

  const fetchPricing = useCallback(
    async (overridePerSlot?: Record<string, SelectedAddon[]>) => {
      const payload = buildSlotsPayload(overridePerSlot);
      if (payload.length === 0) {
        setPricingData(null);
        return;
      }
      try {
        setIsPricingLoading(true);
        const resp = await apiService.getAutoOrderAddonPricing({ addressId, slots: payload });
        if (resp.success) {
          setPricingData(resp.data);
          if (resp.data.kitchenId && !kitchenId) {
            setKitchenId(resp.data.kitchenId);
          }
        }
      } catch (err) {
        console.log('[AutoOrderAddonScreen] Pricing error:', err);
      } finally {
        setIsPricingLoading(false);
      }
    },
    [addressId, buildSlotsPayload, kitchenId]
  );

  // ---------------------------------------------------------------------------
  // Slot selection toggle
  // ---------------------------------------------------------------------------

  const handleToggleSlot = useCallback((key: string) => {
    setSelectedSlotKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Clear addons for this slot
        const updatedAddons = { ...perSlotAddonsRef.current };
        delete updatedAddons[key];
        setPerSlotAddons(updatedAddons);
        fetchPricing(updatedAddons);
      } else {
        next.add(key);
      }
      return next;
    });
  }, [fetchPricing]);

  // ---------------------------------------------------------------------------
  // Per-slot addon handlers
  // ---------------------------------------------------------------------------

  const handleAddonAdd = useCallback((key: string, addon: AddonItem) => {
    const current = perSlotAddonsRef.current;
    const slotAddons = current[key] || [];
    if (slotAddons.find(a => a.addonId === addon._id)) return;
    const updated = {
      ...current,
      [key]: [...slotAddons, { addonId: addon._id, name: addon.name, quantity: 1, unitPrice: addon.price }],
    };
    setPerSlotAddons(updated);
    fetchPricing(updated);
  }, [fetchPricing]);

  const handleAddonRemove = useCallback((key: string, addonId: string) => {
    const current = perSlotAddonsRef.current;
    const updated = {
      ...current,
      [key]: (current[key] || []).filter(a => a.addonId !== addonId),
    };
    setPerSlotAddons(updated);
    fetchPricing(updated);
  }, [fetchPricing]);

  const handleAddonQuantityChange = useCallback((key: string, addonId: string, quantity: number) => {
    const current = perSlotAddonsRef.current;
    const slotAddons = current[key] || [];
    const updated = {
      ...current,
      [key]: quantity <= 0
        ? slotAddons.filter(a => a.addonId !== addonId)
        : slotAddons.map(a => a.addonId === addonId ? { ...a, quantity } : a),
    };
    setPerSlotAddons(updated);
    fetchPricing(updated);
  }, [fetchPricing]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleConfirmAndPay = useCallback(async () => {
    if (isSubmitting) return;
    const slotsPayload = buildSlotsPayload();
    if (slotsPayload.length === 0) {
      showAlert('No Add-ons Selected', 'Please select at least one slot and add some add-ons.', undefined, 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const createResp = await apiService.createAutoOrderAddonSelections({
        addressId,
        slots: slotsPayload,
      });

      if (!createResp.success) {
        throw new Error(createResp.message || 'Failed to create addon selections');
      }

      const result = createResp.data;

      if (result.paymentRequired && result.payment) {
        const payResult = await paymentService.processAutoOrderAddonPayment({
          razorpayOrderId: result.payment.razorpayOrderId,
          amount: result.payment.amount,
          key: result.payment.key,
          currency: 'INR',
          batchId: result.batchId,
          slotsCount: slotsPayload.length,
        });

        if (payResult.success) {
          showAlert(
            'Add-ons Confirmed!',
            `Add-ons scheduled for ${slotsPayload.length} meal${slotsPayload.length !== 1 ? 's' : ''}. They will be included when your auto-orders are placed.`,
            [{ text: 'Done', onPress: () => navigation.goBack() }],
            'success'
          );
        } else if (payResult.error === 'Payment cancelled') {
          showAlert(
            'Payment Pending',
            'Your add-on selections were created but payment is pending. You can complete payment later.',
            [{ text: 'OK' }],
            'warning'
          );
        } else {
          showAlert(
            'Payment Failed',
            payResult.error || 'Payment failed. Your selections were created but unpaid.',
            [{ text: 'OK' }],
            'error'
          );
        }
      } else {
        // Free add-ons (grandTotal === 0)
        showAlert(
          'Add-ons Confirmed!',
          `Add-ons applied for ${result.slotsActivated} meal${result.slotsActivated !== 1 ? 's' : ''}!`,
          [{ text: 'Done', onPress: () => navigation.goBack() }],
          'success'
        );
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to process add-ons. Please try again.', undefined, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, buildSlotsPayload, addressId, navigation, showAlert]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <StatusBar barStyle="light-content" backgroundColor="#FF6636" />
        <SafeAreaView style={{ backgroundColor: '#FF6636' }} edges={['top']} />
        <View style={{ backgroundColor: '#FF6636', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>Auto-Order Add-ons</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FE8733" />
          <Text style={{ marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Loading upcoming slots...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <StatusBar barStyle="light-content" backgroundColor="#FF6636" />
        <SafeAreaView style={{ backgroundColor: '#FF6636' }} edges={['top']} />
        <View style={{ backgroundColor: '#FF6636', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>Auto-Order Add-ons</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={{ fontSize: FONT_SIZES.base, color: '#6B7280', textAlign: 'center', marginTop: SPACING.md }}>{error}</Text>
          <TouchableOpacity
            onPress={fetchSlots}
            style={{ marginTop: SPACING.lg, backgroundColor: '#FE8733', borderRadius: 10, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const unpaidSlots = slots.filter(s => !s.isPaid);
  const paidSlots = slots.filter(s => s.isPaid);

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6636" />
      <SafeAreaView style={{ backgroundColor: '#FF6636' }} edges={['top']} />

      {/* Header */}
      <View style={{ backgroundColor: '#FF6636', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1 }}>Auto-Order Add-ons</Text>
        {isPricingLoading && <ActivityIndicator size="small" color="white" />}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={{ margin: SPACING.lg, backgroundColor: '#FFF7ED', borderRadius: 12, padding: SPACING.md, flexDirection: 'row' }}>
          <MaterialCommunityIcons name="information-outline" size={18} color="#FE8733" style={{ marginRight: SPACING.sm, marginTop: 1 }} />
          <Text style={{ fontSize: FONT_SIZES.xs, color: '#92400E', flex: 1, lineHeight: 18 }}>
            Select upcoming auto-order days and add paid extras. Add-ons are included when your meal is auto-ordered.
          </Text>
        </View>

        {/* Empty State */}
        {slots.length === 0 && (
          <View style={{ margin: SPACING.lg, alignItems: 'center', paddingVertical: SPACING['2xl'] }}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={48} color="#D1D5DB" />
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '600', color: '#6B7280', marginTop: SPACING.md }}>
              No upcoming auto-order slots
            </Text>
            <Text style={{ fontSize: FONT_SIZES.sm, color: '#9CA3AF', marginTop: SPACING.xs, textAlign: 'center' }}>
              Your auto-order slots will appear here once your subscription is active.
            </Text>
          </View>
        )}

        {/* Upcoming Slots (unpaid) */}
        {unpaidSlots.length > 0 && (
          <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
              <View style={{ width: 4, height: 20, backgroundColor: '#FE8733', borderRadius: 2, marginRight: SPACING.sm }} />
              <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>
                Upcoming Meals ({unpaidSlots.length})
              </Text>
            </View>

            {unpaidSlots.map((slot) => {
              const key = slotKey(slot.date, slot.mealWindow);
              const isSelected = selectedSlotKeys.has(key);
              const slotAddons = perSlotAddons[key] || [];
              const mealIcon = slot.mealWindow === 'LUNCH' ? 'white-balance-sunny' : 'moon-waning-crescent';
              const mealIconColor = slot.mealWindow === 'LUNCH' ? '#F59E0B' : '#6366F1';
              const mealLabel = slot.mealWindow === 'LUNCH' ? 'Lunch' : 'Dinner';

              return (
                <View
                  key={key}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    marginBottom: SPACING.sm,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? '#FE8733' : '#E5E7EB',
                    overflow: 'hidden',
                  }}
                >
                  {/* Slot header row */}
                  <TouchableOpacity
                    onPress={() => handleToggleSlot(key)}
                    activeOpacity={0.7}
                    style={{ padding: SPACING.md, flexDirection: 'row', alignItems: 'center' }}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={22}
                      color={isSelected ? '#FE8733' : '#9CA3AF'}
                      style={{ marginRight: SPACING.sm }}
                    />
                    <MaterialCommunityIcons name={mealIcon} size={18} color={mealIconColor} style={{ marginRight: SPACING.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '700', color: '#1F2937' }}>
                        {formatSlotDate(slot.date)} — {mealLabel}
                      </Text>
                      {isSelected && slotAddons.length > 0 && (
                        <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>
                          {slotAddons.length} add-on{slotAddons.length !== 1 ? 's' : ''} selected
                        </Text>
                      )}
                    </View>
                    {isSelected && slotAddons.length > 0 && pricingData && (() => {
                      const slotPricing = pricingData.slots.find(s => s.date === slot.date && s.mealWindow === slot.mealWindow);
                      return slotPricing ? (
                        <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '700', color: '#FE8733' }}>
                          {'\u20B9'}{slotPricing.addonsCost}
                        </Text>
                      ) : null;
                    })()}
                  </TouchableOpacity>

                  {/* Addon selector (shown when slot is selected) */}
                  {isSelected && availableAddons.length > 0 && (
                    <View style={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                      <AddonSelector
                        availableAddons={availableAddons}
                        selectedAddons={slotAddons}
                        onAdd={(addon) => handleAddonAdd(key, addon)}
                        onRemove={(addonId) => handleAddonRemove(key, addonId)}
                        onQuantityChange={(addonId, qty) => handleAddonQuantityChange(key, addonId, qty)}
                        loading={addonsLoading}
                        title="Add-ons for this meal"
                      />
                    </View>
                  )}

                  {isSelected && !addonsLoading && availableAddons.length === 0 && (
                    <View style={{ padding: SPACING.md, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                      <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', textAlign: 'center' }}>
                        No add-ons available for this kitchen
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Already Paid Slots */}
        {paidSlots.length > 0 && (
          <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
              <View style={{ width: 4, height: 20, backgroundColor: '#10B981', borderRadius: 2, marginRight: SPACING.sm }} />
              <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>
                Already Paid ({paidSlots.length})
              </Text>
            </View>

            {paidSlots.map((slot) => {
              const key = slotKey(slot.date, slot.mealWindow);
              const mealIcon = slot.mealWindow === 'LUNCH' ? 'white-balance-sunny' : 'moon-waning-crescent';
              const mealIconColor = slot.mealWindow === 'LUNCH' ? '#F59E0B' : '#6366F1';
              const mealLabel = slot.mealWindow === 'LUNCH' ? 'Lunch' : 'Dinner';

              return (
                <View
                  key={key}
                  style={{
                    backgroundColor: '#F0FDF4',
                    borderRadius: 14,
                    marginBottom: SPACING.sm,
                    borderWidth: 1,
                    borderColor: '#BBF7D0',
                    padding: SPACING.md,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name={mealIcon} size={18} color={mealIconColor} style={{ marginRight: SPACING.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '700', color: '#1F2937' }}>
                        {formatSlotDate(slot.date)} — {mealLabel}
                      </Text>
                      {slot.existingAddons.length > 0 && (
                        <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>
                          {slot.existingAddons.map(a => `${a.name} ×${a.quantity}`).join(', ')}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {slot.addonsCost > 0 && (
                        <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#059669', marginRight: SPACING.xs }}>
                          {'\u20B9'}{slot.addonsCost}
                        </Text>
                      )}
                      <View style={{ backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: SPACING.sm, paddingVertical: 3 }}>
                        <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#059669' }}>Paid</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Pricing Summary */}
        {pricingData && activeSlotCount > 0 && (
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

            {pricingData.slots.map((s, i) => (
              <View
                key={`${s.date}_${s.mealWindow}`}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: SPACING.xs,
                  paddingBottom: i < pricingData.slots.length - 1 ? SPACING.xs : 0,
                  borderBottomWidth: i < pricingData.slots.length - 1 ? 1 : 0,
                  borderBottomColor: '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>
                  {formatSlotDate(s.date)} {s.mealWindow === 'LUNCH' ? 'Lunch' : 'Dinner'}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#1F2937', fontWeight: '600' }}>
                  {'\u20B9'}{s.addonsCost}
                </Text>
              </View>
            ))}

            <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: SPACING.sm }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937' }}>Total</Text>
              <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#FE8733' }}>
                {'\u20B9'}{grandTotal}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      {(unpaidSlots.length > 0 || activeSlotCount > 0) && (
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
            onPress={handleConfirmAndPay}
            disabled={isSubmitting || activeSlotCount === 0}
            style={{
              backgroundColor: (isSubmitting || activeSlotCount === 0) ? '#fbb36b' : '#FE8733',
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
                  name={grandTotal === 0 && activeSlotCount > 0 ? 'check-circle-outline' : 'credit-card-outline'}
                  size={20}
                  color="white"
                  style={{ marginRight: SPACING.sm }}
                />
                <Text style={{ color: 'white', fontSize: FONT_SIZES.base, fontWeight: '700' }}>
                  {activeSlotCount === 0
                    ? 'Select a slot to add add-ons'
                    : grandTotal === 0
                    ? `Confirm Add-ons (${activeSlotCount} meal${activeSlotCount !== 1 ? 's' : ''})`
                    : `Confirm & Pay \u20B9${grandTotal}`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default AutoOrderAddonScreen;
