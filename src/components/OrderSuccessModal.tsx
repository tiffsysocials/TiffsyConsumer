// src/components/OrderSuccessModal.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Clipboard from '@react-native-clipboard/clipboard';

interface OrderSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  onGoHome: () => void;
  onTrackOrder: () => void;
  onCancelOrder?: () => Promise<void>;
  orderNumber?: string;
  amountToPay?: number;
  extraVouchersIssued?: number;
  cancelDeadline?: string;
}

const { height } = Dimensions.get('window');

const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  visible,
  onClose,
  onGoHome,
  onTrackOrder,
  onCancelOrder,
  orderNumber,
  amountToPay,
  extraVouchersIssued,
  cancelDeadline,
}) => {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Cancel countdown state
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate and start countdown when modal becomes visible
  useEffect(() => {
    if (visible && cancelDeadline) {
      const deadline = new Date(cancelDeadline).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
      setRemainingSeconds(remaining);
      setIsCancelling(false);

      if (remaining > 0) {
        timerRef.current = setInterval(() => {
          const newRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
          setRemainingSeconds(newRemaining);
          if (newRemaining <= 0) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        }, 1000);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, cancelDeadline]);

  // Format seconds as M:SS
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancel = useCallback(async () => {
    if (!onCancelOrder || isCancelling) return;
    setIsCancelling(true);
    try {
      await onCancelOrder();
    } finally {
      setIsCancelling(false);
    }
  }, [onCancelOrder, isCancelling]);

  const showCancelButton = cancelDeadline && remainingSeconds > 0 && onCancelOrder;
  const isMultiOrder = orderNumber ? orderNumber.includes(' & ') : false;

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
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
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

              {/* Success Icon */}
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <Svg width={50} height={50} viewBox="0 0 70 70">
                  {/* Green circle background */}
                  <Path
                    d="M35 0C15.67 0 0 15.67 0 35s15.67 35 35 35 35-15.67 35-35S54.33 0 35 0z"
                    fill="#22C55E"
                  />
                  {/* White checkmark */}
                  <Path
                    d="M29.17 46.25L18.75 35.83l2.92-2.91 7.5 7.5 19.16-19.17 2.92 2.92z"
                    fill="#FFFFFF"
                  />
                </Svg>
              </View>

              {/* Success Text */}
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#111827',
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                {isMultiOrder ? 'Orders Successful!' : 'Order Successful!'}
              </Text>

              {/* Order Number(s) */}
              {orderNumber && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#FE8733',
                    }}
                  >
                    {isMultiOrder ? `Orders #${orderNumber}` : `Order #${orderNumber}`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Clipboard.setString(orderNumber);
                      Alert.alert('Copied!', 'Order ID copied to clipboard');
                    }}
                    style={{ marginLeft: 6, padding: 2 }}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="#FE8733" />
                    </Svg>
                  </TouchableOpacity>
                </View>
              )}

              {/* Amount to Pay */}
              {amountToPay !== undefined && amountToPay > 0 && (
                <View
                  style={{
                    backgroundColor: '#FFF7ED',
                    borderRadius: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    alignSelf: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#FE8733',
                      textAlign: 'center',
                    }}
                  >
                    Amount to Pay: ₹{amountToPay.toFixed(2)}
                  </Text>
                </View>
              )}

              {/* Description */}
              <Text
                style={{
                  fontSize: 14,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  marginBottom: extraVouchersIssued && extraVouchersIssued > 0 ? 12 : 24,
                  lineHeight: 20,
                }}
              >
                {isMultiOrder
                  ? 'Your lunch & dinner orders are being prepared.\nSee updates in my orders'
                  : 'We\'re preparing your food.\nSee updates in my orders'}
              </Text>

              {/* Bonus Vouchers Banner */}
              {extraVouchersIssued !== undefined && extraVouchersIssued > 0 && (
                <View
                  style={{
                    backgroundColor: '#EFF6FF',
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    marginBottom: 24,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#BFDBFE',
                  }}
                >
                  <Text style={{ fontSize: 18, marginRight: 8 }}>🎉</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1D4ED8', textAlign: 'center' }}>
                    You got {extraVouchersIssued} bonus meal voucher{extraVouchersIssued > 1 ? 's' : ''}!
                  </Text>
                </View>
              )}

              {/* Go Home Button */}
              <TouchableOpacity
                onPress={onGoHome}
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
                  Go Home
                </Text>
              </TouchableOpacity>

              {/* Track Order Button */}
              <TouchableOpacity
                onPress={onTrackOrder}
                style={{
                  borderWidth: 2,
                  borderColor: 'rgba(254, 135, 51, 1)',
                  borderRadius: 28,
                  paddingVertical: 12,
                  paddingHorizontal: 32,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  marginBottom: showCancelButton ? 12 : 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: 'rgba(254, 135, 51, 1)',
                    marginRight: 4,
                  }}
                >
                  {isMultiOrder ? 'View your orders' : 'Track your order'}
                </Text>
                <Text style={{ fontSize: 16, color: 'rgba(254, 135, 51, 1)' }}>→</Text>
              </TouchableOpacity>

              {/* Cancel Order Button with Countdown */}
              {showCancelButton && (
                <TouchableOpacity
                  onPress={handleCancel}
                  disabled={isCancelling}
                  style={{
                    borderRadius: 28,
                    paddingVertical: 12,
                    paddingHorizontal: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isCancelling ? 0.6 : 1,
                  }}
                >
                  {isCancelling ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: '#EF4444',
                      }}
                    >
                      Cancel order ({formatCountdown(remainingSeconds)})
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default OrderSuccessModal;