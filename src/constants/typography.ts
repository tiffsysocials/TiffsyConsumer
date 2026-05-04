import { constrainedScale } from './responsive';

/**
 * Responsive font sizes based on constrainedScale
 * Scales from base device (375px) with max 1.2x scaling
 */
export const FONT_SIZES = {
  // Headings
  h1: constrainedScale(32),
  h2: constrainedScale(28),
  h3: constrainedScale(24),
  h4: constrainedScale(20),
  h5: constrainedScale(18),
  h6: constrainedScale(16),

  // Body text
  xl: constrainedScale(18),
  lg: constrainedScale(16),
  base: constrainedScale(14),
  sm: constrainedScale(12),
  xs: constrainedScale(10),

  // Special sizes
  display: constrainedScale(36),
  caption: constrainedScale(11),
} as const;

/**
 * Line height multipliers
 * Use with fontSize: lineHeight = fontSize * LINE_HEIGHTS.normal
 */
export const LINE_HEIGHTS = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
  loose: 2,
} as const;

/**
 * Font weights
 * Maps to React Native fontWeight values
 */
export const FONT_WEIGHTS = {
  light: '300' as const,
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
} as const;

/**
 * Helper to calculate line height
 * @param fontSize - Font size
 * @param lineHeight - Line height key from LINE_HEIGHTS
 * @returns Calculated line height
 */
export const getLineHeight = (
  fontSize: number,
  lineHeight: keyof typeof LINE_HEIGHTS = 'normal'
): number => {
  return Math.round(fontSize * LINE_HEIGHTS[lineHeight]);
};
