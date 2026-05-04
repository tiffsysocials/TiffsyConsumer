// src/screens/onboarding/OnboardingScreen.tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Animated,
  Easing,
  ImageBackground,
  useWindowDimensions,
  Platform,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingScreenProps } from '../../types/navigation';

type Props = OnboardingScreenProps<'OnboardingScreen1'>;

interface PageContent {
  id: number;
  title: string;
  subtitle?: string;
  image: any;
  backgroundImage: any;
  imageAnimation: 'rotate' | 'float';
}

const pages: PageContent[] = [
  {
    id: 0,
    title: "Taste\nTasty Meals\nEvery Days",
    image: require('../../assets/images/onboarding/onboarding1.png'),
    backgroundImage: require('../../assets/images/onboarding/fastfood.png'),
    imageAnimation: 'rotate',
  },
  {
    id: 1,
    title: "Get Coupons\nFor Auto\nDelivery",
    subtitle: "Lorem ipsum dolor amet consectetur.\nAdipiscing ultricies dui morbi varius ac id.",
    image: require('../../assets/images/onboarding/onboarding2.png'),
    backgroundImage: require('../../assets/images/onboarding/couponbackground.png'),
    imageAnimation: 'float',
  },
  {
    id: 2,
    title: "Meals\nThat Feel\nLike Home",
    subtitle: "Lorem ipsum dolor amet consectetur.\nAdipiscing ultricies dui morbi varius acid.",
    image: require('../../assets/images/onboarding/onboarding3.png'),
    backgroundImage: require('../../assets/images/onboarding/home.png'),
    imageAnimation: 'float',
  },
];

