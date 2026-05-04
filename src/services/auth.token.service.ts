/**
 * JWT Token Storage Service
 * Manages storing, retrieving, and validating JWT tokens from AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = '@tiffsy_auth_token';
const AUTH_TOKEN_EXPIRY_KEY = '@tiffsy_auth_token_expiry';

let cachedToken: string | null = null;

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
