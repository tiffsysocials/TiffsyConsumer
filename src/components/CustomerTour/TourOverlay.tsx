import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TourStep, TourTargetRect } from './types';

interface Props {
  step: TourStep;
  target: TourTargetRect | null;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
}

const DIM_COLOR = 'rgba(15, 23, 42, 0.78)';
const RING_PADDING = 8;
const TOOLTIP_HEIGHT_ESTIMATE = 170;
const TOOLTIP_GAP = 12;
const EDGE_PADDING = 16;

const TourOverlay: React.FC<Props> = ({ step, target, isLast, onNext, onSkip }) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const tooltipWidth = Math.min(screenWidth - 32, 340);

  // Why this offset exists: the host activity uses a translucent status bar,
  // so `measureInWindow` returns Y values whose origin sits *below* the
  // status bar / notch / dynamic island. The overlay Modal uses
  // `statusBarTranslucent` and renders y=0 at the absolute top of the
  // screen. Without compensation the spotlight ring sits status-bar-height
  // pixels too high. We use the safe-area top inset instead of
  // `StatusBar.currentHeight` because it correctly accounts for notches,
  // punch-holes, and the iPhone Dynamic Island on every device.
  //
  // iOS does NOT need this: its Modal's coordinate space already matches
  // `measureInWindow` output, so adding the inset would push the ring down
  // by the safe-area amount and break alignment.
  const verticalOffset = Platform.OS === 'android' ? insets.top : 0;

  const layout = useMemo(() => {
    if (!target) {
      return { mode: 'center' as const };
    }
    const adjustedY = target.y + verticalOffset;
    const ringTop = adjustedY - RING_PADDING;
    const ringLeft = target.x - RING_PADDING;
    const ringWidth = target.width + RING_PADDING * 2;
    const ringHeight = target.height + RING_PADDING * 2;

    const targetCenterY = adjustedY + target.height / 2;
    const placeAbove =
      step.placement === 'above' ||
      (step.placement !== 'below' && targetCenterY > screenHeight * 0.55);

    const rawTooltipTop = placeAbove
      ? ringTop - TOOLTIP_GAP - TOOLTIP_HEIGHT_ESTIMATE
      : ringTop + ringHeight + TOOLTIP_GAP;

    // Clamp the tooltip so it stays clear of notches at the top and the
    // gesture / nav bar at the bottom on every device.
    const minTooltipTop = Math.max(40, insets.top + 8);
    const maxTooltipTop =
      screenHeight - TOOLTIP_HEIGHT_ESTIMATE - Math.max(40, insets.bottom + 8);
    const tooltipTop = Math.max(minTooltipTop, Math.min(maxTooltipTop, rawTooltipTop));

    const tooltipLeft = Math.max(
      EDGE_PADDING + insets.left,
      Math.min(
        screenWidth - tooltipWidth - EDGE_PADDING - insets.right,
        target.x + target.width / 2 - tooltipWidth / 2,
      ),
    );

    return {
      mode: 'spotlight' as const,
      ringTop,
      ringLeft,
      ringWidth,
      ringHeight,
      tooltipTop,
      tooltipLeft,
    };
  }, [
    target,
    step.placement,
    verticalOffset,
    insets.top,
    insets.bottom,
    insets.left,
    insets.right,
    screenWidth,
    screenHeight,
    tooltipWidth,
  ]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      {layout.mode === 'spotlight' ? (
        <>
          <View style={[styles.dimPanel, { top: 0, left: 0, right: 0, height: Math.max(0, layout.ringTop) }]} />
          <View
            style={[
              styles.dimPanel,
              {
                top: layout.ringTop + layout.ringHeight,
                left: 0,
                right: 0,
                bottom: 0,
              },
            ]}
          />
          <View
            style={[
              styles.dimPanel,
              {
                top: layout.ringTop,
                left: 0,
                width: Math.max(0, layout.ringLeft),
                height: layout.ringHeight,
              },
            ]}
          />
          <View
            style={[
              styles.dimPanel,
              {
                top: layout.ringTop,
                left: layout.ringLeft + layout.ringWidth,
                right: 0,
                height: layout.ringHeight,
              },
            ]}
          />
        </>
      ) : (
        <View style={styles.dim} pointerEvents="auto" />
      )}

      {layout.mode === 'spotlight' && (
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              top: layout.ringTop,
              left: layout.ringLeft,
              width: layout.ringWidth,
              height: layout.ringHeight,
            },
          ]}
        />
      )}

      <View
        style={[
          styles.tooltip,
          layout.mode === 'spotlight'
            ? {
                position: 'absolute',
                top: layout.tooltipTop,
                left: layout.tooltipLeft,
                width: tooltipWidth,
              }
            : {
                position: 'absolute',
                left: (screenWidth - tooltipWidth) / 2,
                top: screenHeight / 2 - 100,
                width: tooltipWidth,
              },
        ]}
      >
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>

        <View style={styles.actions}>
          <TouchableOpacity onPress={onSkip} style={styles.skipButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onNext} style={styles.nextButton} activeOpacity={0.85}>
            <Text style={styles.nextText}>{isLast ? 'Got it' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DIM_COLOR,
  },
  dimPanel: {
    position: 'absolute',
    backgroundColor: DIM_COLOR,
  },
  ring: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#FE8733',
    backgroundColor: 'rgba(254, 135, 51, 0.08)',
  },
  tooltip: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 12 },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  skipButton: { paddingVertical: 6, paddingHorizontal: 4 },
  skipText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  nextButton: {
    backgroundColor: '#FE8733',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
  },
  nextText: { color: 'white', fontSize: 14, fontWeight: '700' },
});

export default TourOverlay;
