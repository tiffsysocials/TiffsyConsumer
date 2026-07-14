import React, { useState, useCallback, useRef } from 'react';
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
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
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
  // Total thalis on the meal being cancelled, and how many to cancel
  // (defaults to all = full cancel; a lower value = partial cancel).
  const [cancelMealQty, setCancelMealQty] = useState(1);
  const [cancelQty, setCancelQty] = useState(1);

  // Tracks whether data has loaded at least once, so refocusing the screen
  // refreshes silently instead of blanking the list to a spinner. A ref (not
  // state) on purpose — state in the focus callback deps would re-run the
  // effect mid-focus when data lands.
  const hasLoadedOnceRef = useRef(false);

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
        hasLoadedOnceRef.current = true;
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
      // Spinner only before the first load; later focuses refresh silently.
      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
      }
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

  const handleCancelPress = useCallback((meal: ScheduledMealListItem) => {
    const mainItem = meal.items?.find(i => i.isMainCourse) || meal.items?.[0];
    const qty = mainItem?.quantity || 1;
    setCancelMealId(meal._id);
    setCancelMealQty(qty);
    setCancelQty(qty); // default: cancel all
    setCancelReason('');
    setShowCancelModal(true);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelMealId) return;

    // Partial when cancelling fewer thalis than the meal has.
    const isPartial = cancelQty < cancelMealQty;

    setIsCancelling(true);
    try {
      const response = await apiService.cancelScheduledMeal(
        cancelMealId,
        cancelReason.trim() || undefined,
        isPartial ? cancelQty : undefined
      );
      if (response.success) {
        setShowCancelModal(false);
        setCancelMealId(null);
        setCancelReason('');

        let message = isPartial
          ? `Reduced by ${cancelQty} thali${cancelQty > 1 ? 's' : ''}. ${response.data.newQuantity} remaining.`
          : 'Your scheduled meal has been cancelled.';
        if (response.data.refundInitiated) {
          message += ' A refund has been initiated.';
        }
        if (response.data.vouchersRestored && response.data.vouchersRestored > 0) {
          message += ` ${response.data.vouchersRestored} voucher${response.data.vouchersRestored > 1 ? 's' : ''} restored.`;
        }

        showAlert(isPartial ? 'Updated' : 'Cancelled', message, undefined, 'success');

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
  }, [cancelMealId, cancelQty, cancelMealQty, cancelReason, showAlert, fetchMeals]);

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
    const mainItem = item.items?.find(i => i.isMainCourse) || item.items?.[0];
    const thaliName = mainItem?.name || 'Thali Meal';
    const thaliQty = mainItem?.quantity || 1;
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
              {thaliName}{thaliQty > 1 ? `  ×${thaliQty}` : ''}
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
              onPress={() => handleCancelPress(item)}
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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#FD9E2F', '#FF6636']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'relative', overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 24 }}>
        <SafeAreaView edges={['top']}>
          <View className="flex-row items-center justify-between px-5 pt-4 pb-6">
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1, textAlign: 'center' }} numberOfLines={1}>Scheduled Meals</Text>
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
        </SafeAreaView>
      </LinearGradient>

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
        title={cancelMealQty > 1 ? 'Cancel Thalis?' : 'Cancel Scheduled Meal?'}
        message={
          cancelMealQty > 1
            ? 'Choose how many thalis to cancel. Any paid amount and used vouchers for the cancelled thalis will be refunded/restored.'
            : "Are you sure you want to cancel this meal? If you've already paid, a refund will be initiated."
        }
        confirmText={
          isCancelling
            ? 'Cancelling...'
            : cancelQty < cancelMealQty
              ? `Cancel ${cancelQty} Thali${cancelQty > 1 ? 's' : ''}`
              : 'Cancel Meal'
        }
        cancelText="Keep It"
        onConfirm={handleConfirmCancel}
        onCancel={() => { setShowCancelModal(false); setCancelMealId(null); setCancelReason(''); }}
        confirmStyle="danger"
      >
        {cancelMealQty > 1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZES.sm, color: '#4B5563', fontWeight: '500' }}>Thalis to cancel</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setCancelQty(q => Math.max(1, q - 1))}
                disabled={cancelQty <= 1}
                style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', opacity: cancelQty <= 1 ? 0.4 : 1 }}
              >
                <MaterialCommunityIcons name="minus" size={18} color="#EF4444" />
              </TouchableOpacity>
              <Text style={{ marginHorizontal: SPACING.md, fontSize: FONT_SIZES.base, fontWeight: '700', color: '#1F2937', minWidth: 36, textAlign: 'center' }}>
                {cancelQty} / {cancelMealQty}
              </Text>
              <TouchableOpacity
                onPress={() => setCancelQty(q => Math.min(cancelMealQty, q + 1))}
                disabled={cancelQty >= cancelMealQty}
                style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', opacity: cancelQty >= cancelMealQty ? 0.4 : 1 }}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ConfirmationModal>
    </View>
  );
};

export default MyScheduledMealsScreen;
