import apiService, { Order } from './api.service';

/**
 * Cache metadata for tracking data freshness
 */
interface CacheMetadata {
  timestamp: number; // Unix timestamp in milliseconds
  ttl: number; // Time-to-live in milliseconds
}

/**
 * Generic cached data structure
 */
interface CachedData<T> {
  data: T;
  metadata: CacheMetadata;
}

/**
 * Context interface for Subscription methods
 */
interface SubscriptionContextMethods {
  fetchSubscriptions: () => Promise<void>;
  fetchVouchers: () => Promise<void>;
}

/**
 * Context interface for Notification methods
 */
interface NotificationContextMethods {
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: (page: number) => Promise<void>;
}

/**
 * DataPreloaderService - Orchestrates background data preloading after login
 *
 * This service implements Phase 3 of the progressive loading strategy:
 * - Preloads subscriptions, vouchers, orders, and notifications in background
 * - Provides in-memory caching with TTL (Time-To-Live)
 * - Non-blocking - errors are logged silently
 * - Singleton pattern - one instance across the app
 */
class DataPreloaderService {
  // In-memory cache for orders
  private orderCache: CachedData<Order[]> | null = null;

  // Status flags
  private preloadInProgress: boolean = false;
  private preloadCompleted: boolean = false;

  /**
   * Main entry point: Start background preload (Phase 3)
   *
   * This should be called from HomeScreen after menu data loads successfully.
   * Runs in background - user can navigate freely while preload happens.
   *
   * @param subscriptionContext - Methods from SubscriptionContext
   * @param notificationContext - Methods from NotificationContext
   */
  async startBackgroundPreload(
    subscriptionContext: SubscriptionContextMethods,
    notificationContext: NotificationContextMethods
  ): Promise<void> {
    // Prevent duplicate preloads
    if (this.preloadInProgress || this.preloadCompleted) {
      console.log('[DataPreloader] Preload already started or completed, skipping');
      return;
    }

    this.preloadInProgress = true;
    console.log('[DataPreloader] 🚀 Starting background data preload');

    try {
      // Run all preloads in parallel for maximum efficiency
      // Use Promise.allSettled to continue even if some fail
      const results = await Promise.allSettled([
        this.preloadSubscriptions(subscriptionContext),
        this.preloadVouchers(subscriptionContext),
        this.preloadOrders(),
        this.preloadNotifications(notificationContext),
      ]);

      // Log results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`[DataPreloader] ✅ Background preload completed: ${successful} successful, ${failed} failed`);
      this.preloadCompleted = true;
    } catch (error) {
      // This catch block should never be reached due to Promise.allSettled
      // But keep it for safety
      console.warn('[DataPreloader] ⚠️ Background preload failed (non-critical):', error);
    } finally {
      this.preloadInProgress = false;
    }
  }

  /**
   * Preload subscriptions via SubscriptionContext
   *
   * Subscriptions are stored in SubscriptionContext (in-memory).
   * This just triggers the fetch - context manages the data.
   */
  private async preloadSubscriptions(
    subscriptionContext: SubscriptionContextMethods
  ): Promise<void> {
    try {
      console.log('[DataPreloader] 📦 Preloading subscriptions...');
      await subscriptionContext.fetchSubscriptions();
      console.log('[DataPreloader] ✓ Subscriptions preloaded');
    } catch (error) {
      console.warn('[DataPreloader] ✗ Failed to preload subscriptions:', error);
      // Don't throw - let other preloads continue
    }
  }

  /**
   * Preload vouchers via SubscriptionContext
   *
   * Vouchers are stored in SubscriptionContext (in-memory).
   * This just triggers the fetch - context manages the data.
   */
  private async preloadVouchers(
    subscriptionContext: SubscriptionContextMethods
  ): Promise<void> {
    try {
      console.log('[DataPreloader] 🎫 Preloading vouchers...');
      await subscriptionContext.fetchVouchers();
      console.log('[DataPreloader] ✓ Vouchers preloaded');
    } catch (error) {
      console.warn('[DataPreloader] ✗ Failed to preload vouchers:', error);
      // Don't throw - let other preloads continue
    }
  }

  /**
   * Preload current orders into local cache
   *
   * Orders are stored in this service's in-memory cache with 60-second TTL.
   * YourOrdersScreen will check this cache first before fetching from API.
   */
  private async preloadOrders(): Promise<void> {
    try {
      console.log('[DataPreloader] 📋 Preloading orders...');
      const response = await apiService.getMyOrders({ limit: 50 });

      // Handle multiple response formats
      const isSuccess = response.success === true || (response as any).message === true;
      const responseData = response.data && typeof response.data === 'object' && 'orders' in response.data
        ? response.data
        : (response as any).error || response.data;

      let orders: Order[] = [];

      if (isSuccess && responseData && responseData.orders) {
        orders = responseData.orders;
      } else if (isSuccess && responseData && Array.isArray(responseData)) {
        orders = responseData;
      } else if (Array.isArray(response.data)) {
        orders = response.data;
      }

      // Cache the orders with 60-second TTL
      this.orderCache = {
        data: orders,
        metadata: {
          timestamp: Date.now(),
          ttl: 60 * 1000, // 60 seconds in milliseconds
        },
      };

      console.log(`[DataPreloader] ✓ Orders preloaded: ${orders.length} orders`);
    } catch (error) {
      console.warn('[DataPreloader] ✗ Failed to preload orders:', error);
      // Don't throw - let other preloads continue
    }
  }

