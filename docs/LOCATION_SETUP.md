# Location-Based Kitchen Fetching - Setup Guide

## Overview
The app now automatically requests location permission on startup and uses the user's current location pincode to fetch available kitchens. This provides a seamless experience where users can browse kitchens immediately without setting up an address first.

## How It Works

### 1. App Startup Flow
- When the app starts, it automatically requests location permission
- If granted, it gets the user's current GPS coordinates
- Coordinates are reverse geocoded to get the full address including pincode
- The pincode is stored in the AddressContext for use throughout the app

### 2. Kitchen Fetching Flow
The HomeScreen now follows this logic:

```
1. Check if user has a saved delivery address
   ├─ YES → Use address ID to fetch kitchens (existing flow)
   └─ NO → Check if location pincode is available
       ├─ YES → Use pincode to fetch zone → Get kitchens for zone
       └─ NO → Show "Add Address" prompt
```

### 3. Benefits
- Users can browse kitchens immediately without manual address entry
- Seamless onboarding experience
- Falls back gracefully if location is denied
- Works alongside manual address management

## Files Modified

### New Files
- [src/services/location.service.ts](src/services/location.service.ts) - Location permission and geolocation service

### Modified Files
- [src/context/AddressContext.tsx](src/context/AddressContext.tsx) - Added location state and methods
- [App.tsx](App.tsx) - Added location permission request on startup
- [src/screens/home/HomeScreen.tsx](src/screens/home/HomeScreen.tsx) - Updated to fetch kitchens by pincode when no address
- [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml) - Added location permissions
- [ios/TiffinDelivery/Info.plist](ios/TiffinDelivery/Info.plist) - Added location permission descriptions

## Configuration Required

### Google Maps API Key (Required for Production)
The reverse geocoding feature uses Google Geocoding API. You need to:

1. Get a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Geocoding API** for your project
3. Update the API key in [src/services/location.service.ts:110](src/services/location.service.ts#L110)

```typescript
// Replace 'YOUR_GOOGLE_MAPS_API_KEY' with your actual key
const response = await fetch(
  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=YOUR_ACTUAL_API_KEY`
);
```

**Important:** Never commit your API key to version control. Consider using environment variables:
- Use `react-native-dotenv` or `react-native-config`
- Store the key in `.env` file (add to `.gitignore`)
- Reference it as `process.env.GOOGLE_MAPS_API_KEY`

## API Endpoints Used

The following backend endpoints are used:
- `GET /api/zone/pincode/:pincode` - Get zone information by pincode
- `GET /api/kitchens/zone/:zoneId?menuType=MEAL_MENU` - Get kitchens for a zone
- `GET /api/address/kitchens/:addressId?menuType=MEAL_MENU` - Get kitchens for address (existing)

## Testing

### Test on Android
```bash
npm run android
```

### Test on iOS
```bash
npm run ios
```

### Testing Location Permission Flow
1. Launch the app
2. You should see a permission dialog asking for location access
3. Grant permission
4. Check console logs for location data:
   ```
   [HomeScreen] No address, using location pincode: 110001
   [HomeScreen] Zone found: <zone_id>
   ```
5. Kitchens should load based on your current location

### Testing Without Location Permission
1. Launch the app
2. Deny location permission
3. App should show "Add Address" prompt on HomeScreen
4. User can manually add address to proceed

### Testing Location Fallback
1. Add a delivery address manually
2. The app will prefer the saved address over location
3. Kitchens will be fetched using address ID (more accurate)

## Location Service API

### AddressContext Methods

```typescript
// Request location permission
const granted = await requestLocationPermission();

// Get current location with full address
const locationResult = await getCurrentLocationWithAddress();
// Returns: { coordinates, pincode, address: { addressLine1, locality, city, state } }

// Access current location from context
const { currentLocation, isGettingLocation } = useAddress();
```

### LocationService Methods

```typescript
import locationService from './services/location.service';

// Request permission
await locationService.requestLocationPermission();

// Check permission status
const hasPermission = await locationService.checkLocationPermission();

// Get coordinates only
const coords = await locationService.getCurrentLocation();

// Get coordinates + address
const fullLocation = await locationService.getLocationWithAddress();

// Show permission denied alert
locationService.showLocationPermissionDeniedAlert();
```

## Platform-Specific Notes

### Android
- Requires Android 6.0+ for runtime permissions
- Permission request shows native Android dialog
- Location can be tested in Android emulator (send GPS coordinates)

### iOS
- Info.plist descriptions are shown in permission dialog
- Must set location simulation in Xcode for testing
- Simulator: Debug → Location → Custom Location

## Troubleshooting

### "Location permission denied" error
- User denied permission
- Check device location services are enabled
- On Android: Settings → Location → On
- On iOS: Settings → Privacy → Location Services → On

### "Unable to get address from coordinates" error
- No internet connection (reverse geocoding needs internet)
- Invalid Google Maps API key
- Geocoding API not enabled in Google Cloud Console
- API quota exceeded

### No kitchens found
- Pincode may not be served by any kitchen
- Check backend has zones configured for the pincode
- Verify zone has associated kitchens

### Location not updating
- Location is fetched only on app startup
- To refresh, user needs to restart the app
- Consider adding pull-to-refresh with location update

## Future Enhancements

### Recommended Improvements
1. **Manual Location Refresh** - Add a button to refresh current location
2. **Location Caching** - Cache last known location to avoid repeated API calls
3. **Alternative Geocoding** - Use device locale as fallback if geocoding fails
4. **Background Location** - Update location when app comes to foreground
5. **Location Accuracy Indicator** - Show location accuracy to user
6. **Offline Support** - Cache zone/pincode mapping for offline use

### Privacy Considerations
- Only request location when needed
- Explain why location is needed in permission dialog
- Provide manual address entry as alternative
- Don't track location in background unless necessary
- Clear location data on logout

## Dependencies Added

```json
{
  "react-native-geolocation-service": "^5.3.1"
}
```

**Note:** This package provides better support for React Native's new architecture and has more reliable location handling compared to `@react-native-community/geolocation`.

## Next Steps

1. ✅ Add Google Maps API key to location.service.ts
2. ✅ Test on physical devices (Android & iOS)
3. ✅ Verify location permission dialogs appear correctly
4. ✅ Test with different pincodes to ensure kitchen fetching works
5. ✅ Add error tracking for location failures
6. ✅ Monitor API usage and set billing alerts for Google Geocoding API

## Support

For issues or questions:
- Check console logs for detailed error messages
- Verify API key is valid and has correct permissions
- Ensure backend endpoints are accessible
- Test with manual address entry as fallback
