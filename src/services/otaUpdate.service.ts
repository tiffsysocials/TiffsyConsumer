// src/services/otaUpdate.service.ts
//
// Over-the-air JS-bundle updates (react-native-ota-hot-update). On launch it
// asks the backend manifest whether a newer JS bundle is available FOR THIS
// native build, and if so downloads it. Once downloaded we PROMPT the user to
// restart so the new bundle takes effect immediately.
//
// Why prompt instead of applying silently: a downloaded bundle only loads when
// React Native re-initialises at a genuine COLD start (the bundle path is read
// once, at process launch). Backgrounding the app and reopening it — or
// resuming from Recents — keeps the same warm process running the OLD bundle.
// MIUI/Xiaomi in particular keeps processes warm for a long time, so a fix
// could sit downloaded-but-unapplied for days while the user "closed and
// reopened" the app. The prompt makes applying it a single tap.
//
// Fully FAIL-OPEN: any error is swallowed so the app is never blocked, and
// declining the prompt is harmless — the bundle still applies on the next
// natural cold start, exactly as before.
//
// Native changes (new native modules, RN upgrades) still need a Play Store
// build + a bumped `targetNativeVersion` — the guard below refuses a bundle
// built for a different native version.

import { Alert, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import hotUpdate from 'react-native-ota-hot-update';
import ReactNativeBlobUtil from 'react-native-blob-util';
import apiService from './api.service';

// Only surface the restart prompt once per app session.
let restartPromptShown = false;

/**
 * Delete every downloaded bundle except the one we just installed, so a stale
 * older bundle can never linger or be served. Safe to call before restarting:
 * the currently-running JS is an in-memory copy, and the embedded APK bundle
 * always remains as the ultimate fallback.
 *
 * getBundleList/deleteBundleById are newer additions to the library, so this is
 * guarded — on an older native build it simply no-ops and the library's own
 * `maxBundleVersions` pruning still applies.
 */
async function clearPreviousBundles(keepVersion: number): Promise<void> {
  try {
    if (typeof hotUpdate.getBundleList !== 'function') return;
    const list = await hotUpdate.getBundleList();
    for (const bundle of list || []) {
      if (Number(bundle.version) === keepVersion) continue;
      try {
        await hotUpdate.deleteBundleById(bundle.id);
      } catch {
        // one stale bundle failing to delete must not block the restart
      }
    }
  } catch (err: any) {
    console.log('[OTA] clearing old bundles failed (non-fatal):', err?.message);
  }
}

function promptRestartToApply(newVersion: number): void {
  if (restartPromptShown) return;
  restartPromptShown = true;

  Alert.alert(
    'Update ready',
    "We've improved the app. Restart now to apply the latest version.",
    [
      // Declining is safe: the bundle is already downloaded, so it applies on
      // the next cold start regardless — the previous silent behaviour.
      { text: 'Later', style: 'cancel' },
      {
        text: 'Restart now',
        onPress: async () => {
          await clearPreviousBundles(newVersion);
          try {
            await hotUpdate.resetApp();
          } catch (err: any) {
            // Old native builds may not expose resetApp; the bundle still
            // applies on the next cold start.
            console.log('[OTA] resetApp failed (applies on next launch):', err?.message);
          }
        },
      },
    ],
    { cancelable: false },
  );
}

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

    const newVersion = Number(m.version);

    await hotUpdate.downloadBundleUri(ReactNativeBlobUtil, m.downloadUrl, newVersion, {
      updateSuccess: () => {
        console.log('[OTA] bundle downloaded; prompting restart to apply');
        promptRestartToApply(newVersion);
      },
      updateFail: (msg?: string | Error) => console.log('[OTA] update failed:', msg),
      // We apply it ourselves via the prompt so the user gets it immediately
      // instead of waiting for a cold start that may never come.
      restartAfterInstall: false,
      progress: () => {},
      maxBundleVersions: 2,
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
