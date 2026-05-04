// src/screens/onboarding/OnboardingScreen1.tsx
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Animated, Easing, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingScreenProps } from '../../types/navigation';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = OnboardingScreenProps<'OnboardingScreen1'>;

const OnboardingScreen1: React.FC<Props> = ({ navigation }) => {
  const { isSmallDevice, width } = useResponsive();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Automatic clockwise rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000, // 8 seconds for a full rotation
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [rotateAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleNext = () => {
    navigation.navigate('OnboardingScreen2');
  };

  const handleSkip = () => {
    navigation.navigate('Auth');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FE8733' }}>
      <StatusBar barStyle="light-content" backgroundColor="#FE8733" />
      <View className="flex-1 px-10">
        <View className="flex-1 justify-center" style={{ width: '100%' }}>
          {/* Background Image */}
          <Image
            source={require('../../assets/images/onboarding/fastfood.png')}
            style={{ width: 220, height: 230, marginLeft: -45, marginTop: -21, position: 'absolute', top: 0, left: 0, opacity: 0.04 }}
            resizeMode="cover"
          />

          {/* Text */}
          <Text
            style={{
              position: 'absolute',
              top: 110,
              left: 16,
              width: 284,
              height: 171,
              color: '#FFFFFF',
              fontSize: 48,
              lineHeight: 57,
              fontFamily: 'arbutusslab',
              letterSpacing: 0,
              textShadowColor: 'rgba(0, 0, 0, 0.3)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 4,
            }}
          >
            Taste{'\n'}Tasty Meals{'\n'}Every Days
          </Text>

          {/* Image */}
          <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 0 }}>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: rotateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.25,
                shadowRadius: 10,
                elevation: 10,
              }}
            >
              <Animated.Image
                source={require('../../assets/images/onboarding/onboarding1.png')}
                style={{ width: 250, height: 250, borderRadius: 140 }}
                resizeMode="cover"
              />
            </Animated.View>
          </View>

          {/* Dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 40 }}>
            <View
              style={{
                width: 18,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'white',
                marginHorizontal: 4,
              }}
            />
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.5)',
                marginHorizontal: 4,
              }}
            />
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.5)',
                marginHorizontal: 4,
              }}
            />
          </View>

          {/* Next button */}
          <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleNext}
            activeOpacity={1}
            style={{ marginTop: SPACING.lg }}
          >
            <Animated.View
              style={{
                backgroundColor: 'white',
                borderRadius: 50,
                paddingLeft: SPACING['2xl'],
                paddingRight: SPACING.sm,
                paddingVertical: SPACING.sm,
                minHeight: TOUCH_TARGETS.large,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: isSmallDevice ? width * 0.8 : 320,
                marginBottom: 0,
                alignSelf: 'center',
                transform: [{ scale: scaleAnim }],
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 5,
                elevation: 8,
              }}
            >
              <Text
                style={{
                  color: '#FE8733',
                  fontSize: FONT_SIZES.h4,
                  fontWeight: '600',
                  flex: 1,
                  textAlign: 'center',
                  marginRight: SPACING.sm,
                }}
              >
                Next
              </Text>
              <View
                style={{
                  backgroundColor: '#FE8733',
                  borderRadius: SPACING.iconXl / 2,
                  width: SPACING.iconXl + 4,
                  height: SPACING.iconXl + 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image
                  source={require('../../assets/icons/right.png')}
                  style={{
                    width: SPACING.iconLg,
                    height: SPACING.iconLg,
                  }}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Bottom nav & bar */}
        <View
          style={{
            position: 'absolute',
            bottom: 40,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: SPACING['2xl'],
          }}
        >
          <TouchableOpacity
            style={{
              paddingHorizontal: SPACING.md,
              paddingVertical: SPACING.sm,
              minHeight: TOUCH_TARGETS.minimum,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: FONT_SIZES.base, fontWeight: '500' }}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              paddingHorizontal: SPACING.md,
              paddingVertical: SPACING.sm,
              minHeight: TOUCH_TARGETS.minimum,
              justifyContent: 'center',
            }}
            onPress={handleSkip}
          >
            <Text style={{ color: 'white', fontSize: FONT_SIZES.base, fontWeight: '500' }}>Skip</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
};

export default OnboardingScreen1;
