// src/screens/account/AccountScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainTabParamList } from '../../types/navigation';
import { useUser } from '../../context/UserContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAddress } from '../../context/AddressContext';
import { Subscription } from '../../services/api.service';
import ConfirmationModal from '../../components/ConfirmationModal';
import InfoModal from '../../components/InfoModal';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useResponsive, useScaling } from '../../hooks/useResponsive';
import { SPACING } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

// ============================================
// OFFLINE MODE FLAG - Set to false to enable backend
// ============================================
const OFFLINE_MODE = true;

type Props = StackScreenProps<MainTabParamList, 'Account'>;

// Menu items configuration for search filtering
const ACCOUNT_MENU_ITEMS = [
  { id: 'orders', label: 'My Orders', icon: require('../../assets/icons/order2.png'), route: 'YourOrders' as const, authRequired: true },
  { id: 'addresses', label: 'Saved Addresses', icon: require('../../assets/icons/address2.png'), route: 'Address' as const, authRequired: true },
  { id: 'mealplans', label: 'Meal Plans', icon: require('../../assets/icons/prepared2.png'), route: 'MealPlans' as const, authRequired: false },
  { id: 'vouchers', label: 'My Vouchers', icon: require('../../assets/icons/refund2.png'), route: 'Vouchers' as const, authRequired: true },
  { id: 'autoordersettings', label: 'Auto-Order Settings', icon: require('../../assets/icons/time2.png'), route: 'AutoOrderSettings' as const, authRequired: true },
  { id: 'mealcalendar', label: 'Meal Calendar', icon: require('../../assets/icons/time2.png'), route: 'MealCalendar' as const, authRequired: true },
  { id: 'scheduledmeals', label: 'Scheduled Meals', icon: require('../../assets/icons/meal.png'), route: 'MyScheduledMeals' as const, authRequired: true },
  { id: 'referral', label: 'Refer & Earn', icon: require('../../assets/icons/people2.png'), route: 'ReferAndEarn' as const, authRequired: true },
  { id: 'bulkorders', label: 'Bulk Orders', icon: require('../../assets/icons/bulkorders.png'), route: 'BulkOrders' as const, authRequired: false },
];

const SUPPORT_MENU_ITEMS = [
  { id: 'help', label: 'Help & Support', icon: require('../../assets/icons/help2.png'), route: 'HelpSupport' as const, authRequired: false },
  { id: 'about', label: 'About', icon: require('../../assets/icons/about2.png'), route: 'About' as const, authRequired: false },
];

