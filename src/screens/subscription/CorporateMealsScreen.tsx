/**
 * Corporate Meals
 *
 * Flow (as specced): validate corporate ID → corporate voucher plans →
 * purchase → order to the locked office address (per-window cap enforced).
 *
 * Not linked  → [Section 1] corporate-ID entry + [Section 2] "partner with us".
 * Linked      → corporate home: office address, voucher/wallet balance, today's
 *               cap usage + order buttons, and the voucher plans to buy.
 *
 * Visual style mirrors VoucherPurchaseScreen/CorporateAutoOrderScreen — orange
 * gradient header, gray-50 scroll body, sectioned cards with orange-tab titles.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
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
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Polyline } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import apiService, { CorporatePlan, CorporateAutoOrderSetup } from '../../services/api.service';
import { useAlert } from '../../context/AlertContext';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'CorporateMeals'>;

const PRIMARY = '#FE8733';
const PRIMARY_TINT = '#FFF7ED';
const PRIMARY_BORDER = '#FED7AA';
const BG = '#F9FAFB';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const TEXT = '#111827';

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
  autoOrderSetup?: CorporateAutoOrderSetup | null;
  hasPurchasedAnyPack?: boolean;
}

const CorporateMealsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [home, setHome] = useState<CorporateHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);

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
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <Header onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  const linked = home?.linked && home.corporate;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Header onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1, backgroundColor: BG }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: SPACING.lg, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />
          }
        >
          {!linked ? (
            <>
              {/* Section 1 — corporate ID validation */}
              <Section title="Enter your Corporate ID">
                <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <Text style={styles.cardMeta}>
                    Partnered with Tiffsy through your company? Enter the corporate ID your admin shared to
                    unlock discounted meal vouchers delivered to your office.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
                    <TextInput
                      value={code}
                      onChangeText={(t) => setCode(t.toUpperCase())}
                      placeholder="e.g., AIB2026"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      style={styles.input}
                    />
                    <TouchableOpacity
                      onPress={handleLink}
                      disabled={!code.trim() || linking}
                      style={[styles.smallBtn, !code.trim() && { backgroundColor: '#D1D5DB' }]}
                    >
                      {linking ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.smallBtnText}>Validate</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </Section>

              {/* Section 2 — partner with us */}
              <Section title="Want corporate meals at your office?">
                <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <Text style={styles.cardMeta}>
                    Get your company partnered with Tiffsy for discounted daily meals delivered to your
                    workplace. Our team will reach out to set it up.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setLeadVisible(true)}
                    style={{
                      backgroundColor: '#EFF6FF',
                      borderRadius: 12,
                      paddingVertical: SPACING.md,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: '#BFDBFE',
                      marginTop: SPACING.md,
                    }}
                  >
                    <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: FONT_SIZES.base }}>
                      Contact Tiffsy Team
                    </Text>
                  </TouchableOpacity>
                </View>
              </Section>
            </>
          ) : (
            <>
              {/* Corporate header */}
              <Section title={home!.corporate!.name}>
                <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <MaterialCommunityIcons name="map-marker" size={18} color={MUTED} style={{ marginTop: 2 }} />
                    <Text style={{ fontSize: FONT_SIZES.sm, color: MUTED, marginLeft: 8, flex: 1 }}>
                      {home!.corporate!.lockedAddress.addressLine1}, {home!.corporate!.lockedAddress.locality},{' '}
                      {home!.corporate!.lockedAddress.city} {home!.corporate!.lockedAddress.pincode}
                      {'  '}(locked delivery address)
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleUnlink} style={{ alignSelf: 'flex-end', marginTop: SPACING.sm }}>
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF' }}>Unlink</Text>
                  </TouchableOpacity>
                </View>
              </Section>

              {/* Balances */}
              <View style={{ flexDirection: 'row', gap: SPACING.md, marginHorizontal: 16, marginBottom: 16 }}>
                <View style={[styles.card, { flex: 1, flexDirection: 'column', alignItems: 'center' }]}>
                  <Text style={{ fontSize: FONT_SIZES.h3, fontWeight: 'bold', color: PRIMARY }}>{home!.voucherBalance ?? 0}</Text>
                  <Text style={styles.cardMeta}>Vouchers</Text>
                </View>
                <View style={[styles.card, { flex: 1, flexDirection: 'column', alignItems: 'center' }]}>
                  <Text style={{ fontSize: FONT_SIZES.h3, fontWeight: 'bold', color: '#10B981' }}>₹{(home!.walletBalance ?? 0).toFixed(0)}</Text>
                  <Text style={styles.cardMeta}>Delivery Wallet</Text>
                </View>
              </View>

              {/* Order today */}
              {(home!.voucherBalance ?? 0) > 0 && (
                <Section title="Order for today">
                  <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch', padding: 0 }]}>
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
                            padding: 16,
                            borderTopWidth: mw === 'DINNER' ? 1 : 0,
                            borderTopColor: BORDER,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View
                              style={[
                                styles.iconCircle,
                                { backgroundColor: mw === 'LUNCH' ? '#FEF3C7' : '#EDE9FE', width: 36, height: 36, marginRight: 10 },
                              ]}
                            >
                              <MaterialCommunityIcons
                                name={mw === 'LUNCH' ? 'white-balance-sunny' : 'moon-waning-crescent'}
                                size={18}
                                color={mw === 'LUNCH' ? '#F59E0B' : '#6366F1'}
                              />
                            </View>
                            <View>
                              <Text style={styles.cardTitle}>{mw === 'LUNCH' ? 'Lunch' : 'Dinner'}</Text>
                              <Text style={styles.cardMeta}>{used}/{cap} used today</Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleOrder(mw)}
                            disabled={atCap || orderingWindow !== null}
                            style={[styles.smallBtn, { minWidth: 90 }, atCap && { backgroundColor: '#E5E7EB' }]}
                          >
                            {orderingWindow === mw ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={[styles.smallBtnText, atCap && { color: '#9CA3AF' }]}>
                                {atCap ? 'Limit hit' : 'Order 1'}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </Section>
              )}

              {/* Auto-order entry point — only shown once eligible: either a
                  setup already exists (to manage), or they've bought at least
                  one pack (to set one up). Buying nothing yet ⇒ hidden. */}
              {(home!.autoOrderSetup || home!.hasPurchasedAnyPack) && (
                <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('CorporateAutoOrder')}
                    style={styles.card}
                  >
                    <View style={styles.iconCircle}>
                      <MaterialCommunityIcons name="autorenew" size={22} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        {home!.autoOrderSetup ? 'Manage Auto-Order' : 'Set up Auto-Order'}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {home!.autoOrderSetup
                          ? home!.autoOrderSetup.enabled
                            ? 'Currently ON — tap to manage'
                            : 'Currently OFF — tap to manage'
                          : 'Order automatically on a weekly schedule'}
                      </Text>
                    </View>
                    <Text style={styles.chev}>›</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Voucher plans — same branded pack-card design as the
                  personal MealPlansScreen (background art, orange border,
                  savings chip, big price/voucher-count row) so a corporate
                  pack reads as the same product, just a different channel.
                  Whole card is tappable, same as MealPlansScreen. */}
              <Section title="Voucher Plans">
                {(home!.plans || []).length === 0 ? (
                  <View style={styles.card}>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: MUTED, textAlign: 'center', flex: 1 }}>
                      No plans available yet. Check back soon.
                    </Text>
                  </View>
                ) : (
                  (home!.plans || []).map((plan) => {
                    const savings =
                      plan.originalPrice && plan.originalPrice > plan.price
                        ? Math.round(plan.originalPrice - plan.price)
                        : 0;
                    const pricePerVoucher = plan.voucherCount > 0 ? (plan.price / plan.voucherCount) : 0;
                    const pricePerVoucherLabel = pricePerVoucher >= 1 ? Math.round(pricePerVoucher).toString() : pricePerVoucher.toFixed(2);
                    return (
                      <TouchableOpacity
                        key={plan._id}
                        onPress={() => navigation.navigate('CorporatePurchase', { planId: plan._id })}
                        activeOpacity={0.8}
                        style={styles.planCard}
                      >
                        <Image
                          source={require('../../assets/images/myaccount/voucherbackgound.png')}
                          style={{ position: 'absolute', width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                        <View style={{ flex: 1, padding: 16 }}>
                          {savings > 0 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
                              <View style={styles.saveChip}>
                                <Text style={styles.saveChipText}>Save ₹{savings}</Text>
                              </View>
                            </View>
                          )}

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <MaterialCommunityIcons name="ticket-percent" size={20} color={TEXT} style={{ marginRight: 8 }} />
                            <Text style={styles.planName}>{plan.name}</Text>
                          </View>

                          {plan.description ? (
                            <Text style={styles.planDesc} numberOfLines={2}>{plan.description}</Text>
                          ) : (
                            <View style={{ height: 8 }} />
                          )}

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 6 }}>
                            <View style={{ flex: 1, marginRight: 12 }}>
                              {savings > 0 && (
                                <Text style={styles.planOriginalPrice}>₹{plan.originalPrice!.toFixed(2)}</Text>
                              )}
                              <Text style={styles.planBigPrice}>₹{plan.price.toFixed(2)}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                <Text style={styles.planVoucherCount}>{plan.voucherCount}</Text>
                                <Text style={styles.planVoucherLabel}> Vouchers</Text>
                              </View>
                              <View style={styles.equivalencePill}>
                                <Text style={styles.equivalencePillText}>1 voucher = 1 meal</Text>
                              </View>
                              <Text style={styles.pricePerVoucher}>₹{pricePerVoucherLabel}/voucher</Text>
                            </View>
                          </View>

                          <View style={styles.planFooter}>
                            <Text style={styles.planFooterText}>
                              Vouchers valid for {plan.voucherValidityDays} days from purchase
                            </Text>
                            {plan.perMealDeliveryFee > 0 && (
                              <Text style={styles.planFooterText}>
                                + ₹{plan.perMealDeliveryFee}/meal delivery (prepaid to wallet)
                              </Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 6, height: 22, backgroundColor: PRIMARY, borderRadius: 999, marginRight: 10 }} />
        <Text style={{ fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: TEXT, flex: 1 }} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

const Header: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <LinearGradient
    colors={['#FD9E2F', '#FF6636']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={styles.gradientHeader}
  >
    <SafeAreaView edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Polyline points="15,18 9,12 15,6" stroke={PRIMARY} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Corporate Meals</Text>
        <View style={{ width: TOUCH_TARGETS.minimum }} />
      </View>
    </SafeAreaView>
  </LinearGradient>
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
      <Text style={{ fontSize: FONT_SIZES.xs, color: MUTED, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#9CA3AF"
        style={{
          borderWidth: 1,
          borderColor: BORDER,
          borderRadius: 12,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm + 2,
          fontSize: FONT_SIZES.sm,
          color: TEXT,
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
            <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: TEXT }}>Partner with Tiffsy</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={MUTED} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {field('Company name *', companyName, setCompanyName)}
            {field('Your name *', contactName, setContactName)}
            {field('Phone *', contactPhone, (v: string) => setContactPhone(v.replace(/[^0-9+]/g, '')), { keyboardType: 'phone-pad', maxLength: 15 })}
            {field('Email', contactEmail, setContactEmail, { keyboardType: 'email-address', autoCapitalize: 'none' })}
            {field('Message (team size, location…)', message, setMessage, { multiline: true, numberOfLines: 3, style: { minHeight: 70, textAlignVertical: 'top', borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZES.sm, color: TEXT } })}
            <TouchableOpacity
              onPress={submit}
              disabled={submitting}
              style={{ backgroundColor: PRIMARY, borderRadius: 25, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.sm, marginBottom: SPACING.lg }}
            >
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: FONT_SIZES.base }}>Submit Request</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  gradientHeader: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: TOUCH_TARGETS.minimum,
    height: TOUCH_TARGETS.minimum,
    borderRadius: TOUCH_TARGETS.minimum / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: TEXT },
  cardMeta: { fontSize: FONT_SIZES.sm, color: MUTED, marginTop: 2 },
  chev: { fontSize: 22, color: '#9CA3AF' },
  // Voucher-pack card — same design language as the personal MealPlansScreen
  // pack card (background art, orange border, savings chip) so a corporate
  // pack reads as the same product across the app.
  planCard: {
    width: '100%',
    minHeight: 130,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: PRIMARY,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    position: 'relative',
  },
  saveChip: {
    backgroundColor: 'rgba(233, 255, 238, 1)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  saveChipText: { fontSize: 11, fontWeight: '600', color: 'rgba(0, 139, 30, 1)' },
  planName: { fontSize: FONT_SIZES.base, fontWeight: '700', color: TEXT },
  planDesc: { fontSize: FONT_SIZES.xs, color: '#374151', marginBottom: 10, lineHeight: 16 },
  planOriginalPrice: { fontSize: FONT_SIZES.xs, color: '#9CA3AF', textDecorationLine: 'line-through', marginBottom: 2 },
  planBigPrice: { fontSize: 26, fontWeight: '700', color: TEXT },
  planVoucherCount: { fontSize: 26, fontWeight: '700', color: TEXT },
  planVoucherLabel: { fontSize: FONT_SIZES.sm, fontWeight: '500', color: TEXT },
  equivalencePill: {
    backgroundColor: PRIMARY_TINT,
    borderWidth: 1,
    borderColor: PRIMARY_BORDER,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  equivalencePillText: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  pricePerVoucher: { fontSize: FONT_SIZES.xs, color: '#374151', marginTop: 3 },
  planFooter: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  planFooterText: { fontSize: 11, color: MUTED, marginTop: 1 },
  input: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.sm,
    color: TEXT,
    borderWidth: 1,
    borderColor: BORDER,
    letterSpacing: 1,
  },
  smallBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZES.sm },
});

export default CorporateMealsScreen;
