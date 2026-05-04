// Centralized config — read once, used by services + native config (Info.plist + AndroidManifest).
// Keep this file in sync with the platform-specific manifests.
//
// Note: For production we should move these to build-time env vars
// (e.g., react-native-config) so keys aren't committed in plaintext.
//
// We keep TWO Google Maps keys with different API restrictions:
// - GOOGLE_MAPS_API_KEY: used by JS-side HTTP calls (Geocoding, Places Autocomplete).
//   Restricted in Google Cloud to those two APIs.
// - GOOGLE_MAPS_ANDROID_KEY: used by react-native-maps in AndroidManifest for tile rendering.
//   Restricted to "Maps SDK for Android". Mirrored in
//   android/app/src/main/AndroidManifest.xml under com.google.android.geo.API_KEY.
//   (Not imported in JS — listed here for visibility only.)

export const GOOGLE_MAPS_API_KEY = 'AIzaSyCJLEZUNQP8gtDQh-oW3FxgsNCdJHEaYQc';
export const GOOGLE_MAPS_ANDROID_KEY = 'AIzaSyB4jJpH1-3SYsBGguA9UqHcwGs-AC_bpuw';
