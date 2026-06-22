// src/utils/deliveryFormula.ts
//
// Shared helpers for explaining how the order's Delivery Fee was computed.
// Used by the cart, voucher-purchase, auto-order setup, and scheduling
// screens so the wording reads identically everywhere.

import type { DeliveryFeeBreakdown, DistancePricing } from '../services/api.service';

function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
}

// The cart's pricing endpoint returns the distance fields under a slightly
// different shape (`distancePricing`) than the voucher/auto-order endpoints
// (`deliveryBreakdown`). This adapter normalises them so the same formatter
// can handle both call sites.
export function distancePricingToBreakdown(
  dp: DistancePricing | null | undefined,
): DeliveryFeeBreakdown | null {
  if (!dp) return null;
  const baseFee = dp.source?.baseFee ?? 0;
  const baseFeeEnabled = dp.source?.baseFeeEnabled ?? false;
  const baseFreeUptoKm = dp.source?.baseFreeUptoKm ?? 0;
  const perKmAfterFree = dp.source?.perKmAfterFree ?? 0;
  const formulaEnabled = dp.source?.enabled ?? false;
  const distKm = typeof dp.distanceKm === 'number' ? dp.distanceKm : null;
  const extraKm = distKm != null ? Math.max(0, distKm - baseFreeUptoKm) : 0;
  const sourceLabel = dp.appliedSourceLabel;
  const source: DeliveryFeeBreakdown['source'] =
    sourceLabel === 'zone' || sourceLabel === 'global' || sourceLabel === 'flat'
      ? sourceLabel
      : 'global';
  return {
    distKm,
    source,
    formulaEnabled,
    baseFee,
    baseFeeEnabled,
    baseFreeUptoKm,
    perKmAfterFree,
    extraKm,
    extraFee: extraKm * perKmAfterFree,
  };
}

// Build the human-readable formula string. Returns null when there's
// nothing meaningful to say.
export function deliveryFormulaText(
  dp: DeliveryFeeBreakdown | null | undefined,
): string | null {
  if (!dp) return null;
  if (!dp.formulaEnabled) {
    if (dp.source === 'flat') {
      return dp.distKm != null
        ? `Flat rate · ${formatNumber(dp.distKm)} km away`
        : 'Flat rate';
    }
    return dp.distKm != null ? `${formatNumber(dp.distKm)} km away` : null;
  }
  const parts: string[] = [];
  if (dp.baseFeeEnabled && dp.baseFee > 0) {
    parts.push(`₹${formatNumber(dp.baseFee)} base`);
  }
  if (dp.extraKm > 0 && dp.perKmAfterFree > 0) {
    parts.push(`${formatNumber(dp.extraKm)} km × ₹${formatNumber(dp.perKmAfterFree)}`);
  } else if (dp.distKm != null && dp.baseFreeUptoKm > 0) {
    parts.push(`within ${formatNumber(dp.baseFreeUptoKm)} km free zone`);
  }
  if (parts.length === 0 && dp.distKm != null) {
    return `${formatNumber(dp.distKm)} km away`;
  }
  return parts.join(' + ');
}
