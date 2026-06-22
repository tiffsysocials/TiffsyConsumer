/**
 * SubscriptionsTab — list of every voucher-pack purchase the customer
 * has made. Mounted inside VouchersScreen under the "Subscriptions"
 * top-level tab.
 *
 * Data source: GET /api/payment/history?purchaseType=SUBSCRIPTION
 * (already exposed via apiService.getPaymentHistory). Rows are joined
 * client-side against SubscriptionContext.subscriptions[] to enrich
 * each transaction with its plan name + voucher-count when the
 * subscription record is still around. Falls back to the snapshot
 * stored on transaction.notes when the join misses.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiService from '../../../services/api.service';
import { useSubscription } from '../../../context/SubscriptionContext';
import { FONT_SIZES } from '../../../constants/typography';
import SubscriptionPaymentDetailModal from './SubscriptionPaymentDetailModal';

const PRIMARY = '#FE8733';
const MUTED = '#6B7280';
const TEXT = '#111827';
const GREEN = '#059669';
const RED = '#DC2626';
const BLUE = '#2563EB';

export type SubscriptionPaymentTx = {
  _id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  purchaseType: 'ORDER' | 'SUBSCRIPTION';
  referenceId?: string | null;
  status: string;
  amountRupees: number;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
  breakdown?: {
    subtotal?: number;
    tax?: number;
    autoOrderWalletTopup?: number;
    autoOrderSetupPrepaidFees?: number;
    [k: string]: number | undefined;
  };
  notes?: {
    planName?: string;
    totalVouchers?: number;
    durationDays?: number;
    autoOrderSetupQuote?: { totalFeesPrepaid?: number; totalDeliveries?: number };
    [k: string]: any;
  };
};

function formatINR(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? `${r}` : r.toFixed(2);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Status-driven icon, color, and tint. Treats AUTHORIZED as pending so
// a Razorpay race window doesn't render as a hard failure.
function statusMeta(status: string) {
  const s = status?.toUpperCase?.() || '';
  if (s === 'CAPTURED' || s === 'PAID') {
    return { icon: 'check-circle', color: GREEN, tint: '#ECFDF5', label: 'Paid' };
  }
  if (s === 'REFUNDED' || s === 'PARTIALLY_REFUNDED') {
    return { icon: 'undo-variant', color: BLUE, tint: '#EFF6FF', label: s === 'REFUNDED' ? 'Refunded' : 'Part. refunded' };
  }
  if (s === 'FAILED' || s === 'EXPIRED') {
    return { icon: 'close-circle', color: RED, tint: '#FEF2F2', label: s === 'FAILED' ? 'Failed' : 'Expired' };
  }
  // CREATED / AUTHORIZED — payment didn't capture (most often abandoned
  // checkout). Render muted so it doesn't look like a debit.
  return { icon: 'clock-outline', color: MUTED, tint: '#F3F4F6', label: 'Pending' };
}

type RowProps = {
  tx: SubscriptionPaymentTx;
  planName: string;
  vouchersIssued: number | null;
  onPress: () => void;
};

const TxRow: React.FC<RowProps> = ({ tx, planName, vouchersIssued, onPress }) => {
  const m = statusMeta(tx.status);
  // Pick the most informative timestamp we have. paidAt only exists once
  // Razorpay captures, so fall back to createdAt (order-create time)
  // for FAILED / CREATED rows.
  const when = tx.paidAt || tx.createdAt;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.row}>
      <View style={[styles.iconBubble, { backgroundColor: m.tint }]}>
        <MaterialCommunityIcons name={m.icon} size={20} color={m.color} />
      </View>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{planName}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {vouchersIssued !== null
            ? `${vouchersIssued} voucher${vouchersIssued === 1 ? '' : 's'} • ${fmtDate(when)}`
            : fmtDate(when)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.rowAmount}>₹{formatINR(tx.amountRupees)}</Text>
        <View style={[styles.statusPill, { backgroundColor: m.tint }]}>
          <Text style={[styles.statusPillText, { color: m.color }]}>{m.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

type Props = {
  onNavigateToPlans: () => void;
};

const PAGE_SIZE = 50;

const SubscriptionsTab: React.FC<Props> = ({ onNavigateToPlans }) => {
  const { subscriptions } = useSubscription();
  const [transactions, setTransactions] = useState<SubscriptionPaymentTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<SubscriptionPaymentTx | null>(null);

  const fetchPage = useCallback(async (skip: number): Promise<SubscriptionPaymentTx[]> => {
    const res = await apiService.getPaymentHistory({
      purchaseType: 'SUBSCRIPTION',
      limit: PAGE_SIZE,
      skip,
    });
    if (res?.success && res.data?.transactions) {
      return res.data.transactions as SubscriptionPaymentTx[];
    }
    return [];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPage(0);
      setTransactions(list);
      setHasMore(list.length === PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message || 'Failed to load subscription payments');
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await fetchPage(0);
      setTransactions(list);
      setHasMore(list.length === PAGE_SIZE);
    } catch {
      // keep existing list on refresh failure — no clobber
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const more = await fetchPage(transactions.length);
      if (more.length === 0) {
        setHasMore(false);
      } else {
        setTransactions((prev) => [...prev, ...more]);
        if (more.length < PAGE_SIZE) setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, transactions.length, fetchPage]);

  useEffect(() => {
    load();
  }, [load]);

  // Resolve plan name + vouchers-issued for a row. Prefer the live
  // Subscription doc (in case the user has it open across two tabs and
  // the count moved); fall back to the snapshot in transaction.notes.
  const resolveRowMeta = useCallback(
    (tx: SubscriptionPaymentTx): { planName: string; vouchersIssued: number | null } => {
      const sub = tx.referenceId
        ? subscriptions.find((s) => s._id === tx.referenceId)
        : undefined;
      const planName =
        sub?.planSnapshot?.name ||
        tx.notes?.planName ||
        'Voucher pack';
      const vouchersIssued =
        sub?.totalVouchersIssued ??
        tx.notes?.totalVouchers ??
        null;
      return { planName, vouchersIssued };
    },
    [subscriptions],
  );

  const renderItem = ({ item }: { item: SubscriptionPaymentTx }) => {
    const meta = resolveRowMeta(item);
    return (
      <TxRow
        tx={item}
        planName={meta.planName}
        vouchersIssued={meta.vouchersIssued}
        onPress={() => setSelectedTx(item)}
      />
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading purchases...</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F3F4F6', marginLeft: 70 }} />}
          ListEmptyComponent={
            error ? (
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color={RED} />
                <Text style={styles.emptyTitle}>Couldn't load purchases</Text>
                <Text style={styles.emptyBody}>{error}</Text>
                <TouchableOpacity onPress={load} style={styles.ctaBtn}>
                  <Text style={styles.ctaBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons name="receipt" size={48} color={MUTED} />
                <Text style={styles.emptyTitle}>No purchases yet</Text>
                <Text style={styles.emptyBody}>
                  You haven't bought any voucher packs yet. Browse plans to get started.
                </Text>
                <TouchableOpacity onPress={onNavigateToPlans} style={styles.ctaBtn}>
                  <Text style={styles.ctaBtnText}>View Meal Plans</Text>
                </TouchableOpacity>
              </View>
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={PRIMARY} />
              </View>
            ) : null
          }
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
      )}

      <SubscriptionPaymentDetailModal
        tx={selectedTx}
        planName={selectedTx ? resolveRowMeta(selectedTx).planName : ''}
        vouchersIssued={selectedTx ? resolveRowMeta(selectedTx).vouchersIssued : null}
        onClose={() => setSelectedTx(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  iconBubble: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  rowTitle: { fontSize: FONT_SIZES.base, fontWeight: '600', color: TEXT },
  rowSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  rowAmount: { fontSize: FONT_SIZES.base, fontWeight: '700', color: TEXT },
  statusPill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: MUTED, fontSize: FONT_SIZES.sm },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 32 },
  emptyTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: TEXT, marginTop: 14 },
  emptyBody: { fontSize: FONT_SIZES.sm, color: MUTED, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  ctaBtn: { marginTop: 18, backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZES.base },
});

export default SubscriptionsTab;
