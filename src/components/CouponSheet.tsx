// src/components/CouponSheet.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Pressable,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiService, {
  Coupon,
  CouponDiscountType,
  COUPON_REJECTION_MESSAGES,
  CouponRejectionReason,
} from '../services/api.service';

interface CouponSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (couponCode: string) => void;
  menuType: 'MEAL_MENU' | 'ON_DEMAND_MENU';
  kitchenId: string;
  zoneId?: string;
  orderValue: number;
  itemCount: number;
  hasAddons?: boolean;
}

function getDiscountBadge(discountType: CouponDiscountType): { label: string; color: string; bg: string } {
  switch (discountType) {
    case 'PERCENTAGE':
      return { label: '% OFF', color: '#D97706', bg: '#FEF3C7' };
    case 'FLAT':
      return { label: 'FLAT OFF', color: '#D97706', bg: '#FEF3C7' };
    case 'FREE_DELIVERY':
      return { label: 'FREE DELIVERY', color: '#059669', bg: '#D1FAE5' };
    case 'FREE_ADDON_COUNT':
      return { label: 'FREE ADD-ONS', color: '#7C3AED', bg: '#EDE9FE' };
    case 'FREE_ADDON_VALUE':
      return { label: 'FREE ADD-ONS', color: '#7C3AED', bg: '#EDE9FE' };
    case 'FREE_EXTRA_VOUCHER':
      return { label: 'BONUS VOUCHERS', color: '#2563EB', bg: '#DBEAFE' };
    default:
      return { label: 'OFFER', color: '#D97706', bg: '#FEF3C7' };
  }
}

function getCouponDescription(coupon: Coupon): string {
  if (coupon.description) return coupon.description;
  switch (coupon.discountType) {
    case 'PERCENTAGE':
      return `${coupon.discountValue}% off${coupon.maxDiscountAmount ? ` (up to ₹${coupon.maxDiscountAmount})` : ''}`;
    case 'FLAT':
      return `₹${coupon.discountValue} off`;
    case 'FREE_DELIVERY':
      return 'Free delivery on this order';
    case 'FREE_ADDON_COUNT':
      return `${coupon.freeAddonCount} add-on${(coupon.freeAddonCount || 0) > 1 ? 's' : ''} free`;
    case 'FREE_ADDON_VALUE':
      return `Add-ons worth ₹${coupon.freeAddonMaxValue} free`;
    case 'FREE_EXTRA_VOUCHER':
      return `Get ${coupon.extraVoucherCount} bonus meal voucher${(coupon.extraVoucherCount || 0) > 1 ? 's' : ''}`;
    default:
      return '';
  }
}

