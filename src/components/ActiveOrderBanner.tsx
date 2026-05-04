import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SPACING, TOUCH_TARGETS } from '../constants/spacing';
import { FONT_SIZES } from '../constants/typography';

interface ActiveOrderBannerProps {
  title: string;
  subtitle: string;
  hasLunch: boolean;
  hasDinner: boolean;
  onPress: () => void;
}

// iOS shadows render softer/more diffuse than Android elevation.
// Android uses elevation only; iOS uses the shadow* props.
const platformShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  android: {
    elevation: 8,
    shadowColor: '#000',
  },
  default: {},
});

const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({
  title,
  subtitle,
  hasLunch,
  hasDinner,
  onPress,
}) => {
  // Pick the most relevant thali image — dinner takes precedence if both
  const image = hasDinner
    ? require('../assets/images/homepage/dinnerThali.png')
    : require('../assets/images/homepage/lunchThali.png');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        marginHorizontal: SPACING.lg,
        minHeight: TOUCH_TARGETS.comfortable,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderLeftWidth: 4,
        borderLeftColor: '#FE8733',
        ...platformShadow,
      }}
    >
      <Image
        source={image}
        style={{ width: 44, height: 44, borderRadius: 8 }}
        resizeMode="cover"
      />

      <View style={{ flex: 1, marginLeft: SPACING.md }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: FONT_SIZES.sm,
            fontWeight: '700',
            color: '#111827',
          }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontSize: FONT_SIZES.xs,
            color: '#6B7280',
            marginTop: 2,
          }}
        >
          {subtitle}
        </Text>
      </View>

      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M9 6l6 6-6 6"
          stroke="#FE8733"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  );
};

export default ActiveOrderBanner;
