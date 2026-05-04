// src/components/BannerSliderWidget.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SPACING } from '../constants/spacing';
import { BannerModel } from '../types/banner';

// Keep one fallback asset for offline / empty-banners case
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FALLBACK_BANNER = require('../assets/images/1.png');

interface BannerSliderWidgetProps {
  banners: BannerModel[];
  isLoading: boolean;
  /** Full device width (pass from useResponsive) */
  screenWidth: number;
  /** Called when a banner is tapped; receives the banner's redirectLink */
  onBannerPress: (redirectLink?: string) => void;
}

const BannerSliderWidget: React.FC<BannerSliderWidgetProps> = ({
  banners,
  isLoading,
  screenWidth,
  onBannerPress,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-slide every 3 seconds when banners are available
  useEffect(() => {
    if (banners.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [banners.length, screenWidth]);

  // Reset index when banners list changes (e.g. after refresh)
  useEffect(() => {
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [banners]);

  // ─── Loading state ────────────────────────────────────────────────────────
  if (isLoading && banners.length === 0) {
    return (
      <View style={{ marginTop: SPACING.md + 30, width: screenWidth }}>
        {/* Shimmer/skeleton placeholder */}
        <View
          style={{
            marginHorizontal: SPACING.lg,
            height: 140,
            borderRadius: SPACING.lg,
            backgroundColor: '#E5E7EB',
            overflow: 'hidden',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator color="#FE8733" size="small" />
        </View>
        {/* Placeholder dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.dotInactive} />
          ))}
        </View>
      </View>
    );
  }

  // ─── Fallback banner (API failed + no cache) ─────────────────────────────
  if (banners.length === 0) {
    return (
      <View style={{ marginTop: SPACING.md + 30, width: screenWidth }}>
        <View style={{ paddingHorizontal: SPACING.lg, height: 140 }}>
          <View style={styles.imageWrapper}>
            <Image
              source={FALLBACK_BANNER}
              style={styles.bannerImage}
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={styles.dotsRow}>
          <View style={styles.dotActive} />
        </View>
      </View>
    );
  }

  // ─── Dynamic banners ──────────────────────────────────────────────────────
  return (
    <View style={{ marginTop: SPACING.md + 30, width: screenWidth }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width: screenWidth }}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          setActiveIndex(index);
        }}
        decelerationRate="fast"
      >
        {banners.map((banner, index) => (
          <TouchableOpacity
            key={banner.id || String(index)}
            activeOpacity={banner.redirectLink ? 0.85 : 1}
            onPress={() => onBannerPress(banner.redirectLink)}
            style={{ width: screenWidth, height: 140, paddingHorizontal: SPACING.lg }}
          >
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: banner.imageUrl }}
                style={styles.bannerImage}
                resizeMode="contain"
                // Show fallback asset if remote image fails to load
                defaultSource={FALLBACK_BANNER}
              />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {banners.map((_, index) => (
          <View
            key={index}
            style={[
              activeIndex === index ? styles.dotActive : styles.dotInactive,
              { marginHorizontal: 3 },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = {
  imageWrapper: {
    width: '100%' as const,
    height: '100%' as const,
    borderRadius: SPACING.lg,
    overflow: 'hidden' as const,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bannerImage: {
    width: '100%' as const,
    height: '100%' as const,
  },
  dotsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: SPACING.sm,
  },
  dotActive: {
    width: 20,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FE8733',
  },
  dotInactive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 3,
  },
};

export default BannerSliderWidget;
