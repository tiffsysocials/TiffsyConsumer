import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAddress } from '../../context/AddressContext';
import { useUser } from '../../context/UserContext';
import { useAlert } from '../../context/AlertContext';
import locationService from '../../services/location.service';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

const ADDRESS_LABELS = ['Home', 'Office', 'Other'];

const AddressSetupScreen: React.FC = () => {
  const { checkServiceability, createAddressOnServer, getCurrentLocationWithAddress } = useAddress();
  const { setNeedsAddressSetup, user, logout } = useUser();
  const { showAlert } = useAlert();
  const { isSmallDevice } = useResponsive();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [formCoordinates, setFormCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [pincodeServiceable, setPincodeServiceable] = useState<boolean | null>(null);

  // Address form state
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    pincode: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    locality: '',
    city: '',
    state: '',
    contactName: user?.name || '',
    contactPhone: user?.phone?.replace('+91', '') || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-detect location on mount
  useEffect(() => {
    detectLocation(true);
  }, []);

  const detectLocation = async (isAutoDetect = false) => {
    setIsDetectingLocation(true);
    try {
      const location = await getCurrentLocationWithAddress();

      if (!location.pincode) {
        if (!isAutoDetect) {
          showAlert(
            'Location Error',
            'Unable to get pincode from your location. Please enter your address manually.',
            undefined,
            'error'
          );
        }
        setIsDetectingLocation(false);
        return;
      }

      // Store GPS coordinates
      setFormCoordinates(location.coordinates);

      // Auto-fill form with location data
      setAddressForm(prev => ({
        ...prev,
        addressLine1: location.address?.addressLine1 || '',
        locality: location.address?.locality || '',
        city: location.address?.city || '',
        state: location.address?.state || '',
        pincode: location.pincode || '',
      }));

      // Clear any existing errors for auto-filled fields
      setErrors({});

      // Auto-check pincode serviceability
      if (location.pincode && location.pincode.length === 6) {
        setIsCheckingPincode(true);
        const result = await checkServiceability(location.pincode);
        setPincodeServiceable(result.isServiceable);
        setIsCheckingPincode(false);
      }

      if (!isAutoDetect) {
        showAlert(
          'Location Detected',
          'We\'ve auto-filled your address details. Please review and add any missing information.',
          undefined,
          'success'
        );
      }
    } catch (error: any) {
      console.error('Location detection error:', error);
      if (!isAutoDetect) {
        showAlert(
          'Location Error',
          error.message || 'Unable to get your current location. Please ensure location services are enabled.',
          undefined,
          'error'
        );
      }
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handlePincodeChange = async (text: string) => {
    const pincode = text.replace(/[^0-9]/g, '');
    updateFormField('pincode', pincode);
    setPincodeServiceable(null);

    if (pincode.length === 6) {
      setIsCheckingPincode(true);
      const result = await checkServiceability(pincode);
      setPincodeServiceable(result.isServiceable);
      setIsCheckingPincode(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!addressForm.pincode.trim() || addressForm.pincode.length !== 6) {
      newErrors.pincode = 'Valid 6-digit pincode is required';
    }
    if (!addressForm.addressLine1.trim()) {
      newErrors.addressLine1 = 'Address is required';
    } else if (addressForm.addressLine1.trim().length < 6) {
      newErrors.addressLine1 = 'Address must be at least 6 characters long';
    }
    if (!addressForm.locality.trim()) {
      newErrors.locality = 'Locality is required';
    }
    if (!addressForm.city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!addressForm.state.trim()) {
      newErrors.state = 'State is required';
    }
    if (!addressForm.contactName.trim()) {
      newErrors.contactName = 'Contact name is required';
    }
    if (!addressForm.contactPhone.trim() || addressForm.contactPhone.length !== 10) {
      newErrors.contactPhone = 'Valid 10-digit phone number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitAddress = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // First check serviceability
      const serviceabilityResult = await checkServiceability(addressForm.pincode);

      if (!serviceabilityResult.isServiceable) {
        showAlert(
          'Not Serviceable',
          serviceabilityResult.message || `We don't deliver to pincode ${addressForm.pincode} yet. Please try a different address.`,
          undefined,
          'error'
        );
        setErrors(prev => ({ ...prev, pincode: 'This pincode is not serviceable' }));
        setIsSubmitting(false);
        return;
      }

      // Use GPS coordinates if available, otherwise forward geocode
      let coordinates = formCoordinates;
      if (!coordinates) {
        const fullAddress = `${addressForm.addressLine1}, ${addressForm.locality}, ${addressForm.city}, ${addressForm.state}, ${addressForm.pincode}`;
        coordinates = await locationService.forwardGeocode(fullAddress);
      }

      await createAddressOnServer({
        label: addressForm.label,
        pincode: addressForm.pincode,
        addressLine1: addressForm.addressLine1,
        addressLine2: addressForm.addressLine2,
        landmark: addressForm.landmark,
        locality: addressForm.locality,
        city: addressForm.city,
        state: addressForm.state,
        contactName: addressForm.contactName,
        contactPhone: '+91' + addressForm.contactPhone,
        isMain: true,
        coordinates: coordinates || undefined,
      });

      // Address created successfully, exit address setup flow
      setNeedsAddressSetup(false);
    } catch (error: any) {
      console.error('Error creating address:', error);
      showAlert(
        'Error',
        error.error || error.message || 'Failed to save address. Please try again.',
        undefined,
        'error'
      );
      setIsSubmitting(false);
    }
  };

  const updateFormField = (field: string, value: string) => {
    setAddressForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleBackPress = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
      showAlert('Error', 'Failed to log out. Please try again.', undefined, 'error');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header with Back Button */}
      <View style={{ paddingHorizontal: isSmallDevice ? SPACING.lg : SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.lg }}>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={handleBackPress}
            className="rounded-full bg-orange-400 items-center justify-center mr-4"
            style={{ minWidth: TOUCH_TARGETS.minimum, minHeight: TOUCH_TARGETS.minimum }}
          >
            <Image
              source={require('../../assets/icons/backarrow2.png')}
              style={{ width: SPACING.iconLg, height: SPACING.iconLg - 2 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="font-bold text-gray-900" style={{ fontSize: isSmallDevice ? FONT_SIZES.h3 : FONT_SIZES.h2 }}>
              Add Delivery Address
            </Text>
            <Text className="text-gray-500 mt-1" style={{ fontSize: FONT_SIZES.sm }}>
              We'll check if we deliver to your area
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-5 pb-6">
            {/* Use Current Location Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isDetectingLocation}
              onPress={() => detectLocation(false)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDetectingLocation ? '#FFF7ED' : '#FFFFFF',
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 20,
                marginBottom: 20,
                borderWidth: 1.5,
                borderColor: '#FE8733',
                borderStyle: 'dashed',
              }}
            >
              {isDetectingLocation ? (
                <>
                  <ActivityIndicator size="small" color="#FE8733" style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '600', color: '#FE8733' }}>
                    Detecting your location...
                  </Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#FE8733" style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '600', color: '#FE8733' }}>
                    Use Current Location
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Address Label */}
            <View className="mb-5">
              <Text className="text-gray-700 font-semibold mb-2" style={{ fontSize: FONT_SIZES.base }}>
                Save As
              </Text>
              <View className="flex-row gap-2">
                {ADDRESS_LABELS.map((label) => (
                  <TouchableOpacity
                    key={label}
                    onPress={() => updateFormField('label', label)}
                    className="rounded-full"
                    style={{
                      paddingHorizontal: SPACING.lg,
                      paddingVertical: SPACING.sm,
                      minHeight: TOUCH_TARGETS.minimum,
                      backgroundColor: addressForm.label === label ? '#FE8733' : '#F3F4F6',
                      borderWidth: 1,
                      borderColor: addressForm.label === label ? '#FE8733' : '#E5E7EB',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: addressForm.label === label ? '#FFFFFF' : '#374151',
                        fontSize: FONT_SIZES.base,
                      }}
                      className="font-medium"
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Pincode with serviceability check */}
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold mb-2" style={{ fontSize: FONT_SIZES.base }}>
                Pincode <Text className="text-red-500">*</Text>
              </Text>
              <View className="flex-row items-center">
                <TextInput
                  className="flex-1 bg-gray-50 rounded-xl"
                  style={{
                    paddingHorizontal: SPACING.lg,
                    paddingVertical: SPACING.md,
                    minHeight: TOUCH_TARGETS.comfortable,
                    fontSize: FONT_SIZES.base,
                    borderWidth: 1,
                    borderColor: errors.pincode ? '#EF4444' : pincodeServiceable === true ? '#10B981' : pincodeServiceable === false ? '#EF4444' : '#E5E7EB',
                  }}
                  placeholder="Enter 6-digit pincode"
                  placeholderTextColor="#9CA3AF"
                  value={addressForm.pincode}
                  onChangeText={handlePincodeChange}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {isCheckingPincode && (
                  <ActivityIndicator size="small" color="#FE8733" style={{ marginLeft: 12 }} />
                )}
                {pincodeServiceable === true && (
                  <Text className="ml-3 text-green-600 text-lg">✓</Text>
                )}
                {pincodeServiceable === false && (
                  <Text className="ml-3 text-red-500 text-lg">✗</Text>
                )}
              </View>
              {errors.pincode && (
                <Text className="text-red-500 mt-1" style={{ fontSize: FONT_SIZES.xs }}>{errors.pincode}</Text>
              )}
              {pincodeServiceable === false && !errors.pincode && (
                <Text className="text-red-500 mt-1" style={{ fontSize: FONT_SIZES.xs }}>
                  Sorry, we don't deliver to this pincode yet
                </Text>
              )}
              {pincodeServiceable === true && (
                <Text className="text-green-600 mt-1" style={{ fontSize: FONT_SIZES.xs }}>
                  Great! We deliver to this location
                </Text>
              )}
            </View>

            {/* Address Line 1 */}
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold mb-2" style={{ fontSize: FONT_SIZES.base }}>
                Flat / House / Building <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="bg-gray-50 rounded-xl"
                style={{
                  paddingHorizontal: SPACING.lg,
                  paddingVertical: SPACING.md,
                  minHeight: TOUCH_TARGETS.comfortable,
                  fontSize: FONT_SIZES.base,
                  borderWidth: 1,
                  borderColor: errors.addressLine1 ? '#EF4444' : '#E5E7EB',
                }}
                placeholder="e.g., Flat 201, Sunrise Apartments"
                placeholderTextColor="#9CA3AF"
                value={addressForm.addressLine1}
                onChangeText={(text) => updateFormField('addressLine1', text)}
              />
              {errors.addressLine1 && (
                <Text className="text-red-500 mt-1" style={{ fontSize: FONT_SIZES.xs }}>{errors.addressLine1}</Text>
              )}
            </View>

            {/* Address Line 2 */}
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold mb-2" style={{ fontSize: FONT_SIZES.base }}>
                Street / Area
              </Text>
              <TextInput
                className="bg-gray-50 rounded-xl"
                style={{
                  paddingHorizontal: SPACING.lg,
                  paddingVertical: SPACING.md,
                  minHeight: TOUCH_TARGETS.comfortable,
                  fontSize: FONT_SIZES.base,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                placeholder="e.g., Lane 5, MG Road"
                placeholderTextColor="#9CA3AF"
                value={addressForm.addressLine2}
                onChangeText={(text) => updateFormField('addressLine2', text)}
              />
            </View>

            {/* Landmark */}
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold mb-2" style={{ fontSize: FONT_SIZES.base }}>
                Landmark
              </Text>
              <TextInput
                className="bg-gray-50 rounded-xl"
                style={{
                  paddingHorizontal: SPACING.lg,
                  paddingVertical: SPACING.md,
                  minHeight: TOUCH_TARGETS.comfortable,
                  fontSize: FONT_SIZES.base,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                placeholder="e.g., Near Central Mall"
                placeholderTextColor="#9CA3AF"
                value={addressForm.landmark}
                onChangeText={(text) => updateFormField('landmark', text)}
              />
            </View>

            {/* Locality */}
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold mb-2" style={{ fontSize: FONT_SIZES.base }}>
                Locality <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="bg-gray-50 rounded-xl"
                style={{
                  paddingHorizontal: SPACING.lg,
                  paddingVertical: SPACING.md,
                  minHeight: TOUCH_TARGETS.comfortable,
                  fontSize: FONT_SIZES.base,
                  borderWidth: 1,
                  borderColor: errors.locality ? '#EF4444' : '#E5E7EB',
                }}
                placeholder="e.g., Koregaon Park"
                placeholderTextColor="#9CA3AF"
                value={addressForm.locality}
                onChangeText={(text) => updateFormField('locality', text)}
              />
              {errors.locality && (
                <Text className="text-red-500 mt-1" style={{ fontSize: FONT_SIZES.xs }}>{errors.locality}</Text>
              )}
            </View>

            {/* City and State */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-gray-700 font-semibold mb-2" style={{ fontSize: FONT_SIZES.base }}>
                  City <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className="bg-gray-50 rounded-xl"
                  style={{
                    paddingHorizontal: SPACING.lg,
                    paddingVertical: SPACING.md,
                    minHeight: TOUCH_TARGETS.comfortable,
                    fontSize: FONT_SIZES.base,
                    borderWidth: 1,
                    borderColor: errors.city ? '#EF4444' : '#E5E7EB',
                  }}
                  placeholder="City"
                  placeholderTextColor="#9CA3AF"
                  value={addressForm.city}
                  onChangeText={(text) => updateFormField('city', text)}
                />
                {errors.city && (
                  <Text className="text-red-500 mt-1" style={{ fontSize: FONT_SIZES.xs }}>{errors.city}</Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-gray-700 font-semibold mb-2" style={{ fontSize: FONT_SIZES.base }}>
                  State <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className="bg-gray-50 rounded-xl"
                  style={{
                    paddingHorizontal: SPACING.lg,
                    paddingVertical: SPACING.md,
                    minHeight: TOUCH_TARGETS.comfortable,
                    fontSize: FONT_SIZES.base,
                    borderWidth: 1,
                    borderColor: errors.state ? '#EF4444' : '#E5E7EB',
                  }}
                  placeholder="State"
                  placeholderTextColor="#9CA3AF"
                  value={addressForm.state}
                  onChangeText={(text) => updateFormField('state', text)}
                />
                {errors.state && (
                  <Text className="text-red-500 mt-1" style={{ fontSize: FONT_SIZES.xs }}>{errors.state}</Text>
                )}
              </View>
            </View>

            {/* Contact Name */}
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold mb-2" style={{ fontSize: FONT_SIZES.base }}>
                Contact Name <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="bg-gray-50 rounded-xl"
                style={{
                  paddingHorizontal: SPACING.lg,
                  paddingVertical: SPACING.md,
                  minHeight: TOUCH_TARGETS.comfortable,
                  fontSize: FONT_SIZES.base,
                  borderWidth: 1,
                  borderColor: errors.contactName ? '#EF4444' : '#E5E7EB',
                }}
                placeholder="Name for delivery"
                placeholderTextColor="#9CA3AF"
                value={addressForm.contactName}
                onChangeText={(text) => updateFormField('contactName', text)}
                autoCapitalize="words"
              />
              {errors.contactName && (
                <Text className="text-red-500 mt-1" style={{ fontSize: FONT_SIZES.xs }}>{errors.contactName}</Text>
              )}
            </View>

            {/* Contact Phone */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-2" style={{ fontSize: FONT_SIZES.base }}>
                Contact Phone <Text className="text-red-500">*</Text>
              </Text>
              <View className="flex-row items-center">
                <View
                  className="bg-gray-100 rounded-l-xl border border-r-0 border-gray-200"
                  style={{
                    paddingHorizontal: SPACING.md,
                    paddingVertical: SPACING.md,
                    minHeight: TOUCH_TARGETS.comfortable,
                    justifyContent: 'center',
                  }}
                >
                  <Text className="text-gray-600 font-medium" style={{ fontSize: FONT_SIZES.base }}>+91</Text>
                </View>
                <TextInput
                  className="flex-1 bg-gray-50 rounded-r-xl"
                  style={{
                    paddingHorizontal: SPACING.lg,
                    paddingVertical: SPACING.md,
                    minHeight: TOUCH_TARGETS.comfortable,
                    fontSize: FONT_SIZES.base,
                    borderWidth: 1,
                    borderLeftWidth: 0,
                    borderColor: errors.contactPhone ? '#EF4444' : '#E5E7EB',
                  }}
                  placeholder="10-digit phone number"
                  placeholderTextColor="#9CA3AF"
                  value={addressForm.contactPhone}
                  onChangeText={(text) => updateFormField('contactPhone', text.replace(/[^0-9]/g, ''))}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
              {errors.contactPhone && (
                <Text className="text-red-500 mt-1" style={{ fontSize: FONT_SIZES.xs }}>{errors.contactPhone}</Text>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmitAddress}
              disabled={isSubmitting}
              className="rounded-full items-center mb-4"
              style={{
                paddingVertical: SPACING.lg,
                minHeight: TOUCH_TARGETS.large,
                backgroundColor: isSubmitting ? '#CCCCCC' : '#FE8733',
                justifyContent: 'center',
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold" style={{ fontSize: FONT_SIZES.base }}>
                  Save Address & Continue
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddressSetupScreen;