const AccountScreen: React.FC<Props> = ({ navigation }) => {
  const { width, height, isSmallDevice } = useResponsive();
  const { scale } = useScaling();
  const insets = useSafeAreaInsets();

  // Modal states
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState('Success');
  const [shouldLogoutOnClose, setShouldLogoutOnClose] = useState(false);


  const { isGuest, user, logout, exitGuestMode } = useUser();
  const {
    activeSubscription,
    vouchers,
    usableVouchers,
    subscriptions,
    loading,
    fetchSubscriptions,
    autoOrderConfigs,
    fetchAllAutoOrderConfigs,
  } = useSubscription();
  useAddress();

  // Get the active subscription object (not just summary)
  const getActiveSubscriptionFull = (): Subscription | null => {
    return subscriptions.find(s => s.status === 'ACTIVE') || null;
  };

  const activeSubFull = getActiveSubscriptionFull();

  // Derived auto-order state
  const activeConfigCount = autoOrderConfigs.filter(c => c.enabled).length;
  const totalConfigCount = autoOrderConfigs.length;

  // Refresh subscriptions and auto-order configs when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!isGuest) {
        console.log('[AccountScreen] Screen focused, refreshing subscriptions and auto-order configs');
        fetchSubscriptions();
        fetchAllAutoOrderConfigs();
      }
    }, [isGuest, fetchSubscriptions, fetchAllAutoOrderConfigs])
  );

  // Show loading state while fetching subscriptions
  if (loading && !isGuest) {
    return (
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
        {/* Status bar background */}
        <SafeAreaView style={{ backgroundColor: '#ff8800' }} edges={['top']} />
        {/* Header with orange background */}
        <View className="bg-orange-400 pb-6" style={{ position: 'relative', overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}>
          <View className="flex-row items-center justify-between px-5 pt-4 pb-6">
            <View style={{ width: isSmallDevice ? SPACING.iconXl * 1.2 : SPACING.iconXl * 1.45 }}>
              <Image
                source={require('../../assets/icons/Tiffsy.png')}
                style={{
                  width: isSmallDevice ? SPACING.iconXl * 1.2 : SPACING.iconXl * 1.45,
                  height: isSmallDevice ? SPACING.iconXl * 0.7 : SPACING.iconXl * 0.875,
                  borderRadius: 8,
                }}
                resizeMode="contain"
              />
            </View>
            <Text className="text-white text-xl font-bold">My Profile</Text>
            <View style={{ width: isSmallDevice ? SPACING.iconXl * 1.2 : SPACING.iconXl * 1.45 }} />
          </View>
        </View>
        {/* Loading indicator */}
        <View className="flex-1 justify-center items-center bg-white">
          <ActivityIndicator size="large" color="#ff8800" />
          <Text className="mt-4 text-gray-600">Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Get nearest expiry date from usable vouchers (AVAILABLE or RESTORED)
  const getNearestVoucherExpiry = () => {
    const usableVouchersList = vouchers.filter(v => v.status === 'AVAILABLE' || v.status === 'RESTORED');
    if (usableVouchersList.length === 0) return null;

    // Sort by expiry date ascending and get the nearest
    const sorted = [...usableVouchersList].sort(
      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
    );
    return sorted[0]?.expiryDate || null;
  };

  // Format expiry date
  const formatExpiryDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    return `${day}${getDaySuffix(day)} ${month} ${year}`;
  };

  const getDaySuffix = (day: number) => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleGuestLogin = async () => {
    // Exit guest mode - AppNavigator will automatically show Auth flow
    await exitGuestMode();
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirmModal(true);
  };


  const confirmDeleteAccount = async () => {
    setShowDeleteConfirmModal(false);

    // OFFLINE MODE: Simulate successful account deletion
    if (OFFLINE_MODE) {
      console.log('[OFFLINE MODE] Simulating account deletion');
      setModalTitle('Account Deletion Scheduled');
      setModalMessage('Your account will be deleted in 10 days. (OFFLINE MODE)');
      setShouldLogoutOnClose(true);
      setShowSuccessModal(true);
      return;
    }

    /* BACKEND CODE - Uncomment when backend is ready
    try {
      const response: any = await apiService.deleteAccount();
      if (response.success) {
        setModalTitle('Account Deletion Scheduled');
        setModalMessage(response.message || 'Your account will be deleted in 10 days.');
        setShouldLogoutOnClose(true);
        setShowSuccessModal(true);
      } else {
        setModalMessage(response.message || 'Failed to delete account');
        setShowErrorModal(true);
      }
    } catch (error: any) {
      console.error('Delete account error:', error);
      setModalMessage(error.message || 'Failed to delete account. Please try again.');
      setShowErrorModal(true);
    }
    */
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    if (shouldLogoutOnClose) {
      logout();
      setShouldLogoutOnClose(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
      {/* Status bar background */}
      <SafeAreaView style={{ backgroundColor: '#ff8800' }} edges={['top']} />

      <ScrollView className="flex-1 bg-white" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View className="bg-orange-400 pb-6" style={{ position: 'relative', overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}>
          {/* Decorative Background Elements */}
          <Image
            source={require('../../assets/images/homepage/halfcircle.png')}
            style={{ position: 'absolute', top: -90, right: -125, width: 300, height: 380 }}
            resizeMode="contain"
          />
          <Image
            source={require('../../assets/images/homepage/halfline.png')}
            style={{ position: 'absolute', top: 30, right: -150, width: 380, height: 150 }}
            resizeMode="contain"
          />

          <View className="flex-row items-center justify-between px-5 pt-4 pb-6">
            {/* Logo */}
            <View style={{ width: isSmallDevice ? SPACING.iconXl * 1.2 : SPACING.iconXl * 1.45 }}>
              <Image
                source={require('../../assets/icons/Tiffsy.png')}
                style={{
                  width: isSmallDevice ? SPACING.iconXl * 1.2 : SPACING.iconXl * 1.45,
                  height: isSmallDevice ? SPACING.iconXl * 0.7 : SPACING.iconXl * 0.875,
                  borderRadius: 8,
                }}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>
              My Profile
            </Text>

            {/* Voucher Button */}
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
                source={require('../../assets/icons/voucher5.png')}
                style={{ width: SPACING.iconSm + 2, height: SPACING.iconSm + 2 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: 'bold', color: '#ff8800' }}>{usableVouchers}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* White Container with Profile and Voucher */}
        <View className="bg-white px-5" style={{ marginTop: 10, paddingTop: 10, paddingBottom: 16 }}>
          {isGuest ? (
            /* Guest User - Login Prompt */
            <View className="mb-6" style={{
              backgroundColor: 'rgba(255, 245, 242, 1)',
              borderRadius: 20,
              padding: 24,
              borderWidth: 2,
              borderColor: '#ff8800',
            }}>
              <View className="items-center mb-4">
                <Image
                  source={require('../../assets/images/myaccount/user2.png')}
                  style={{
                    width: SPACING.iconXl * 2,
                    height: SPACING.iconXl * 2,
                    borderRadius: SPACING.iconXl,
                    opacity: 0.7
                  }}
                  resizeMode="cover"
                />
              </View>
              <Text className="text-xl font-bold text-gray-900 text-center mb-2">
                Welcome, Guest!
              </Text>
              <Text className="text-sm text-gray-600 text-center mb-6" style={{ lineHeight: 20 }}>
                Login or register to unlock personalized meal plans, save addresses, track orders, and much more!
              </Text>
              <TouchableOpacity
                onPress={handleGuestLogin}
                className="bg-orange-400 rounded-full py-3 items-center shadow-lg"
                style={{
                  shadowColor: '#ff8800',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Text className="text-white font-bold text-base">Login / Register</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Authenticated User - Profile Section */
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center">
                {user?.profileImage ? (
                  <Image
                    source={{ uri: user.profileImage }}
                    style={{
                      width: SPACING.iconXl * 1.75,
                      height: SPACING.iconXl * 1.75,
                      borderRadius: SPACING.iconXl * 0.875
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={require('../../assets/images/myaccount/user2.png')}
                    style={{
                      width: SPACING.iconXl * 1.75,
                      height: SPACING.iconXl * 1.75,
                      borderRadius: SPACING.iconXl * 0.875
                    }}
                    resizeMode="cover"
                  />
                )}
                <View style={{ marginLeft: SPACING.lg + 4 }}>
                  <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827' }}>
                    {user?.name || 'User'}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: 2 }}>
                    {user?.phone || 'No phone'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
                <Image
                  source={require('../../assets/icons/edit.png')}
                  style={{ width: SPACING.iconLg + 4, height: SPACING.iconLg + 4 }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Voucher Card - Only for authenticated users */}
          {!isGuest && (
          <View style={{ borderRadius: 25, overflow: 'hidden' }}>
          <Image
            source={require('../../assets/images/myaccount/voucherbackgound.png')}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <View style={{ padding: 20 }}>
            {/* Top Row - Icon, Vouchers Count and Buy More Button */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Image
                  source={require('../../assets/icons/voucher4.png')}
                  style={{ width: SPACING.iconXl + 5, height: SPACING.iconXl + 5 }}
                  resizeMode="contain"
                />
                <View style={{ marginLeft: SPACING.md }}>
                  <Text style={{ fontSize: FONT_SIZES.h2, fontWeight: 'bold', color: '#111827' }}>
                    {usableVouchers}{' '}
                    <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'normal', color: '#374151' }}>
                      vouchers
                    </Text>
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                className="bg-white rounded-full"
                style={{
                  paddingHorizontal: SPACING.lg,
                  paddingVertical: SPACING.sm,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2
                }}
                onPress={() => navigation.navigate('MealPlans')}
              >
                <Text style={{ color: '#ff8800', fontWeight: '600', fontSize: FONT_SIZES.sm }}>
                  Buy More
                </Text>
              </TouchableOpacity>
            </View>

            {/* Description Text */}
            <Text className="text-sm text-gray-600 mb-4" style={{ lineHeight: 20 }}>
              {activeSubscription && activeSubscription.planName
                ? `Active plan: ${activeSubscription.planName}`
                : 'Purchase a plan to get vouchers for your meals.'}
            </Text>

            {/* Validity Section - Show if we have activeSubscription with expiry OR available vouchers */}
            {(() => {
              // Always get the nearest expiry date from available vouchers
              const nearestExpiry = getNearestVoucherExpiry();

              if (!nearestExpiry) return null;

              // Count vouchers expiring on this specific date
              const vouchersExpiringOnDate = vouchers.filter(
                v => (v.status === 'AVAILABLE' || v.status === 'RESTORED') &&
                     new Date(v.expiryDate).toDateString() === new Date(nearestExpiry).toDateString()
              ).length;

              if (vouchersExpiringOnDate === 0) return null;

              return (
                <>
                  <View className="flex-row items-center mb-2">
                    <View className="flex-1" style={{ height: 1, backgroundColor: 'rgba(243, 243, 243, 1)' }} />
                    <Text className="text-xs font-semibold px-3" style={{ color: 'rgba(59, 59, 59, 1)' }}>Validity</Text>
                    <View className="flex-1" style={{ height: 1, backgroundColor: 'rgba(243, 243, 243, 1)' }} />
                  </View>

                  <View className="mb-2">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View className="w-2 h-2 rounded-full bg-orange-400 mr-2" />
                        <Text className="text-sm text-gray-700">{vouchersExpiringOnDate} voucher{vouchersExpiringOnDate > 1 ? 's' : ''} expire{vouchersExpiringOnDate === 1 ? 's' : ''}</Text>
                      </View>
                      <Text className="text-sm font-semibold text-gray-900">{formatExpiryDate(nearestExpiry)}</Text>
                    </View>
                  </View>
                </>
              );
            })()}

            {/* Auto-Order Status Card - Show if there are active configs */}
            {activeConfigCount > 0 && (
              <View className="mt-3 rounded-xl p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.6)' }}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons
                      name="refresh-auto"
                      size={20}
                      color="#8B5CF6"
                      style={{ marginRight: 8 }}
                    />
                    <View>
                      <Text className="text-xs text-gray-600">Auto-Order</Text>
                      <Text className="text-sm font-bold" style={{ color: '#8B5CF6' }}>
                        Active for {activeConfigCount} address{activeConfigCount > 1 ? 'es' : ''}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('AutoOrderSettings')}
                    className="px-5 py-2 rounded-full"
                    style={{ backgroundColor: 'white' }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: '#8B5CF6' }}>Settings</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* View All Vouchers Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Vouchers')}
              className="mt-2"
            >
              <Text className="text-sm font-semibold" style={{ color: '#ff8800' }}>
                View All Vouchers →
              </Text>
            </TouchableOpacity>

            {/* Auto-Order and Calendar Buttons */}
            <View className="flex-row justify-between mt-4 mb-4">
              {/* Auto-Order Settings Button */}
              <TouchableOpacity
                onPress={() => navigation.navigate('AutoOrderSettings')}
                className="flex-1 mr-2 bg-white rounded-full py-2.5 items-center"
                style={{
                  borderWidth: 1.5,
                  borderColor: '#ff8800',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Text className="font-semibold text-sm" style={{ color: '#ff8800' }}>
                  Settings
                </Text>
              </TouchableOpacity>

              {/* Meal Calendar Button */}
              <TouchableOpacity
                onPress={() => navigation.navigate('MealCalendar')}
                className="flex-1 ml-2 rounded-full py-2.5 items-center"
                style={{
                  backgroundColor: '#ff8800',
                  shadowColor: '#ff8800',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Text className="text-white font-semibold text-sm">
                  Meal Calendar
                </Text>
              </TouchableOpacity>
            </View>

            {/* Auto Order Status Display */}
            {totalConfigCount > 0 && (
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-gray-900">
                  {activeConfigCount} of {totalConfigCount} address{totalConfigCount > 1 ? 'es' : ''} active
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('AutoOrderSettings')}
                >
                  <Text className="text-sm font-semibold" style={{ color: '#ff8800' }}>
                    Manage →
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          </View>
          )}
        </View>

        {/* Account Section */}
        {(() => {
          const filteredAccountItems = ACCOUNT_MENU_ITEMS.filter(item => {
            // Filter by auth requirement
            if (item.authRequired && isGuest) return false;
            return true;
          });

          return (
            <View className="px-5 mb-3">
              <Text style={{ fontSize: FONT_SIZES.h4, fontWeight: 'bold', color: '#111827', marginBottom: SPACING.md }}>
                Account
              </Text>
              <View className="bg-white rounded-2xl overflow-hidden">
                {filteredAccountItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    className="flex-row items-center justify-between pl-3 pr-5 py-3"
                    onPress={() => {
                      navigation.navigate(item.route as any);
                    }}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="rounded-full bg-orange-400 items-center justify-center"
                        style={{ width: SPACING.iconXl, height: SPACING.iconXl }}
                      >
                        <Image
                          source={item.icon}
                          style={{
                            width: item.id === 'autoordersettings' ? SPACING.iconSize :
                                  (item.id === 'mealplans' ? SPACING.iconLg + 8 : SPACING.iconLg + 4),
                            height: item.id === 'autoordersettings' ? SPACING.iconSize :
                                   (item.id === 'mealplans' ? SPACING.iconLg + 8 : SPACING.iconLg + 4),
                            tintColor: item.id === 'autoordersettings' ? '#FFFFFF' : undefined
                          }}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '500', color: '#111827', marginLeft: SPACING.md }}>
                        {item.label}
                      </Text>
                    </View>
                    <Text style={{ color: '#9CA3AF', fontSize: FONT_SIZES.h2 }}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })()}

        {/* Support Section */}
        {(() => {
          const filteredSupportItems = SUPPORT_MENU_ITEMS.filter(item => {
            // Filter by auth requirement
            if (item.authRequired && isGuest) return false;
            return true;
          });

          return (
            <View className="px-5 mb-6">
              <Text style={{ fontSize: FONT_SIZES.h4, fontWeight: 'bold', color: '#111827', marginBottom: SPACING.md }}>
                Support
              </Text>
              <View className="bg-white rounded-2xl overflow-hidden">
                {filteredSupportItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    className="flex-row items-center justify-between pl-3 pr-5 py-3"
                    onPress={() => navigation.navigate(item.route)}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="rounded-full bg-orange-400 items-center justify-center"
                        style={{ width: SPACING.iconXl, height: SPACING.iconXl }}
                      >
                        <Image
                          source={item.icon}
                          style={{ width: SPACING.iconLg, height: SPACING.iconLg }}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '500', color: '#111827', marginLeft: SPACING.md }}>
                        {item.label}
                      </Text>
                    </View>
                    <Text style={{ color: '#9CA3AF', fontSize: FONT_SIZES.h2 }}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })()}

        {/* Logout Button - Only for authenticated users */}
        {!isGuest && (
        <View className="px-5 mb-2">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-orange-400 rounded-full items-center shadow-lg"
            style={{ paddingVertical: SPACING.lg }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: FONT_SIZES.lg }}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
        )}

        {/* Delete Account Button - Only for authenticated users */}
        {!isGuest && (
        <View className="px-5 mb-2">
          <TouchableOpacity
            onPress={handleDeleteAccount}
            className="bg-white rounded-full items-center"
            style={{
              borderWidth: 2,
              borderColor: '#ff8800',
              paddingVertical: SPACING.lg,
            }}
          >
            <Text style={{ fontWeight: 'bold', fontSize: FONT_SIZES.lg, color: '#ff8800' }}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>
        )}
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteConfirmModal}
        title="Delete Account"
        message="Are you sure you want to delete your account? Your account will be scheduled for deletion in 10 days."
        confirmText="Delete"
        cancelText="Cancel"
        confirmStyle="danger"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setShowDeleteConfirmModal(false)}
      />

      {/* Success Modal */}
      <InfoModal
        visible={showSuccessModal}
        title={modalTitle}
        message={modalMessage}
        buttonText="OK"
        type="success"
        onClose={handleSuccessModalClose}
      />

      {/* Error Modal */}
      <InfoModal
        visible={showErrorModal}
        title="Error"
        message={modalMessage}
        buttonText="OK"
        type="error"
        onClose={() => setShowErrorModal(false)}
      />

    </View>
  );
};

export default AccountScreen;
