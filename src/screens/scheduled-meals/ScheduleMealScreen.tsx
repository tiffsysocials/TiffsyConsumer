import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import { useAddress } from '../../context/AddressContext';
import { useAlert } from '../../context/AlertContext';
import apiService, { ScheduledMealSlot } from '../../services/api.service';
import { useResponsive, useScaling } from '../../hooks/useResponsive';
import { SPACING } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'ScheduleMeal'>;

interface GroupedSlots {
  date: string;
  dayName: string;
  lunch: ScheduledMealSlot | null;
  dinner: ScheduledMealSlot | null;
}

const SLOT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  available: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  cutoff_passed: { bg: '#F3F4F6', text: '#9CA3AF', border: '#E5E7EB' },
  auto_order_active: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  already_scheduled: { bg: '#FED7AA', text: '#9A3412', border: '#FDBA74' },
  already_ordered: { bg: '#FFEDD5', text: '#9A3412', border: '#FDBA74' },
  not_serviceable: { bg: '#F3F4F6', text: '#9CA3AF', border: '#E5E7EB' },
  no_kitchen: { bg: '#F3F4F6', text: '#9CA3AF', border: '#E5E7EB' },
};

const SLOT_ICONS: Record<string, string> = {
  available: 'check-circle-outline',
  cutoff_passed: 'clock-outline',
  auto_order_active: 'refresh-auto',
  already_scheduled: 'calendar-check',
  already_ordered: 'calendar-check',
  not_serviceable: 'map-marker-off-outline',
  no_kitchen: 'store-off-outline',
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
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

const ScheduleMealScreen: React.FC<Props> = ({ navigation }) => {
  const { width } = useResponsive();
  const { scale } = useScaling();
  const insets = useSafeAreaInsets();
  const { addresses, selectedAddressId } = useAddress();
  const { showAlert } = useAlert();

  const [slots, setSlots] = useState<ScheduledMealSlot[]>([]);
  const [activeScheduledMeals, setActiveScheduledMeals] = useState(0);
  const [maxScheduledMeals, setMaxScheduledMeals] = useState(14);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAddressId, setCurrentAddressId] = useState<string | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  const getDefaultAddressId = useCallback((): string | null => {
    if (selectedAddressId) return selectedAddressId;
    const defaultAddr = addresses.find(a => a.isMain);
    if (defaultAddr) return defaultAddr.id;
    if (addresses.length > 0) return addresses[0].id;
    return null;
  }, [addresses, selectedAddressId]);

  const fetchSlots = useCallback(async (addressId: string | null) => {
    if (!addressId) {
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setError(null);
      const response = await apiService.getScheduledMealSlots(addressId);
      if (response.success) {
        setSlots(response.data.slots);
        setActiveScheduledMeals(response.data.activeScheduledMeals);
        setMaxScheduledMeals(response.data.maxScheduledMeals);
      } else {
        setError(response.message || 'Failed to load available slots');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load available slots');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const addressId = currentAddressId || getDefaultAddressId();
      if (addressId && addressId !== currentAddressId) {
        setCurrentAddressId(addressId);
      }
      setIsLoading(true);
      fetchSlots(addressId || currentAddressId);
    }, [currentAddressId, getDefaultAddressId, fetchSlots])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSlots(currentAddressId);
  }, [currentAddressId, fetchSlots]);

  const handleAddressChange = useCallback((addressId: string) => {
    setCurrentAddressId(addressId);
    setShowAddressPicker(false);
    setIsLoading(true);
    fetchSlots(addressId);
  }, [fetchSlots]);

  const handleSlotPress = useCallback((slot: ScheduledMealSlot) => {
    if (slot.status !== 'available') return;

    if (activeScheduledMeals >= maxScheduledMeals) {
      showAlert(
        'Limit Reached',
        `You can have at most ${maxScheduledMeals} scheduled meals at a time. Cancel an existing one to schedule a new meal.`,
        undefined,
        'warning'
      );
      return;
    }

    if (!currentAddressId) return;

    navigation.navigate('ScheduledMealPricing', {
      deliveryAddressId: currentAddressId,
      mealWindow: slot.mealWindow,
      scheduledDate: slot.date,
    });
  }, [activeScheduledMeals, maxScheduledMeals, currentAddressId, navigation, showAlert]);

  // Group slots by date
  const groupedSlots: GroupedSlots[] = slots.reduce<GroupedSlots[]>((groups, slot) => {
    let group = groups.find(g => g.date === slot.date);
    if (!group) {
      group = { date: slot.date, dayName: slot.dayName, lunch: null, dinner: null };
      groups.push(group);
    }
    if (slot.mealWindow === 'LUNCH') group.lunch = slot;
    if (slot.mealWindow === 'DINNER') group.dinner = slot;
    return groups;
  }, []);

  const currentAddress = addresses.find(a => a.id === currentAddressId);
  const hasAddresses = addresses.length > 0;

  const renderSlotCell = (slot: ScheduledMealSlot | null, mealWindow: 'LUNCH' | 'DINNER') => {
    if (!slot) {
      return (
        <View style={{
          flex: 1,
          backgroundColor: '#F3F4F6',
          borderRadius: 10,
          padding: SPACING.sm,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 60,
          borderWidth: 1,
          borderColor: '#E5E7EB',
        }}>
          <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF' }}>N/A</Text>
        </View>
      );
    }

    const colors = SLOT_COLORS[slot.status] || SLOT_COLORS.cutoff_passed;
    const icon = SLOT_ICONS[slot.status] || 'help-circle-outline';
    const isAvailable = slot.status === 'available';

    return (
      <TouchableOpacity
        activeOpacity={isAvailable ? 0.7 : 1}
        onPress={() => handleSlotPress(slot)}
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          borderRadius: 10,
          padding: SPACING.sm,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 60,
          borderWidth: 1.5,
          borderColor: colors.border,
        }}
      >
        <MaterialCommunityIcons name={icon} size={18} color={colors.text} />
        <Text style={{
          fontSize: FONT_SIZES.xs,
          color: colors.text,
          fontWeight: isAvailable ? '600' : '400',
          marginTop: 2,
          textAlign: 'center',
        }}>
          {isAvailable ? mealWindow : slot.status.replace(/_/g, ' ')}
        </Text>
        {slot.reason && !isAvailable && (
          <Text style={{ fontSize: 9, color: colors.text, opacity: 0.7, textAlign: 'center', marginTop: 1 }} numberOfLines={2}>
            {slot.reason}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // No addresses state
  if (!hasAddresses) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={['#FD9E2F', '#FF6636']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'relative', overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 24 }}>
          <SafeAreaView edges={['top']}>
            <View className="flex-row items-center justify-between px-5 pt-4 pb-6">
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
              </TouchableOpacity>
              <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1, textAlign: 'center' }} numberOfLines={1}>Schedule a Meal</Text>
              <View style={{ width: 24 }} />
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
          <MaterialCommunityIcons name="map-marker-plus-outline" size={64} color="#D1D5DB" />
          <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: '600', color: '#374151', marginTop: SPACING.lg, textAlign: 'center' }}>
            No Delivery Address
          </Text>
          <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: SPACING.sm, textAlign: 'center' }}>
            Add a delivery address to schedule a meal
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Address')}
            style={{
              marginTop: SPACING.xl,
              backgroundColor: '#FE8733',
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
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#FD9E2F', '#FF6636']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.md, paddingBottom: SPACING.lg, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' }}>
        <SafeAreaView edges={['top']} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1 }}>Schedule a Meal</Text>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs }}>
          <Text style={{ color: 'white', fontSize: FONT_SIZES.xs, fontWeight: '600' }}>
            {activeScheduledMeals}/{maxScheduledMeals} scheduled
          </Text>
        </View>
              </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#FE8733']} />}
      >
        {/* Address Selector */}
        <TouchableOpacity
          onPress={() => setShowAddressPicker(true)}
          style={{
            margin: SPACING.lg,
            backgroundColor: '#F9FAFB',
            borderRadius: 12,
            padding: SPACING.md,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
        >
          <MaterialCommunityIcons name="map-marker-outline" size={20} color="#FE8733" style={{ marginRight: SPACING.sm }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>Delivering to</Text>
            <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937' }} numberOfLines={1}>
              {currentAddress ? `${currentAddress.label} - ${currentAddress.addressLine1}` : 'Select an address'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Max Limit Warning */}
        {activeScheduledMeals >= maxScheduledMeals && (
          <View style={{
            marginHorizontal: SPACING.lg,
            marginBottom: SPACING.md,
            backgroundColor: '#FEF3C7',
            borderRadius: 10,
            padding: SPACING.md,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#D97706" style={{ marginRight: SPACING.sm }} />
            <Text style={{ flex: 1, fontSize: FONT_SIZES.xs, color: '#92400E' }}>
              You've reached the maximum of {maxScheduledMeals} scheduled meals. Cancel an existing meal to schedule a new one.
            </Text>
          </View>
        )}

        {/* Loading State */}
        {isLoading ? (
          <View style={{ paddingVertical: SPACING['5xl'], alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#FE8733" />
            <Text style={{ marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Loading available slots...</Text>
          </View>
        ) : error ? (
          /* Error State */
          <View style={{ paddingVertical: SPACING['5xl'], alignItems: 'center', paddingHorizontal: SPACING.xl }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={{ marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: '#6B7280', textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity
              onPress={() => { setIsLoading(true); fetchSlots(currentAddressId); }}
              style={{ marginTop: SPACING.lg, backgroundColor: '#FE8733', borderRadius: 10, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl }}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: FONT_SIZES.sm }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Slot Grid */
          <View style={{ paddingHorizontal: SPACING.lg }}>
            {/* Grid Header */}
            <View style={{ flexDirection: 'row', marginBottom: SPACING.sm, paddingHorizontal: SPACING.xs }}>
              <View style={{ flex: 1.2 }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#6B7280' }}>LUNCH</Text>
              </View>
              <View style={{ width: SPACING.sm }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#6B7280' }}>DINNER</Text>
              </View>
            </View>

            {/* Slot Rows */}
            {groupedSlots.map((group) => (
              <View key={group.date} style={{ flexDirection: 'row', marginBottom: SPACING.sm, alignItems: 'center' }}>
                {/* Date Label */}
                <View style={{ flex: 1.2, paddingRight: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937' }}>{formatDate(group.date)}</Text>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', textTransform: 'capitalize' }}>{group.dayName}</Text>
                </View>

                {/* Lunch Slot */}
                {renderSlotCell(group.lunch, 'LUNCH')}

                <View style={{ width: SPACING.sm }} />

                {/* Dinner Slot */}
                {renderSlotCell(group.dinner, 'DINNER')}
              </View>
            ))}

            {groupedSlots.length === 0 && (
              <View style={{ paddingVertical: SPACING['4xl'], alignItems: 'center' }}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={48} color="#D1D5DB" />
                <Text style={{ marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: '#6B7280', textAlign: 'center' }}>
                  No available slots found for this address
                </Text>
              </View>
            )}

            {/* Legend */}
            <View style={{ marginTop: SPACING.lg, marginBottom: SPACING.xl, backgroundColor: '#F9FAFB', borderRadius: 12, padding: SPACING.md }}>
              <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#6B7280', marginBottom: SPACING.sm }}>Legend</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
                {[
                  { status: 'available', label: 'Available' },
                  { status: 'cutoff_passed', label: 'Cutoff Passed' },
                  { status: 'auto_order_active', label: 'Auto-Order' },
                  { status: 'already_scheduled', label: 'Scheduled' },
                ].map(item => (
                  <View key={item.status} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      backgroundColor: SLOT_COLORS[item.status].bg,
                      borderWidth: 1,
                      borderColor: SLOT_COLORS[item.status].border,
                      marginRight: 4,
                    }} />
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* View Scheduled Meals Link */}
            {activeScheduledMeals > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('MyScheduledMeals')}
                style={{
                  marginBottom: SPACING.xl,
                  backgroundColor: '#F0F9FF',
                  borderRadius: 12,
                  padding: SPACING.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#BAE6FD',
                }}
              >
                <MaterialCommunityIcons name="calendar-text" size={20} color="#0284C7" style={{ marginRight: SPACING.sm }} />
                <Text style={{ flex: 1, fontSize: FONT_SIZES.sm, color: '#0284C7', fontWeight: '500' }}>
                  View your {activeScheduledMeals} scheduled meal{activeScheduledMeals > 1 ? 's' : ''}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#0284C7" />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: SPACING['4xl'] + insets.bottom }} />
      </ScrollView>

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
            {/* Handle */}
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
                    color={item.id === currentAddressId ? '#FE8733' : '#6B7280'}
                    style={{ marginRight: SPACING.md }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: item.id === currentAddressId ? '#FE8733' : '#1F2937' }}>
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                      {item.addressLine1}, {item.locality}
                    </Text>
                  </View>
                  {item.id === currentAddressId && (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#FE8733" />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => {
                setShowAddressPicker(false);
                navigation.navigate('Address');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: SPACING.lg,
                paddingVertical: SPACING.md,
                marginTop: SPACING.xs,
                borderTopWidth: 1,
                borderTopColor: '#F3F4F6',
              }}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FE8733" style={{ marginRight: SPACING.md }} />
              <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#FE8733' }}>Add new address</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default ScheduleMealScreen;
