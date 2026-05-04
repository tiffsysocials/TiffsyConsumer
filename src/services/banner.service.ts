// src/services/banner.service.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BannerModel } from '../types/banner';

const BASE_URL = 'https://d31od4t2t5epcb.cloudfront.net';
const CACHE_KEY = 'home_banners';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface BannerCacheEntry {
  timestamp: number;
  banners: BannerModel[];
}

const bannerService = {
  /**
   * Fetch banners from API or cache.
   * forceRefresh=true bypasses cache and always calls API.
   */
  async fetchBanners(forceRefresh = false): Promise<BannerModel[]> {
    // 1. If cache is fresh and not forcing refresh, return cached
    if (!forceRefresh) {
      const cached = await this._getCached(false);
      if (cached !== null) {
        console.log('[BannerService] Returning cached banners');
        // Silently refresh in background if this was a non-forced read
        this._refreshInBackground();
        return cached;
      }
    }

    // 2. Fetch from API
    try {
      const result = await this._callApi();
      await this._setCache(result);
      return result;
    } catch (error) {
      console.warn('[BannerService] API call failed, falling back to cache:', error);
      // On failure, return stale cache if available (ignore TTL)
      const stale = await this._getCached(true);
      return stale ?? [];
    }
  },

  /** Call the /api/banners endpoint */
  async _callApi(): Promise<BannerModel[]> {
    const response = await axios.get(`${BASE_URL}/api/banners`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    const raw: any[] = response.data?.data?.banners ?? [];
    return raw.map((b) => ({
      id: b._id,
      imageUrl: b.image_url,
      title: b.title ?? undefined,
      redirectLink: b.redirect_link ?? undefined,
      status: b.status,
      displayOrder: b.display_order ?? 0,
    }));
  },

  /** Get cached banners. ignoreExpiry=true returns stale cache; false respects TTL. */
  async _getCached(ignoreExpiry: boolean): Promise<BannerModel[] | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const entry: BannerCacheEntry = JSON.parse(raw);
      if (ignoreExpiry || Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.banners;
      }
      return null;
    } catch {
      return null;
    }
  },

  /** Persist banners to cache with current timestamp */
  async _setCache(banners: BannerModel[]): Promise<void> {
    try {
      const entry: BannerCacheEntry = { timestamp: Date.now(), banners };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch (e) {
      console.warn('[BannerService] Cache write failed:', e);
    }
  },

  /** Silently refresh banners from API in background (does not throw) */
  _refreshInBackground(): void {
    this._callApi()
      .then((banners) => this._setCache(banners))
      .catch(() => {
        /* silent — background refresh, no user-visible impact */
      });
  },
};

export default bannerService;
