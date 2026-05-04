// src/screens/notifications/AutoOrderFailureScreen.tsx
import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, Image, StatusBar } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import AutoOrderFailureModal from '../../components/AutoOrderFailureModal';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

// This screen is deprecated - AUTO_ORDER_FAILED notifications now route to AutoOrderSettings
type Props = StackScreenProps<any, 'AutoOrderFailure'>;

/**
 * Screen wrapper for Auto-Order Failure notifications
 * Displays the failure modal with navigation back button
 */
const AutoOrderFailureScreen: React.FC<Props> = ({ navigation, route }) => {
  const { failureCategory, mealWindow, message } = route.params;
  const { isSmallDevice } = useResponsive();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View className="bg-white px-5 py-4 flex-row items-center border-b border-gray-100">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="rounded-full bg-orange-400 items-center justify-center"
          style={{
            minWidth: TOUCH_TARGETS.minimum,
            minHeight: TOUCH_TARGETS.minimum,
          }}
        >
          <Image
            source={require('../../assets/icons/arrow.png')}
            style={{ width: SPACING.iconLg, height: SPACING.iconLg }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-bold text-gray-900" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3, marginRight: SPACING.iconXl }}>
          Auto-Order Failed
        </Text>
      </View>

      {/* Modal Display */}
      <AutoOrderFailureModal
        visible={true}
        failureCategory={failureCategory}
        mealWindow={mealWindow}
        message={message}
        onDismiss={() => navigation.goBack()}
        navigation={navigation}
      />
    </SafeAreaView>
  );
};

export default AutoOrderFailureScreen;
