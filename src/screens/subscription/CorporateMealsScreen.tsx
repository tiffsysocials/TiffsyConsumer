/**
 * Corporate Meals
 *
 * Flow (as specced): validate corporate ID → corporate voucher plans →
 * purchase → order to the locked office address (per-window cap enforced).
 *
 * Not linked  → [Section 1] corporate-ID entry + [Section 2] "partner with us".
 * Linked      → corporate home: office address, voucher/wallet balance, today's
 *               cap usage + order buttons, and the voucher plans to buy.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import apiService, { CorporatePlan } from '../../services/api.service';
import paymentService from '../../services/payment.service';
import { useAlert } from '../../context/AlertContext';
import { SPACING } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'CorporateMeals'>;

const PRIMARY = '#FE8733';

interface CorporateHome {
  linked: boolean;
  corporate?: {
    id: string;
    name: string;
    code: string;
    lockedAddress: {
      addressLine1: string;
      addressLine2?: string;
      locality: string;
      city: string;
      pincode: string;
    };
    maxMealsPerWindow: number;
  };
  plans?: CorporatePlan[];
  voucherBalance?: number;
  walletBalance?: number;
  capUsage?: { maxPerWindow: number; lunchUsedToday: number; dinnerUsedToday: number };
}

const CorporateMealsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [home, setHome] = useState<CorporateHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);

  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const [orderingWindow, setOrderingWindow] = useState<'LUNCH' | 'DINNER' | null>(null);

  const [leadVisible, setLeadVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await apiService.getMyCorporate();
      if (resp.success) setHome(resp.data as CorporateHome);
    } catch (err) {
      // Non-fatal — leave whatever we had.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleLink = async () => {
    if (!code.trim()) return;
    setLinking(true);
    try {
      const resp = await apiService.linkCorporate(code.trim().toUpperCase());
      if (resp.success) {
        showAlert('Linked!', resp.message || 'Corporate linked', undefined, 'success');
        setCode('');
        setLoading(true);
        await load();
      } else {
        showAlert('Could not link', resp.message || 'Invalid corporate ID', undefined, 'error');
      }
    } catch (err: any) {
      showAlert('Could not link', err?.response?.data?.message || err?.message || 'Invalid corporate ID', undefined, 'error');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = () => {
    showAlert(
      'Unlink corporate?',
      'You can re-link anytime with your corporate ID. Your purchased vouchers stay on your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            await apiService.unlinkCorporate();
            setLoading(true);
            load();
          },
        },
      ],
      'warning',
    );
  };

  const handlePurchase = async (plan: CorporatePlan) => {
    setPurchasingPlanId(plan._id);
    try {
      const result = await paymentService.processCorporatePurchase(plan._id);
      if (result.success) {
        showAlert('Success', `${plan.voucherCount} corporate vouchers added!`, undefined, 'success');
        setLoading(true);
        await load();
      } else if (result.error !== 'Payment cancelled') {
        showAlert('Payment failed', result.error || 'Try again', undefined, 'error');
      }
    } finally {
      setPurchasingPlanId(null);
    }
  };

  const handleOrder = async (mealWindow: 'LUNCH' | 'DINNER') => {
    setOrderingWindow(mealWindow);
    try {
      const resp = await apiService.placeCorporateOrder(mealWindow, 1);
      if (resp.success) {
        showAlert('Order placed!', `Your ${mealWindow.toLowerCase()} will be delivered to the office.`, undefined, 'success');
        await load();
      } else {
        showAlert('Could not order', resp.message, undefined, 'error');
      }
    } catch (err: any) {
      showAlert('Could not order', err?.response?.data?.message || err?.message || 'Try again', undefined, 'error');
    } finally {
      setOrderingWindow(null);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <SafeAreaView style={{ backgroundColor: PRIMARY }} edges={['top']} />
        <Header onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  const linked = home?.linked && home.corporate;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <SafeAreaView style={{ backgroundColor: PRIMARY }} edges={['top']} />
      <Header onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />
        }
      >
        {!linked ? (
          <>
            {/* Section 1 — corporate ID validation */}
            <View style={cardStyle}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                <MaterialCommunityIcons name="office-building" size={22} color={PRIMARY} />
                <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginLeft: 8 }}>
                  Enter your Corporate ID
                </Text>
              </View>
              <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginBottom: SPACING.md }}>
                Partnered with Tiffsy through your company? Enter the corporate ID your admin shared to unlock
                discounted meal vouchers delivered to your office.
              </Text>
              <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                <TextInput
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase())}
                  placeholder="e.g., AIB2026"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    backgroundColor: '#F9FAFB',
                    borderRadius: 10,
                    paddingHorizontal: SPACING.md,
                    paddingVertical: SPACING.sm + 2,
                    fontSize: FONT_SIZES.sm,
                    color: '#1F2937',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    letterSpacing: 1,
                  }}
                />
                <TouchableOpacity
                  onPress={handleLink}
                  disabled={!code.trim() || linking}
                  style={{
                    backgroundColor: code.trim() ? PRIMARY : '#D1D5DB',
                    borderRadius: 10,
                    paddingHorizontal: SPACING.lg,
                    justifyContent: 'center',
                  }}
                >
                  {linking ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: FONT_SIZES.sm }}>Validate</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Section 2 — partner with us */}
            <View style={[cardStyle, { marginTop: SPACING.md }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                <MaterialCommunityIcons name="handshake-outline" size={22} color="#2563EB" />
                <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginLeft: 8 }}>
                  Want corporate meals at your office?
                </Text>
              </View>
              <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginBottom: SPACING.md }}>
                Get your company partnered with Tiffsy for discounted daily meals delivered to your workplace.
                Our team will reach out to set it up.
              </Text>
              <TouchableOpacity
                onPress={() => setLeadVisible(true)}
                style={{
                  backgroundColor: '#EFF6FF',
                  borderRadius: 10,
                  paddingVertical: SPACING.md,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                }}
              >
                <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: FONT_SIZES.sm }}>
                  Contact Tiffsy Team
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Corporate header */}
            <View style={cardStyle}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialCommunityIcons name="office-building" size={24} color={PRIMARY} />
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginLeft: 8, flex: 1 }}>
                    {home!.corporate!.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleUnlink}>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF' }}>Unlink</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: SPACING.md }}>
                <MaterialCommunityIcons name="map-marker" size={16} color="#6B7280" style={{ marginTop: 2 }} />
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginLeft: 6, flex: 1 }}>
                  {home!.corporate!.lockedAddress.addressLine1}, {home!.corporate!.lockedAddress.locality},{' '}
                  {home!.corporate!.lockedAddress.city} {home!.corporate!.lockedAddress.pincode}
                  {'  '}(locked delivery address)
                </Text>
              </View>
            </View>

            {/* Balances */}
            <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md }}>
              <View style={[cardStyle, { flex: 1, alignItems: 'center' }]}>
                <Text style={{ fontSize: FONT_SIZES.h3, fontWeight: 'bold', color: PRIMARY }}>{home!.voucherBalance ?? 0}</Text>
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>Vouchers</Text>
              </View>
              <View style={[cardStyle, { flex: 1, alignItems: 'center' }]}>
                <Text style={{ fontSize: FONT_SIZES.h3, fontWeight: 'bold', color: '#10B981' }}>₹{(home!.walletBalance ?? 0).toFixed(0)}</Text>
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>Delivery Wallet</Text>
              </View>
            </View>

            {/* Order today */}
            {(home!.voucherBalance ?? 0) > 0 && (
              <View style={[cardStyle, { marginTop: SPACING.md }]}>
                <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginBottom: SPACING.sm }}>
                  Order for today
                </Text>
                {(['LUNCH', 'DINNER'] as const).map((mw) => {
                  const used = mw === 'LUNCH' ? home!.capUsage?.lunchUsedToday ?? 0 : home!.capUsage?.dinnerUsedToday ?? 0;
                  const cap = home!.capUsage?.maxPerWindow ?? home!.corporate!.maxMealsPerWindow;
                  const atCap = used >= cap;
                  return (
                    <View
                      key={mw}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: SPACING.sm,
                        borderTopWidth: mw === 'DINNER' ? 1 : 0,
                        borderTopColor: '#F3F4F6',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons
                          name={mw === 'LUNCH' ? 'white-balance-sunny' : 'moon-waning-crescent'}
                          size={18}
                          color={mw === 'LUNCH' ? '#F59E0B' : '#6366F1'}
                        />
                        <View style={{ marginLeft: 8 }}>
                          <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937' }}>
                            {mw === 'LUNCH' ? 'Lunch' : 'Dinner'}
                          </Text>
                          <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF' }}>
                            {used}/{cap} used today
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleOrder(mw)}
                        disabled={atCap || orderingWindow !== null}
                        style={{
                          backgroundColor: atCap ? '#E5E7EB' : PRIMARY,
                          borderRadius: 8,
                          paddingHorizontal: SPACING.lg,
                          paddingVertical: SPACING.sm,
                          minWidth: 90,
                          alignItems: 'center',
                        }}
                      >
                        {orderingWindow === mw ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={{ color: atCap ? '#9CA3AF' : '#fff', fontWeight: '700', fontSize: FONT_SIZES.sm }}>
                            {atCap ? 'Limit hit' : 'Order 1'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Voucher plans */}
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937', marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
              Voucher Plans
            </Text>
            {(home!.plans || []).length === 0 ? (
              <View style={cardStyle}>
                <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', textAlign: 'center' }}>
                  No plans available yet. Check back soon.
                </Text>
              </View>
            ) : (
              (home!.plans || []).map((plan) => (
                <View key={plan._id} style={[cardStyle, { marginBottom: SPACING.md }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937' }}>{plan.name}</Text>
                      <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>
                        {plan.voucherCount} meal vouchers · valid {plan.voucherValidityDays} days
                      </Text>
                      {plan.perMealDeliveryFee > 0 && (
                        <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', marginTop: 2 }}>
                          + ₹{plan.perMealDeliveryFee}/meal delivery (prepaid to wallet)
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: FONT_SIZES.h4, fontWeight: 'bold', color: '#1F2937' }}>₹{plan.price}</Text>
                      {!!plan.originalPrice && plan.originalPrice > plan.price && (
                        <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', textDecorationLine: 'line-through' }}>
                          ₹{plan.originalPrice}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handlePurchase(plan)}
                    disabled={purchasingPlanId !== null}
                    style={{
                      backgroundColor: PRIMARY,
                      borderRadius: 10,
                      paddingVertical: SPACING.md,
                      alignItems: 'center',
                      marginTop: SPACING.md,
                    }}
                  >
                    {purchasingPlanId === plan._id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: FONT_SIZES.sm }}>Buy Pack</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <LeadModal
        visible={leadVisible}
        onClose={() => setLeadVisible(false)}
        onSubmitted={() => {
          setLeadVisible(false);
          showAlert('Request sent!', 'Our team will reach out shortly.', undefined, 'success');
        }}
      />
    </View>
  );
};

const Header: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <View style={{ backgroundColor: PRIMARY, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
    <TouchableOpacity onPress={onBack} style={{ marginRight: SPACING.md }}>
      <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
    </TouchableOpacity>
    <Text style={{ color: '#fff', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>Corporate Meals</Text>
  </View>
);

const LeadModal: React.FC<{ visible: boolean; onClose: () => void; onSubmitted: () => void }> = ({
  visible,
  onClose,
  onSubmitted,
}) => {
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!companyName.trim() || !contactName.trim() || contactPhone.trim().length < 10) {
      showAlert('Missing info', 'Company, your name and a valid phone are required', undefined, 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await apiService.createCorporateLead({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim() || undefined,
        message: message.trim() || undefined,
      });
      if (resp.success) {
        setCompanyName(''); setContactName(''); setContactPhone(''); setContactEmail(''); setMessage('');
        onSubmitted();
      } else {
        showAlert('Could not send', resp.message, undefined, 'error');
      }
    } catch (err: any) {
      showAlert('Could not send', err?.response?.data?.message || err?.message || 'Try again', undefined, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, opts?: any) => (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#9CA3AF"
        style={{
          borderWidth: 1,
          borderColor: '#E5E7EB',
          borderRadius: 10,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm + 2,
          fontSize: FONT_SIZES.sm,
          color: '#1F2937',
        }}
        {...opts}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: Math.max(insets.bottom, SPACING.lg), maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
            <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 'bold', color: '#1F2937' }}>Partner with Tiffsy</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {field('Company name *', companyName, setCompanyName)}
            {field('Your name *', contactName, setContactName)}
            {field('Phone *', contactPhone, (v: string) => setContactPhone(v.replace(/[^0-9+]/g, '')), { keyboardType: 'phone-pad', maxLength: 15 })}
            {field('Email', contactEmail, setContactEmail, { keyboardType: 'email-address', autoCapitalize: 'none' })}
            {field('Message (team size, location…)', message, setMessage, { multiline: true, numberOfLines: 3, style: { minHeight: 70, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZES.sm, color: '#1F2937' } })}
            <TouchableOpacity
              onPress={submit}
              disabled={submitting}
              style={{ backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.sm, marginBottom: SPACING.lg }}
            >
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: FONT_SIZES.sm }}>Submit Request</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const cardStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: 14,
  padding: SPACING.lg,
  borderWidth: 1,
  borderColor: '#F3F4F6',
} as const;

export default CorporateMealsScreen;
