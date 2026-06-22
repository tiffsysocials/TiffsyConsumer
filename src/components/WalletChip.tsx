// src/components/WalletChip.tsx
//
// Compact wallet balance chip — mirrors the voucher chip styling used in
// HomeScreen / AccountScreen / VouchersScreen so the two read as one logical
// pair when placed side by side. Owns no data; the parent passes the balance
// in from useSubscription().

import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING } from '../constants/spacing';
import { FONT_SIZES } from '../constants/typography';

interface WalletChipProps {
  balance: number;
  onPress?: () => void;
  // 'sm' matches the cramped header chip (Home/Account header). 'md' is the
  // slightly roomier variant used inside cards/sections (VouchersScreen body).
  size?: 'sm' | 'md';
  // Optional inline ref + onLayout — lets the existing tour-target system in
  // HomeScreen attach to the chip if/when the wallet ever needs an
  // onboarding callout.
  innerRef?: React.Ref<View>;
  onLayout?: (event: import('react-native').LayoutChangeEvent) => void;
}

const WalletChip: React.FC<WalletChipProps> = ({
  balance,
  onPress,
  size = 'sm',
  innerRef,
  onLayout,
}) => {
  const isMd = size === 'md';
  const iconSize = isMd ? SPACING.iconSm + 2 : SPACING.iconSm;
  const textSize = isMd ? FONT_SIZES.sm : FONT_SIZES.xs;
  // Whole rupees when integer, two decimals otherwise — same rule
  // formatINR() uses in the subscription/cart screens.
  const formatted = (() => {
    const rounded = Math.round(balance * 100) / 100;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
  })();

  return (
    <TouchableOpacity
      ref={innerRef as React.Ref<any>}
      onLayout={onLayout}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      // 'md' mirrors the voucher chip's header styling 1:1 (same
      // borderRadius/paddings/gap/shadow) so the wallet + voucher pair
      // visually matches as one unit on every gradient header.
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: isMd ? SPACING.lg : SPACING.md,
        paddingVertical: isMd ? SPACING.xs + 1 : SPACING.xs,
        paddingHorizontal: isMd ? SPACING.sm : SPACING.sm - 2,
        gap: isMd ? 4 : 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isMd ? 0.1 : 0,
        shadowRadius: 4,
        elevation: isMd ? 3 : 0,
      }}
    >
      <MaterialCommunityIcons name="wallet-outline" size={iconSize} color="#FE8733" />
      <Text style={{ fontSize: textSize, fontWeight: 'bold', color: '#FE8733' }}>
        ₹{formatted}
      </Text>
    </TouchableOpacity>
  );
};

export default WalletChip;