  /**
   * Preload notifications via NotificationContext
   *
   * Notifications are stored in NotificationContext (AsyncStorage + in-memory).
   * This just triggers the fetch - context manages the data.
   */
  private async preloadNotifications(
    notificationContext: NotificationContextMethods
  ): Promise<void> {
    try {
      console.log('[DataPreloader] 🔔 Preloading notifications...');

      // Fetch both unread count and first page of notifications in parallel
      await Promise.all([
        notificationContext.fetchUnreadCount(),
        notificationContext.fetchNotifications(1),
      ]);

      console.log('[DataPreloader] ✓ Notifications preloaded');
    } catch (error) {
      console.warn('[DataPreloader] ✗ Failed to preload notifications:', error);
      // Don't throw - let other preloads continue
    }
  }

  /**
   * Get cached orders (returns null if cache miss or expired)
   *
   * YourOrdersScreen calls this to check if cached orders are available.
   * If cache is valid (not expired), returns the orders instantly.
   * If cache is invalid, returns null and screen falls back to API fetch.
   *
   * @returns Cached orders or null
   */
  getCachedOrders(): Order[] | null {
    if (!this.orderCache) {
      console.log('[DataPreloader] 📋 Order cache miss (empty)');
      return null;
    }

    if (this.isCacheExpired('orders')) {
      console.log('[DataPreloader] ⏰ Order cache expired');
      this.orderCache = null;
      return null;
    }

    console.log('[DataPreloader] ✓ Order cache hit');
    return this.orderCache.data;
  }

  /**
   * Check if a cache is expired based on TTL
   *
   * @param cacheKey - The cache key to check
   * @returns true if expired, false if still valid
   */
  isCacheExpired(cacheKey: 'orders'): boolean {
    const cache = cacheKey === 'orders' ? this.orderCache : null;

    if (!cache) {
      return true; // No cache = expired
    }

    const now = Date.now();
    const age = now - cache.metadata.timestamp;
    const isExpired = age > cache.metadata.ttl;

    if (isExpired) {
      const ageInSeconds = Math.floor(age / 1000);
      const ttlInSeconds = Math.floor(cache.metadata.ttl / 1000);
      console.log(`[DataPreloader] Cache expired: age=${ageInSeconds}s, ttl=${ttlInSeconds}s`);
    }

    return isExpired;
  }

  /**
   * Manually invalidate a specific cache
   *
   * Call this after actions that modify the cached data:
   * - After order placement → invalidate orders + vouchers
   * - After subscription purchase → invalidate subscriptions + vouchers
   *
   * Note: Vouchers are managed by SubscriptionContext, so we can't invalidate them directly.
   * Instead, call subscriptionContext.fetchVouchers() to refresh.
   *
   * @param cacheKey - The cache to invalidate
   */
  invalidateCache(cacheKey: 'orders' | 'vouchers'): void {
    if (cacheKey === 'orders') {
      console.log('[DataPreloader] 🗑️ Invalidating order cache');
      this.orderCache = null;
    } else if (cacheKey === 'vouchers') {
      console.log('[DataPreloader] 🗑️ Invalidating voucher cache (handled by SubscriptionContext)');
      // Vouchers are managed by SubscriptionContext
      // Caller should call subscriptionContext.fetchVouchers() to refresh
    }
  }

  /**
   * Clear all caches (call on logout)
   *
   * This ensures that when a user logs out and a new user logs in,
   * they don't see the previous user's cached data.
   */
  clearAllCaches(): void {
    console.log('[DataPreloader] 🧹 Clearing all caches');
    this.orderCache = null;
    this.preloadCompleted = false;
    this.preloadInProgress = false;
  }

  /**
   * Reset preload status (for testing or force re-preload)
   *
   * This allows the preload to run again, useful for:
   * - Testing the preload functionality
   * - Forcing a re-preload after significant app state changes
   */
  resetPreloadStatus(): void {
    console.log('[DataPreloader] 🔄 Resetting preload status');
    this.preloadCompleted = false;
    this.preloadInProgress = false;
  }

  /**
   * Get cache statistics (for debugging)
   *
   * Returns information about the current cache state.
   */
  getCacheStats(): {
    orderCacheSize: number;
    orderCacheAge: number | null;
    orderCacheTTL: number | null;
    isOrderCacheValid: boolean;
    preloadCompleted: boolean;
    preloadInProgress: boolean;
  } {
    return {
      orderCacheSize: this.orderCache?.data.length || 0,
      orderCacheAge: this.orderCache ? Date.now() - this.orderCache.metadata.timestamp : null,
      orderCacheTTL: this.orderCache?.metadata.ttl || null,
      isOrderCacheValid: this.orderCache ? !this.isCacheExpired('orders') : false,
      preloadCompleted: this.preloadCompleted,
      preloadInProgress: this.preloadInProgress,
    };
  }
}

// Export singleton instance
export const dataPreloader = new DataPreloaderService();
export default dataPreloader;
