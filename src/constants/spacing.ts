import { constrainedScale, moderateScale } from './responsive';

/**
 * Responsive spacing scale using moderateScale
 * Provides consistent spacing across all screen sizes
 */
export const SPACING = {
  // Standard spacing scale
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(12),
  lg: moderateScale(16),
  xl: moderateScale(20),
  '2xl': moderateScale(24),
  '3xl': moderateScale(32),
  '4xl': moderateScale(40),
  '5xl': moderateScale(48),

  // Screen-level padding
  screenHorizontal: moderateScale(20),
  screenVertical: moderateScale(16),

  // Container spacing
  containerPadding: moderateScale(16),
  cardPadding: moderateScale(20),

  // Component-specific spacing
  buttonPadding: moderateScale(16),
  buttonPaddingVertical: moderateScale(12),
  inputPadding: moderateScale(14),

  // Icon sizes
  iconXs: constrainedScale(12),
  iconSm: constrainedScale(16),
  iconSize: constrainedScale(24),
  iconLg: constrainedScale(32),
  iconXl: constrainedScale(40),
} as const;

/**
 * Responsive border radius scale
 * Uses moderateScale for consistent rounding
 */
export const BORDER_RADIUS = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(12),
  lg: moderateScale(16),
  xl: moderateScale(20),
  '2xl': moderateScale(24),
  '3xl': moderateScale(30),
  full: 9999,
} as const;

/**
 * Touch target minimum sizes (accessibility)
 * Minimum 44x44 points per iOS Human Interface Guidelines
 */
export const TOUCH_TARGETS = {
  minimum: 44,
  comfortable: 48,
  large: 56,
} as const;

/**
 * Button height standards for consistent touch targets
 * Alias for TOUCH_TARGETS for button-specific usage
 */
export const BUTTON_HEIGHTS = {
  small: 44,    // Minimum touch target
  medium: 48,   // Comfortable
  large: 56,    // Primary actions
} as const;
