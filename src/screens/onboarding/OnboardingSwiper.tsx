// src/screens/onboarding/OnboardingSwiper.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Animated,
  Easing,
  ImageBackground,
  Image,
  FlatList,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingScreenProps } from '../../types/navigation';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = OnboardingScreenProps<'OnboardingScreen1'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  description?: string;
  backgroundImage: any;
  mainImage: any;
  backgroundStyle: object;
  backgroundImageStyle?: object;
  animationType: 'rotate' | 'float';
  imageStyle?: object;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Taste\nTasky Meals\nEvery Days',
    backgroundImage: require('../../assets/images/onboarding/fastfood.png'),
    mainImage: require('../../assets/images/onboarding/onboarding1.png'),
    backgroundStyle: {
      width: 220,
      height: 230,
      paddingLeft: 0,
      marginLeft: -45,
      paddingRight: 8,
      marginTop: -21,
      justifyContent: 'center',
      position: 'absolute',
      top: 0,
      left: 0,
    },
    backgroundImageStyle: { opacity: 0.8 },
    animationType: 'rotate',
    imageStyle: { width: 250, height: 250, borderRadius: 140 },
  },
  {
    id: '2',
    title: 'Get Coupons\nFor Auto\nDelivery',
    description: 'Lorem ipsum dolor amet consectetur.\nAdipiscing ultricies dui morbi varius ac id.',
    backgroundImage: require('../../assets/images/onboarding/couponbackground.png'),
    mainImage: require('../../assets/images/onboarding/onboarding2.png'),
    backgroundStyle: {
      width: 250,
      height: 320,
      paddingLeft: 2,
      paddingRight: 8,
      marginTop: -100,
      marginLeft: -50,
      position: 'absolute',
      top: 0,
      left: 0,
    },
    backgroundImageStyle: { opacity: 0.8, borderRadius: 100 },
    animationType: 'float',
    imageStyle: { width: 280, height: 260, marginBottom: -10 },
  },
  {
    id: '3',
    title: 'Meals\nThat Feel\nLike Home',
    description: 'Lorem ipsum dolor amet consectetur.\nAdipiscing ultricies dui morbi varius acid.',
    backgroundImage: require('../../assets/images/onboarding/home.png'),
    mainImage: require('../../assets/images/onboarding/onboarding3.png'),
    backgroundStyle: {
      width: 220,
      height: 290,
      paddingLeft: 2,
      paddingRight: 8,
      marginTop: -62,
      marginLeft: -35,
      marginBottom: 20,
      position: 'absolute',
      top: 0,
      left: 0,
    },
    backgroundImageStyle: { opacity: 0.8 },
    animationType: 'float',
    imageStyle: { width: 280, height: 200 },
  },
];

