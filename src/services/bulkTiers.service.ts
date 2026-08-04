// src/services/bulkTiers.service.ts
//
// Fetches the bulk-quantity pricing tiers and the bulk-ordering limits that the
// Bulk Order page runs on (GET /api/app/config → data.bulkTiers / data.bulkOrder).
// The tiers are the SAME config the backend prices from, so the page can never
// quote a number the order won't honour — and re-tuning either from the admin
// app needs no OTA.
//
// Both come from one request, so they're fetched and cached together.

import { Platform } from 'react-native';
import apiService, { BulkTierConfig, BulkOrderLimits } from './api.service';

// Mirrors DEFAULTS in the backend's bulk-discount.service.js. Used only when
// the response omits `bulkTiers` entirely (pre-deploy backend); an explicit
// empty array means the engine is off and is passed through untouched.
export const FALLBACK_BULK_TIERS: BulkTierConfig[] = [
  { minMeals: 8, type: 'UNIT_PRICE', value: 85 },
  { minMeals: 20, type: 'UNIT_PRICE', value: 75 },
];

// Mirrors the bulkOrder defaults in the backend's config.service.js.
export const FALLBACK_BULK_ORDER: BulkOrderLimits = {
  enabled: true,
  minThalisPerOrder: 8,
  maxThalisPerOrder: 100,
  minLeadHours: 12,
  maxDaysAhead: 30,
};

export interface BulkConfig {
  tiers: BulkTierConfig[];
  limits: BulkOrderLimits;
}

// undefined = not fetched yet this session.
let cached: BulkConfig | undefined;

async function fetchConfig(force = false): Promise<BulkConfig> {
  if (!force && cached !== undefined) return cached;
  try {
    const res = await apiService.getAppConfig(Platform.OS === 'ios' ? 'ios' : 'android');
    const tiers = res?.data?.bulkTiers;
    const limits = res?.data?.bulkOrder;
    cached = {
      tiers: Array.isArray(tiers) ? tiers : FALLBACK_BULK_TIERS,
      limits: limits || FALLBACK_BULK_ORDER,
    };
  } catch {
    cached = { tiers: FALLBACK_BULK_TIERS, limits: FALLBACK_BULK_ORDER };
  }
  return cached;
}

/**
 * Highest tier whose minMeals <= mealCount, or null. Mirrors the backend's
 * resolveBulkTier so the page's estimate matches what checkout will charge.
 */
export function resolveTier(tiers: BulkTierConfig[], mealCount: number): BulkTierConfig | null {
  let match: BulkTierConfig | null = null;
  for (const tier of tiers) {
    if (mealCount >= tier.minMeals) match = tier;
    else break;
  }
  return match;
}

/** The next tier above mealCount, with how many more thalis it takes to reach it. */
export function nextTier(
  tiers: BulkTierConfig[],
  mealCount: number,
): (BulkTierConfig & { mealsAway: number }) | null {
  const next = tiers.find(t => t.minMeals > mealCount);
  return next ? { ...next, mealsAway: next.minMeals - mealCount } : null;
}

export default { fetchConfig, resolveTier, nextTier };
