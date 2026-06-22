// src/screens/account/VouchersScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { MainTabParamList } from '../../types/navigation';
import { useSubscription } from '../../context/SubscriptionContext';
import WalletChip from '../../components/WalletChip';
import { Voucher, VoucherStatus } from '../../services/api.service';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';
import SubscriptionsTab from './components/SubscriptionsTab';

type Props = StackScreenProps<MainTabParamList, 'Vouchers'>;

// Top-level tab — split the screen between the voucher list (old
// behaviour) and the new subscription-payment audit trail.
type TopTab = 'VOUCHERS' | 'SUBSCRIPTIONS';

// Filter tab options (inside the Vouchers top-tab)
type FilterTab = 'ALL' | VoucherStatus;

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'AVAILABLE', label: 'Available' },
  { id: 'REDEEMED', label: 'Redeemed' },
  { id: 'EXPIRED', label: 'Expired' },
];

const VouchersScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const {
    vouchers,
    voucherSummary,
    usableVouchers,
    walletBalance,
    hasAnySubscription,
    vouchersLoading,
    error,
    fetchVouchers,
    clearError,
  } = useSubscription();
  const { isSmallDevice } = useResponsive();

  const [activeTopTab, setActiveTopTab] = useState<TopTab>('VOUCHERS');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch vouchers on mount
  useEffect(() => {
    console.log('[VouchersScreen] useEffect - Fetching vouchers');
    fetchVouchers();
  }, [fetchVouchers]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    console.log('[VouchersScreen] onRefresh - Starting refresh');
    setRefreshing(true);
    await fetchVouchers();
    setRefreshing(false);
    console.log('[VouchersScreen] onRefresh - Refresh complete');
  }, [fetchVouchers]);

  // Filter vouchers based on active tab
  const filteredVouchers = vouchers.filter((voucher) => {
    if (activeFilter === 'ALL') return true;
    return voucher.status === activeFilter;
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: '2-digit' };
    return date.toLocaleDateString('en-IN', options);
  };

  // Get status color
  const getStatusColor = (status: VoucherStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return { bg: '#DCFCE7', text: '#22C55E' };
      case 'REDEEMED':
        return { bg: '#DBEAFE', text: '#3B82F6' };
      case 'EXPIRED':
        return { bg: '#F3F4F6', text: '#6B7280' };
      case 'RESTORED':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'CANCELLED':
        return { bg: '#FEE2E2', text: '#EF4444' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  // Get meal type color
  const getMealTypeColor = (mealType: string) => {
    switch (mealType) {
      case 'LUNCH':
        return { bg: '#FFF7ED', text: '#EA580C' };
      case 'DINNER':
        return { bg: '#F0F9FF', text: '#0284C7' };
      case 'ANY':
        return { bg: '#F5F3FF', text: '#7C3AED' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  // Truncate voucher code for display
  const truncateCode = (code: string) => {
    if (code.length <= 12) return code;
    return `${code.slice(0, 6)}...${code.slice(-4)}`;
  };

  // Render voucher item
  const renderVoucherItem = ({ item }: { item: Voucher }) => {
    const statusColor = getStatusColor(item.status);
    const mealColor = getMealTypeColor(item.mealType);

    return (
      <View
        className="bg-white rounded-2xl p-4 mb-3"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        {/* Top Row - Code and Status */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Image
              source={require('../../assets/icons/voucher4.png')}
              style={{ width: 24, height: 24, marginRight: 8 }}
              resizeMode="contain"
            />
            <Text className="text-base font-semibold text-gray-900">
              {truncateCode(item.voucherCode)}
            </Text>
          </View>
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: statusColor.bg }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: statusColor.text }}
            >
              {item.status}
            </Text>
          </View>
        </View>

        {/* Middle Row - Meal Type and Expiry */}
        <View className="flex-row items-center justify-between mb-2">
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: mealColor.bg }}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: mealColor.text }}
            >
              {item.mealType === 'ANY' ? 'Any Meal' : item.mealType}
            </Text>
          </View>
          <Text className="text-sm text-gray-500">
            Expires: {formatDate(item.expiryDate)}
          </Text>
        </View>

        {/* Bottom Row - Redeemed info (if applicable) */}
        {item.status === 'REDEEMED' && item.redeemedAt && (
          <View className="pt-2 border-t border-gray-100">
            <Text className="text-xs text-gray-500">
              Redeemed on {formatDate(item.redeemedAt)}
              {item.redeemedOrderId && ` - Order #${item.redeemedOrderId.slice(-6)}`}
            </Text>
          </View>
        )}

        {/* Restored info (if applicable) */}
        {item.status === 'RESTORED' && item.restoredAt && (
          <View className="pt-2 border-t border-gray-100">
            <Text className="text-xs text-gray-500">
              Restored on {formatDate(item.restoredAt)}
              {item.restorationReason && ` - ${item.restorationReason}`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-16">
      <Image
        source={require('../../assets/icons/voucher4.png')}
        style={{ width: 64, height: 64, opacity: 0.3, marginBottom: 16 }}
        resizeMode="contain"
      />
      <Text className="text-lg font-semibold text-gray-400 mb-2">
        No {activeFilter === 'ALL' ? '' : activeFilter.toLowerCase()} vouchers
      </Text>
      <Text className="text-sm text-gray-400 text-center px-8">
        {activeFilter === 'AVAILABLE'
          ? 'Purchase a meal plan to get vouchers'
          : activeFilter === 'ALL'
          ? 'You don\'t have any vouchers yet'
          : `No ${activeFilter.toLowerCase()} vouchers found`}
      </Text>
      {activeFilter === 'AVAILABLE' && (
        <TouchableOpacity
          onPress={() => navigation.navigate('MealPlans')}
          className="mt-4 bg-orange-400 rounded-full"
          style={{
            paddingHorizontal: SPACING.xl,
            paddingVertical: SPACING.md,
            minHeight: TOUCH_TARGETS.comfortable,
          }}
        >
          <Text className="text-white font-semibold" style={{ fontSize: FONT_SIZES.base }}>View Meal Plans</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient
        colors={['#FD9E2F', '#FF6636']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
          paddingBottom: 24,
                  }}
      >
        <SafeAreaView edges={['top']}>
        {/* Decorative Background Elements */}
        <Image
          source={require('../../assets/images/homepage/halfcircle.png')}
          style={{ position: 'absolute', top: -90, right: -125, width: 300, height: 380, borderRadius: 150 }}
          resizeMode="contain"
        />
        <Image
          source={require('../../assets/images/homepage/halfline.png')}
          style={{ position: 'absolute', top: 30, right: -150, width: 380, height: 150, borderRadius: 20 }}
          resizeMode="contain"
        />

        <View className="flex-row items-center justify-between px-5 pt-4 pb-6">
          {/* Back Button */}
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

          {/* Title */}
          <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1, textAlign: 'center' }} numberOfLines={1}>
            My Vouchers
          </Text>

          {/* Wallet + Voucher chips */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {hasAnySubscription && <WalletChip balance={walletBalance} size="md" />}
            <TouchableOpacity
              onPress={() => navigation.navigate('MealPlans')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'white',
                borderRadius: SPACING.lg,
                paddingVertical: SPACING.xs + 1,
                paddingHorizontal: SPACING.sm,
                gap: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Image
                source={require('../../assets/icons/voucher4.png')}
                style={{ width: SPACING.iconSm + 2, height: SPACING.iconSm + 2 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: 'bold', color: '#FE8733' }}>{usableVouchers}</Text>
            </TouchableOpacity>
          </View>
        </View>
              </SafeAreaView>
      </LinearGradient>

      {/* Content Area */}
      <View className="flex-1 bg-gray-50">
        {/* Top-level tabs: Vouchers (default — preserves old screen
            verbatim) | Subscriptions (new — payment audit trail). Pill
            container styled like YourOrdersScreen so the hierarchy is
            visually distinct from the voucher-status chips below. */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 20,
            marginTop: 16,
            backgroundColor: '#F3F4F6',
            borderRadius: 999,
            padding: 4,
          }}
        >
          {(['VOUCHERS', 'SUBSCRIPTIONS'] as const).map((tab) => {
            const active = activeTopTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTopTab(tab)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: active ? '#FFFFFF' : 'transparent',
                  alignItems: 'center',
                  shadowColor: active ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: active ? 0.08 : 0,
                  shadowRadius: 2,
                  elevation: active ? 2 : 0,
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: FONT_SIZES.base,
                    fontWeight: active ? '700' : '500',
                    color: active ? '#FE8733' : '#6B7280',
                  }}
                >
                  {tab === 'VOUCHERS' ? 'Vouchers' : 'Subscriptions'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTopTab === 'SUBSCRIPTIONS' ? (
          <SubscriptionsTab onNavigateToPlans={() => navigation.navigate('MealPlans')} />
        ) : (
        <>
        {/* Summary Cards — 4 columns when the user has a subscription
            (Available / Redeemed / Expired / Wallet), 3 columns otherwise. */}
        <View className="flex-row px-5 pt-6 pb-4" style={{ gap: 6 }}>
        {/* Available */}
        <View
          className="flex-1 bg-white rounded-xl p-3"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View className="flex-row items-center mb-1">
            <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: '#22C55E' }} />
            <Text className="text-xs text-gray-500">Available</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">
            {usableVouchers}
          </Text>
        </View>

        {/* Redeemed */}
        <View
          className="flex-1 bg-white rounded-xl p-3"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View className="flex-row items-center mb-1">
            <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: '#3B82F6' }} />
            <Text className="text-xs text-gray-500">Redeemed</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">
            {voucherSummary?.redeemed ?? 0}
          </Text>
        </View>

        {/* Expired */}
        <View
          className="flex-1 bg-white rounded-xl p-3"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View className="flex-row items-center mb-1">
            <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: '#6B7280' }} />
            <Text className="text-xs text-gray-500">Expired</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">
            {voucherSummary?.expired ?? 0}
          </Text>
        </View>

        {/* Wallet — only shown to subscribed users so guests / never-
            subscribed users don't see an empty fourth card. */}
        {hasAnySubscription && (
          <View
            className="flex-1 bg-white rounded-xl p-3"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <View className="flex-row items-center mb-1">
              <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: '#FE8733' }} />
              <Text className="text-xs text-gray-500">Wallet</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">
              ₹{Number.isInteger(walletBalance) ? walletBalance : walletBalance.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* Filter Tabs */}
      <View className="flex-row px-5 mb-4">
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveFilter(tab.id)}
            className="mr-2 rounded-full"
            style={{
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.sm,
              minHeight: TOUCH_TARGETS.minimum,
              backgroundColor: activeFilter === tab.id ? '#FE8733' : '#F3F4F6',
            }}
          >
            <Text
              className="font-medium"
              style={{
                fontSize: FONT_SIZES.base,
                color: activeFilter === tab.id ? 'white' : '#6B7280',
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error State */}
      {error && !vouchersLoading && (
        <View className="mx-5 bg-red-50 rounded-xl p-4 mb-4">
          <Text className="text-red-600 text-center">{error}</Text>
          <TouchableOpacity
            onPress={() => {
              clearError();
              fetchVouchers();
            }}
            className="mt-2"
          >
            <Text className="text-center text-red-600 font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading State */}
      {vouchersLoading && !refreshing && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FE8733" />
          <Text className="mt-4 text-gray-500">Loading vouchers...</Text>
        </View>
      )}

      {/* Vouchers List */}
      {!vouchersLoading && (
        <FlatList
          data={filteredVouchers}
          renderItem={renderVoucherItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 20,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FE8733']}
            />
          }
        />
      )}
        </>
        )}
      </View>
    </View>
  );
};

export default VouchersScreen;
