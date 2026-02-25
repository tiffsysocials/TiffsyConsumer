import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationData } from '../../context/NotificationContext';
import NotificationDetailModal from '../../components/NotificationDetailModal';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<any, 'Notifications'>;

const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const {
    notifications,
    isLoading,
    isRefreshing,
    hasMore,
    fetchNotifications,
    refreshNotifications,
    loadMoreNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const { isSmallDevice } = useResponsive();

  const [selectedNotification, setSelectedNotification] = useState<NotificationData | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch notifications on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchNotifications(1);
    }, [fetchNotifications])
  );

  // Handle pull to refresh
  const handleRefresh = useCallback(async () => {
    await refreshNotifications();
  }, [refreshNotifications]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadMoreNotifications();
    }
  }, [isLoading, hasMore, loadMoreNotifications]);

  // Handle notification tap
  const handleNotificationPress = useCallback(
    async (notification: NotificationData) => {
      setSelectedNotification(notification);
      setShowDetailModal(true);

      // Mark as read if unread
      if (!notification.isRead) {
        await markAsRead(notification._id);
      }
    },
    [markAsRead]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (notificationId: string) => {
      Alert.alert(
        'Delete Notification',
        'Are you sure you want to delete this notification?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteNotification(notificationId);
            },
          },
        ]
      );
    },
    [deleteNotification]
  );

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get icon based on notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'MENU_UPDATE':
        return { iconName: 'chef-hat', iconType: 'MaterialCommunityIcons', color: '#3B82F6' };
      case 'ORDER_STATUS_CHANGE':
        return { iconName: 'package-variant', iconType: 'MaterialCommunityIcons', color: '#10B981' };
      case 'ORDER_UPDATE':
        return { iconName: 'package-variant', iconType: 'MaterialCommunityIcons', color: '#D97706' };
      case 'VOUCHER_EXPIRY_REMINDER':
        return { iconName: 'ticket', iconType: 'MaterialCommunityIcons', color: '#F59E0B' };
      case 'ADMIN_PUSH':
        return { iconName: 'notifications', iconType: 'Ionicons', color: '#8B5CF6' };
      default:
        return { iconName: 'notifications', iconType: 'Ionicons', color: '#ff8800' };
    }
  };

  // Render swipeable delete action
  const renderRightActions = (notificationId: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDelete(notificationId)}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  // Render notification item
  const renderNotificationItem = ({ item }: { item: NotificationData }) => {
    const { iconName, iconType, color } = getNotificationIcon(item.type);
    const IconComponent = iconType === 'Ionicons' ? Ionicons : MaterialCommunityIcons;

    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item._id)}
        overshootRight={false}
      >
        <TouchableOpacity
          style={[
            styles.notificationItem,
            !item.isRead && styles.unreadNotification,
          ]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.7}
        >
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
            <IconComponent name={iconName} size={24} color={color} />
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            {/* Title and Timestamp */}
            <View style={styles.headerRow}>
              <Text
                style={[
                  styles.title,
                  !item.isRead && styles.unreadTitle,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {!item.isRead && <View style={styles.unreadDot} />}
            </View>

            {/* Body */}
            <Text style={styles.body} numberOfLines={2}>
              {item.body}
            </Text>

            {/* Timestamp */}
            <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="notifications-outline" size={64} color="#D1D5DB" />
        </View>
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptyMessage}>
          We'll notify you when there's something new!
        </Text>
      </View>
    );
  };

  // Render footer loading indicator
  const renderFooter = () => {
    if (!hasMore || isLoading) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#ff8800" />
      </View>
    );
  };

  const hasUnreadNotifications = notifications.some((n) => !n.isRead);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Notifications</Text>

        {hasUnreadNotifications && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}

        {!hasUnreadNotifications && <View style={styles.placeholder} />}
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderNotificationItem}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#ff8800']}
            tintColor="#ff8800"
          />
        }
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyList : styles.list
        }
      />

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <NotificationDetailModal
          visible={showDetailModal}
          notification={selectedNotification}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedNotification(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ff8800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'left',
    marginLeft: SPACING.sm,
  },
  markAllButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    minHeight: TOUCH_TARGETS.minimum,
    justifyContent: 'center',
  },
  markAllText: {
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
    color: '#ff8800',
  },
  placeholder: {
    width: SPACING['4xl'] * 2,
  },
  list: {
    paddingVertical: SPACING.sm,
  },
  emptyList: {
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: SPACING.lg,
    backgroundColor: '#F3F4F6',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
    borderRadius: SPACING.md,
    minHeight: TOUCH_TARGETS.large,
  },
  unreadNotification: {
    backgroundColor: 'white',
  },
  iconContainer: {
    width: SPACING['3xl'],
    height: SPACING['3xl'],
    borderRadius: SPACING['3xl'] / 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    flex: 1,
    fontSize: FONT_SIZES.h4,
    fontWeight: '600',
    color: '#1F2937',
  },
  unreadTitle: {
    fontWeight: 'bold',
  },
  unreadDot: {
    width: SPACING.sm,
    height: SPACING.sm,
    borderRadius: SPACING.sm / 2,
    backgroundColor: '#3B82F6',
    marginLeft: SPACING.sm,
  },
  body: {
    fontSize: FONT_SIZES.base,
    color: '#6B7280',
    lineHeight: FONT_SIZES.base * 1.4,
    marginBottom: SPACING.xs,
  },
  timestamp: {
    fontSize: FONT_SIZES.xs,
    color: '#9CA3AF',
  },
  deleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: SPACING['4xl'] * 2,
    marginVertical: SPACING.xs,
    marginRight: SPACING.md,
    borderRadius: SPACING.md,
    minHeight: TOUCH_TARGETS.large,
  },
  deleteActionText: {
    color: 'white',
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING['2xl'],
  },
  emptyIconContainer: {
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.h3,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: FONT_SIZES.base,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: FONT_SIZES.base * 1.4,
  },
  footerLoader: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
});

export default NotificationsScreen;
