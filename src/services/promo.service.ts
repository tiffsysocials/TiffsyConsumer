// src/services/promo.service.ts
//
// Fetches the consumer promo campaign (GET /api/app/config → data.promo) and
// gates the home pop-up to at most once per app session. The campaign is fully
// server-driven (content + on/off + expiry via the `promoCampaign` systemconfig),
// so turning it off or editing copy needs no OTA.

import { Platform } from 'react-native';
import apiService, { PromoConfig } from './api.service';

// undefined = not fetched yet this session; null = fetched, no active promo.
let cachedPromo: PromoConfig | null | undefined;
let popupShownThisSession = false;

async function fetchPromo(): Promise<PromoConfig | null> {
  if (cachedPromo !== undefined) return cachedPromo;
  try {
    const res = await apiService.getAppConfig(Platform.OS === 'ios' ? 'ios' : 'android');
    cachedPromo = res?.data?.promo ?? null;
  } catch {
    cachedPromo = null; // fail-open: no promo rather than blocking anything
  }
  return cachedPromo;
}

// True only the first time it's called in a session — so the pop-up shows once
// per cold start, not on every return to Home. Call it AFTER confirming there
// is pop-up content, so the one-shot isn't spent on an empty promo.
function claimPopupSlot(): boolean {
  if (popupShownThisSession) return false;
  popupShownThisSession = true;
  return true;
}

export default { fetchPromo, claimPopupSlot };
