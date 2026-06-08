/**
 * Per-config Auto-Order Prepaid Wallets.
 *
 * Lists each `autoOrderConfigs[i]` for the customer's active subscription
 * with its rupee balance, recent transactions, and a "Top Up" button. The
 * top-up routes through Razorpay via paymentService.topupAutoOrderWallet.
 *
 * Used in three places:
 *   1. Account → Auto-order wallets (general entry point)
 *   2. AutoOrderConfigScreen redirect when balance is 0 and the customer
 *      tries to enable a config (route params: focusAddressId, suggestedAmount)
 *   3. Push-notification deep link from WALLET_INSUFFICIENT (same params)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { StackScreenProps } from '@react-navigation/stack';
import apiService, { AutoOrderWalletRow } from '../../services/api.service';
import paymentService from '../../services/payment.service';
import { useUser } from '../../context/UserContext';
import { MainTabParamList } from '../../types/navigation';

type Props = StackScreenProps<MainTabParamList, 'AutoOrderWallets'>;

const THEME_COLOR = '#FE8733';
const BORDER_COLOR = '#E5E7EB';
const MUTED = '#9CA3AF';

const AutoOrderWalletsScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const focusAddressId = route.params?.focusAddressId;
  const suggestedAmountParam = route.params?.suggestedAmount;

  const [wallets, setWallets] = useState<AutoOrderWalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topupModal, setTopupModal] = useState<{
    addressId: string;
    addressLabel: string;
    suggested: number;
    currentBalance: number;
  } | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupSubmitting, setTopupSubmitting] = useState(false);

  const loadWallets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiService.getAutoOrderWallets();
      if (resp.success) {
        setWallets(resp.data.wallets);
      } else {
        setError(resp.message || 'Failed to load wallets');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load wallets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  // Deep-link / redirect path: a specific addressId came in with a
  // suggested amount. Auto-open the top-up modal for that row when
  // the wallets list loads.
  useEffect(() => {
    if (loading || !focusAddressId || !wallets.length || topupModal) return;
    const target = wallets.find((w) => w.addressId === focusAddressId);
    if (target) {
      setTopupModal({
        addressId: target.addressId,
        addressLabel: target.addressLabel,
        suggested: suggestedAmountParam || target.suggestedTopup || 0,
        currentBalance: target.balance,
      });
      setTopupAmount(
        String(
          Math.max(
            1,
            Math.round(suggestedAmountParam || target.suggestedTopup || 0),
          ),
        ),
      );
    }
  }, [focusAddressId, suggestedAmountParam, wallets, loading, topupModal]);

  const onTopUp = (w: AutoOrderWalletRow) => {
    setTopupModal({
      addressId: w.addressId,
      addressLabel: w.addressLabel,
      suggested: w.suggestedTopup,
      currentBalance: w.balance,
    });
    setTopupAmount(String(Math.max(1, Math.round(w.suggestedTopup))));
  };

  const submitTopup = async () => {
    if (!topupModal) return;
    const amount = Number(topupAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      Alert.alert('Invalid amount', 'Please enter at least ₹1.');
      return;
    }
    setTopupSubmitting(true);
    try {
      const prefill = {
        name: user?.name || '',
        contact: user?.phone || '',
        email: user?.email || '',
      };
      const res = await paymentService.topupAutoOrderWallet(
        topupModal.addressId,
        amount,
        prefill,
      );
      if (res.success) {
        Alert.alert(
          'Top-up successful',
          `₹${amount} credited to your auto-order wallet for ${topupModal.addressLabel}.`,
        );
        setTopupModal(null);
        await loadWallets();
      } else if (res.error === 'Payment cancelled') {
        Alert.alert('Payment cancelled');
      } else {
        Alert.alert('Top-up failed', res.error || 'Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Top-up failed', err?.message || 'Please try again.');
    } finally {
      setTopupSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <LinearGradient
        colors={[THEME_COLOR, '#FE9C5C']}
        style={{ paddingTop: insets.top, paddingBottom: 16, paddingHorizontal: 16 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '600' }}>
            Auto-order wallets
          </Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={THEME_COLOR} size="large" />
        </View>
      ) : error ? (
        <View style={{ padding: 24 }}>
          <Text style={{ color: '#DC2626' }}>{error}</Text>
          <TouchableOpacity onPress={loadWallets} style={{ marginTop: 16 }}>
            <Text style={{ color: THEME_COLOR, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : wallets.length === 0 ? (
        <View style={{ padding: 24 }}>
          <Text style={{ color: MUTED }}>
            No auto-order addresses yet. Enable auto-ordering for an address to
            create a wallet.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {wallets.map((w) => (
            <View key={w.addressId} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>{w.addressLabel}</Text>
                  <Text style={styles.addressSub}>
                    {w.addressLine1} · {w.pincode}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: w.enabled ? '#DCFCE7' : '#F3F4F6',
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: w.enabled ? '#16A34A' : '#6B7280',
                    }}
                  >
                    {w.enabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </View>
              </View>

              <View style={styles.balanceRow}>
                <View>
                  <Text style={styles.balanceLabel}>Balance</Text>
                  <Text style={styles.balanceValue}>
                    ₹{w.balance.toFixed(2)}
                  </Text>
                </View>
                {w.suggestedTopup > 0 && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.balanceLabel}>Recommended top-up</Text>
                    <Text style={styles.suggestedAmount}>
                      ₹{w.suggestedTopup.toFixed(0)}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.topupBtn}
                onPress={() => onTopUp(w)}
              >
                <MaterialCommunityIcons name="wallet-plus" size={18} color="#FFF" />
                <Text style={styles.topupBtnText}>Top up</Text>
              </TouchableOpacity>

              {w.transactions.length > 0 && (
                <View style={styles.txHeader}>
                  <Text style={styles.txHeaderText}>Recent activity</Text>
                </View>
              )}
              {w.transactions.slice(0, 5).map((t, idx) => (
                <View
                  key={`${t.timestamp}-${idx}`}
                  style={styles.txRow}
                >
                  <Text style={styles.txType}>
                    {t.type === 'DEPOSIT'
                      ? '↓ Top-up'
                      : t.type === 'DEDUCTION'
                        ? '↑ Order'
                        : '↻ Refund'}
                  </Text>
                  <Text
                    style={[
                      styles.txAmount,
                      {
                        color:
                          t.type === 'DEDUCTION' ? '#DC2626' : '#16A34A',
                      },
                    ]}
                  >
                    {t.type === 'DEDUCTION' ? '−' : '+'}₹{t.amount.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={!!topupModal}
        animationType="slide"
        transparent
        onRequestClose={() => setTopupModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Top up {topupModal?.addressLabel}
            </Text>
            <Text style={styles.modalSub}>
              Current balance: ₹{topupModal?.currentBalance?.toFixed(2) || '0.00'}
            </Text>
            {(topupModal?.suggested || 0) > 0 && (
              <Text style={styles.modalHint}>
                Recommended: ₹{Math.round(topupModal?.suggested || 0)} (covers your
                remaining vouchers)
              </Text>
            )}
            <View style={styles.amountRow}>
              <Text style={styles.amountRupee}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="number-pad"
                value={topupAmount}
                onChangeText={setTopupAmount}
                placeholder="Amount"
                placeholderTextColor={MUTED}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.cancelBtn}
                disabled={topupSubmitting}
                onPress={() => setTopupModal(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.payBtn,
                  topupSubmitting && { opacity: 0.6 },
                ]}
                disabled={topupSubmitting}
                onPress={submitTopup}
              >
                {topupSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.payBtnText}>Pay & top up</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  addressSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  balanceLabel: { fontSize: 11, color: MUTED, marginBottom: 2 },
  balanceValue: { fontSize: 24, fontWeight: '700', color: THEME_COLOR },
  suggestedAmount: { fontSize: 14, fontWeight: '600', color: '#374151' },
  topupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME_COLOR,
    borderRadius: 10,
    paddingVertical: 12,
  },
  topupBtnText: { color: '#FFF', fontWeight: '600' },
  txHeader: {
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    marginTop: 12,
    paddingTop: 12,
  },
  txHeaderText: { fontSize: 11, color: MUTED, fontWeight: '600' },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  txType: { fontSize: 13, color: '#374151' },
  txAmount: { fontSize: 13, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalSub: { fontSize: 13, color: MUTED, marginTop: 4 },
  modalHint: { fontSize: 12, color: THEME_COLOR, marginTop: 8 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  amountRupee: { fontSize: 22, fontWeight: '700', color: '#374151' },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    padding: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  cancelBtnText: { color: '#374151', fontWeight: '600' },
  payBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: THEME_COLOR,
  },
  payBtnText: { color: '#FFF', fontWeight: '700' },
});

export default AutoOrderWalletsScreen;
