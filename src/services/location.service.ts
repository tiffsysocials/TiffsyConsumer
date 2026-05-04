import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { GOOGLE_MAPS_API_KEY } from '../constants/config';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  coordinates: LocationCoordinates;
  pincode?: string;
  address?: {
    addressLine1?: string;
    locality?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

class LocationService {
  private hasPermission: boolean = false;

  /**
   * Request location permission from the user
   * Android requires runtime permission, iOS uses Info.plist
   */
  async requestLocationPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Tiffsy needs access to your location to show nearby kitchens and ensure accurate delivery.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        this.hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        return this.hasPermission;
      } else {
        // iOS: react-native-geolocation-service requires an explicit authorization
        // request before getCurrentPosition will work. Info.plist alone is not enough.
        const status = await Geolocation.requestAuthorization('whenInUse');
        this.hasPermission = status === 'granted';
        return this.hasPermission;
      }
    } catch (err) {
      console.error('Error requesting location permission:', err);
      return false;
    }
  }

  /**
   * Check if location permission is granted
   */
  async checkLocationPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        this.hasPermission = granted;
        return granted;
      } else {
        // requestAuthorization is idempotent on iOS — if already granted it
        // returns 'granted' without re-prompting; if denied/restricted we get
        // the real status here instead of the optimistic `true` we used before.
        const status = await Geolocation.requestAuthorization('whenInUse');
        this.hasPermission = status === 'granted';
        return this.hasPermission;
      }
    } catch (err) {
      console.error('Error checking location permission:', err);
      return false;
    }
  }

  /**
   * Get current device location coordinates
   */
  async getCurrentLocation(): Promise<LocationCoordinates> {
    return new Promise((resolve, reject) => {
      console.log('[LocationService] Requesting location...');

      // Try high accuracy first with shorter timeout
      Geolocation.getCurrentPosition(
        (position) => {
          const coordinates: LocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          console.log('[LocationService] Location obtained successfully:', coordinates);
          resolve(coordinates);
        },
        (error) => {
          console.log('[LocationService] High accuracy failed (code:', error.code, '), trying low accuracy...');

          // Fallback to low accuracy mode with longer timeout
          Geolocation.getCurrentPosition(
            (position) => {
              const coordinates: LocationCoordinates = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              };
              console.log('[LocationService] Location obtained (low accuracy):', coordinates);
              resolve(coordinates);
            },
            (fallbackError) => {
              console.error('[LocationService] Location failed completely. Error code:', fallbackError.code);

              // Provide user-friendly error messages
              let errorMessage = 'Failed to get location';
              switch (fallbackError.code) {
                case 1: // PERMISSION_DENIED
                  errorMessage = 'Location permission denied';
                  break;
                case 2: // POSITION_UNAVAILABLE
                  errorMessage = 'Location service unavailable. Please ensure location services are enabled in your device settings.';
                  break;
                case 3: // TIMEOUT
                  errorMessage = 'Location request timed out. Please ensure you have a clear view of the sky or try again indoors with WiFi enabled.';
                  break;
                default:
                  errorMessage = fallbackError.message;
              }

              reject(new Error(errorMessage));
            },
            {
              enableHighAccuracy: false,
              timeout: 30000,
              maximumAge: 60000,
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );
    });
  }

  /**
   * Reverse geocode coordinates to get address details including pincode
   * Uses Google Maps Geocoding API for high accuracy (especially for India)
   */
  async reverseGeocode(coordinates: LocationCoordinates): Promise<LocationResult> {
    try {
      const { latitude, longitude } = coordinates;

      // Google Maps Geocoding API - Most accurate for India
      // Get your free API key from: https://console.cloud.google.com/
      // Enable "Geocoding API" in your project
      const GOOGLE_API_KEY = GOOGLE_MAPS_API_KEY;

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}&language=en&result_type=street_address|sublocality|locality`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        // Get the most precise result (usually first one)
        const result = data.results[0];
        const addressComponents = result.address_components;

        console.log('[LocationService] Google Geocoding result:', JSON.stringify(result, null, 2));

        let pincode = '';
        let sublocality = '';
        let locality = '';
        let city = '';
        let state = '';
        let country = '';
        let route = ''; // Street name
        let premise = ''; // Building name/number

        // Extract all address components
        addressComponents.forEach((component: any) => {
          const types = component.types;

          if (types.includes('postal_code')) {
            pincode = component.long_name;
          }
          if (types.includes('sublocality_level_1') || types.includes('sublocality_level_2')) {
            sublocality = component.long_name;
          }
          if (types.includes('sublocality') && !sublocality) {
            sublocality = component.long_name;
          }
          if (types.includes('locality')) {
            locality = component.long_name;
          }
          if (types.includes('administrative_area_level_2') && !city) {
            city = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            state = component.long_name;
          }
          if (types.includes('country')) {
            country = component.long_name;
          }
          if (types.includes('route')) {
            route = component.long_name;
          }
          if (types.includes('premise') || types.includes('street_number')) {
            premise = component.long_name;
          }
        });

        // Build detailed address line
        let addressLine1 = '';
        if (premise) addressLine1 += premise;
        if (route) addressLine1 += (addressLine1 ? ', ' : '') + route;

        // If no street address, use first part of formatted address
        if (!addressLine1) {
          const parts = result.formatted_address.split(',');
          addressLine1 = parts[0] || '';
        }

        // Use locality or city as fallback
        const finalCity = locality || city;
        const finalLocality = sublocality || locality;

        console.log('[LocationService] Parsed address:', {
          addressLine1,
          locality: finalLocality,
          city: finalCity,
          state,
          pincode,
        });

        return {
          coordinates,
          pincode,
          address: {
            addressLine1,
            locality: finalLocality,
            city: finalCity,
            state,
            country,
          },
        };
      } else if (data.status === 'ZERO_RESULTS') {
        throw new Error('No address found for this location');
      } else if (data.status === 'REQUEST_DENIED') {
        throw new Error('Google API key is invalid or not configured properly');
      } else {
        throw new Error(`Geocoding failed: ${data.status}`);
      }
    } catch (error) {
      console.error('[LocationService] Error reverse geocoding:', error);
      throw error;
    }
  }

  /**
   * Get location with full address details including pincode
   * This is the main method to use for getting location-based data
   */
  async getLocationWithAddress(): Promise<LocationResult> {
    try {
      // Check permission first
      const hasPermission = await this.checkLocationPermission();

      if (!hasPermission) {
        const granted = await this.requestLocationPermission();
        if (!granted) {
          throw new Error('Location permission denied');
        }
      }

      // Get current coordinates
      const coordinates = await this.getCurrentLocation();

      // Reverse geocode to get address and pincode
      const locationResult = await this.reverseGeocode(coordinates);

      return locationResult;
    } catch (error) {
      console.error('Error getting location with address:', error);
      throw error;
    }
  }

  /**
   * Forward geocode an address string to get coordinates
   * Uses Google Maps Geocoding API
   */
  async forwardGeocode(address: string): Promise<LocationCoordinates | null> {
    try {
      const GOOGLE_API_KEY = GOOGLE_MAPS_API_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}&language=en`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        console.log('[LocationService] Forward geocoded:', address, '->', location);
        return {
          latitude: location.lat,
          longitude: location.lng,
        };
      }

      console.warn('[LocationService] Forward geocode returned no results for:', address);
      return null;
    } catch (error) {
      console.error('[LocationService] Error forward geocoding:', error);
      return null;
    }
  }

  /**
   * Show alert for location permission denied
   */
  showLocationPermissionDeniedAlert() {
    Alert.alert(
      'Location Permission Required',
      'Tiffsy needs your location to show nearby kitchens. Please enable location permission in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => {
          // You can add logic to open app settings here
          if (Platform.OS === 'android') {
            // PermissionsAndroid doesn't have openSettings
            // You might need to use a library like react-native-permissions for this
          }
        }},
      ]
    );
  }

  /**
   * Show alert for location error
   */
  showLocationErrorAlert(error: string) {
    Alert.alert(
      'Location Error',
      `Unable to get your location: ${error}. You can still enter your address manually.`,
      [{ text: 'OK' }]
    );
  }
}

export default new LocationService();