const OnboardingSwiper: React.FC<Props> = ({ navigation }) => {
  const { isSmallDevice, width } = useResponsive();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      navigation.navigate('Auth');
    }
  };

  const handleSkip = () => {
    navigation.navigate('Auth');
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(
      event.nativeEvent.contentOffset.x / SCREEN_WIDTH
    );
    setCurrentIndex(slideIndex);
  };

  const renderDots = () => (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: currentIndex === 0 ? 40 : currentIndex === 1 ? 10 : 25,
        alignSelf: 'center',
        width: '100%',
      }}
    >
      {SLIDES.map((_, index) => (
        <View
          key={index}
          style={{
            width: index === currentIndex ? 20 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor:
              index === currentIndex ? 'white' : 'rgba(255,255,255,0.5)',
            marginHorizontal: 4,
          }}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-orange-400">
      <StatusBar barStyle="light-content" backgroundColor="#FE8733" />
      <View className="flex-1">
        {/* Skip button - top right */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: SPACING.lg,
            right: SPACING['2xl'],
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.sm,
            minHeight: TOUCH_TARGETS.minimum,
            justifyContent: 'center',
            zIndex: 10,
          }}
          onPress={handleSkip}
        >
          <Text
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: FONT_SIZES.base,
              fontWeight: '600'
            }}
          >
            Skip
          </Text>
        </TouchableOpacity>

        <FlatList
          ref={flatListRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <OnboardingSlideItem
              item={item}
              index={index}
              renderDots={renderDots}
            />
          )}
        />

        {/* Next/Get Started button */}
        <View style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' }}>
          <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleNext}
            activeOpacity={1}
            style={{ width: isSmallDevice ? width * 0.8 : 320 }}
          >
            <Animated.View
              style={{
                backgroundColor: 'white',
                borderRadius: 50,
                paddingVertical: SPACING.md,
                paddingLeft: currentIndex < SLIDES.length - 1 ? SPACING.lg : SPACING.lg,
                paddingRight: currentIndex < SLIDES.length - 1 ? SPACING.sm : SPACING.lg,
                minHeight: TOUCH_TARGETS.large,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transform: [{ scale: scaleAnim }],
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 5,
                elevation: 8,
              }}
            >
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text
                  style={{
                    color: '#FE8733',
                    fontSize: FONT_SIZES.h4,
                    fontWeight: '700',
                    textAlign: 'center',
                    letterSpacing: 0.5,
                  }}
                >
                  {currentIndex === SLIDES.length - 1 ? 'GET STARTED' : 'NEXT'}
                </Text>
              </View>
              {currentIndex < SLIDES.length - 1 && (
                <View
                  style={{
                    backgroundColor: '#FE8733',
                    borderRadius: SPACING.iconXl / 2,
                    width: SPACING.iconXl + 4,
                    height: SPACING.iconXl + 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    right: SPACING.sm,
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
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

interface SlideItemProps {
  item: OnboardingSlide;
  index: number;
  renderDots: () => React.ReactNode;
}

const OnboardingSlideItem: React.FC<SlideItemProps> = ({ item, index, renderDots }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (item.animationType === 'rotate') {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else if (item.animationType === 'float') {
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
        ])
      ).start();
    }
  }, [rotateAnim, floatAnim, item.animationType]);

  const getImageTransform = () => {
    if (item.animationType === 'rotate') {
      return [
        {
          rotate: rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ];
    } else {
      return [{ translateY: floatAnim }, { rotate: '-8deg' }];
    }
  };

  return (
    <View
      style={{ width: SCREEN_WIDTH, paddingHorizontal: 40, flex: 1 }}
    >
      <View className="flex-1" style={{ justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
        {/* Background Image */}
        <ImageBackground
          source={item.backgroundImage}
          style={item.backgroundStyle as any}
          resizeMode="cover"
          imageStyle={item.backgroundImageStyle}
        />

        {/* Text */}
        <Text
          style={{
            color: 'white',
            fontSize: FONT_SIZES['3xl'],
            fontWeight: 'bold',
            lineHeight: FONT_SIZES['3xl'] * 1.2,
            marginTop: index === 1 ? SPACING['3xl'] : 0,
            textAlign: 'left',
          }}
        >
          {item.title}
        </Text>

        {/* Description (only for slides 2 and 3) */}
        {item.description && (
          <Text
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: FONT_SIZES.sm,
              marginTop: SPACING.sm,
              lineHeight: FONT_SIZES.sm * 1.4,
              textAlign: 'left',
            }}
          >
            {item.description}
          </Text>
        )}

        {/* Main Image */}
        <View
          style={{
            alignItems: 'center',
            width: '100%',
            marginTop: index === 0 ? 40 : index === 1 ? 10 : 20,
            marginBottom: 0,
          }}
        >
          <Animated.View
            style={{
              transform: getImageTransform(),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 10,
            }}
          >
            <Animated.Image
              source={item.mainImage}
              style={item.imageStyle}
              resizeMode={index === 0 ? 'cover' : 'contain'}
            />
          </Animated.View>
        </View>

        {/* Dots */}
        {renderDots()}
      </View>
    </View>
  );
};

export default OnboardingSwiper;
