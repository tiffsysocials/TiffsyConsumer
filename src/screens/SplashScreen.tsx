import React, {useEffect, useRef} from 'react';
import {
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import LottieView from 'lottie-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Path} from 'react-native-svg';


const AnimatedPath = Animated.createAnimatedComponent(Path);

const {width, height} = Dimensions.get('window');

// ── Path 1: curve that draws down to the middle, then STOPS ──
const PATH_CURVE =
  'M58.6953 25.387695C58.6953 25.387695 87.9947 49.2034 93.1953 70.8877C103.096 112.1685 17.5234 117.4326 28.6952 158.388C38.4951 194.313 130.549 166.905 126.195 203.888C123.431 227.368 69.6953 252.888 69.6953 252.888';

// ── Path 2: bottom curve (Vector 49) ──
const BOTTOM_PATH =
  'M289.5 0.444336C289.5 0.444336 303.469 7.62586 309.043 11.9483C320 20.4443 315.5 33.4443 301 40.9443C286.5 48.4443 52.5454 105.949 40.5435 110.448C28.5416 114.947 5.04414 129.447 2.04348 141.948C-0.957182 154.449 -0.456987 162.949 11.5435 171.948C23.544 180.947 31.5 186.448 46 189.448C60.5 192.448 79.543 196.949 83.5435 200.948C87.544 204.947 87.8115 208.947 82.544 215.947C77.2764 222.947 64.5439 228.947 61.5439 230.947C55.8692 234.73 46.0435 238.448 51.0439 249.447C56.0444 260.446 79.5435 257.948 79.5435 257.948H130.543L208.543 254.948H245.043';

const CURVE_LENGTH = 800; // generous upper bound
const EXIT_LENGTH = 800; // generous upper bound

// ── Layout ──
const SC = (height * 0.63) / 544;
const SVG_W = 127 * SC;
const SVG_H = 544 * SC;
const SVG_LEFT = (width - 127 * SC) / 2;
const SVG_TOP = (height - 544 * SC) / 2;

// ── Element sizes ──
const PHONE_LOTTIE_SIZE = width * 0.26;
const PAN_LOTTIE_SIZE = width * 0.28;
const DRIVER_SIZE = width * 0.34;
const LOGO_SIZE = width * 0.6;

// ── Bottom SVG (Vector 49) layout ──
const BOTTOM_VB = {x: 0, y: 0, w: 316, h: 259};
const BOTTOM_SVG_H = height * 0.20;
const BOTTOM_SVG_W = BOTTOM_SVG_H * (BOTTOM_VB.w / BOTTOM_VB.h);
const BOTTOM_SVG_TOP = SVG_TOP + 305 * SC;
const BOTTOM_SVG_LEFT = (width - BOTTOM_SVG_W) / 2 - width * 0.09;

// ── Stroke widths: keep both SVGs visually equal ──
const TOP_STROKE = 2; // viewBox units for top SVG
const STROKE_PX = TOP_STROKE * SC; // top renders at this many screen px
const BOTTOM_STROKE = STROKE_PX * (BOTTOM_VB.w / BOTTOM_SVG_W); // viewBox units for bottom
const BOTTOM_END_X =
  BOTTOM_SVG_LEFT +
  ((245.043 - BOTTOM_VB.x) / BOTTOM_VB.w) * BOTTOM_SVG_W;
const BOTTOM_END_Y =
  BOTTOM_SVG_TOP +
  ((254.948 - BOTTOM_VB.y) / BOTTOM_VB.h) * BOTTOM_SVG_H;

// ── Fixed screen positions ──
const POS_PHONE = {x: SVG_LEFT + 58 * SC, y: SVG_TOP + 0 * SC};
const POS_PAN = {x: SVG_LEFT + 175 * SC, y: SVG_TOP + 178 * SC};
const POS_LOGO = {x: width / 2, y: SVG_TOP + 285 * SC};
const POS_DRIVER = {x: BOTTOM_END_X, y: BOTTOM_END_Y};

// Static splash for loading states
export const SplashView = () => (
  <LinearGradient
    colors={['#FD9E2F', '#FF6636']}
    start={{x: 0, y: 0}}
    end={{x: 0, y: 1}}
    style={styles.container}>
    <Image
      source={require('../assets/images/logo.png')}
      style={{width: width * 0.5, height: width * 0.5}}
      resizeMode="contain"
    />
  </LinearGradient>
);

type SplashScreenProps = {
  onFinish: () => void;
};

const SplashScreen = ({onFinish}: SplashScreenProps) => {
  const logoAnim = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const driverExit = useRef(new Animated.Value(0)).current;
  const exitLine = useRef(new Animated.Value(0)).current;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

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
      onFinishRef.current();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      colors={['#FD9E2F', '#FF6636']}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      style={styles.container}>
      {/* ── Top curve SVG ── */}
      <Svg
        width={SVG_W}
        height={SVG_H}
        viewBox="0 0 127 544"
        style={{position: 'absolute', left: SVG_LEFT, top: SVG_TOP}}>
        <AnimatedPath
          d={PATH_CURVE}
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[CURVE_LENGTH, CURVE_LENGTH]}
          strokeDashoffset={curveDashOffset}
        />
      </Svg>

      {/* ── Bottom curve SVG (Vector 3) ── */}
      <Svg
        width={BOTTOM_SVG_W}
        height={BOTTOM_SVG_H}
        viewBox={`${BOTTOM_VB.x} ${BOTTOM_VB.y} ${BOTTOM_VB.w} ${BOTTOM_VB.h}`}
        style={{
          position: 'absolute',
          left: BOTTOM_SVG_LEFT,
          top: BOTTOM_SVG_TOP,
        }}>
        <AnimatedPath
          d={BOTTOM_PATH}
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={BOTTOM_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
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
            top: BOTTOM_END_Y - STROKE_PX / 2,
            height: STROKE_PX,
            width: trailWidth,
            backgroundColor: 'rgba(255,255,255,0.8)',
            borderRadius: STROKE_PX / 2,
          },
        ]}
      />

      {/* ── Driver (bottom) ── */}
      <Animated.View
        style={[
          styles.abs,
          {
            top: POS_DRIVER.y - DRIVER_SIZE * 0.85,
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
