import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

interface NotificationPermissionModalProps {
  visible: boolean;
  onAllow: () => void;
  onSkip: () => void;
  isLoading?: boolean;
}

const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
  visible,
  onAllow,
  onSkip,
  isLoading = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Bell Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="notifications" size={40} color="#FE8733" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Stay Updated!</Text>

          {/* Description */}
          <Text style={styles.description}>
            Enable notifications to get updates about your orders, meal deliveries, and exclusive offers.
          </Text>

          {/* Benefits List */}
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark" size={16} color="#10B981" style={{ marginRight: 10 }} />
              <Text style={styles.benefitText}>Real-time order tracking</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark" size={16} color="#10B981" style={{ marginRight: 10 }} />
              <Text style={styles.benefitText}>Delivery updates & reminders</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark" size={16} color="#10B981" style={{ marginRight: 10 }} />
              <Text style={styles.benefitText}>Special offers & discounts</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.allowButton}
              onPress={onAllow}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.allowButtonText}>
                {isLoading ? 'Please wait...' : 'Allow Notifications'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={onSkip}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.skipButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    width: width - 40,
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  benefitsList: {
    width: '100%',
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  allowButton: {
    backgroundColor: '#FE8733',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  allowButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  skipButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default NotificationPermissionModal;
