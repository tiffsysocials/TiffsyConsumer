# Location Timeout Troubleshooting Guide

## Error: "Location request timed out"

This error (code 3) means the device couldn't get your GPS location within the timeout period.

## Quick Fixes

### For Android Emulator/Device:

1. **Enable Location Services**
   - Open Settings → Location
   - Turn ON Location
   - Set Location Mode to "High accuracy" (uses GPS, Wi-Fi, and mobile networks)

2. **For Android Emulator (Android Studio)**
   - Open emulator's Extended Controls (three dots on the right panel)
   - Go to Location tab
   - Click "Set Location" with default coordinates OR
   - Use "Routes" to simulate movement
   - Try: Latitude `19.0760`, Longitude `72.8777` (Mumbai coordinates)

3. **Grant App Permissions**
   - Settings → Apps → Tiffsy → Permissions → Location
   - Select "Allow only while using the app" or "Allow all the time"

4. **For Physical Android Device**
   - Make sure you're outdoors or near a window (better GPS signal)
   - Enable WiFi (helps with location accuracy even if not connected)
   - Wait 30-60 seconds after opening the app

### For iOS Simulator/Device:

1. **For iOS Simulator**
   - In Simulator menu: Features → Location → Custom Location
   - Enter: Latitude `19.0760`, Longitude `72.8777`
   - Or choose a preset like "Apple" or "City Run"

2. **For Physical iOS Device**
   - Settings → Privacy & Security → Location Services → ON
   - Settings → Privacy & Security → Location Services → Tiffsy → "While Using the App"
   - Make sure you're near a window or outdoors

## What We Fixed

The code now has:
1. **Dual-mode fallback**: Tries high accuracy first (10s), then falls back to low accuracy (30s)
2. **Non-blocking**: App loads even if location fails
3. **Better logging**: Check console for detailed error messages

## Testing the Fix

### Step 1: Check Console Logs
Look for these messages in your console:
```
[App] Requesting location permission...
[App] Location permission granted, fetching location...
[LocationService] Requesting location...
[LocationService] Location obtained successfully: {latitude: 19.0760, longitude: 72.8777}
[App] Location fetched successfully: 400703
```

### Step 2: If Still Timing Out
The app will still work! Users can:
- Manually add an address in the app
- HomeScreen will prompt "Add Delivery Address"
- Location will be attempted again next time they open the app

## Understanding Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 1 | PERMISSION_DENIED | Grant location permission in app settings |
| 2 | POSITION_UNAVAILABLE | Enable location services in device settings |
| 3 | TIMEOUT | Wait longer, ensure good GPS signal, or use WiFi |

## For Development/Testing

### Option 1: Test with Manual Address Entry
1. Open app
2. Ignore location permission or let it timeout
3. Navigate to HomeScreen
4. Click "Add Address"
5. Enter pincode manually

### Option 2: Use Mock Location (Android Only)
1. Enable Developer Options on your device
2. Settings → Developer Options → Select mock location app → Tiffsy
3. Use a mock location app to set fake GPS coordinates

### Option 3: Test Location Later
Location is optional at startup. You can:
- Add a "Refresh Location" button in settings
- Call `getCurrentLocationWithAddress()` when user needs it
- Prompt for location only when accessing location-dependent features

## Advanced Debugging

Add this to see detailed location info:

```javascript
// In App.tsx, add more logging:
getCurrentLocationWithAddress()
  .then((location) => {
    console.log('Full location data:', JSON.stringify(location, null, 2));
  })
  .catch((error) => {
    console.log('Location error:', error);
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
  });
```

## Production Considerations

### For Better User Experience:

1. **Show Loading State**
   ```javascript
   const { isGettingLocation } = useAddress();
   {isGettingLocation && <Text>Detecting your location...</Text>}
   ```

2. **Add Retry Button**
   ```javascript
   <Button onPress={getCurrentLocationWithAddress}>
     Retry Location Detection
   </Button>
   ```

3. **Graceful Fallback**
   - Always allow manual address entry
   - Show popular areas/pincodes as quick options
   - Cache last known location

4. **Optimize Timeout Settings**
   - Indoor environment: Lower accuracy, longer timeout
   - Outdoor environment: Higher accuracy, shorter timeout

## Need Help?

If location still doesn't work:
1. Check device location settings are enabled
2. Verify app has location permission
3. Test on a different device/emulator
4. Check console logs for error codes
5. Try manual address entry as fallback

The app is designed to work with OR without location services!
