import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AutoOrderFailureCategory } from '../constants/notificationTypes';

interface AutoOrderFailureModalProps {
  visible: boolean;
  failureCategory: AutoOrderFailureCategory;
  mealWindow: 'LUNCH' | 'DINNER';
  message?: string;
  onClose: () => void;
}

type NavigationProp = NativeStackNavigationProp<any>;

interface CategoryContent {
  iconName: string;
  iconType: 'Ionicons' | 'MaterialCommunityIcons';
  title: string;
  message: string;
  primaryAction: {
    label: string;
    onPress: () => void;
  };
  secondaryAction: {
    label: string;
    onPress: () => void;
  } | null;
}

const AutoOrderFailureModal: React.FC<AutoOrderFailureModalProps> = ({
  visible,
  failureCategory,
  mealWindow,
  message: customMessage,
  onClose,
}) => {
  const navigation = useNavigation<NavigationProp>();

  // Get category-specific content
  const getCategoryContent = (): CategoryContent => {
    const mealText = mealWindow.toLowerCase();

    switch (failureCategory) {
      case AutoOrderFailureCategory.NO_VOUCHERS:
        return {
          iconName: 'ticket',
          iconType: 'MaterialCommunityIcons',
          title: 'No Vouchers Available',
          message: customMessage || `You don't have any vouchers for ${mealText}. Buy a subscription to continue receiving automatic orders.`,
          primaryAction: {
            label: 'Buy Subscription',
            onPress: () => {
              onClose();
              navigation.navigate('MealPlans');
            },
          },
          secondaryAction: {
            label: 'Order Manually',
            onPress: () => {
              onClose();
              navigation.navigate('Home');
            },
          },
        };

      case AutoOrderFailureCategory.NO_ADDRESS:
        return {
          iconName: 'map-marker',
          iconType: 'MaterialCommunityIcons',
          title: 'No Delivery Address',
          message: customMessage || 'Please add a delivery address to enable automatic orders.',
          primaryAction: {
            label: 'Add Address',
            onPress: () => {
              onClose();
              navigation.navigate('Address');
            },
          },
          secondaryAction: null,
        };

      case AutoOrderFailureCategory.NO_ZONE:
        return {
          iconName: 'map',
          iconType: 'MaterialCommunityIcons',
          title: 'Address Not Serviceable',
          message: customMessage || 'Your current address is outside our delivery zone. Please update your address to a serviceable location.',
          primaryAction: {
            label: 'Update Address',
            onPress: () => {
              onClose();
              navigation.navigate('Address');
            },
          },
          secondaryAction: {
            label: 'Check Service Areas',
            onPress: () => {
              onClose();
              // Navigate to home (or service areas info if that screen exists)
              navigation.navigate('Home');
            },
          },
        };

      case AutoOrderFailureCategory.NO_KITCHEN:
        return {
          iconName: 'chef-hat',
          iconType: 'MaterialCommunityIcons',
          title: 'No Kitchen Available',
          message: customMessage || `No kitchen is available for ${mealText} in your area. We'll try again for the next meal.`,
          primaryAction: {
            label: 'Order Manually',
            onPress: () => {
              onClose();
              navigation.navigate('Home');
            },
          },
          secondaryAction: null,
        };

      case AutoOrderFailureCategory.NO_MENU_ITEM:
        return {
          iconName: 'clipboard-text',
          iconType: 'MaterialCommunityIcons',
          title: 'Menu Not Available',
          message: customMessage || `The ${mealText} menu is not available yet. We'll try again when the menu is ready.`,
          primaryAction: {
            label: 'Check Menu',
            onPress: () => {
              onClose();
              navigation.navigate('Home');
            },
          },
          secondaryAction: null,
        };

      case AutoOrderFailureCategory.VOUCHER_REDEMPTION_FAILED:
        return {
          iconName: 'warning',
          iconType: 'Ionicons',
          title: 'Voucher Issue',
          message: customMessage || 'There was a problem redeeming your voucher. Please contact support or try ordering manually.',
          primaryAction: {
            label: 'Contact Support',
            onPress: () => {
              onClose();
              navigation.navigate('HelpSupport');
            },
          },
          secondaryAction: {
            label: 'Order Manually',
            onPress: () => {
              onClose();
              navigation.navigate('Home');
            },
          },
        };

      case AutoOrderFailureCategory.UNKNOWN:
      default:
        return {
          iconName: 'close-circle',
          iconType: 'Ionicons',
          title: 'Auto-Order Failed',
          message: customMessage || `We couldn't automatically place your ${mealText} order. Please try ordering manually.`,
          primaryAction: {
            label: 'Order Now',
            onPress: () => {
              onClose();
              navigation.navigate('Home');
            },
          },
          secondaryAction: null,
        };
    }
  };

  const content = getCategoryContent();
  const IconComponent = content.iconType === 'Ionicons' ? Ionicons : MaterialCommunityIcons;

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
            {/* Close button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Icon */}
            <View style={styles.iconContainer}>
              <IconComponent name={content.iconName} size={40} color="#FE8733" />
            </View>

            {/* Title */}
            <Text style={styles.title}>{content.title}</Text>

            {/* Message */}
            <Text style={styles.message}>{content.message}</Text>

            {/* Meal Window Badge */}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {mealWindow} Auto-Order
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              {/* Primary Action */}
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={content.primaryAction.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryButtonText}>
                  {content.primaryAction.label}
                </Text>
              </TouchableOpacity>

              {/* Secondary Action (if exists) */}
              {content.secondaryAction && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={content.secondaryAction.onPress}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>
                    {content.secondaryAction.label}
                  </Text>
                </TouchableOpacity>
              )}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
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
    padding: 4,
    zIndex: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F0',
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
  message: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  badge: {
    backgroundColor: '#FEF2F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 24,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FE8733',
  },
  actions: {
    flexDirection: 'column',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#FE8733',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
});

export default AutoOrderFailureModal;
