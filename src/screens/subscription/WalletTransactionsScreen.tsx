/**
 * Phase 11.1 — Wallet Transactions screen.
 *
 * Shows every globalWallet transaction across the user's subscriptions
 * (deposits, deductions, refunds, adjustments) with the running balance.
 * Sticky top card with the LIVE balance + a one-line legend explaining
 * each transaction colour code. Paginates 50 at a time.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import apiService from '../../services/api.service';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

const PRIMARY = '#FE8733';
const PRIMARY_TINT = '#FFF7ED';
const BG = '#F9FAFB';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const TEXT = '#111827';
const GREEN = '#059669';
const RED = '#DC2626';
const BLUE = '#2563EB';

type Tx = {
  subscriptionId: string;
  type: 'DEPOSIT' | 'DEDUCTION' | 'REFUND_CREDIT' | 'ADJUSTMENT';
  source: 'PACK_PURCHASE' | 'TOPUP' | 'AUTO_ORDER' | 'MANUAL' | 'MIGRATION';
  amount: number;
  orderId: string | null;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: string;
  note: string | null;
};

function formatINR(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? `${r}` : r.toFixed(2);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function txMeta(t: Tx) {
  if (t.type === 'DEPOSIT') {
    return {
      icon: 'plus-circle',
      color: GREEN,
      tint: '#ECFDF5',
      sign: '+',
      title:
        t.source === 'PACK_PURCHASE' ? 'Pack purchase'
          : t.source === 'TOPUP' ? 'Wallet top-up'
          : t.source === 'MIGRATION' ? 'Wallet migration'
          : 'Wallet credit',
    };
  }
  if (t.type === 'REFUND_CREDIT') {
    return {
      icon: 'undo-variant',
      color: BLUE,
      tint: '#EFF6FF',
      sign: '+',
      title: 'Refund credit',
    };
  }
  if (t.type === 'DEDUCTION') {
    return {
      icon: 'minus-circle',
      color: RED,
      tint: '#FEF2F2',
      sign: '-',
      title:
        t.source === 'AUTO_ORDER' ? 'Auto-order delivery'
          : t.source === 'MANUAL' ? 'Manual order'
          : 'Wallet debit',
    };
  }
  return {
    icon: 'sync-circle',
    color: MUTED,
    tint: '#F3F4F6',
    sign: '',
    title: 'Adjustment',
  };
}

export default function WalletTransactionsScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [balance, setBalance] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE_SIZE = 50;

  const fetchPage = useCallback(async (offset: number) => {
    const res = await apiService.getWalletTransactions({ limit: PAGE_SIZE, offset });
    if (res?.success && res.data) {
      setBalance(res.data.currentBalance);
      setTotal(res.data.total);
      return res.data.transactions as Tx[];
    }
    return [];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchPage(0);
      setTransactions(list);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await fetchPage(0);
      setTransactions(list);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  const onEndReached = useCallback(async () => {
    if (loadingMore) return;
    if (transactions.length >= total) return;
    setLoadingMore(true);
    try {
      const more = await fetchPage(transactions.length);
      setTransactions(prev => [...prev, ...more]);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, transactions.length, total, fetchPage]);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: Tx }) => {
    const m = txMeta(item);
    return (
      <View style={styles.row}>
        <View style={[styles.iconBubble, { backgroundColor: m.tint }]}>
          <MaterialCommunityIcons name={m.icon} size={20} color={m.color} />
        </View>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{m.title}</Text>
          <Text style={styles.rowTime}>{fmtTime(item.timestamp)}</Text>
          {!!item.note && (
            <Text style={styles.rowNote} numberOfLines={2}>{item.note}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.rowAmount, { color: m.color }]}>
            {m.sign}₹{formatINR(item.amount)}
          </Text>
          <Text style={styles.rowBalance}>Bal ₹{formatINR(item.balanceAfter)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <LinearGradient
        colors={['#FD9E2F', '#FF6636']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientHeader}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Polyline points="15,18 9,12 15,6" stroke={PRIMARY} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>Wallet Transactions</Text>
            <View style={{ width: TOUCH_TARGETS.minimum }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        data={transactions}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <View>
            {/* Balance card */}
            <View style={{ marginHorizontal: 16, marginTop: SPACING.lg, marginBottom: 12 }}>
              <View style={styles.balanceCard}>
                <View style={styles.balanceIcon}>
                  <MaterialCommunityIcons name="wallet" size={28} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.balanceLabel}>Current balance</Text>
                  <Text style={styles.balanceAmount}>₹{formatINR(balance)}</Text>
                </View>
              </View>
            </View>
            {/* Section header */}
            {transactions.length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 6, height: 22, backgroundColor: PRIMARY, borderRadius: 999, marginRight: 10 }} />
                  <Text style={{ fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: TEXT }}>
                    History
                  </Text>
                  <Text style={{ marginLeft: 'auto', fontSize: FONT_SIZES.xs, color: MUTED }}>
                    {total} total
                  </Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="wallet-outline" size={48} color={MUTED} />
              <Text style={styles.emptyTitle}>No wallet activity yet</Text>
              <Text style={styles.emptyBody}>
                Wallet transactions appear here when you buy a voucher pack or pay for an order with your wallet.
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="small" color={PRIMARY} />
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ alignItems: 'center', paddingVertical: 18 }}>
              <ActivityIndicator size="small" color={PRIMARY} />
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F3F4F6', marginLeft: 70 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  gradientHeader: {
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    paddingBottom: 16, overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
  },
  backBtn: {
    width: TOUCH_TARGETS.minimum, height: TOUCH_TARGETS.minimum,
    borderRadius: TOUCH_TARGETS.minimum / 2, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff', fontSize: FONT_SIZES.h4, fontWeight: 'bold', flex: 1, textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: PRIMARY_TINT,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  balanceIcon: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  balanceLabel: { fontSize: FONT_SIZES.sm, color: '#9A3412', fontWeight: '600' },
  balanceAmount: { fontSize: 28, fontWeight: 'bold', color: PRIMARY, lineHeight: 34, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  iconBubble: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  rowTitle: { fontSize: FONT_SIZES.base, fontWeight: '600', color: TEXT },
  rowTime: { fontSize: 11, color: MUTED, marginTop: 2 },
  rowNote: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' },
  rowAmount: { fontSize: FONT_SIZES.base, fontWeight: '700' },
  rowBalance: { fontSize: 11, color: MUTED, marginTop: 2 },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: TEXT,
    marginTop: 14,
  },
  emptyBody: {
    fontSize: FONT_SIZES.sm,
    color: MUTED,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
