// src/components/PromoPopup.tsx
//
// Server-driven promotional pop-up shown on Home once per app session. Content
// comes from the `promoCampaign` systemconfig via GET /api/app/config.

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface PromoPopupProps {
  visible: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
  onClose: () => void;
}

const PromoPopup: React.FC<PromoPopupProps> = ({ visible, title, body, ctaLabel, onCta, onClose }) => {
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
  bodyScroll: { maxHeight: 220, alignSelf: 'stretch' },
  body: { fontSize: 15, lineHeight: 22, color: '#4B5563', textAlign: 'center' },
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
