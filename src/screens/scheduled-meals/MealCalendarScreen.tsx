import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  StatusBar,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAddress } from '../../context/AddressContext';
import { useAlert } from '../../context/AlertContext';
import apiService, {
  AutoOrderScheduleDay,
  ScheduledMealSlot,
  ScheduledMealListItem,
} from '../../services/api.service';
import { formatShortDate, isPastDate } from '../../utils/autoOrderUtils';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'MealCalendar'>;

interface MergedSlotData {
  slotStatus: ScheduledMealSlot['status'] | null;
  autoOrderScheduled: boolean;
  autoOrderSkipped: boolean;
  scheduledMeal: ScheduledMealListItem | null;
  reason: string | null;
}

interface MergedDayData {
  date: string;
  dayName: string;
  lunch: MergedSlotData;
  dinner: MergedSlotData;
}

const createEmptySlot = (): MergedSlotData => ({
  slotStatus: null,
  autoOrderScheduled: false,
  autoOrderSkipped: false,
  scheduledMeal: null,
  reason: null,
});

const MealCalendarScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { skipMeal, unskipMeal, getScheduleForAddress } = useSubscription();
  const { addresses, selectedAddressId } = useAddress();
  const { showAlert } = useAlert();

  // Local date string (YYYY-MM-DD) to avoid UTC timezone mismatch
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mergedData, setMergedData] = useState<Map<string, MergedDayData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [panelHeight] = useState(new Animated.Value(0));
  const [currentAddressId, setCurrentAddressId] = useState<string | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  // Multi-select state for bulk scheduling
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  // Key format: "2026-02-24_LUNCH", "2026-02-24_DINNER"

  const getDefaultAddressId = useCallback((): string | null => {
    if (selectedAddressId) return selectedAddressId;
    const defaultAddr = addresses.find(a => a.isMain);
    if (defaultAddr) return defaultAddr.id;
    if (addresses.length > 0) return addresses[0].id;
    return null;
  }, [addresses, selectedAddressId]);

  // Use a ref to track current address to avoid stale closures
  const addressRef = React.useRef<string | null>(null);

  const fetchAndMergeData = useCallback(async (addressId: string) => {
    addressRef.current = addressId;
    setIsLoading(true);
    try {
      const [slotsResponse, scheduleResponse, mealsResponse] = await Promise.all([
        apiService.getScheduledMealSlots(addressId),
        getScheduleForAddress(addressId).catch(() => null),
        apiService.getMyScheduledMeals({ limit: 50, deliveryAddressId: addressId }).catch(() => null),
      ]);

      // If address changed while fetching, discard stale results
      if (addressRef.current !== addressId) return;

      const merged = new Map<string, MergedDayData>();

      // Helper to compute day name locally from date string (avoids API timezone bugs)
      const getDayName = (dateStr: string): string => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString('en-US', { weekday: 'long' });
      };

      // Step 1: Populate from slots (30-day coverage)
      if (slotsResponse.success) {
        slotsResponse.data.slots.forEach((slot: ScheduledMealSlot) => {
          const key = slot.date;
          if (!merged.has(key)) {
            merged.set(key, {
              date: slot.date,
              dayName: getDayName(slot.date),
              lunch: createEmptySlot(),
              dinner: createEmptySlot(),
            });
          }
          const day = merged.get(key)!;
          const mealSlot = slot.mealWindow === 'LUNCH' ? day.lunch : day.dinner;
          mealSlot.slotStatus = slot.status;
          mealSlot.reason = slot.reason;
        });
      }

      // Step 2: Overlay auto-order schedule (14-day coverage)
      // Only overlay if auto-ordering is enabled and not paused (globally or per-address)
      const autoOrderData = scheduleResponse?.data;
      const isAutoOrderActive = autoOrderData?.autoOrderingEnabled
        && !autoOrderData?.isPaused
        && autoOrderData?.configEnabled !== false
        && !autoOrderData?.configIsPaused;
      if (scheduleResponse?.success && autoOrderData?.schedule && isAutoOrderActive) {
        scheduleResponse.data.schedule.forEach((schedDay: AutoOrderScheduleDay) => {
          const key = schedDay.date;
          if (!merged.has(key)) {
            merged.set(key, {
              date: schedDay.date,
              dayName: getDayName(schedDay.date),
              lunch: createEmptySlot(),
              dinner: createEmptySlot(),
            });
          }
          const day = merged.get(key)!;
          day.lunch.autoOrderScheduled = schedDay.lunch?.scheduled ?? false;
          day.lunch.autoOrderSkipped = schedDay.lunch?.skipped ?? false;
          day.dinner.autoOrderScheduled = schedDay.dinner?.scheduled ?? false;
          day.dinner.autoOrderSkipped = schedDay.dinner?.skipped ?? false;
        });
      }

      // Step 3: Overlay scheduled meal details (filter by address)
      if (mealsResponse?.success && mealsResponse.data?.meals) {
        const addressMeals = mealsResponse.data.meals.filter(
          (meal: ScheduledMealListItem) => !meal.deliveryAddressId || meal.deliveryAddressId === addressId
        );
        addressMeals.forEach((meal: ScheduledMealListItem) => {
          const mealDate = meal.scheduledFor.split('T')[0];
          const day = merged.get(mealDate);
          if (day) {
            const slot = meal.mealWindow === 'LUNCH' ? day.lunch : day.dinner;
            slot.scheduledMeal = meal;
          }
        });
      }

      setMergedData(merged);
    } catch (err: any) {
      if (addressRef.current === addressId) {
        showAlert('Error', 'Failed to load meal calendar', undefined, 'error');
      }
    } finally {
      if (addressRef.current === addressId) {
        setIsLoading(false);
      }
    }
  }, [getScheduleForAddress, showAlert]);

  // Initial load + re-focus: resolve default address and fetch
  useFocusEffect(
    useCallback(() => {
      const addressId = currentAddressId || getDefaultAddressId();
      if (addressId) {
        if (!currentAddressId) {
          setCurrentAddressId(addressId);
        }
        fetchAndMergeData(addressId);
      } else {
        setIsLoading(false);
      }
      // Only depend on getDefaultAddressId and fetchAndMergeData, NOT currentAddressId
      // Address changes are handled by handleAddressChange, not by re-running this effect
    }, [getDefaultAddressId, fetchAndMergeData]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleAddressChange = useCallback((addressId: string) => {
    setCurrentAddressId(addressId);
    setShowAddressPicker(false);
    setSelectedDate(null);
    setSelectedSlots(new Set());
    fetchAndMergeData(addressId);
  }, [fetchAndMergeData]);

  // Calendar multi-dot marking
  const markedDates = useMemo(() => {
    const marked: Record<string, any> = {};

    mergedData.forEach((day, dateKey) => {
      const dots: Array<{ key: string; color: string }> = [];

      // Helper to determine dot for a slot
      const addSlotDot = (slot: MergedSlotData, prefix: string) => {
        // Skipped auto-order (red) — highest priority
        if (slot.autoOrderSkipped) {
          dots.push({ key: `${prefix}-skip`, color: '#EF4444' });
          return;
        }
        // Auto-order active: from schedule API or from slot status (green)
        if (slot.autoOrderScheduled || slot.slotStatus === 'auto_order_active') {
          dots.push({ key: `${prefix}-auto`, color: '#10B981' });
          return;
        }
        // Manually scheduled or already ordered (blue)
        if (slot.slotStatus === 'already_scheduled' || slot.slotStatus === 'already_ordered') {
          dots.push({ key: `${prefix}-sched`, color: '#3B82F6' });
          return;
        }
        // Available (gray)
        if (slot.slotStatus === 'available') {
          dots.push({ key: `${prefix}-avail`, color: '#D1D5DB' });
        }
      };

      addSlotDot(day.lunch, 'lunch');
      addSlotDot(day.dinner, 'dinner');

      if (dots.length > 0) {
        marked[dateKey] = { dots, marked: true };
      }
    });

    // Add orange dots for selected slots
    selectedSlots.forEach(slotKey => {
      const [date] = slotKey.split('_');
      if (!marked[date]) marked[date] = { dots: [], marked: true };
      if (!marked[date].dots?.some((d: any) => d.key === 'selected')) {
        marked[date].dots = [...(marked[date].dots || []), { key: 'selected', color: '#ff8800' }];
      }
    });

    // Highlight selected date
    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: '#ff8800',
      };
    }

    return marked;
  }, [mergedData, selectedDate, selectedSlots]);

  // Handle date tap
  const handleDatePress = useCallback((day: DateData) => {
    const dateStr = day.dateString;
    setSelectedDate(dateStr);

    Animated.spring(panelHeight, {
      toValue: 1,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
  }, [panelHeight]);

  const closePanel = useCallback(() => {
    Animated.spring(panelHeight, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
    setSelectedDate(null);
  }, [panelHeight]);

  // Skip auto-order meal
  const handleSkipMeal = useCallback(async (mealWindow: 'LUNCH' | 'DINNER') => {
    if (!selectedDate || !currentAddressId) return;
    setIsActionLoading(true);
    try {
      await skipMeal({ addressId: currentAddressId, date: selectedDate, mealWindow });
      showAlert('Skipped', `${mealWindow} on ${formatShortDate(selectedDate)} has been skipped`, undefined, 'success');
      fetchAndMergeData(currentAddressId);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to skip meal', undefined, 'error');
    } finally {
      setIsActionLoading(false);
    }
  }, [selectedDate, currentAddressId, skipMeal, showAlert, fetchAndMergeData]);

  // Unskip auto-order meal
  const handleUnskipMeal = useCallback(async (mealWindow: 'LUNCH' | 'DINNER') => {
    if (!selectedDate || !currentAddressId) return;
    setIsActionLoading(true);
    try {
      await unskipMeal({ addressId: currentAddressId, date: selectedDate, mealWindow });
      showAlert('Restored', `${mealWindow} on ${formatShortDate(selectedDate)} has been restored`, undefined, 'success');
      fetchAndMergeData(currentAddressId);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to restore meal', undefined, 'error');
    } finally {
      setIsActionLoading(false);
    }
  }, [selectedDate, currentAddressId, unskipMeal, showAlert, fetchAndMergeData]);

  // Multi-select: toggle a slot for bulk scheduling
  const toggleSlotSelection = useCallback((slotKey: string) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slotKey)) next.delete(slotKey);
      else next.add(slotKey);
      return next;
    });
  }, []);

  // Navigate to bulk pricing screen with selected slots
  const handleContinueToPricing = useCallback(() => {
    if (!currentAddressId || selectedSlots.size === 0) return;

    const slots = Array.from(selectedSlots).map(key => {
      const [date, mealWindow] = key.split('_');
      return { date, mealWindow: mealWindow as 'LUNCH' | 'DINNER' };
    }).sort((a, b) => a.date.localeCompare(b.date) || a.mealWindow.localeCompare(b.mealWindow));

    navigation.navigate('BulkSchedulePricing', {
      deliveryAddressId: currentAddressId,
      selectedSlots: slots,
    });
  }, [currentAddressId, selectedSlots, navigation]);

  // Render a slot card in the bottom panel
  const renderSlotCard = (mealWindow: 'LUNCH' | 'DINNER') => {
    if (!selectedDate) return null;
    const dayData = mergedData.get(selectedDate);
    if (!dayData) return null;

    const slot = mealWindow === 'LUNCH' ? dayData.lunch : dayData.dinner;
    const icon = mealWindow === 'LUNCH' ? 'white-balance-sunny' : 'moon-waning-crescent';
    const iconColor = mealWindow === 'LUNCH' ? '#F59E0B' : '#6366F1';
    const label = mealWindow === 'LUNCH' ? 'Lunch' : 'Dinner';
    const past = isPastDate(selectedDate);

    // Auto-order active
    if (slot.autoOrderScheduled && !slot.autoOrderSkipped) {
      return (
        <View style={{
          backgroundColor: '#F0FDF4',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#BBF7D0',
          padding: SPACING.lg,
          marginBottom: SPACING.md,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
            <MaterialCommunityIcons name={icon} size={22} color={iconColor} style={{ marginRight: SPACING.sm }} />
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937', flex: 1 }}>{label}</Text>
            <View style={{ backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: SPACING.sm, paddingVertical: 2 }}>
              <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#047857' }}>Auto-Order</Text>
            </View>
          </View>
          <Text style={{ fontSize: FONT_SIZES.sm, color: '#047857', marginBottom: SPACING.sm }}>
            Your meal will be auto-ordered for this slot
          </Text>
          {!past && (
            <TouchableOpacity
              onPress={() => handleSkipMeal(mealWindow)}
              disabled={isActionLoading}
              style={{
                borderWidth: 1,
                borderColor: '#FCA5A5',
                borderRadius: 10,
                paddingVertical: SPACING.sm,
                alignItems: 'center',
                backgroundColor: '#FFF5F5',
              }}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#DC2626' }}>Skip This Meal</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Auto-order skipped
    if (slot.autoOrderSkipped) {
      return (
        <View style={{
          backgroundColor: '#FEF2F2',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#FECACA',
          padding: SPACING.lg,
          marginBottom: SPACING.md,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
            <MaterialCommunityIcons name={icon} size={22} color={iconColor} style={{ marginRight: SPACING.sm }} />
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937', flex: 1 }}>{label}</Text>
            <View style={{ backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: SPACING.sm, paddingVertical: 2 }}>
              <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#DC2626' }}>Skipped</Text>
            </View>
          </View>
          <Text style={{ fontSize: FONT_SIZES.sm, color: '#DC2626', marginBottom: SPACING.sm }}>
            This auto-order meal has been skipped
          </Text>
          {!past && (
            <TouchableOpacity
              onPress={() => handleUnskipMeal(mealWindow)}
              disabled={isActionLoading}
              style={{
                borderRadius: 10,
                paddingVertical: SPACING.sm,
                alignItems: 'center',
                backgroundColor: '#10B981',
              }}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: 'white' }}>Restore Meal</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Manually scheduled meal
    if (slot.slotStatus === 'already_scheduled' && slot.scheduledMeal) {
      const meal = slot.scheduledMeal;
      const thaliName = meal.items?.[0]?.name || 'Scheduled Meal';
      return (
        <View style={{
          backgroundColor: '#EFF6FF',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#BFDBFE',
          padding: SPACING.lg,
          marginBottom: SPACING.md,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
            <MaterialCommunityIcons name={icon} size={22} color={iconColor} style={{ marginRight: SPACING.sm }} />
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937', flex: 1 }}>{label}</Text>
            <View style={{ backgroundColor: '#DBEAFE', borderRadius: 8, paddingHorizontal: SPACING.sm, paddingVertical: 2 }}>
              <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#1D4ED8' }}>Scheduled</Text>
            </View>
          </View>
          <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937' }}>{thaliName}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.xs }}>
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>#{meal.orderNumber}</Text>
            <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '700', color: '#1F2937' }}>₹{meal.grandTotal}</Text>
          </View>
        </View>
      );
    }

    // Already scheduled (no meal details available)
    if (slot.slotStatus === 'already_scheduled' || slot.slotStatus === 'already_ordered') {
      return (
        <View style={{
          backgroundColor: '#EFF6FF',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#BFDBFE',
          padding: SPACING.lg,
          marginBottom: SPACING.md,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
            <MaterialCommunityIcons name={icon} size={22} color={iconColor} style={{ marginRight: SPACING.sm }} />
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937', flex: 1 }}>{label}</Text>
            <View style={{ backgroundColor: '#DBEAFE', borderRadius: 8, paddingHorizontal: SPACING.sm, paddingVertical: 2 }}>
              <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#1D4ED8' }}>
                {slot.slotStatus === 'already_ordered' ? 'Ordered' : 'Scheduled'}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: FONT_SIZES.sm, color: '#1D4ED8' }}>
            {slot.slotStatus === 'already_ordered' ? 'A meal has been ordered for this slot' : 'A meal is scheduled for this slot'}
          </Text>
        </View>
      );
    }

    // Available slot — multi-select toggle for bulk scheduling
    if (slot.slotStatus === 'available') {
      const slotKey = `${selectedDate}_${mealWindow}`;
      const isSelected = selectedSlots.has(slotKey);

      return (
        <TouchableOpacity
          onPress={() => toggleSlotSelection(slotKey)}
          activeOpacity={0.7}
          style={{
            backgroundColor: isSelected ? '#FFF7ED' : '#FFFFFF',
            borderRadius: 14,
            borderWidth: isSelected ? 2 : 1.5,
            borderColor: isSelected ? '#ff8800' : '#6EE7B7',
            borderStyle: isSelected ? 'solid' : 'dashed',
            padding: SPACING.lg,
            marginBottom: SPACING.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
            <MaterialCommunityIcons name={icon} size={22} color={iconColor} style={{ marginRight: SPACING.sm }} />
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937', flex: 1 }}>{label}</Text>
            <MaterialCommunityIcons
              name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={isSelected ? '#ff8800' : '#9CA3AF'}
            />
          </View>
          <Text style={{ fontSize: FONT_SIZES.sm, color: isSelected ? '#ff8800' : '#6B7280' }}>
            {isSelected ? 'Selected for scheduling' : 'Tap to select for scheduling'}
          </Text>
        </TouchableOpacity>
      );
    }

    // Unavailable (cutoff_passed, not_serviceable, no_kitchen, or null)
    const reasonText = slot.reason || (slot.slotStatus === 'cutoff_passed' ? 'Ordering cutoff has passed' :
      slot.slotStatus === 'not_serviceable' ? 'Not serviceable at this address' :
      slot.slotStatus === 'no_kitchen' ? 'No kitchen available' : 'Not available');

    return (
      <View style={{
        backgroundColor: '#F9FAFB',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        opacity: 0.6,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs }}>
          <MaterialCommunityIcons name={icon} size={22} color="#9CA3AF" style={{ marginRight: SPACING.sm }} />
          <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '700', color: '#9CA3AF', flex: 1 }}>{label}</Text>
        </View>
        <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF' }}>{reasonText}</Text>
      </View>
    );
  };

  const currentAddress = addresses.find(a => a.id === currentAddressId);

  // No addresses
  if (addresses.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
        <SafeAreaView style={{ backgroundColor: '#ff8800' }} edges={['top']} />
        <View style={{ backgroundColor: '#ff8800', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1 }}>Meal Calendar</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
          <MaterialCommunityIcons name="map-marker-plus-outline" size={64} color="#D1D5DB" />
          <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: '600', color: '#374151', marginTop: SPACING.lg, textAlign: 'center' }}>
            No Delivery Address
          </Text>
          <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: SPACING.sm, textAlign: 'center' }}>
            Add a delivery address to view your meal calendar
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Address')}
            style={{
              marginTop: SPACING.xl,
              backgroundColor: '#ff8800',
              borderRadius: 12,
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING['2xl'],
            }}
          >
            <Text style={{ color: 'white', fontSize: FONT_SIZES.base, fontWeight: '600' }}>Add Address</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
      <SafeAreaView style={{ backgroundColor: '#ff8800' }} edges={['top']} />

      {/* Header */}
      <View style={{ backgroundColor: '#ff8800', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1 }}>Meal Calendar</Text>
        {selectedSlots.size > 0 && (
          <TouchableOpacity
            onPress={() => setSelectedSlots(new Set())}
            style={{
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: 10,
              paddingHorizontal: SPACING.sm + 2,
              paddingVertical: SPACING.xs,
              flexDirection: 'row',
              alignItems: 'center',
              marginRight: SPACING.sm,
            }}
          >
            <MaterialCommunityIcons name="close-circle-outline" size={16} color="white" style={{ marginRight: 4 }} />
            <Text style={{ color: 'white', fontSize: FONT_SIZES.xs, fontWeight: '600' }}>Clear ({selectedSlots.size})</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => navigation.navigate('MyScheduledMeals')}
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 10,
            paddingHorizontal: SPACING.sm + 2,
            paddingVertical: SPACING.xs,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <MaterialCommunityIcons name="format-list-bulleted" size={16} color="white" style={{ marginRight: 4 }} />
          <Text style={{ color: 'white', fontSize: FONT_SIZES.xs, fontWeight: '600' }}>List</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Address Selector */}
        <TouchableOpacity
          onPress={() => setShowAddressPicker(true)}
          style={{
            margin: SPACING.lg,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: SPACING.md,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
        >
          <MaterialCommunityIcons name="map-marker-outline" size={20} color="#ff8800" style={{ marginRight: SPACING.sm }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>Showing calendar for</Text>
            <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937' }} numberOfLines={1}>
              {currentAddress ? `${currentAddress.label} - ${currentAddress.addressLine1}` : 'Select an address'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {isLoading ? (
          <View style={{ paddingVertical: SPACING['5xl'], alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#ff8800" />
            <Text style={{ marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Loading meal calendar...</Text>
          </View>
        ) : (
          <>
            {/* Calendar */}
            <View style={{
              marginHorizontal: SPACING.lg,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
            }}>
              <Calendar
                current={todayStr}
                minDate={todayStr}
                markedDates={markedDates}
                onDayPress={handleDatePress}
                markingType="multi-dot"
                renderHeader={(date: any) => {
                  const d = date instanceof Date ? date : new Date(date);
                  const month = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  return (
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1F2937' }}>
                      {month}
                    </Text>
                  );
                }}
                renderArrow={(direction: 'left' | 'right') => (
                  <MaterialCommunityIcons
                    name={direction === 'left' ? 'chevron-left' : 'chevron-right'}
                    size={24}
                    color="#ff8800"
                  />
                )}
                theme={{
                  backgroundColor: '#FFFFFF',
                  calendarBackground: '#FFFFFF',
                  textSectionTitleColor: '#6B7280',
                  selectedDayBackgroundColor: '#ff8800',
                  selectedDayTextColor: '#FFFFFF',
                  todayTextColor: '#ff8800',
                  dayTextColor: '#1F2937',
                  textDisabledColor: '#D1D5DB',
                  arrowColor: '#ff8800',
                  monthTextColor: '#1F2937',
                  textMonthFontWeight: 'bold' as any,
                  textDayFontSize: 16,
                  textMonthFontSize: 18,
                }}
              />

              {/* Legend */}
              <View style={{ paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#6B7280', marginBottom: SPACING.sm }}>Legend</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md }}>
                  {[
                    { color: '#10B981', label: 'Auto-Order' },
                    { color: '#EF4444', label: 'Skipped' },
                    { color: '#3B82F6', label: 'Scheduled' },
                    { color: '#D1D5DB', label: 'Available' },
                  ].map(item => (
                    <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: item.color,
                        marginRight: 4,
                      }} />
                      <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={{
              marginHorizontal: SPACING.lg,
              marginTop: SPACING.lg,
              flexDirection: 'row',
              gap: SPACING.sm,
            }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('MyScheduledMeals')}
                style={{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: SPACING.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <MaterialCommunityIcons name="calendar-text" size={20} color="#ff8800" style={{ marginRight: SPACING.sm }} />
                <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#1F2937' }}>My Meals</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('AutoOrderSettings')}
                style={{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: SPACING.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <MaterialCommunityIcons name="refresh-auto" size={20} color="#ff8800" style={{ marginRight: SPACING.sm }} />
                <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#1F2937' }}>Auto-Order</Text>
              </TouchableOpacity>
              {currentAddressId && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('AutoOrderAddons', { addressId: currentAddressId })}
                  style={{
                    flex: 1,
                    backgroundColor: '#FFF7ED',
                    borderRadius: 12,
                    padding: SPACING.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#FED7AA',
                  }}
                >
                  <MaterialCommunityIcons name="food-variant-plus" size={20} color="#ff8800" style={{ marginRight: SPACING.sm }} />
                  <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#ff8800' }}>Add Add-ons</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Bottom spacer for panel and floating action bar */}
            {selectedDate && <View style={{ height: 400 }} />}
            <View style={{ height: SPACING['4xl'] + insets.bottom + (selectedSlots.size > 0 ? 80 : 0) }} />
          </>
        )}
      </ScrollView>

      {/* Bottom Panel */}
      {selectedDate && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{
              translateY: panelHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [400, 0],
              }),
            }],
          }}
        >
          <View style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          }}>
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingVertical: SPACING.md }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2 }} />
            </View>

            <View style={{ paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl + insets.bottom }}>
              {/* Date header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg }}>
                <View>
                  <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#1F2937' }}>
                    {formatShortDate(selectedDate)}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>
                    Tap a slot to take action
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closePanel}
                  style={{
                    width: TOUCH_TARGETS.minimum,
                    height: TOUCH_TARGETS.minimum,
                    borderRadius: TOUCH_TARGETS.minimum / 2,
                    backgroundColor: '#F3F4F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Slot cards */}
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {renderSlotCard('LUNCH')}
                {renderSlotCard('DINNER')}
              </ScrollView>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Floating Action Bar for Bulk Scheduling */}
      {selectedSlots.size > 0 && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#ff8800',
          paddingVertical: SPACING.md,
          paddingHorizontal: SPACING.xl,
          paddingBottom: SPACING.md + insets.bottom,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        }}>
          <View>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: FONT_SIZES.base }}>
              {selectedSlots.size} meal{selectedSlots.size > 1 ? 's' : ''} selected
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: FONT_SIZES.xs }}>
              Continue to see pricing
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleContinueToPricing}
            style={{
              backgroundColor: 'white',
              borderRadius: 10,
              paddingVertical: SPACING.sm,
              paddingHorizontal: SPACING.xl,
            }}
          >
            <Text style={{ color: '#ff8800', fontWeight: '700', fontSize: FONT_SIZES.sm }}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Address Picker Modal */}
      <Modal visible={showAddressPicker} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          activeOpacity={1}
          onPress={() => setShowAddressPicker(false)}
        >
          <View style={{ flex: 1 }} />
          <View style={{
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '60%',
            paddingTop: SPACING.lg,
            paddingBottom: insets.bottom + SPACING.lg,
          }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg }} />
            <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#1F2937', paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
              Select Delivery Address
            </Text>
            <FlatList
              data={addresses}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleAddressChange(item.id)}
                  style={{
                    paddingHorizontal: SPACING.lg,
                    paddingVertical: SPACING.md,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: item.id === currentAddressId ? '#FFF7ED' : 'white',
                  }}
                >
                  <MaterialCommunityIcons
                    name={item.label === 'Home' ? 'home-outline' : item.label === 'Office' ? 'office-building-outline' : 'map-marker-outline'}
                    size={20}
                    color={item.id === currentAddressId ? '#ff8800' : '#6B7280'}
                    style={{ marginRight: SPACING.md }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: item.id === currentAddressId ? '#ff8800' : '#1F2937' }}>
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                      {item.addressLine1}, {item.locality}
                    </Text>
                  </View>
                  {item.id === currentAddressId && (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#ff8800" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default MealCalendarScreen;
