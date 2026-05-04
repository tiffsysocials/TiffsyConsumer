// src/screens/ondemand/OnDemandScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { MainTabParamList } from '../../types/navigation';
import { useSubscription } from '../../context/SubscriptionContext';
import { useUser } from '../../context/UserContext';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'OnDemand'>;

const OnDemandScreen: React.FC<Props> = ({ navigation }) => {
  const { usableVouchers } = useSubscription();
  const { isGuest } = useUser();
  const { isSmallDevice } = useResponsive();
  const insets = useSafeAreaInsets();

  console.log('[OnDemandScreen] Screen rendered');

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient
        colors={['#FD9E2F', '#FF6636']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
          paddingBottom: 24,
                  }}
      >
        <SafeAreaView edges={['top']}>
        {/* Decorative Background Elements */}
        <Image
          source={require('../../assets/images/homepage/halfcircle.png')}
          style={{ position: 'absolute', top: insets.top - 90, right: -125, width: 300, height: 380 }}
          resizeMode="contain"
        />
        <Image
          source={require('../../assets/images/homepage/halfline.png')}
          style={{ position: 'absolute', top: insets.top + 30, right: -150, width: 380, height: 150 }}
          resizeMode="contain"
        />

        <View className="flex-row items-center justify-between px-5 pt-4 pb-6">
          {/* Logo */}
          <View style={{ width: isSmallDevice ? SPACING.iconXl * 1.2 : SPACING.iconXl * 1.45 }}>
            <Image
              source={require('../../assets/icons/Tiffsy.png')}
              style={{
                width: isSmallDevice ? SPACING.iconXl * 1.2 : SPACING.iconXl * 1.45,
                height: isSmallDevice ? SPACING.iconXl * 0.7 : SPACING.iconXl * 0.875,
                borderRadius: 8,
              }}
              resizeMode="contain"
            />
          </View>

          {/* Title — matches "My Profile" sizing (FONT_SIZES.h4) for consistent header typography across screens */}
          <Text style={{ color: 'white', fontSize: FONT_SIZES.h4, fontWeight: 'bold' }}>
            On-Demand
          </Text>

          {/* Voucher Button — hidden in guest mode; replaced with an invisible spacer of the same width as the logo so the title stays visually centered */}
          {isGuest ? (
            <View style={{ width: isSmallDevice ? SPACING.iconXl * 1.2 : SPACING.iconXl * 1.45 }} />
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('MealPlans')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'white',
                borderRadius: SPACING.lg,
                paddingVertical: SPACING.xs + 1,
                paddingHorizontal: SPACING.sm,
                gap: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Image
                source={require('../../assets/icons/voucher5.png')}
                style={{ width: SPACING.iconSm + 2, height: SPACING.iconSm + 2 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: 'bold', color: '#FE8733' }}>{usableVouchers}</Text>
            </TouchableOpacity>
          )}
        </View>
              </SafeAreaView>
      </LinearGradient>

      {/* Content Area */}
      <View
        className="flex-1 bg-white items-center justify-center"
        style={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Coming Soon Content */}
        <View className="items-center px-8">
          <Svg
            width={isSmallDevice ? SPACING['4xl'] * 1.5 : SPACING['4xl'] * 2}
            height={isSmallDevice ? SPACING['4xl'] * 1.5 : SPACING['4xl'] * 2}
            viewBox="0 0 24 24"
            fill="none"
            style={{ marginBottom: SPACING['2xl'] }}
          >
            <Path
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              stroke="#FE8733"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text
            className="font-bold text-gray-900 mb-4"
            style={{ fontSize: isSmallDevice ? FONT_SIZES.h2 : FONT_SIZES.h1 }}
          >
            Coming Soon
          </Text>
          <Text
            className="text-gray-500 text-center"
            style={{ fontSize: FONT_SIZES.base, lineHeight: FONT_SIZES.base * 1.5 }}
          >
            We're working hard to bring you on-demand meal ordering. Stay tuned for updates!
          </Text>
        </View>
      </View>
    </View>
  );
};

export default OnDemandScreen;
