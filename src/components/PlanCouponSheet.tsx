// src/components/PlanCouponSheet.tsx
//
// Coupon picker for VOUCHER-PACK (plan) purchases. Same UX as the cart's
// CouponSheet (browse offers or type a code) but backed by the plan-purchase
// coupon endpoints; validation runs server-side via validatePlanCoupon so
// the previewed price always matches what Razorpay will charge.
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiService, { PlanCoupon } from '../services/api.service';

export interface AppliedPlanCoupon {
  code: string;
  discountType: string;
  discountAmount: number;
  extraVouchers: number;
  finalPayable: number;
}

interface PlanCouponSheetProps {
  visible: boolean;
  onClose: () => void;
  planId: string;
  onApplied: (coupon: AppliedPlanCoupon) => void;
}

function couponBadge(discountType: string): { label: string; color: string; bg: string } {
  switch (discountType) {
    case 'PERCENTAGE':
      return { label: '% OFF', color: '#D97706', bg: '#FEF3C7' };
    case 'FLAT':
      return { label: 'FLAT OFF', color: '#D97706', bg: '#FEF3C7' };
    case 'FREE_EXTRA_VOUCHER':
      return { label: 'BONUS VOUCHERS', color: '#2563EB', bg: '#DBEAFE' };
    default:
      return { label: 'OFFER', color: '#D97706', bg: '#FEF3C7' };
  }
}

function couponDescription(c: PlanCoupon): string {
  if (c.description) return c.description;
  switch (c.discountType) {
    case 'PERCENTAGE':
      return `${c.discountValue}% off this pack${c.maxDiscountAmount ? ` (up to ₹${c.maxDiscountAmount})` : ''}`;
    case 'FLAT':
      return `₹${c.discountValue} off this pack`;
    case 'FREE_EXTRA_VOUCHER':
      return `Get ${c.extraVoucherCount} bonus meal voucher${(c.extraVoucherCount || 0) > 1 ? 's' : ''} with this pack`;
    default:
      return '';
  }
}

const PlanCouponSheet: React.FC<PlanCouponSheetProps> = ({ visible, onClose, planId, onApplied }) => {
  const insets = useSafeAreaInsets();
  const [coupons, setCoupons] = useState<PlanCoupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setManualCode('');
    setLoading(true);
    apiService
      .getCouponsForPlan(planId)
      .then((resp) => setCoupons(resp?.data?.coupons || []))
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false));
  }, [visible, planId]);

  const applyCode = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setApplyingCode(trimmed);
    setError(null);
    try {
      const resp = await apiService.validatePlanCoupon(trimmed, planId);
      if (resp?.data?.valid) {
        onApplied({
          code: resp.data.couponCode || trimmed,
          discountType: resp.data.discountType || '',
          discountAmount: resp.data.discountAmount || 0,
          extraVouchers: resp.data.extraVouchers || 0,
          finalPayable: resp.data.finalPayable ?? 0,
        });
        onClose();
      } else {
        setError(resp?.message || 'This coupon cannot be applied');
      }
    } catch (e: any) {
      // Axios error responses carry the backend's message
      setError(e?.response?.data?.message || e?.message || 'Could not validate coupon');
    } finally {
      setApplyingCode(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '75%',
          paddingBottom: insets.bottom + 12,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 10,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Apply Coupon</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="close" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Manual code entry */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 8 }}>
          <TextInput
            value={manualCode}
            onChangeText={(t) => setManualCode(t.toUpperCase())}
            placeholder="Enter coupon code"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14,
              color: '#111827',
            }}
          />
          <TouchableOpacity
            onPress={() => applyCode(manualCode)}
            disabled={!manualCode.trim() || !!applyingCode}
            style={{
              marginLeft: 10,
              backgroundColor: manualCode.trim() ? '#FE8733' : '#E5E7EB',
              borderRadius: 12,
              paddingHorizontal: 18,
              justifyContent: 'center',
            }}
          >
            {applyingCode === manualCode.trim().toUpperCase() ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: manualCode.trim() ? '#fff' : '#9CA3AF', fontWeight: '700' }}>Apply</Text>
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <Text style={{ color: '#DC2626', fontSize: 12, paddingHorizontal: 22, marginBottom: 4 }}>{error}</Text>
        )}

        {/* Available offers */}
        <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color="#FE8733" />
          ) : coupons.length === 0 ? (
            <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', marginVertical: 24 }}>
              No offers available for this pack right now.
            </Text>
          ) : (
            coupons.map((c) => {
              const badge = couponBadge(c.discountType);
              return (
                <View
                  key={c.code}
                  style={{
                    borderWidth: 1,
                    borderColor: '#F3F4F6',
                    borderRadius: 16,
                    padding: 14,
                    marginVertical: 6,
                    backgroundColor: '#FFFDFB',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View
                      style={{
                        backgroundColor: badge.bg,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={{ color: badge.color, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>
                        {badge.label}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => applyCode(c.code)}
                      disabled={!!applyingCode}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {applyingCode === c.code ? (
                        <ActivityIndicator size="small" color="#FE8733" />
                      ) : (
                        <Text style={{ color: '#FE8733', fontWeight: '800', fontSize: 13 }}>APPLY</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 8 }}>{c.code}</Text>
                  <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>{couponDescription(c)}</Text>
                  {!!c.minOrderValue && c.minOrderValue > 0 && (
                    <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                      Min. pack value ₹{c.minOrderValue}
                    </Text>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 12 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

export default PlanCouponSheet;
