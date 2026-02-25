import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { NotificationData } from '../context/NotificationContext';
import { NotificationType, AutoOrderFailureCategory } from '../constants/notificationTypes';

interface NotificationDetailModalProps {
  visible: boolean;
  notification: NotificationData;
  onClose: () => void;
}

type NavigationProp = NativeStackNavigationProp<any>;

const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  visible,
  notification,
  onClose,
}) => {
  const navigation = useNavigation<NavigationProp>();

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get icon based on notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      // Order status notifications
      case NotificationType.ORDER_ACCEPTED:
        return { iconName: 'checkmark-circle', iconType: 'Ionicons', color: '#10B981' };
      case NotificationType.ORDER_PREPARING:
        return { iconName: 'chef-hat', iconType: 'MaterialCommunityIcons', color: '#F59E0B' };
      case NotificationType.ORDER_READY:
        return { iconName: 'food', iconType: 'MaterialCommunityIcons', color: '#10B981' };
      case NotificationType.ORDER_PICKED_UP:
      case NotificationType.ORDER_OUT_FOR_DELIVERY:
        return { iconName: 'car', iconType: 'MaterialCommunityIcons', color: '#3B82F6' };
      case NotificationType.ORDER_DELIVERED:
        return { iconName: 'checkmark-circle', iconType: 'Ionicons', color: '#10B981' };
      case NotificationType.ORDER_CANCELLED:
      case NotificationType.ORDER_REJECTED:
        return { iconName: 'close-circle', iconType: 'Ionicons', color: '#EF4444' };

      // Auto-order notifications
      case NotificationType.AUTO_ORDER_SUCCESS:
        return { iconName: 'checkmark-circle', iconType: 'Ionicons', color: '#10B981' };
      case NotificationType.AUTO_ORDER_FAILED:
        return { iconName: 'warning', iconType: 'Ionicons', color: '#EF4444' };

      // Subscription notifications
      case NotificationType.VOUCHER_EXPIRY_REMINDER:
        return { iconName: 'ticket', iconType: 'MaterialCommunityIcons', color: '#F59E0B' };
      case NotificationType.SUBSCRIPTION_CREATED:
        return { iconName: 'party-popper', iconType: 'MaterialCommunityIcons', color: '#8B5CF6' };

      // General notifications
      case NotificationType.MENU_UPDATE:
        return { iconName: 'chef-hat', iconType: 'MaterialCommunityIcons', color: '#3B82F6' };
      case NotificationType.PROMOTIONAL:
        return { iconName: 'gift', iconType: 'MaterialCommunityIcons', color: '#F59E0B' };
      case NotificationType.ADMIN_PUSH:
        return { iconName: 'notifications', iconType: 'Ionicons', color: '#8B5CF6' };

      // Geofencing order update
      case NotificationType.ORDER_UPDATE:
        return { iconName: 'package-variant', iconType: 'MaterialCommunityIcons', color: '#D97706' };

      // Legacy
      case NotificationType.ORDER_STATUS_CHANGE:
        return { iconName: 'package-variant', iconType: 'MaterialCommunityIcons', color: '#10B981' };

      default:
        return { iconName: 'notifications', iconType: 'Ionicons', color: '#6B7280' };
    }
  };

  // Get action button config based on notification type
  const getActionButton = () => {
    switch (notification.type) {
      // Order status notifications - Track or view order
      case NotificationType.ORDER_ACCEPTED:
      case NotificationType.ORDER_PREPARING:
      case NotificationType.ORDER_READY:
      case NotificationType.ORDER_PICKED_UP:
      case NotificationType.ORDER_OUT_FOR_DELIVERY:
        return {
          label: 'Track Order',
          action: () => {
            onClose();
            if (notification.entityId || notification.data?.orderId) {
              navigation.navigate('OrderTracking', {
                orderId: notification.entityId || notification.data?.orderId,
              });
            }
          },
        };

      case NotificationType.ORDER_DELIVERED:
        return {
          label: 'Rate Order',
          action: () => {
            onClose();
            if (notification.entityId || notification.data?.orderId) {
              navigation.navigate('OrderDetail', {
                orderId: notification.entityId || notification.data?.orderId,
                showRating: true,
              });
            }
          },
        };

      case NotificationType.ORDER_CANCELLED:
      case NotificationType.ORDER_REJECTED:
        return {
          label: 'View Details',
          action: () => {
            onClose();
            if (notification.entityId || notification.data?.orderId) {
              navigation.navigate('OrderDetail', {
                orderId: notification.entityId || notification.data?.orderId,
              });
            }
          },
        };

      // Geofencing order update - view order detail
      case NotificationType.ORDER_UPDATE:
        return {
          label: 'View Order',
          action: () => {
            onClose();
            if (notification.entityId || notification.data?.orderId) {
              navigation.navigate('OrderDetail', {
                orderId: notification.entityId || notification.data?.orderId,
              });
            }
          },
        };

      // Auto-order notifications
      case NotificationType.AUTO_ORDER_SUCCESS:
        return {
          label: 'View Order',
          action: () => {
            onClose();
            if (notification.data?.orderId) {
              navigation.navigate('OrderDetail', {
                orderId: notification.data.orderId,
                orderNumber: notification.data.orderNumber,
              });
            }
          },
        };

      case NotificationType.AUTO_ORDER_FAILED:
        return {
          label: 'Take Action',
          action: () => {
            onClose();
            // Navigate based on failure category
            const category = notification.data?.failureCategory as AutoOrderFailureCategory;
            if (category === AutoOrderFailureCategory.NO_VOUCHERS) {
              navigation.navigate('MealPlans');
            } else if (
              category === AutoOrderFailureCategory.NO_ADDRESS ||
              category === AutoOrderFailureCategory.NO_ZONE
            ) {
              navigation.navigate('Address');
            } else {
              navigation.navigate('Home');
            }
          },
        };

      // Legacy
      case NotificationType.ORDER_STATUS_CHANGE:
        return {
          label: 'View Order',
          action: () => {
            onClose();
            if (notification.entityId) {
              navigation.navigate('OrderDetail', { orderId: notification.entityId });
            }
          },
        };

      case NotificationType.MENU_UPDATE:
        return {
          label: 'Check Menu',
          action: () => {
            onClose();
            // Navigate to kitchen menu if kitchenId is available
            if (notification.data?.kitchenId) {
              navigation.navigate('Home');
            } else {
              navigation.navigate('Home');
            }
          },
        };

      // Subscription notifications
      case NotificationType.VOUCHER_EXPIRY_REMINDER:
        return {
          label: 'Use Vouchers',
          action: () => {
            onClose();
            navigation.navigate('Vouchers');
          },
        };

      case NotificationType.SUBSCRIPTION_CREATED:
        return {
          label: 'View Vouchers',
          action: () => {
            onClose();
            navigation.navigate('Vouchers');
          },
        };

      // General notifications
      case NotificationType.PROMOTIONAL:
        return {
          label: 'View Offer',
          action: () => {
            onClose();
            // Check for custom target screen in notification data
            if (notification.data?.targetScreen) {
              navigation.navigate(notification.data.targetScreen as any);
            } else {
              navigation.navigate('MealPlans');
            }
          },
        };

      case NotificationType.ADMIN_PUSH:
        // Handle custom screen navigation from data.screen
        if (notification.data?.screen) {
          const screenMap: Record<string, string> = {
            SUBSCRIPTIONS: 'MealPlans',
            ORDERS: 'YourOrders',
            VOUCHERS: 'Vouchers',
            HOME: 'Home',
          };

          const targetScreen = screenMap[notification.data.screen] || 'Home';
          return {
            label: 'View Details',
            action: () => {
              onClose();
              navigation.navigate(targetScreen);
            },
          };
        }
        return null;

      default:
        return null;
    }
  };

  const { iconName, iconType, color } = getNotificationIcon(notification.type);
  const actionButton = getActionButton();

  const IconComponent = iconType === 'Ionicons' ? Ionicons : MaterialCommunityIcons;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.container}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.content}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Icon */}
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: `${color}20` },
                ]}
              >
                <IconComponent name={iconName} size={36} color={color} />
              </View>

              {/* Title */}
              <Text style={styles.title}>{notification.title}</Text>

              {/* Body */}
              <Text style={styles.body}>{notification.body}</Text>

              {/* Timestamp */}
              <Text style={styles.timestamp}>
                {formatTime(notification.createdAt)}
              </Text>

              {/* Additional Data (if any) */}
              {notification.type === 'ORDER_STATUS_CHANGE' &&
                notification.data?.orderNumber && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Order Number:</Text>
                    <Text style={styles.infoValue}>
                      {notification.data.orderNumber}
                    </Text>
                  </View>
                )}

              {notification.type === 'VOUCHER_EXPIRY_REMINDER' &&
                notification.data?.voucherCount && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Expiring Vouchers:</Text>
                    <Text style={styles.infoValue}>
                      {notification.data.voucherCount} voucher(s)
                    </Text>
                  </View>
                )}

              {notification.type === 'ADMIN_PUSH' &&
                notification.data?.promoCode && (
                  <View style={styles.promoBox}>
                    <Text style={styles.promoLabel}>Promo Code:</Text>
                    <Text style={styles.promoCode}>
                      {notification.data.promoCode}
                    </Text>
                  </View>
                )}

              {/* Action Button */}
              {actionButton && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={actionButton.action}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionButtonText}>
                    {actionButton.label}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 450,
    maxHeight: '80%',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  scrollContent: {
    paddingTop: 16,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 12,
    textAlign: 'center',
  },
  timestamp: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  promoBox: {
    backgroundColor: '#FEF2F0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  promoLabel: {
    fontSize: 13,
    color: '#ff8800',
    marginBottom: 6,
    fontWeight: '600',
  },
  promoCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff8800',
    letterSpacing: 1,
  },
  actionButton: {
    backgroundColor: '#ff8800',
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default NotificationDetailModal;
