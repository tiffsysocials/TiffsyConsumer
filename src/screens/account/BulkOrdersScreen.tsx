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
          className="rounded-full bg-orange-400 items-center justify-center"
          style={{
            minWidth: TOUCH_TARGETS.minimum,
            minHeight: TOUCH_TARGETS.minimum,
          }}
        >
          <Image
            source={require('../../assets/icons/backarrow2.png')}
            style={{ width: SPACING.iconLg, height: SPACING.iconLg }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text className="font-bold text-gray-900" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>Bulk Orders</Text>

        <View style={{ minWidth: TOUCH_TARGETS.minimum, minHeight: TOUCH_TARGETS.minimum }} />
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-8">
        <Image
          source={require('../../assets/icons/bulkorders.png')}
          style={{ width: SPACING['4xl'] * 2, height: SPACING['4xl'] * 2, marginBottom: SPACING.xl }}
          resizeMode="contain"
        />
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
