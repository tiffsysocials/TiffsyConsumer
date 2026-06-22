// src/components/DeliveryFeeInfoModal.tsx
//
// Small popup that explains how the delivery fee was computed. Triggered by
// a tiny ⓘ icon placed next to the "Delivery Fee" label in the cart, voucher
// purchase, auto-order setup, scheduling, and order-detail screens.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface DeliveryFeeInfoModalProps {
  visible: boolean;
  onClose: () => void;
  // Formula string built via deliveryFormulaText() — e.g. "₹1 base + 3.9 km × ₹1".
  // Pass null/undefined when the screen has no distance breakdown available
  // (scheduled/bulk pricing endpoints); the modal falls back to a generic
  // explanation in that case.
  formula?: string | null;
  // Optional displayed fee amount for context — "Delivery Fee: ₹5.00".
  deliveryFee?: number | null;
}

const DeliveryFeeInfoModal: React.FC<DeliveryFeeInfoModalProps> = ({
  visible,
  onClose,
  formula,
  deliveryFee,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 120 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.95, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, scale]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          opacity,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 28,
        }}
      >
        <Pressable
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          onPress={onClose}
        />
        <Animated.View
          style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 20,
            width: '100%',
            maxWidth: 380,
            transform: [{ scale }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <MaterialCommunityIcons name="bike-fast" size={18} color="#FE8733" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Delivery Fee</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {typeof deliveryFee === 'number' && (
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
              ₹{deliveryFee.toFixed(2)}
            </Text>
          )}

          {formula ? (
            <Text style={{ fontSize: 13, color: '#4B5563', lineHeight: 19 }}>
              <Text style={{ color: '#6B7280' }}>Calculated as: </Text>
              <Text style={{ fontWeight: '600', color: '#111827' }}>{formula}</Text>
            </Text>
          ) : (
            <Text style={{ fontSize: 13, color: '#4B5563', lineHeight: 19 }}>
              Delivery fee is calculated based on the distance from the kitchen to your delivery
              address. The exact rate depends on your delivery zone.
            </Text>
          )}

          <View
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#F3F4F6',
            }}
          >
            <Text style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 16 }}>
              Goes directly to keep deliveries on time. We don't profit from this fee.
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default DeliveryFeeInfoModal;
