/**
 * JWT Token Storage Service
 * Manages storing, retrieving, and validating JWT tokens from AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const AUTH_TOKEN_KEY = '@tiffsy_auth_token';
const AUTH_TOKEN_EXPIRY_KEY = '@tiffsy_auth_token_expiry';

let cachedToken: string | null = null;
let cachedExpiry: number | null = null;
let inflightRefresh: Promise<string> | null = null;

export class AuthRefreshError extends Error {
  constructor(public kind: 'auth' | 'transient', message: string) {
    super(message);
    this.name = 'AuthRefreshError';
  }
}

/**
 * Store JWT token from backend
 */
export async function storeAuthToken(
  token: string,
  expiresIn: number,
): Promise<void> {
  const expiryTimestamp = Date.now() + expiresIn * 1000;
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  await AsyncStorage.setItem(
    AUTH_TOKEN_EXPIRY_KEY,
    expiryTimestamp.toString(),
  );
  cachedToken = token;
  cachedExpiry = expiryTimestamp;
}

/**
 * Get stored JWT token (returns null if not present)
 * Note: Does NOT check expiry - let the backend handle token expiry
 * via 401 responses, which trigger the refresh flow
 */
export async function getAuthToken(): Promise<string | null> {
  if (cachedToken) {
    return cachedToken;
  }

  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    return null;
  }

  cachedToken = token;
  return token;
}

/**
 * Clear stored auth token (logout)
 */
export async function clearAuthToken(): Promise<void> {
  cachedToken = null;
  cachedExpiry = null;
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);
}

/**
 * Check if user has a stored token
 */
export async function hasValidToken(): Promise<boolean> {
  const token = await getAuthToken();
  return token !== null;
}

/**
 * Read stored token expiry timestamp (ms since epoch). Null if not present.
 */
export async function getTokenExpiry(): Promise<number | null> {
  if (cachedExpiry !== null) return cachedExpiry;
  const expiryStr = await AsyncStorage.getItem(AUTH_TOKEN_EXPIRY_KEY);
  if (!expiryStr) return null;
  const parsed = parseInt(expiryStr, 10);
  if (Number.isNaN(parsed)) return null;
  cachedExpiry = parsed;
  return parsed;
}

/**
 * True when the stored token is within `thresholdMs` of expiring (or already expired).
 * Returns false when no expiry is stored (legacy tokens — let the backend handle them).
 */
export async function isTokenExpiringSoon(
  thresholdMs: number = 5 * 60 * 1000,
): Promise<boolean> {
  const expiry = await getTokenExpiry();
  if (expiry === null) return false;
  return Date.now() + thresholdMs >= expiry;
}

/**
 * Refresh the JWT token. Coalesces concurrent callers onto a single in-flight
 * request so token rotation on the backend can't cause races where one refresh
 * succeeds and a parallel one fails (and clears the just-stored token).
 *
 * Throws AuthRefreshError with kind='auth' for definitive auth failures
 * (401/403/missing-token) and kind='transient' for network/5xx/timeout.
 */
export function refreshAuthToken(baseURL: string): Promise<string> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = doRefresh(baseURL).finally(() => {
    inflightRefresh = null;
  });

  return inflightRefresh;
}

async function doRefresh(baseURL: string): Promise<string> {
  const currentToken = await getAuthToken();
  if (!currentToken) {
    throw new AuthRefreshError('auth', 'No token available to refresh');
  }

  try {
    const response = await axios.post(
      `${baseURL}/api/auth/token/refresh`,
      {},
      {
        headers: { Authorization: `Bearer ${currentToken}` },
        timeout: 15000,
      },
    );

    const newToken: string | undefined = response.data?.data?.token;
    const expiresIn: number | undefined = response.data?.data?.expiresIn;
    if (!newToken || typeof expiresIn !== 'number') {
      throw new AuthRefreshError('auth', 'Refresh returned no token');
    }

    await storeAuthToken(newToken, expiresIn);
    return newToken;
  } catch (err: any) {
    if (err instanceof AuthRefreshError) throw err;

    if (err.response) {
      const status = err.response.status;
      if (status === 401 || status === 403) {
        throw new AuthRefreshError('auth', `Refresh rejected (${status})`);
      }
      throw new AuthRefreshError('transient', `Refresh failed (${status})`);
    }

    throw new AuthRefreshError(
      'transient',
      err.message || 'Network error during refresh',
    );
  }
}
