/**
 * SubscriptionPaymentDetailModal — bottom-sheet style modal showing
 * the breakdown for a single PaymentTransaction row (purchase type
 * SUBSCRIPTION). Surfaces:
 *
 *   - Plan name + voucher count
 *   - Razorpay payment & order IDs
 *   - Payment method (UPI / CARD / etc.)
 *   - Captured date
 *   - Status pill
 *   - Breakdown rows: subtotal, GST, wallet credit
 *     (autoOrderSetupPrepaidFees for Phase 11 bundled purchases),
 *     total
 *   - autoOrderSetupQuote.totalDeliveries when present, to explain
 *     "₹X credited to wallet for N upcoming deliveries"
 *
 * Triggered by tapping a row in SubscriptionsTab. Tap-outside or the
 * Close button dismisses.
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { FONT_SIZES } from '../../../constants/typography';
import type { SubscriptionPaymentTx } from './SubscriptionsTab';

const PRIMARY = '#FE8733';
const MUTED = '#6B7280';
const TEXT = '#111827';
const BORDER = '#E5E7EB';
const GREEN = '#059669';
const RED = '#DC2626';
const BLUE = '#2563EB';

function formatINR(n: number | undefined | null): string {
  if (n === undefined || n === null) return '0';
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? `${r}` : r.toFixed(2);
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function statusMeta(status: string) {
  const s = status?.toUpperCase?.() || '';
  if (s === 'CAPTURED' || s === 'PAID') {
    return { color: GREEN, tint: '#ECFDF5', label: 'Paid' };
  }
  if (s === 'REFUNDED' || s === 'PARTIALLY_REFUNDED') {
    return { color: BLUE, tint: '#EFF6FF', label: s === 'REFUNDED' ? 'Refunded' : 'Partially refunded' };
  }
  if (s === 'FAILED' || s === 'EXPIRED') {
    return { color: RED, tint: '#FEF2F2', label: s === 'FAILED' ? 'Failed' : 'Expired' };
  }
  return { color: MUTED, tint: '#F3F4F6', label: 'Pending' };
}

type Props = {
  tx: SubscriptionPaymentTx | null;
  planName: string;
  vouchersIssued: number | null;
  onClose: () => void;
};

const KV: React.FC<{ label: string; value: React.ReactNode; valueStyle?: any }> = ({ label, value, valueStyle }) => (
  <View style={styles.kvRow}>
    <Text style={styles.kvLabel}>{label}</Text>
    <Text style={[styles.kvValue, valueStyle]}>{value}</Text>
  </View>
);

const SubscriptionPaymentDetailModal: React.FC<Props> = ({ tx, planName, vouchersIssued, onClose }) => {
  if (!tx) return null;
  const m = statusMeta(tx.status);
  const when = tx.paidAt || tx.createdAt;
  const subtotal = tx.breakdown?.subtotal;
  const tax = tx.breakdown?.tax;
  // Phase 11 bundled purchases carry both the pack price (subtotal +
  // tax) AND the auto-order wallet credit. Surface that credit
  // explicitly so the customer can see where their money went.
  const walletCredit = tx.breakdown?.autoOrderSetupPrepaidFees;
  const totalDeliveries = tx.notes?.autoOrderSetupQuote?.totalDeliveries;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{planName}</Text>
              {vouchersIssued !== null && (
                <Text style={styles.subtitle}>
                  {vouchersIssued} voucher{vouchersIssued === 1 ? '' : 's'} issued
                </Text>
              )}
            </View>
            <View style={[styles.statusPill, { backgroundColor: m.tint }]}>
              <Text style={[styles.statusPillText, { color: m.color }]}>{m.label}</Text>
            </View>
          </View>

          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Total paid</Text>
            <Text style={styles.amountValue}>₹{formatINR(tx.amountRupees)}</Text>
            <Text style={styles.amountWhen}>{fmtDateTime(when)}</Text>
          </View>

          <Text style={styles.sectionTitle}>Breakdown</Text>
          <View style={styles.section}>
            {subtotal !== undefined && (
              <KV label="Voucher pack" value={`₹${formatINR(subtotal)}`} />
            )}
            {tax !== undefined && tax > 0 && (
              <KV label="GST" value={`₹${formatINR(tax)}`} />
            )}
            {walletCredit !== undefined && walletCredit > 0 && (
              <KV
                label={totalDeliveries
                  ? `Wallet credit (for ${totalDeliveries} deliveries)`
                  : 'Wallet credit'}
                value={`₹${formatINR(walletCredit)}`}
              />
            )}
            <View style={styles.divider} />
            <KV
              label="Total"
              value={`₹${formatINR(tx.amountRupees)}`}
              valueStyle={{ fontWeight: '700', color: TEXT }}
            />
          </View>

          <Text style={styles.sectionTitle}>Payment details</Text>
          <View style={styles.section}>
            {tx.razorpayPaymentId && (
              <KV
                label="Payment ID"
                value={<Text style={styles.mono}>{tx.razorpayPaymentId}</Text>}
              />
            )}
            <KV
              label="Order ID"
              value={<Text style={styles.mono}>{tx.razorpayOrderId}</Text>}
            />
            {tx.paymentMethod && (
              <KV label="Method" value={tx.paymentMethod} />
            )}
            <KV label="Status" value={m.label} valueStyle={{ color: m.color, fontWeight: '700' }} />
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.85}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    maxHeight: '85%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: { fontSize: FONT_SIZES.h4, fontWeight: '700', color: TEXT },
  subtitle: { fontSize: FONT_SIZES.sm, color: MUTED, marginTop: 4 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 8,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  amountCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 20,
  },
  amountLabel: { fontSize: FONT_SIZES.sm, color: '#9A3412', fontWeight: '600' },
  amountValue: { fontSize: 28, fontWeight: '700', color: PRIMARY, marginTop: 2, lineHeight: 34 },
  amountWhen: { fontSize: FONT_SIZES.xs, color: MUTED, marginTop: 4 },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  section: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 18,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  kvLabel: { fontSize: FONT_SIZES.sm, color: MUTED, flexShrink: 1, marginRight: 12 },
  kvValue: { fontSize: FONT_SIZES.sm, color: TEXT, fontWeight: '600', textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: 12, color: TEXT },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },
  closeBtn: {
    marginTop: 4,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: FONT_SIZES.base, fontWeight: '700' },
});

export default SubscriptionPaymentDetailModal;
