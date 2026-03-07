import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import { useAlert } from '../../context/AlertContext';
import apiService, { ScheduledMealListItem } from '../../services/api.service';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useResponsive, useScaling } from '../../hooks/useResponsive';
import { SPACING } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'MyScheduledMeals'>;

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  PENDING_KITCHEN_ACCEPTANCE: { text: '#B45309', bg: '#FEF3C7' },
  SCHEDULED: { text: '#1D4ED8', bg: '#DBEAFE' },
  PLACED: { text: '#B45309', bg: '#FEF3C7' },
  ACCEPTED: { text: '#047857', bg: '#D1FAE5' },
  PREPARING: { text: '#047857', bg: '#D1FAE5' },
  READY: { text: '#047857', bg: '#D1FAE5' },
  PICKED_UP: { text: '#0F766E', bg: '#CCFBF1' },
  OUT_FOR_DELIVERY: { text: '#0F766E', bg: '#CCFBF1' },
  DELIVERED: { text: '#4B5563', bg: '#F3F4F6' },
  CANCELLED: { text: '#DC2626', bg: '#FEE2E2' },
};

const CANCELLABLE_STATUSES = ['SCHEDULED', 'PENDING_KITCHEN_ACCEPTANCE', 'PLACED'];

const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mealDate = new Date(date);
  mealDate.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (mealDate.getTime() === today.getTime()) return 'Today';
  if (mealDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
};

