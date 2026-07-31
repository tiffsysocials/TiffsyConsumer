// src/components/PromoPopup.tsx
//
// Server-driven promotional pop-up shown on Home once per app session. Content
// comes from the `promoCampaign` systemconfig via GET /api/app/config.
//
// The key actionable bits — the coupon CODE and the VALIDITY — arrive as
// structured fields (not just buried in the prose body), so we surface them as
// highlighted elements: a tap-to-copy code chip and a "valid till" row.

import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Clipboard from '@react-native-clipboard/clipboard';

interface PromoPopupProps {
  visible: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  code?: string | null;
  validTill?: string | null;
  onCta: () => void;
  onClose: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Format the server's validTill (ISO / YYYY-MM-DD) as "31 Jul 2026". Manual
// formatting avoids Hermes/Android Intl gaps; falls back to the raw string.
function formatValidTill(v?: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const PromoPopup: React.FC<PromoPopupProps> = ({
  visible,
  title,
  body,
  ctaLabel,
  code,
  validTill,
  onCta,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const validLabel = formatValidTill(validTill);

  const handleCopy = () => {
    if (!code) return;
    Clipboard.setString(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="close" size={22} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>LIMITED-TIME OFFER</Text>
          </View>

          <Text style={styles.title}>{title}</Text>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.body}>{body}</Text>
          </ScrollView>

          {/* Highlighted, tap-to-copy coupon code — the primary action. */}
          {!!code && (
            <TouchableOpacity
              style={styles.codeChip}
              onPress={handleCopy}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Copy coupon code ${code}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.codeLabel}>{copied ? 'COPIED!' : 'TAP TO COPY CODE'}</Text>
                <Text style={styles.codeValue}>{code}</Text>
              </View>
              <View style={styles.codeCopyBtn}>
                <MaterialCommunityIcons
                  name={copied ? 'check' : 'content-copy'}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.codeCopyText}>{copied ? 'Copied' : 'Copy'}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Validity — small but distinct so it doesn't get lost in the prose. */}
          {!!validLabel && (
            <View style={styles.validRow}>
              <MaterialCommunityIcons name="clock-outline" size={14} color="#B45309" />
              <Text style={styles.validText}>Valid till {validLabel}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.cta} onPress={onCta} activeOpacity={0.9}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.dismiss}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  close: { position: 'absolute', top: 12, right: 12, zIndex: 2, padding: 4 },
  badge: {
    backgroundColor: '#FFF1E9',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  badgeText: { color: '#FE8733', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 10 },
  bodyScroll: { maxHeight: 180, alignSelf: 'stretch' },
  body: { fontSize: 15, lineHeight: 22, color: '#4B5563', textAlign: 'center' },
  // Coupon code chip — dashed, tinted, ticket-like; clearly the thing to grab.
  codeChip: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  codeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#C2410C' },
  codeValue: { fontSize: 22, fontWeight: '900', letterSpacing: 2, color: '#9A3412', marginTop: 2 },
  codeCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE8733',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 12,
  },
  codeCopyText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginLeft: 4 },
  validRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  validText: { fontSize: 13, fontWeight: '700', color: '#B45309', marginLeft: 5 },
  cta: {
    backgroundColor: '#FE8733',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignSelf: 'stretch',
    marginTop: 20,
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  dismiss: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', marginTop: 12 },
});

export default PromoPopup;
