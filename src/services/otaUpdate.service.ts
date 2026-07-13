// src/services/otaUpdate.service.ts
//
// Over-the-air JS-bundle updates (react-native-ota-hot-update). On launch it
// asks the backend manifest whether a newer JS bundle is available FOR THIS
// native build, and if so downloads it silently — applied on the next cold
// start. Fully FAIL-OPEN: any error is swallowed so the app is never blocked.
//
// Native changes (new native modules, RN upgrades) still need a Play Store
// build + a bumped `targetNativeVersion` — the guard below refuses a bundle
// built for a different native version.

import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import hotUpdate from 'react-native-ota-hot-update';
import ReactNativeBlobUtil from 'react-native-blob-util';
import apiService from './api.service';

export async function checkForOtaUpdate(): Promise<void> {
  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const resp = await apiService.getOtaManifest(platform);
    const m = resp?.data;
    if (!m || !m.downloadUrl || !m.version) return;

    // Native-build guard: only apply a bundle built for the installed native version.
    let installed = '';
    try {
      installed = DeviceInfo.getVersion();
    } catch {}
    if (m.targetNativeVersion && installed && m.targetNativeVersion !== installed) return;

    // Skip if we already have this (or a newer) bundle.
    const current = await hotUpdate.getCurrentVersion();
    if (Number(m.version) <= Number(current || 0)) return;

    await hotUpdate.downloadBundleUri(ReactNativeBlobUtil, m.downloadUrl, Number(m.version), {
      updateSuccess: () => console.log('[OTA] bundle downloaded; applies on next launch'),
      updateFail: (msg?: string) => console.log('[OTA] update failed:', msg),
      restartAfterInstall: false, // silent — apply on next cold start
      progress: () => {},
      maxBundleVersions: 3,
      // no-store: blob-util downloads through RN's shared OkHttp client,
      // whose disk cache (cache/http-cache) breaks blob-util's
      // bytes-vs-Content-Length completeness check on cacheable responses
      // ("Download interrupted."). The backend's /api/ota/download proxy
      // serves no-store for the same reason; this header protects us even
      // if a manifest ever points straight at cacheable storage again.
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.log('[OTA] check failed (non-blocking):', err?.message);
  }
}

export default { checkForOtaUpdate };
