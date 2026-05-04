// src/screens/account/AboutScreen.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { StackScreenProps } from '@react-navigation/stack';
import { MainTabParamList } from '../../types/navigation';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'About'>;

const ICON_COLOR = '#FFFFFF';
const ICON_BG = '#FE8733';

const AboutScreen: React.FC<Props> = ({ navigation }) => {
  const { isSmallDevice } = useResponsive();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View className="bg-white px-5 py-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="items-center justify-center"
          style={{
            width: SPACING.iconXl,
            height: SPACING.iconXl,
            borderRadius: SPACING.iconXl / 2,
            backgroundColor: '#FE8733',
          }}
        >
          {/* Chevron-left icon (Heroicons outline) */}
          <Svg width={SPACING.iconSize - 2} height={SPACING.iconSize - 2} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15.75 19.5 8.25 12l7.5-7.5"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        <Text className="font-bold text-gray-900" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>About</Text>

        <View style={{ minWidth: TOUCH_TARGETS.minimum, minHeight: TOUCH_TARGETS.minimum }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* About Us Section */}
        <View className="px-5 mt-6">
          <Text className="font-bold text-gray-900 mb-4" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>About Us</Text>

          <TouchableOpacity
            className="flex-row items-center bg-white rounded-2xl mb-3"
            style={{
              padding: SPACING.lg,
              minHeight: TOUCH_TARGETS.large,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 4,
            }}
            onPress={() => navigation.navigate('OurJourney')}
          >
            <View
              className="rounded-full items-center justify-center"
              style={{ width: SPACING.iconXl + 4, height: SPACING.iconXl + 4, backgroundColor: ICON_BG, borderRadius: (SPACING.iconXl + 4) / 2 }}
            >
              {/* Map icon — Our Journey (Heroicons outline) */}
              <Svg width={SPACING.iconSize} height={SPACING.iconSize} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.159.69.159 1.006 0Z"
                  stroke={ICON_COLOR}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text className="flex-1 font-medium text-gray-900" style={{ fontSize: FONT_SIZES.base, marginLeft: SPACING.lg }}>
              Our Journey
            </Text>
            <Image
              source={require('../../assets/icons/rightarrow.png')}
              style={{ width: SPACING.iconSize, height: SPACING.iconSize }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Legal Section */}
        <View className="px-5 mt-6">
          <Text className="font-bold text-gray-900 mb-4" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>Legal</Text>

          <View
            className="bg-white rounded-2xl overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            {/* Privacy Policy */}
            <TouchableOpacity
              className="flex-row items-center border-b border-gray-100"
              style={{ padding: SPACING.lg, minHeight: TOUCH_TARGETS.large }}
              onPress={() => {}}
            >
              <View
                className="rounded-full items-center justify-center"
                style={{ width: SPACING.iconXl + 4, height: SPACING.iconXl + 4, backgroundColor: ICON_BG, borderRadius: (SPACING.iconXl + 4) / 2 }}
              >
                {/* Shield-check icon — Privacy Policy (Heroicons outline) */}
                <Svg width={SPACING.iconSize} height={SPACING.iconSize} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                    stroke={ICON_COLOR}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text className="flex-1 font-medium text-gray-900" style={{ fontSize: FONT_SIZES.base, marginLeft: SPACING.lg }}>
                Privacy Policy
              </Text>
              <Image
                source={require('../../assets/icons/rightarrow.png')}
                style={{ width: SPACING.iconSize, height: SPACING.iconSize }}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* License & Agreement */}
            <TouchableOpacity
              className="flex-row items-center border-b border-gray-100"
              style={{ padding: SPACING.lg, minHeight: TOUCH_TARGETS.large }}
              onPress={() => {}}
            >
              <View
                className="rounded-full items-center justify-center"
                style={{ width: SPACING.iconXl + 4, height: SPACING.iconXl + 4, backgroundColor: ICON_BG, borderRadius: (SPACING.iconXl + 4) / 2 }}
              >
                {/* Document-text icon — License & Agreement (Heroicons outline) */}
                <Svg width={SPACING.iconSize} height={SPACING.iconSize} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    stroke={ICON_COLOR}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text className="flex-1 font-medium text-gray-900" style={{ fontSize: FONT_SIZES.base, marginLeft: SPACING.lg }}>
                License & Agreement
              </Text>
              <Image
                source={require('../../assets/icons/rightarrow.png')}
                style={{ width: SPACING.iconSize, height: SPACING.iconSize }}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* Refund Policy */}
            <TouchableOpacity
              className="flex-row items-center"
              style={{ padding: SPACING.lg, minHeight: TOUCH_TARGETS.large }}
              onPress={() => {}}
            >
              <View
                className="rounded-full items-center justify-center"
                style={{ width: SPACING.iconXl + 4, height: SPACING.iconXl + 4, backgroundColor: ICON_BG, borderRadius: (SPACING.iconXl + 4) / 2 }}
              >
                {/* Receipt-refund icon — Refund Policy (Heroicons outline) */}
                <Svg width={SPACING.iconSize} height={SPACING.iconSize} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M8.25 9.75h4.875a2.625 2.625 0 0 1 0 5.25H12M8.25 9.75 10.5 7.5M8.25 9.75 10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z"
                    stroke={ICON_COLOR}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text className="flex-1 font-medium text-gray-900" style={{ fontSize: FONT_SIZES.base, marginLeft: SPACING.lg }}>
                Refund Policy
              </Text>
              <Image
                source={require('../../assets/icons/rightarrow.png')}
                style={{ width: SPACING.iconSize, height: SPACING.iconSize }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Version */}
        <View className="px-5 mt-6 mb-8">
          <Text className="text-gray-500" style={{ fontSize: FONT_SIZES.sm }}>App version</Text>
          <Text className="text-gray-500 mt-1" style={{ fontSize: FONT_SIZES.sm }}>0.2.344</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AboutScreen;