const MyScheduledMealsScreen: React.FC<Props> = ({ navigation }) => {
  const { width } = useResponsive();
  const { scale } = useScaling();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [meals, setMeals] = useState<ScheduledMealListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelMealId, setCancelMealId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchMeals = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      const response = await apiService.getMyScheduledMeals({ page: pageNum, limit: 10 });
      if (response.success) {
        // Filter out past meals (before today)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const filtered = response.data.meals.filter(m => new Date(m.scheduledFor) >= todayStart);

        if (isRefresh || pageNum === 1) {
          setMeals(filtered);
        } else {
          setMeals(prev => [...prev, ...filtered]);
        }
        setTotalPages(response.data.pagination.pages);
        setPage(pageNum);
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to load scheduled meals', undefined, 'error');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchMeals(1, true);
    }, [fetchMeals])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMeals(1, true);
  }, [fetchMeals]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || page >= totalPages) return;
    setIsLoadingMore(true);
    fetchMeals(page + 1);
  }, [isLoadingMore, page, totalPages, fetchMeals]);

  const handleCancelPress = useCallback((mealId: string) => {
    setCancelMealId(mealId);
    setCancelReason('');
    setShowCancelModal(true);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelMealId) return;

    setIsCancelling(true);
    try {
      const response = await apiService.cancelScheduledMeal(
        cancelMealId,
        cancelReason.trim() || undefined
      );
      if (response.success) {
        setShowCancelModal(false);
        setCancelMealId(null);
        setCancelReason('');

        let message = 'Your scheduled meal has been cancelled.';
        if (response.data.refundInitiated) {
          message = 'Your scheduled meal has been cancelled and a refund has been initiated.';
        }
        if (response.data.vouchersRestored && response.data.vouchersRestored > 0) {
          message += ` ${response.data.vouchersRestored} voucher${response.data.vouchersRestored > 1 ? 's' : ''} restored.`;
        }

        showAlert('Cancelled', message, undefined, 'success');

        // Refresh the list
        setIsLoading(true);
        fetchMeals(1, true);
      } else {
        showAlert('Error', response.message || 'Failed to cancel meal', undefined, 'error');
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to cancel meal', undefined, 'error');
    } finally {
      setIsCancelling(false);
    }
  }, [cancelMealId, cancelReason, showAlert, fetchMeals]);

  const renderStatusBadge = (status: string) => {
    const colors = STATUS_COLORS[status] || STATUS_COLORS.DELIVERED;
    return (
      <View style={{
        backgroundColor: colors.bg,
        borderRadius: 6,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
      }}>
        <Text style={{
          fontSize: FONT_SIZES.xs,
          fontWeight: '600',
          color: colors.text,
          textTransform: 'capitalize',
        }}>
          {status.replace(/_/g, ' ').toLowerCase()}
        </Text>
      </View>
    );
  };

  const renderMealCard = ({ item }: { item: ScheduledMealListItem }) => {
    const thaliName = item.items?.[0]?.name || 'Thali Meal';
    const isCancellable = CANCELLABLE_STATUSES.includes(item.status);

    return (
      <View style={{
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      }}>
        <View style={{ padding: SPACING.lg }}>
          {/* Row 1: Thali Name + Badges */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm }}>
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', flex: 1, marginRight: SPACING.sm }} numberOfLines={1}>
              {thaliName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {item.orderSource === 'AUTO_ORDER' && (
                <View style={{ backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: SPACING.sm, paddingVertical: 2 }}>
                  <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: '#7C3AED' }}>Auto-Order</Text>
                </View>
              )}
              {renderStatusBadge(item.status)}
            </View>
          </View>

          {/* Row 2: Delivery Address */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color="#6B7280" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }} numberOfLines={1}>
              {item.deliveryAddress?.addressLine1}{item.deliveryAddress?.locality ? `, ${item.deliveryAddress.locality}` : ''}
            </Text>
          </View>

          {/* Row 3: Date + Meal Window */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
            <MaterialCommunityIcons name="calendar-outline" size={14} color="#6B7280" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563', fontWeight: '500' }}>
              {formatDate(item.scheduledFor)}
            </Text>
            <View style={{
              marginLeft: SPACING.sm,
              backgroundColor: item.mealWindow === 'LUNCH' ? '#FEF3C7' : '#E0E7FF',
              borderRadius: 6,
              paddingHorizontal: SPACING.xs + 2,
              paddingVertical: 1,
            }}>
              <Text style={{
                fontSize: 10,
                fontWeight: '600',
                color: item.mealWindow === 'LUNCH' ? '#92400E' : '#3730A3',
              }}>
                {item.mealWindow === 'LUNCH' ? '☀️ Lunch' : '🌙 Dinner'}
              </Text>
            </View>
          </View>

          {/* Row 4: Order Number + Price */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF' }}>#{item.orderNumber}</Text>
              {item.voucherUsage && item.voucherUsage.voucherCount > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: SPACING.sm }}>
                  <MaterialCommunityIcons name="ticket-confirmation-outline" size={12} color="#10B981" style={{ marginRight: 2 }} />
                  <Text style={{ fontSize: FONT_SIZES.xs, color: '#10B981', fontWeight: '500' }}>{item.voucherUsage.voucherCount} voucher</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937' }}>₹{item.grandTotal}</Text>
          </View>

          {/* Cancel Button */}
          {isCancellable && (
            <TouchableOpacity
              onPress={() => handleCancelPress(item._id)}
              style={{
                marginTop: SPACING.md,
                borderWidth: 1,
                borderColor: '#FCA5A5',
                borderRadius: 10,
                paddingVertical: SPACING.sm,
                alignItems: 'center',
                backgroundColor: '#FFF5F5',
              }}
            >
              <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#DC2626' }}>Cancel Meal</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING['5xl'] * 2, paddingHorizontal: SPACING.xl }}>
      <MaterialCommunityIcons name="calendar-blank-outline" size={64} color="#D1D5DB" />
      <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: '600', color: '#374151', marginTop: SPACING.lg, textAlign: 'center' }}>
        No Scheduled Meals
      </Text>
      <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: SPACING.sm, textAlign: 'center' }}>
        Schedule a thali meal for an upcoming day
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('MealCalendar')}
        style={{
          marginTop: SPACING.xl,
          backgroundColor: '#FE8733',
          borderRadius: 12,
          paddingVertical: SPACING.md,
          paddingHorizontal: SPACING['2xl'],
        }}
      >
        <Text style={{ color: 'white', fontSize: FONT_SIZES.base, fontWeight: '600' }}>Schedule a Meal</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={{ paddingVertical: SPACING.lg, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#FE8733" />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6636" />
      <SafeAreaView style={{ backgroundColor: '#FF6636' }} edges={['top']} />

      {/* Header */}
      <View style={{ backgroundColor: '#FF6636', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1 }}>Scheduled Meals</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('MealCalendar')}
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 10,
            paddingHorizontal: SPACING.sm + 2,
            paddingVertical: SPACING.xs,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <MaterialCommunityIcons name="plus" size={16} color="white" style={{ marginRight: 4 }} />
          <Text style={{ color: 'white', fontSize: FONT_SIZES.xs, fontWeight: '600' }}>New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FE8733" />
          <Text style={{ marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: '#6B7280' }}>Loading scheduled meals...</Text>
        </View>
      ) : (
        <FlatList
          data={meals}
          keyExtractor={item => item._id}
          renderItem={renderMealCard}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#FE8733']} />
          }
          contentContainerStyle={{
            paddingTop: SPACING.lg,
            paddingBottom: SPACING['4xl'] + insets.bottom,
            ...(meals.length === 0 && { flex: 1 }),
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        visible={showCancelModal}
        title="Cancel Scheduled Meal?"
        message="Are you sure you want to cancel this meal? If you've already paid, a refund will be initiated."
        confirmText={isCancelling ? 'Cancelling...' : 'Cancel Meal'}
        cancelText="Keep It"
        onConfirm={handleConfirmCancel}
        onCancel={() => { setShowCancelModal(false); setCancelMealId(null); setCancelReason(''); }}
        confirmStyle="danger"
      />
    </View>
  );
};

export default MyScheduledMealsScreen;
