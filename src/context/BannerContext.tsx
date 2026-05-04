// src/context/BannerContext.tsx

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { BannerModel } from '../types/banner';
import bannerService from '../services/banner.service';

interface BannerState {
  isLoading: boolean;
  banners: BannerModel[];
  error: string | null;
}

interface BannerContextType extends BannerState {
  loadBanners: (forceRefresh?: boolean) => Promise<void>;
}

const BannerContext = createContext<BannerContextType | undefined>(undefined);

export const BannerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [banners, setBanners] = useState<BannerModel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadBanners = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await bannerService.fetchBanners(forceRefresh);
      setBanners(data);
    } catch (e: any) {
      console.error('[BannerContext] Failed to load banners:', e);
      setError(e?.message ?? 'Failed to load banners');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <BannerContext.Provider value={{ isLoading, banners, error, loadBanners }}>
      {children}
    </BannerContext.Provider>
  );
};

export const useBanners = (): BannerContextType => {
  const ctx = useContext(BannerContext);
  if (!ctx) {
    throw new Error('useBanners must be used within a BannerProvider');
  }
  return ctx;
};
