// Map-based location picker (Zomato-style: pan map under a fixed center pin, reverse-geocode on settle).
// Returns the chosen location to AddressScreen via route param `pickedLocation`.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  FlatList,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import MapView, { Region, PROVIDER_GOOGLE } from 'react-native-maps';
import Svg, { Path } from 'react-native-svg';

import { MainTabParamList } from '../../types/navigation';
import locationService, { LocationResult } from '../../services/location.service';
import { GOOGLE_MAPS_API_KEY } from '../../constants/config';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'LocationPicker'>;

// Indore as fallback center (Tiffsy's primary delivery city)
const DEFAULT_REGION: Region = {
  latitude: 22.7196,
  longitude: 75.8577,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

const REVERSE_GEOCODE_DEBOUNCE_MS = 400;

interface PlacePrediction {
  description: string;
  place_id: string;
}

const LocationPickerScreen: React.FC<Props> = ({ navigation }) => {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [resolvedAddress, setResolvedAddress] = useState<LocationResult | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const reverseGeocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount, try to center on user's current GPS location
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const granted = await locationService.requestLocationPermission();
        if (!granted || cancelled) return;
        const coords = await locationService.getCurrentLocation();
        if (cancelled || !coords) return;
        const initial: Region = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };
        setRegion(initial);
        mapRef.current?.animateToRegion(initial, 600);
      } catch (err) {
        console.warn('[LocationPicker] Could not get current location:', err);
      }
    })();
    return () => {
      cancelled = true;
      if (reverseGeocodeTimer.current) clearTimeout(reverseGeocodeTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  // Reverse-geocode whenever the map settles on a new region
  const runReverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsResolving(true);
    try {
      const result = await locationService.reverseGeocode({ latitude: lat, longitude: lng });
      setResolvedAddress(result);
    } catch (err) {
      console.warn('[LocationPicker] Reverse-geocode failed:', err);
      setResolvedAddress({ coordinates: { latitude: lat, longitude: lng } });
    } finally {
      setIsResolving(false);
    }
  }, []);

  const onRegionChangeComplete = (next: Region) => {
    setRegion(next);
    if (reverseGeocodeTimer.current) clearTimeout(reverseGeocodeTimer.current);
    reverseGeocodeTimer.current = setTimeout(() => {
      runReverseGeocode(next.latitude, next.longitude);
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  };

  // Trigger an initial reverse-geocode when default region is shown
  useEffect(() => {
    runReverseGeocode(region.latitude, region.longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Places Autocomplete (HTTP, no extra package)
  const searchPlaces = async (query: string) => {
    if (query.trim().length < 3) {
      setPredictions([]);
      return;
    }
    setIsSearching(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        query,
      )}&key=${GOOGLE_MAPS_API_KEY}&components=country:in&language=en`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK' && Array.isArray(data.predictions)) {
        setPredictions(
          data.predictions.slice(0, 5).map((p: any) => ({
            description: p.description,
            place_id: p.place_id,
          })),
        );
      } else {
        setPredictions([]);
      }
    } catch (err) {
      console.warn('[LocationPicker] Places search failed:', err);
      setPredictions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchPlaces(text), 350);
  };

  // When user taps a search suggestion, resolve its place_id → coordinates → animate map
  const selectPrediction = async (pred: PlacePrediction) => {
    Keyboard.dismiss();
    setSearchQuery(pred.description);
    setPredictions([]);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pred.place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      const loc = data?.result?.geometry?.location;
      if (loc?.lat && loc?.lng) {
        const next: Region = {
          latitude: loc.lat,
          longitude: loc.lng,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };
        setRegion(next);
        mapRef.current?.animateToRegion(next, 600);
        runReverseGeocode(loc.lat, loc.lng);
      }
    } catch (err) {
      console.warn('[LocationPicker] Place details failed:', err);
    }
  };

  const handleConfirm = () => {
    const payload = {
      latitude: region.latitude,
      longitude: region.longitude,
      addressLine1: resolvedAddress?.address?.addressLine1,
      locality: resolvedAddress?.address?.locality,
      city: resolvedAddress?.address?.city,
      state: resolvedAddress?.address?.state,
      pincode: resolvedAddress?.pincode,
    };
    // Use merge:true so we don't blow away other Address route params if any
    navigation.navigate({
      name: 'Address',
      params: { pickedLocation: payload },
      merge: true,
    });
  };

  const formattedAddress = resolvedAddress
    ? [
        resolvedAddress.address?.addressLine1,
        resolvedAddress.address?.locality,
        resolvedAddress.address?.city,
        resolvedAddress.pincode,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar with close + search */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeIcon}>×</Text>
        </TouchableOpacity>

        <View style={styles.searchWrap}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
            <Path
              d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"
              stroke="#9CA3AF"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search a location..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {isSearching && <ActivityIndicator size="small" color="#FE8733" />}
        </View>
      </View>

      {/* Suggestions dropdown */}
      {predictions.length > 0 && (
        <View style={styles.predictionsCard}>
          <FlatList
            data={predictions}
            keyExtractor={item => item.place_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => selectPrediction(item)} style={styles.predictionRow}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: 10 }}>
                  <Path
                    d="M12 22s8-7.58 8-13a8 8 0 1 0-16 0c0 5.42 8 13 8 13z"
                    stroke="#FE8733"
                    strokeWidth={1.8}
                  />
                  <Path
                    d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                    stroke="#FE8733"
                    strokeWidth={1.8}
                  />
                </Svg>
                <Text style={styles.predictionText} numberOfLines={2}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Map (fills the rest of the screen above the bottom panel) */}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={DEFAULT_REGION}
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        />

        {/* Fixed center pin overlay (sits on top of MapView, doesn't move) */}
        <View pointerEvents="none" style={styles.centerPinWrap}>
          <View style={styles.pinShaft} />
          <Svg width={36} height={48} viewBox="0 0 24 32" fill="none">
            <Path
              d="M12 0a10 10 0 0 0-10 10c0 7.5 10 22 10 22s10-14.5 10-22A10 10 0 0 0 12 0z"
              fill="#FE8733"
            />
            <Path d="M12 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="white" />
          </Svg>
        </View>
      </View>

      {/* Bottom address card + Confirm CTA */}
      <View style={styles.bottomPanel}>
        <View style={styles.addressRow}>
          <View style={styles.addressIconWrap}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 22s8-7.58 8-13a8 8 0 1 0-16 0c0 5.42 8 13 8 13z"
                stroke="#FE8733"
                strokeWidth={2}
              />
              <Path
                d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                stroke="#FE8733"
                strokeWidth={2}
              />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addressLabel}>Selected location</Text>
            {isResolving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <ActivityIndicator size="small" color="#FE8733" />
                <Text style={[styles.addressText, { marginLeft: 8 }]}>Locating...</Text>
              </View>
            ) : (
              <Text style={styles.addressText} numberOfLines={2}>
                {formattedAddress || 'Move the map to set a location'}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={isResolving || !resolvedAddress}
          style={[
            styles.confirmButton,
            (isResolving || !resolvedAddress) && { opacity: 0.6 },
          ]}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'white',
    zIndex: 10,
  },
  closeButton: {
    width: TOUCH_TARGETS.minimum,
    height: TOUCH_TARGETS.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 28,
    color: '#374151',
    lineHeight: 28,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    height: TOUCH_TARGETS.minimum,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.base,
    color: '#111827',
    padding: 0,
  },
  predictionsCard: {
    position: 'absolute',
    top: 64,
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: 'white',
    borderRadius: 12,
    maxHeight: 280,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  predictionText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: '#111827',
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -18,
    marginTop: -48,
    alignItems: 'center',
  },
  pinShaft: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.25)',
    position: 'absolute',
    bottom: -2,
    left: 15,
  },
  bottomPanel: {
    backgroundColor: 'white',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addressIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  addressLabel: {
    fontSize: FONT_SIZES.xs,
    color: '#6B7280',
    fontWeight: '600',
  },
  addressText: {
    fontSize: FONT_SIZES.sm,
    color: '#111827',
    fontWeight: '600',
    marginTop: 2,
    lineHeight: FONT_SIZES.sm * 1.4,
  },
  confirmButton: {
    backgroundColor: '#FE8733',
    borderRadius: 28,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGETS.large,
  },
  confirmText: {
    color: 'white',
    fontSize: FONT_SIZES.base,
    fontWeight: '700',
  },
});

export default LocationPickerScreen;
