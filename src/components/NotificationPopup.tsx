import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { NotificationData } from '../context/NotificationContext';
import { NotificationType } from '../constants/notificationTypes';

interface NotificationPopupProps {
  visible: boolean;
  notification: NotificationData | null;
  onDismiss: () => void;
  onView: () => void;
}

const NotificationPopup: React.FC<NotificationPopupProps> = ({
  visible,
  notification,
  onDismiss,
  onView,
}) => {
  // Auto-dismiss after 10 seconds (increased from 5s for better UX)
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [visible, onDismiss]);

  if (!notification) return null;

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
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Get icon based on notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      // Order notifications
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
      case NotificationType.AUTO_ORDER_SUCCESS:
        return { iconName: 'checkmark-circle', iconType: 'Ionicons', color: '#10B981' };
      case NotificationType.AUTO_ORDER_FAILED:
        return { iconName: 'warning', iconType: 'Ionicons', color: '#EF4444' };
      case NotificationType.ORDER_UPDATE:
        return { iconName: 'package-variant', iconType: 'MaterialCommunityIcons', color: '#D97706' };
      case NotificationType.ORDER_STATUS_CHANGE:
        return { iconName: 'package-variant', iconType: 'MaterialCommunityIcons', color: '#10B981' };

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

      default:
        return { iconName: 'notifications', iconType: 'Ionicons', color: '#6B7280' };
    }
  };

  const iconConfig = getNotificationIcon(notification.type);
  const IconComponent = iconConfig.iconType === 'Ionicons' ? Ionicons : MaterialCommunityIcons;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={styles.container}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.content}>
            {/* Icon and Close Button */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <IconComponent name={iconConfig.iconName} size={24} color={iconConfig.color} />
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={styles.title} numberOfLines={2}>
              {notification.title}
            </Text>

            {/* Body */}
            <Text style={styles.body} numberOfLines={3}>
              {notification.body}
            </Text>

            {/* Timestamp */}
            <Text style={styles.timestamp}>
              {formatTime(notification.createdAt)}
            </Text>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.dismissButton]}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.viewButton]}
                onPress={onView}
                activeOpacity={0.7}
              >
                <Text style={styles.viewButtonText}>View</Text>
              </TouchableOpacity>
            </View>
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
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  container: {
    width: '100%',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  viewButton: {
    backgroundColor: '#ff8800',
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default NotificationPopup;
