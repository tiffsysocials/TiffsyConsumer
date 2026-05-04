import { Dimensions } from 'react-native';

// Base dimensions (iPhone SE as reference for mobile-first approach)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Breakpoint definitions for React Native (phone-focused)
export const BREAKPOINTS = {
  small: 375,    // iPhone SE, small phones (320-375px)
  medium: 414,   // iPhone Pro Max, standard phones (376-428px)
  large: 768,    // Future tablet support (not currently used)
} as const;

/**
 * Categorize device by width
 * @param width - Device width in pixels
 * @returns Device category: 'xsmall' | 'small' | 'medium' | 'large'
 */
export const getDeviceCategory = (width: number): 'xsmall' | 'small' | 'medium' | 'large' => {
  if (width < BREAKPOINTS.small) return 'xsmall';
  if (width < BREAKPOINTS.medium) return 'small';
  if (width < BREAKPOINTS.large) return 'medium';
  return 'large';
};

/**
 * Scale a size based on device width
 * @param size - Size to scale
 * @param baseWidth - Base width for scaling (default: 375)
 * @returns Scaled size
 */
export const scale = (size: number, baseWidth: number = BASE_WIDTH): number => {
  const { width } = Dimensions.get('window');
  return Math.round((width / baseWidth) * size);
};

/**
 * Scale a size based on device height
 * @param size - Size to scale
 * @param baseHeight - Base height for scaling (default: 812)
 * @returns Scaled size
 */
export const verticalScale = (size: number, baseHeight: number = BASE_HEIGHT): number => {
  const { height } = Dimensions.get('window');
  return Math.round((height / baseHeight) * size);
};

/**
 * Moderate scale - scales with a factor to prevent excessive scaling
 * @param size - Size to scale
 * @param factor - Scale factor (0-1, default: 0.5)
 * @returns Moderately scaled size
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  const { width } = Dimensions.get('window');
  const scaledSize = (width / BASE_WIDTH) * size;
  return Math.round(size + (scaledSize - size) * factor);
};

/**
 * Constrained scale - prevents over-scaling on larger devices
 * Matches the pattern from OnboardingScreen.tsx:64
 * @param size - Size to scale
 * @param maxScale - Maximum scale factor (default: 1.2)
 * @returns Constrained scaled size
 */
export const constrainedScale = (size: number, maxScale: number = 1.2): number => {
  const { width } = Dimensions.get('window');
  const scaleFactor = Math.min(width / BASE_WIDTH, maxScale);
  return Math.round(size * scaleFactor);
};

/**
 * Constrained vertical scale - prevents over-scaling on taller devices
 * Matches the pattern from OnboardingScreen.tsx:65
 * @param size - Size to scale
 * @param maxScale - Maximum scale factor (default: 1.1)
 * @returns Constrained vertically scaled size
 */
export const constrainedVerticalScale = (size: number, maxScale: number = 1.1): number => {
  const { height } = Dimensions.get('window');
  const scaleFactor = Math.min(height / BASE_HEIGHT, maxScale);
  return Math.round(size * scaleFactor);
};

/**
 * Check if device is small (height < 700px)
 * Matches the pattern from OnboardingScreen.tsx:63
 * @returns Boolean indicating if device is small
 */
export const isSmallDevice = (): boolean => {
  const { height } = Dimensions.get('window');
  return height < 700;
};

/**
 * Check if device is in landscape orientation
 * @returns Boolean indicating if device is landscape
 */
export const isLandscape = (): boolean => {
  const { width, height } = Dimensions.get('window');
  return width > height;
};
