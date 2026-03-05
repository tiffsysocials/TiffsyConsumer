import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAddress } from '../../context/AddressContext';
import { getConfigMealCount, getScheduleSummary } from '../../utils/autoOrderUtils';
import { AutoOrderAddressConfig } from '../../services/api.service';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';
import { MainTabParamList } from '../../types/navigation';

type Props = StackScreenProps<MainTabParamList, 'AutoOrderSettings'>;

const AutoOrderSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const {
    autoOrderConfigs,
    autoOrderConfigsLoading,
    fetchAllAutoOrderConfigs,
  } = useSubscription();
  const { addresses } = useAddress();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch configs on mount
  useEffect(() => {
    fetchAllAutoOrderConfigs().catch(() => {});
  }, []);

  // Refresh on focus (when returning from config screen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchAllAutoOrderConfigs().catch(() => {});
    });
    return unsubscribe;
  }, [navigation, fetchAllAutoOrderConfigs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAllAutoOrderConfigs();
    } catch {}
    setRefreshing(false);
  }, [fetchAllAutoOrderConfigs]);

  // Get status badge color
  const getStatusColor = (config: AutoOrderAddressConfig) => {
    if (!config.enabled) return { bg: '#F3F4F6', text: '#6B7280', label: 'Disabled' };
    return { bg: '#D1FAE5', text: '#059669', label: 'Active' };
  };

  // Total meals across all configs
  const totalMealsPerWeek = autoOrderConfigs.reduce((sum, config) => {
    if (config.enabled) {
      return sum + getConfigMealCount(config.weeklySchedule);
    }
    return sum;
  }, 0);

  const activeConfigCount = autoOrderConfigs.filter(c => c.enabled).length;

  // Merge all saved addresses with their configs (if any)
  const mergedAddresses = addresses.map(addr => {
    const config = autoOrderConfigs.find(c => c.addressId === addr.id);
    return { address: addr, config };
  });
  // Also include configs whose address isn't in the local addresses list (edge case)
  const orphanConfigs = autoOrderConfigs.filter(
    c => !addresses.some(a => a.id === c.addressId)
  );
  const allItems = [
    ...mergedAddresses,
    ...orphanConfigs.map(c => ({ address: null, config: c })),
  ];

  // Loading state
  if (autoOrderConfigsLoading && autoOrderConfigs.length === 0) {
    return (
      <SafeAreaView style={styles.container} className="flex-1 justify-center items-center bg-gray-50">
        <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
        <ActivityIndicator size="large" color="#ff8800" />
        <Text className="mt-4 text-gray-600">Loading auto-order settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container} className="flex-1 bg-white">
      <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
      <SafeAreaView style={{ backgroundColor: '#ff8800' }} edges={['top']} />

      {/* Header */}
      <View
        className="bg-orange-400 px-5 py-4"
        style={{ borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}
      >
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              minWidth: TOUCH_TARGETS.minimum,
              minHeight: TOUCH_TARGETS.minimum,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              source={require('../../assets/icons/backarrow3.png')}
              style={{ width: SPACING.iconLg, height: SPACING.iconLg }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text
            className="font-bold text-white flex-1 text-center"
            style={{ fontSize: FONT_SIZES.h4 }}
            numberOfLines={1}
          >
            Auto-Order Settings
          </Text>
          <View style={{ width: SPACING.iconLg }} />
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-gray-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING['4xl'] * 2, paddingTop: SPACING.lg }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ff8800']} />
        }
      >
        {/* Summary Card */}
        <View
          className="mx-4 mb-5 rounded-3xl overflow-hidden"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 5,
          }}
        >
          <View className="p-5" style={{ backgroundColor: '#ff8800' }}>
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="refresh-auto" size={28} color="white" style={{ marginRight: 12 }} />
              <View className="flex-1">
                <Text className="text-xl font-bold text-white mb-1" numberOfLines={1}>
                  Auto-Ordering
                </Text>
                <Text className="text-sm text-white opacity-90" numberOfLines={2}>
                  {activeConfigCount > 0
                    ? `${activeConfigCount} address${activeConfigCount !== 1 ? 'es' : ''} active · ${totalMealsPerWeek} meals/week`
                    : 'Set up auto-ordering for your addresses'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Address Configs Section */}
        <View className="mx-4 mb-4">
          <View className="flex-row items-center mb-4">
            <View className="w-2 h-6 bg-orange-400 rounded-full mr-3" />
            <Text className="text-xl font-bold text-gray-900 flex-1" numberOfLines={1}>
              Your Addresses
            </Text>
            {autoOrderConfigs.length > 0 && (
              <View className="bg-orange-100 rounded-full px-3 py-1">
                <Text className="text-xs font-bold text-orange-600">
                  {autoOrderConfigs.length}
                </Text>
              </View>
            )}
          </View>

          {/* Address Cards */}
          {allItems.length === 0 ? (
            /* No addresses at all */
            <View
              style={{
                backgroundColor: '#FFF7ED',
                borderRadius: 16,
                padding: 24,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: '#FED7AA',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: '#FFEDD5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <MaterialCommunityIcons name="map-marker-plus-outline" size={28} color="#ff8800" />
              </View>
              <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827', marginBottom: 4 }}>
                No Addresses
              </Text>
              <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', textAlign: 'center', marginBottom: 16 }}>
                Add a delivery address first to set up auto-ordering
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Address' as any)}
                style={{
                  backgroundColor: '#ff8800',
                  borderRadius: 25,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                }}
              >
                <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: 'white' }}>
                  Add Address
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            allItems.map((item) => {
              const config = item.config;
              const addrId = config?.addressId || item.address?.id;
              const addrLine1 = config?.address?.addressLine1 || item.address?.addressLine1 || 'Unknown';
              const addrCity = config?.address?.city || item.address?.city || '';
              const addrLabel = item.address?.label;

              if (config) {
                // Address WITH config — show full status card
                const status = getStatusColor(config);
                const mealCount = getConfigMealCount(config.weeklySchedule);
                const scheduleSummary = getScheduleSummary(config.weeklySchedule);

                return (
                  <TouchableOpacity
                    key={config._id}
                    onPress={() => navigation.navigate('AutoOrderConfig', { addressId: config.addressId })}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 12,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    <View className="flex-row items-start">
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: '#FFF7ED',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <MaterialCommunityIcons name="map-marker" size={24} color="#ff8800" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View className="flex-row items-center justify-between mb-1">
                          <Text
                            style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827', flex: 1 }}
                            numberOfLines={1}
                          >
                            {addrLabel || addrLine1}
                          </Text>
                          <Text style={{ fontSize: 20, color: '#9CA3AF', marginLeft: 8 }}>›</Text>
                        </View>
                        <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginBottom: 8 }} numberOfLines={1}>
                          {addrLine1}{addrCity ? `, ${addrCity}` : ''}
                        </Text>
                        <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
                          <View style={{ backgroundColor: status.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: status.text }}>
                              {status.label}
                            </Text>
                          </View>
                          {config.enabled && (
                            <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#3B82F6' }}>
                                {mealCount} meals/week
                              </Text>
                            </View>
                          )}
                          {config.enabled && (
                            <View style={{ backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>
                                {scheduleSummary}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              } else {
                // Address WITHOUT config — show "Not Set Up" card
                return (
                  <TouchableOpacity
                    key={addrId}
                    onPress={() => navigation.navigate('AutoOrderConfig', { addressId: addrId })}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 12,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: '#E5E7EB',
                    }}
                  >
                    <View className="flex-row items-center">
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: '#F3F4F6',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <MaterialCommunityIcons name="map-marker-outline" size={24} color="#9CA3AF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827' }}
                          numberOfLines={1}
                        >
                          {addrLabel || addrLine1}
                        </Text>
                        <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                          {addrLine1}{addrCity ? `, ${addrCity}` : ''}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: '#FFF7ED', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#ff8800' }}>
                          Set Up
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
            })
          )}
        </View>

        {/* Quick Actions */}
        {autoOrderConfigs.length > 0 && (
          <View className="mx-4 mb-4">
            <View className="flex-row items-center mb-4">
              <View className="w-2 h-6 bg-orange-400 rounded-full mr-3" />
              <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>
                Quick Actions
              </Text>
            </View>

            {/* View Calendar */}
            <TouchableOpacity
              onPress={() => navigation.navigate('MealCalendar')}
              activeOpacity={0.7}
            >
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: '#3B82F6',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: '#EFF6FF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <MaterialCommunityIcons name="calendar-month" size={24} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827' }}>
                    View Calendar
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>
                    See your scheduled meals
                  </Text>
                </View>
                <Text style={{ fontSize: 20, color: '#3B82F6' }}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AutoOrderSettingsScreen;
