// src/components/VoucherPaymentModal.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface VoucherPaymentModalProps {
  visible: boolean;
  voucherCount: number;
  onUseVoucher: () => void;
  onPayDirectly: () => void;
  onCancel: () => void;
}

const { height } = Dimensions.get('window');

const VoucherPaymentModal: React.FC<VoucherPaymentModalProps> = ({
  visible,
  voucherCount,
  onUseVoucher,
  onPayDirectly,
  onCancel,
}) => {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            opacity: fadeAnim,
          }}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'white',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingTop: 30,
                paddingBottom: 30,
                transform: [{ translateY: slideAnim }],
              }}
            >
              {/* Handle Bar */}
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: '#D1D5DB',
                  borderRadius: 2,
                  alignSelf: 'center',
                  position: 'absolute',
                  top: 12,
                }}
              />

              {/* Icon */}
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: '#FFF7ED',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons
                    name="ticket-confirmation"
                    size={40}
                    color="#FE8733"
                  />
                </View>
              </View>

              {/* Title */}
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#111827',
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                Use Voucher?
              </Text>

              {/* Voucher Count */}
              <View
                style={{
                  backgroundColor: '#FFF7ED',
                  borderRadius: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  alignSelf: 'center',
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#FE8733',
                    textAlign: 'center',
                  }}
                >
                  You have {voucherCount} voucher{voucherCount > 1 ? 's' : ''} available
                </Text>
              </View>

              {/* Description */}
              <Text
                style={{
                  fontSize: 14,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  marginBottom: 24,
                  lineHeight: 20,
                }}
              >
                Choose how you'd like to complete your purchase
              </Text>

              {/* Use Voucher Button */}
              <TouchableOpacity
                onPress={onUseVoucher}
                style={{
                  backgroundColor: 'rgba(254, 135, 51, 1)',
                  borderRadius: 28,
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                  alignItems: 'center',
                  marginBottom: 12,
                  shadowColor: 'rgba(254, 135, 51, 1)',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: 'white',
                  }}
                >
                  Use Voucher
                </Text>
              </TouchableOpacity>

              {/* Pay Directly Button */}
              <TouchableOpacity
                onPress={onPayDirectly}
                style={{
                  borderWidth: 2,
                  borderColor: 'rgba(254, 135, 51, 1)',
                  borderRadius: 28,
                  paddingVertical: 12,
                  paddingHorizontal: 32,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: 'rgba(254, 135, 51, 1)',
                  }}
                >
                  Pay Directly
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default VoucherPaymentModal;