const CouponSheet: React.FC<CouponSheetProps> = ({
  visible,
  onClose,
  onApply,
  menuType,
  kitchenId,
  zoneId,
  orderValue,
  itemCount,
  hasAddons = false,
}) => {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const drawerTranslateY = useRef(new Animated.Value(600)).current;

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [validatingCode, setValidatingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      setError(null);
      setManualCode('');
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(drawerTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(drawerTranslateY, { toValue: 600, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, backdropOpacity, drawerTranslateY]);

  // Fetch available coupons when sheet opens
  useEffect(() => {
    if (!visible) return;

    const fetchCoupons = async () => {
      setIsLoading(true);
      try {
        const response = await apiService.getAvailableCoupons({
          menuType,
          kitchenId,
          zoneId,
          orderValue,
        });
        if (response.success && response.data?.coupons) {
          setCoupons(response.data.coupons);
        }
      } catch (err: any) {
        console.error('[CouponSheet] Error fetching coupons:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoupons();
  }, [visible, menuType, kitchenId, zoneId, orderValue]);

  const handleApplyCoupon = useCallback(async (code: string) => {
    if (!code.trim()) return;

    setError(null);
    setValidatingCode(code);

    try {
      const response = await apiService.validateCoupon({
        code: code.trim(),
        kitchenId,
        zoneId: zoneId || '',
        orderValue,
        itemCount,
        menuType,
      });

      if (response.data?.valid) {
        Keyboard.dismiss();
        onApply(code.trim());
        onClose();
      } else {
        const reason = response.data?.reason as CouponRejectionReason | null;
        const message = reason
          ? COUPON_REJECTION_MESSAGES[reason] || 'This coupon cannot be applied'
          : 'This coupon cannot be applied';
        setError(message);
      }
    } catch (err: any) {
      console.error('[CouponSheet] Error validating coupon:', err);
      setError(err.message || 'Failed to validate coupon');
    } finally {
      setValidatingCode(null);
    }
  }, [kitchenId, zoneId, orderValue, itemCount, menuType, onApply, onClose]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            opacity: backdropOpacity,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={{
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 12, 24),
            maxHeight: '80%',
            transform: [{ translateY: drawerTranslateY }],
          }}
        >
          {/* Drawer Handle */}
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
          </View>

          {/* Title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827' }}>Apply Coupon</Text>
            <TouchableOpacity onPress={handleClose}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Manual Code Input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 }}>
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: error ? '#EF4444' : '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                color: '#111827',
                textTransform: 'uppercase',
              }}
              placeholder="Enter coupon code"
              placeholderTextColor="#9CA3AF"
              value={manualCode}
              onChangeText={(text) => {
                setManualCode(text.toUpperCase());
                setError(null);
              }}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={() => handleApplyCoupon(manualCode)}
            />
            <TouchableOpacity
              onPress={() => handleApplyCoupon(manualCode)}
              disabled={!manualCode.trim() || validatingCode === manualCode}
              style={{
                marginLeft: 10,
                backgroundColor: manualCode.trim() ? '#FE8733' : '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 18,
                paddingVertical: 11,
              }}
            >
              {validatingCode === manualCode ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={{ color: manualCode.trim() ? 'white' : '#9CA3AF', fontWeight: '600', fontSize: 14 }}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {error && (
            <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: '#EF4444' }}>{error}</Text>
            </View>
          )}

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 }} />

          {/* Available Coupons Header */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280', paddingHorizontal: 20, marginBottom: 12 }}>
            Available Coupons
          </Text>

          {/* Coupon List */}
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="small" color="#FE8733" />
              <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 8 }}>Loading coupons...</Text>
            </View>
          ) : coupons.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}>
              <MaterialCommunityIcons name="ticket-outline" size={40} color="#D1D5DB" />
              <Text style={{ color: '#9CA3AF', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                No coupons available right now.{'\n'}Try entering a code above.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ paddingHorizontal: 20 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {coupons.map((coupon) => {
                const badge = getDiscountBadge(coupon.discountType);
                const isValidating = validatingCode === coupon.code;
                const isAddonCoupon = coupon.discountType === 'FREE_ADDON_COUNT' || coupon.discountType === 'FREE_ADDON_VALUE';
                const isDisabled = isAddonCoupon && !hasAddons;

                return (
                  <View
                    key={coupon.code}
                    style={{
                      borderWidth: 1,
                      borderColor: isDisabled ? '#F3F4F6' : '#E5E7EB',
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 10,
                      opacity: isDisabled ? 0.5 : 1,
                    }}
                  >
                    {/* Top Row: Badge + Code */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <View style={{ backgroundColor: badge.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: badge.color }}>{badge.label}</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', letterSpacing: 0.5 }}>{coupon.code}</Text>
                    </View>

                    {/* Name */}
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 }}>{coupon.name}</Text>

                    {/* Description */}
                    <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                      {getCouponDescription(coupon)}
                    </Text>

                    {/* Bottom Row: Valid Till + Apply */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {isDisabled
                          ? 'Add add-ons to use this coupon'
                          : `Valid till ${new Date(coupon.validTill).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}${coupon.minOrderValue > 0 ? ` · Min ₹${coupon.minOrderValue}` : ''}`
                        }
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleApplyCoupon(coupon.code)}
                        disabled={isValidating || isDisabled}
                        style={{
                          borderWidth: 1,
                          borderColor: isDisabled ? '#D1D5DB' : '#FE8733',
                          borderRadius: 8,
                          paddingHorizontal: 16,
                          paddingVertical: 6,
                        }}
                      >
                        {isValidating ? (
                          <ActivityIndicator size="small" color="#FE8733" />
                        ) : (
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isDisabled ? '#D1D5DB' : '#FE8733' }}>APPLY</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* T&C */}
                    {coupon.termsAndConditions && (
                      <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>
                        {coupon.termsAndConditions}
                      </Text>
                    )}
                  </View>
                );
              })}
              {/* Bottom padding */}
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

export default CouponSheet;
