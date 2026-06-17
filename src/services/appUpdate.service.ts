// src/services/appUpdate.service.ts
//
// Force / soft update gate. On launch (and on resume) the app asks the backend
// for the minimum required version for its platform, compares it against its own
// installed versionName, and decides whether to show a blocking ("required") or
// dismissible ("available") update modal.
//
// FAIL-OPEN: any network/parse error resolves to { status: 'none' } so a backend
// outage can never lock users out of the app.

import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import apiService from './api.service';

export type UpdateStatus = 'none' | 'available' | 'required';

export interface UpdateCheckResult {
  status: UpdateStatus;
  message: string;
  storeUrl: string;
  installedVersion: string;
  latestVersion: string;
}

const NO_UPDATE: UpdateCheckResult = {
  status: 'none',
  message: '',
  storeUrl: '',
  installedVersion: '',
  latestVersion: '',
};

/**
 * Compare two dotted numeric version strings (e.g. "1.0.12" vs "1.0.13").
 * Returns -1 if a < b, 0 if equal, 1 if a > b. Missing segments count as 0,
 * and any non-numeric noise (suffixes, etc.) is stripped per-segment.
 */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string): number[] =>
    String(v || '0')
      .split('.')
      .map((part) => parseInt(part, 10) || 0);

  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/** The installed app's versionName (Android) / CFBundleShortVersionString (iOS). */
export function getInstalledVersion(): string {
  try {
    return DeviceInfo.getVersion();
  } catch {
    return '';
  }
}

/**
 * Ask the backend whether this install must / should update.
 * Never throws — returns { status: 'none' } on any failure (fail-open).
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';
    const installed = getInstalledVersion();
    if (!installed) return NO_UPDATE;

    const res = await apiService.getAppConfig(platform);
    const cfg = res?.data;
    if (!cfg || !cfg.minVersion || !cfg.latestVersion) return NO_UPDATE;

    const belowMin = compareSemver(installed, cfg.minVersion) < 0;
    const belowLatest = compareSemver(installed, cfg.latestVersion) < 0;

    if (belowMin && cfg.forceUpdate) {
      return {
        status: 'required',
        message: cfg.message || 'A new version is required to continue.',
        storeUrl: cfg.storeUrl || '',
        installedVersion: installed,
        latestVersion: cfg.latestVersion,
      };
    }

    if (belowLatest) {
      return {
        status: 'available',
        message: cfg.message || 'A new version is available.',
        storeUrl: cfg.storeUrl || '',
        installedVersion: installed,
        latestVersion: cfg.latestVersion,
      };
    }

    return NO_UPDATE;
  } catch (error: any) {
    console.log('[appUpdate] checkForUpdate failed (fail-open):', error?.message);
    return NO_UPDATE;
  }
}

export default { checkForUpdate, compareSemver, getInstalledVersion };
