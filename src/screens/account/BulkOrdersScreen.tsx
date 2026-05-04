// src/screens/account/BulkOrdersScreen.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import Svg, { Path } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'BulkOrders'>;

const BulkOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const { isSmallDevice } = useResponsive();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View className="px-5 py-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: SPACING.iconXl,
            height: SPACING.iconXl,
            borderRadius: SPACING.iconXl / 2,
            backgroundColor: '#FE8733',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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

        <Text className="font-bold text-gray-900" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>Bulk Orders</Text>

        <View style={{ minWidth: TOUCH_TARGETS.minimum, minHeight: TOUCH_TARGETS.minimum }} />
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-8">
        <View
          style={{
            width: SPACING['4xl'] * 2,
            height: SPACING['4xl'] * 2,
            borderRadius: SPACING['4xl'],
            backgroundColor: '#FE8733',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: SPACING.xl,
          }}
        >
          <Svg width={SPACING['4xl'] * 1.1} height={SPACING['4xl'] * 1.1} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6.75 3v1.5M17.25 3v1.5M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
              stroke="#FFFFFF"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <Text className="font-bold text-gray-900 mb-3" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>
          Bulk Meal Scheduling
        </Text>
        <Text className="text-gray-500 text-center mb-6" style={{ fontSize: FONT_SIZES.base, lineHeight: FONT_SIZES.base * 1.5 }}>
          Schedule meals for multiple days at once. Select slots from the calendar, review pricing, and pay in one go.
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('MealCalendar')}
          style={{
            backgroundColor: '#FE8733',
            borderRadius: 12,
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING['2xl'],
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <MaterialCommunityIcons name="calendar-multiple" size={20} color="white" style={{ marginRight: SPACING.sm }} />
          <Text style={{ color: 'white', fontSize: FONT_SIZES.base, fontWeight: '700' }}>Open Meal Calendar</Text>
        </TouchableOpacity>

        <Text className="text-gray-400 text-center mt-4" style={{ fontSize: FONT_SIZES.xs, lineHeight: FONT_SIZES.xs * 1.5 }}>
          Select multiple meal slots from the calendar, then continue to see pricing and complete your order.
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default BulkOrdersScreen;
