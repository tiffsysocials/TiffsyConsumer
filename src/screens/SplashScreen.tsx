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

// ── Path 1: curve that draws down to the driver, then STOPS ──
const PATH_CURVE =
  'M30.7553 5C30.7553 5 64.4925 43.4245 93.8611 85.1536C148.528 162.829 74.4157 222.5 74.4157 277.688C74.4157 321.3 111.062 348 153.255 348C195.448 348 241.352 341.316 246.489 277.688C251.625 214.061 217.871 190.924 148.528 199.6C112.896 204.059 55.3372 218.193 30.7553 244.222C10.1895 265.998 -15.1064 315.699 30.7553 352.471C59.3054 375.362 100.729 370.233 112.755 404C126.51 442.63 132.39 471.01 163.08 489.04';

// ── Path 2: continues from driver position, sweeps right + extends off-screen ──
const PATH_EXIT =
  'M163.08 489.04C193.76 507.07 249.26 514.75 362.255 512 L1000 512';

const CURVE_LENGTH = 1600; // generous upper bound
const EXIT_LENGTH = 1200; // generous upper bound

// ── Layout ──
const SC = (width * 0.78) / 363;
const SVG_W = 1000 * SC;
const SVG_H = 518 * SC;
const SVG_LEFT = (width - 363 * SC) / 2 + width * 0.04;
const SVG_TOP = (height - SVG_H) / 2 - height * 0.01;

// ── Element sizes ──
const PHONE_LOTTIE_SIZE = width * 0.26;
const PAN_LOTTIE_SIZE = width * 0.28;
const DRIVER_SIZE = width * 0.34;
const LOGO_SIZE = width * 0.6;

// ── Fixed screen positions ──
const POS_PHONE = {x: SVG_LEFT + 30.75 * SC, y: SVG_TOP + 5 * SC - height * 0.03};
const POS_PAN = {x: SVG_LEFT + 290 * SC, y: SVG_TOP + 280 * SC};
const POS_LOGO = {x: width / 2, y: height / 2};
const POS_DRIVER = {x: SVG_LEFT + 136 * SC, y: SVG_TOP + 475 * SC};

// Static splash for loading states
export const SplashView = () => (
  <LinearGradient
    colors={['#ff6636', '#fd9e2f']}
    start={{x: 0, y: 0}}
    end={{x: 1, y: 1}}
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

      // 2. Curve draws to driver + elements pop in (curve done at 82% = when driver appears)
      Animated.timing(progress, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: false,
      }),

      Animated.delay(300),

      // 3. Driver moves right + exit line draws behind it
      Animated.parallel([
        Animated.timing(driverExit, {
          toValue: 1,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(exitLine, {
          toValue: 1,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
      ]),

      Animated.delay(400),
    ]).start(() => {
      navigation.replace('Onboarding');
    });
  }, [navigation, logoAnim, progress, driverExit, exitLine]);

  // ── Curve: fully revealed by progress 0.82 (when driver appears), then frozen ──
  const curveDashOffset = progress.interpolate({
    inputRange: [0, 0.82],
    outputRange: [CURVE_LENGTH, 0],
    extrapolate: 'clamp',
  });

  // ── Exit line: reveals only when driver starts moving ──
  const exitDashOffset = exitLine.interpolate({
    inputRange: [0, 1],
    outputRange: [EXIT_LENGTH, 0],
  });

  // ── Phone: appears at start ──
  const phoneOpacity = progress.interpolate({
    inputRange: [0, 0.05],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const phoneScale = progress.interpolate({
    inputRange: [0, 0.04, 0.08],
    outputRange: [0, 1.15, 1],
    extrapolate: 'clamp',
  });

  // ── Pan: appears on right side (~40%) ──
  const panOpacity = progress.interpolate({
    inputRange: [0.38, 0.44],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const panScale = progress.interpolate({
    inputRange: [0.38, 0.42, 0.48],
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

  // ── Driver: appears near end of curve ──
  const driverOpacity = progress.interpolate({
    inputRange: [0.82, 0.88],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const driverScale = progress.interpolate({
    inputRange: [0.82, 0.86, 0.92],
    outputRange: [0, 1.1, 1],
    extrapolate: 'clamp',
  });

  const driverTranslateX = driverExit.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
  });

  return (
    <LinearGradient
      colors={['#ff6636', '#fd9e2f']}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.container}>
      {/* ── Both paths in one SVG, same stroke — looks like one continuous line ── */}
      <Svg
        width={SVG_W}
        height={SVG_H}
        viewBox="0 0 1000 518"
        style={{position: 'absolute', left: SVG_LEFT, top: SVG_TOP}}>
        {/* Curve: draws during progress, stops at driver */}
        <AnimatedPath
          d={PATH_CURVE}
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[CURVE_LENGTH, CURVE_LENGTH]}
          strokeDashoffset={curveDashOffset}
        />
        {/* Exit line: draws only when driver moves right */}
        <AnimatedPath
          d={PATH_EXIT}
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={5}
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

      {/* ── Driver (bottom) ── */}
      <Animated.View
        style={[
          styles.abs,
          {
            left: POS_DRIVER.x - DRIVER_SIZE / 2,
            top: POS_DRIVER.y - DRIVER_SIZE / 2,
            transform: [{translateX: driverTranslateX}],
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
