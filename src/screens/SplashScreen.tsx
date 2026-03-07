import React, {useEffect, useRef} from 'react';
import {
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import LottieView from 'lottie-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Path} from 'react-native-svg';
import {RootStackParamList} from '../types/navigation';

type SplashScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Splash'
>;

const AnimatedPath = Animated.createAnimatedComponent(Path);

const {width, height} = Dimensions.get('window');

// ── Path 1: curve that draws down to the middle, then STOPS ──
const PATH_CURVE =
  'M58.6953 25.387695C58.6953 25.387695 87.9947 49.2034 93.1953 70.8877C103.096 112.1685 17.5234 117.4326 28.6952 158.388C38.4951 194.313 130.549 166.905 126.195 203.888C123.431 227.368 69.6953 252.888 69.6953 252.888';

// ── Path 2: continues from below the gap, sweeps down ──
const PATH_EXIT =
  'M93.1953 316.888C93.1953 316.888 135.695 371.398 69.6953 380.888C3.69534 390.378 -15.3643 432.388 13.6952 432.388C30.6952 432.388 63.6952 414.888 93.1953 432.388C122.695 449.888 88.8977 485.388 84.1952 489.888C79.4928 494.388 75.6952 496.888 75.6952 502.888C75.6952 508.888 80.78 513.778 87.1952 516.388C92.4405 518.521 99.1952 517.888 99.1952 517.888';

const CURVE_LENGTH = 800; // generous upper bound
const EXIT_LENGTH = 800; // generous upper bound

// ── Layout ──
const SC = (height * 0.65) / 544;
const SVG_W = 127 * SC;
const SVG_H = 544 * SC;
const SVG_LEFT = (width - 127 * SC) / 2;
const SVG_TOP = (height - 544 * SC) / 2;

// ── Element sizes ──
const PHONE_LOTTIE_SIZE = width * 0.26;
const PAN_LOTTIE_SIZE = width * 0.28;
const DRIVER_SIZE = width * 0.34;
const LOGO_SIZE = width * 0.6;

// ── Fixed screen positions ──
const POS_PHONE = {x: SVG_LEFT + 58 * SC, y: SVG_TOP + 0 * SC};
const POS_PAN = {x: SVG_LEFT + 185 * SC, y: SVG_TOP + 178 * SC};
const POS_LOGO = {x: width / 2, y: SVG_TOP + 285 * SC};
const POS_DRIVER = {x: SVG_LEFT + 99 * SC, y: SVG_TOP + 517 * SC};

// Static splash for loading states
export const SplashView = () => (
  <LinearGradient
    colors={['#FD9E2F', '#FE8733', '#FF6636']}
    start={{x: 0, y: 1}}
    end={{x: 0, y: 0}}
    style={styles.container}>
    <Image
      source={require('../assets/images/logo.png')}
      style={{width: width * 0.5, height: width * 0.5}}
      resizeMode="contain"
    />
  </LinearGradient>
);

const SplashScreen = () => {
  const navigation = useNavigation<SplashScreenNavigationProp>();
  const logoAnim = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const driverExit = useRef(new Animated.Value(0)).current;
  const exitLine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(400),

      // 1. Logo appears
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),

      Animated.delay(300),

      // 2. Top curve draws + phone/pan pop in
      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: false,
      }),

      Animated.delay(200),

      // 3. Bottom SVG draws, driver appears at the end
      Animated.timing(exitLine, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: false,
      }),

      Animated.delay(300),

      // 4. Driver rides right, trailing line draws behind it
      Animated.timing(driverExit, {
        toValue: 1,
        duration: 600,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }),

      Animated.delay(400),
    ]).start(() => {
      navigation.replace('Onboarding');
    });
  }, [navigation, logoAnim, progress, driverExit, exitLine]);

  // ── Top curve: fully draws during progress ──
  const curveDashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CURVE_LENGTH, 0],
    extrapolate: 'clamp',
  });

  // ── Exit line: reveals only when driver starts moving ──
  const exitDashOffset = exitLine.interpolate({
    inputRange: [0, 1],
    outputRange: [EXIT_LENGTH, 0],
  });

  // ── Phone: appears at start of top curve ──
  const phoneOpacity = progress.interpolate({
    inputRange: [0, 0.06],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const phoneScale = progress.interpolate({
    inputRange: [0, 0.05, 0.1],
    outputRange: [0, 1.15, 1],
    extrapolate: 'clamp',
  });

  // ── Pan: appears midway through top curve ──
  const panOpacity = progress.interpolate({
    inputRange: [0.45, 0.52],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const panScale = progress.interpolate({
    inputRange: [0.45, 0.5, 0.56],
    outputRange: [0, 1.15, 1],
    extrapolate: 'clamp',
  });

  // ── Logo ──
  const logoOpacity = logoAnim.interpolate({
    inputRange: [0, 0.5],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const logoScale = logoAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.5, 1.05, 1],
    extrapolate: 'clamp',
  });

  // ── Driver: appears near end of bottom SVG ──
  const driverOpacity = exitLine.interpolate({
    inputRange: [0.85, 0.95],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const driverScale = exitLine.interpolate({
    inputRange: [0.85, 0.9, 1],
    outputRange: [0, 1.1, 1],
    extrapolate: 'clamp',
  });

  const driverTranslateX = driverExit.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
  });

  // ── Trail line: grows from the end of bottom path as driver rides right ──
  const trailWidth = driverExit.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
  });

  return (
    <LinearGradient
      colors={['#FD9E2F', '#FE8733', '#FF6636']}
      start={{x: 0, y: 1}}
      end={{x: 0, y: 0}}
      style={styles.container}>
      {/* ── Both paths in one SVG, same stroke — looks like one continuous line ── */}
      <Svg
        width={SVG_W}
        height={SVG_H}
        viewBox="0 0 127 544"
        style={{position: 'absolute', left: SVG_LEFT, top: SVG_TOP}}>
        {/* Curve: draws during progress, stops at driver */}
        <AnimatedPath
          d={PATH_CURVE}
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[CURVE_LENGTH, CURVE_LENGTH]}
          strokeDashoffset={curveDashOffset}
        />
        {/* Exit line: draws only when driver moves right */}
        <AnimatedPath
          d={PATH_EXIT}
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[EXIT_LENGTH, EXIT_LENGTH]}
          strokeDashoffset={exitDashOffset}
        />
      </Svg>

      {/* ── Phone (top) ── */}
      <Animated.View
        style={[
          styles.abs,
          {
            left: POS_PHONE.x - PHONE_LOTTIE_SIZE / 2,
            top: POS_PHONE.y - PHONE_LOTTIE_SIZE / 2,
            opacity: phoneOpacity,
            transform: [{scale: phoneScale}],
          },
        ]}>
        <LottieView
          source={require('../assets/animations/phone_white.json')}
          autoPlay
          loop
          speed={1}
          style={{width: PHONE_LOTTIE_SIZE, height: PHONE_LOTTIE_SIZE}}
        />
      </Animated.View>

      {/* ── Pan (right side) ── */}
      <Animated.View
        style={[
          styles.abs,
          {
            left: POS_PAN.x - PAN_LOTTIE_SIZE / 2,
            top: POS_PAN.y - PAN_LOTTIE_SIZE / 2,
            opacity: panOpacity,
            transform: [{scaleX: -1}, {scale: panScale}],
          },
        ]}>
        <LottieView
          source={require('../assets/animations/pan_white.json')}
          autoPlay
          loop
          speed={1.5}
          style={{width: PAN_LOTTIE_SIZE, height: PAN_LOTTIE_SIZE}}
        />
      </Animated.View>

      {/* ── Logo (center) ── */}
      <Animated.View
        style={[
          styles.abs,
          {
            left: POS_LOGO.x - LOGO_SIZE / 2,
            top: POS_LOGO.y - LOGO_SIZE / 2,
            opacity: logoOpacity,
            transform: [{scale: logoScale}],
          },
        ]}>
        <Image
          source={require('../assets/images/logo.png')}
          style={{width: LOGO_SIZE, height: LOGO_SIZE}}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Trail line behind driver ── */}
      <Animated.View
        style={[
          styles.abs,
          {
            left: POS_DRIVER.x,
            top: SVG_TOP + 517.888 * SC - 1,
            height: 2,
            width: trailWidth,
            backgroundColor: 'rgba(255,255,255,0.8)',
            borderRadius: 1,
          },
        ]}
      />

      {/* ── Driver (bottom) ── */}
      <Animated.View
        style={[
          styles.abs,
          {
            top: POS_DRIVER.y - DRIVER_SIZE / 2,
            left: Animated.add(POS_DRIVER.x - DRIVER_SIZE / 2, driverTranslateX),
          },
        ]}>
        <Animated.View
          style={{
            opacity: driverOpacity,
            transform: [{scale: driverScale}],
          }}>
          <LottieView
            source={require('../assets/animations/driver_white.json')}
            autoPlay
            loop
            speed={1}
            style={{width: DRIVER_SIZE, height: DRIVER_SIZE}}
          />
        </Animated.View>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  abs: {
    position: 'absolute',
  },
});

export default SplashScreen;