const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isSmallDevice = SCREEN_HEIGHT < 700;
  const scale = Math.min(SCREEN_WIDTH / 375, 1.2);

  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const textFade = useRef(new Animated.Value(1)).current;
  const textScale = useRef(new Animated.Value(1)).current;
  const prevPageRef = useRef(0);

  // Rotation animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [rotateAnim]);

  // Float animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [floatAnim]);

  // Animate text blur/fade on page change
  useEffect(() => {
    if (prevPageRef.current !== currentPage) {
      prevPageRef.current = currentPage;
      textFade.setValue(0);
      textScale.setValue(0.92);
      Animated.parallel([
        Animated.timing(textFade, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(textScale, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentPage, textFade, textScale]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const slideIndex = Math.round(
          event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
        );
        if (slideIndex !== prevPageRef.current && slideIndex >= 0 && slideIndex < pages.length) {
          setCurrentPage(slideIndex);
        }
      },
    },
  );

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
    if (currentPage < pages.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: (currentPage + 1) * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      navigation.navigate('Auth');
    }
  };

  const handleSkip = () => {
    navigation.navigate('Auth');
  };

  const imageSize = isSmallDevice ? SCREEN_WIDTH * 0.55 : SCREEN_WIDTH * 0.65;
  const buttonWidth = Math.min(SCREEN_WIDTH * 0.85, 320);
  const contentPadding = Math.round(24 * scale);

  const getImageTransform = useCallback(
    (index: number) => {
      if (pages[index].imageAnimation === 'rotate') {
        return [
          {
            rotate: rotateAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            }),
          },
        ];
      }
      return [{ translateY: floatAnim }, { rotate: '-8deg' }];
    },
    [rotateAnim, floatAnim],
  );

  const currentData = pages[currentPage];

  // Animated dot widths
  const dotWidths = pages.map((_, i) =>
    scrollX.interpolate({
      inputRange: [
        (i - 1) * SCREEN_WIDTH,
        i * SCREEN_WIDTH,
        (i + 1) * SCREEN_WIDTH,
      ],
      outputRange: [8, 18, 8],
      extrapolate: 'clamp',
    }),
  );

  const dotOpacities = pages.map((_, i) =>
    scrollX.interpolate({
      inputRange: [
        (i - 1) * SCREEN_WIDTH,
        i * SCREEN_WIDTH,
        (i + 1) * SCREEN_WIDTH,
      ],
      outputRange: [0.5, 1, 0.5],
      extrapolate: 'clamp',
    }),
  );

  return (
    <SafeAreaView className="flex-1 bg-orange-400" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#FE8733" />

      {/* Skip Button */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 16,
          right: contentPadding,
          zIndex: 10,
        }}>
        <TouchableOpacity style={{ padding: 10 }} onPress={handleSkip}>
          <Text
            style={{
              color: 'white',
              fontSize: Math.round(15 * scale),
              fontWeight: '600',
            }}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {/* Text section - fixed height, animated with blur/fade */}
        <View
          style={{
            paddingHorizontal: contentPadding,
            paddingTop: isSmallDevice ? 50 : 70,
            height: isSmallDevice ? 190 : 220,
          }}>
          {/* Background image for current page */}
          <ImageBackground
            source={currentData.backgroundImage}
            style={{
              width: SCREEN_WIDTH * 0.55,
              height: SCREEN_WIDTH * (currentPage === 1 ? 0.75 : 0.6),
              position: 'absolute',
              top: currentPage === 1 ? -SCREEN_HEIGHT * 0.02 : 0,
              left: -SCREEN_WIDTH * 0.1 + contentPadding,
            }}
            resizeMode="cover"
            imageStyle={{
              opacity: 0.8,
              borderRadius: currentPage === 1 ? 100 : 0,
            }}
          />

          <Animated.View
            style={{
              opacity: textFade,
              transform: [{ scale: textScale }],
            }}>
            <Text
              style={{
                color: 'white',
                fontSize: Math.round(35 * scale),
                fontWeight: 'bold',
                lineHeight: Math.round(42 * scale),
              }}>
              {currentData.title}
            </Text>
            {currentData.subtitle && (
              <Text
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: Math.round(14 * scale),
                  marginTop: 10,
                  lineHeight: Math.round(20 * scale),
                }}>
                {currentData.subtitle}
              </Text>
            )}
          </Animated.View>
        </View>

        {/* Image carousel - slides horizontally, fixed in center */}
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
          }}>
          <Animated.ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            bounces={false}
            decelerationRate="fast">
            {pages.map((item, index) => (
              <View
                key={item.id}
                style={{
                  width: SCREEN_WIDTH,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Animated.View
                  style={{
                    transform: getImageTransform(index),
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                    elevation: 10,
                  }}>
                  <Animated.Image
                    source={item.image}
                    style={{
                      width: imageSize,
                      height:
                        imageSize *
                        (index === 0 ? 1 : index === 2 ? 0.7 : 0.85),
                      borderRadius: index === 0 ? imageSize / 2 : 0,
                    }}
                    resizeMode={index === 0 ? 'cover' : 'contain'}
                  />
                </Animated.View>
              </View>
            ))}
          </Animated.ScrollView>
        </View>

        {/* Animated Pagination Dots */}
        <View
          style={{
            paddingVertical: isSmallDevice ? 10 : 15,
            alignItems: 'center',
          }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            {pages.map((_, dotIndex) => (
              <Animated.View
                key={dotIndex}
                style={{
                  width: dotWidths[dotIndex],
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'white',
                  opacity: dotOpacities[dotIndex],
                  marginHorizontal: 4,
                }}
              />
            ))}
          </View>
        </View>

        {/* Bottom Button */}
        <View
          style={{
            paddingHorizontal: contentPadding,
            paddingBottom:
              Platform.OS === 'android' ? insets.bottom + 12 : 12,
          }}>
          <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleNext}
            activeOpacity={1}>
            <Animated.View
              style={{
                backgroundColor: 'white',
                borderRadius: 50,
                paddingHorizontal: 24,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                width: buttonWidth,
                alignSelf: 'center',
                transform: [{ scale: scaleAnim }],
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 5,
                elevation: 8,
              }}>
              <Text
                style={{
                  color: '#FE8733',
                  fontSize: Math.round(16 * scale),
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                {currentPage === pages.length - 1 ? 'Get Started' : 'Next'}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default OnboardingScreen;
