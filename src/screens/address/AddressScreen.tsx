// src/screens/address/AddressScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { MainTabParamList } from '../../types/navigation';
import { useAddress, Address } from '../../context/AddressContext';
import { useAlert } from '../../context/AlertContext';
import { useUser } from '../../context/UserContext';
import Svg, { Path } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import locationService from '../../services/location.service';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';
import ConfirmationModal from '../../components/ConfirmationModal';
import PickerSheet from '../../components/PickerSheet';
import { INDIAN_STATES } from '../../constants/indianStates';
import { INDIAN_CITIES, findStateForCity, CityEntry } from '../../constants/indianCities';

type Props = StackScreenProps<MainTabParamList, 'Address'>;

const ADDRESS_LABELS = [
  { id: 'HOME', label: 'Home', icon: 'home' },
  { id: 'OFFICE', label: 'Office', icon: 'office-building' },
  { id: 'OTHER', label: 'Other', icon: 'map-marker' },
];

interface AddressFormData {
  label: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
}

const emptyFormData: AddressFormData = {
  label: 'HOME',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  locality: '',
  city: '',
  state: '',
  pincode: '',
  contactName: '',
  contactPhone: '',
};

const AddressScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    addresses,
    isLoadingAddresses,
    fetchAddresses,
    createAddressOnServer,
    updateAddressOnServer,
    deleteAddressOnServer,
    setDefaultAddressOnServer,
    checkServiceability,
    getCurrentLocationWithAddress,
    currentLocation,
    isGettingLocation,
  } = useAddress();
  const { showAlert } = useAlert();
  const { user, isGuest, exitGuestMode } = useUser();
  const { isSmallDevice } = useResponsive();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGuestLoginPrompt, setShowGuestLoginPrompt] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);

  // Debug: Log modal state changes
  useEffect(() => {
    console.log('=== showAddModal state changed to:', showAddModal, '===');
  }, [showAddModal]);

  useEffect(() => {
    console.log('=== showEditModal state changed to:', showEditModal, '===');
  }, [showEditModal]);

  // When the user comes back from the map picker, pre-fill the Add Address form
  // with the picked coordinates + reverse-geocoded address fields.
  useEffect(() => {
    const picked = route.params?.pickedLocation;
    if (!picked) return;
    setFormData(prev => ({
      ...prev,
      label: prev.label || 'HOME',
      addressLine1: picked.addressLine1 || prev.addressLine1 || '',
      locality: picked.locality || prev.locality || '',
      city: picked.city || prev.city || '',
      state: picked.state || prev.state || '',
      pincode: picked.pincode || prev.pincode || '',
      contactName: prev.contactName || user?.name || '',
      contactPhone: prev.contactPhone || user?.phone || '',
    }));
    setFormCoordinates({ latitude: picked.latitude, longitude: picked.longitude });
    setShowAddModal(true);
    // Clear the param so it doesn't re-fire on re-render
    navigation.setParams({ pickedLocation: undefined });
  }, [route.params?.pickedLocation, navigation, user]);

  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<AddressFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formCoordinates, setFormCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [pincodeServiceable, setPincodeServiceable] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch addresses on mount
  useEffect(() => {
    fetchAddresses();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAddresses();
    setRefreshing(false);
  };

  // Filter addresses based on search query
  const filteredAddresses = addresses.filter(address => {
    const searchLower = searchQuery.toLowerCase();
    return (
      address.label?.toLowerCase().includes(searchLower) ||
      address.contactName?.toLowerCase().includes(searchLower) ||
      address.addressLine1?.toLowerCase().includes(searchLower) ||
      address.locality?.toLowerCase().includes(searchLower) ||
      address.city?.toLowerCase().includes(searchLower)
    );
  });

  // Check serviceability when pincode changes
  const handlePincodeChange = async (pincode: string) => {
    setFormData({ ...formData, pincode });
    setPincodeServiceable(null);

    if (pincode.length === 6) {
      setIsCheckingPincode(true);
      const result = await checkServiceability(pincode);
      setPincodeServiceable(result.isServiceable);
      setIsCheckingPincode(false);
    }
  };

  const resetForm = () => {
    // Seed contact name & phone from the user's profile so they don't have to retype every time.
    // Fields stay editable — onChangeText overrides these defaults.
    setFormData({
      ...emptyFormData,
      contactName: user?.name || '',
      contactPhone: user?.phone || '',
    });
    setFormCoordinates(null);
    setPincodeServiceable(null);
  };

  const handleAddAddress = async () => {
    // Validation - check all required fields
    if (!formData.addressLine1 || !formData.locality || !formData.city ||
        !formData.state || !formData.pincode || !formData.contactName || !formData.contactPhone) {
      showAlert('Error', 'Please fill all required fields', undefined, 'error');
      return;
    }

    // addressLine1 must be at least 5 characters
    if (formData.addressLine1.trim().length < 5) {
      showAlert('Error', 'Address line 1 must be at least 5 characters long', undefined, 'error');
      return;
    }

    // locality must be at least 2 characters
    if (formData.locality.trim().length < 2) {
      showAlert('Error', 'Locality must be at least 2 characters long', undefined, 'error');
      return;
    }

    // city must be at least 2 characters
    if (formData.city.trim().length < 2) {
      showAlert('Error', 'City must be at least 2 characters long', undefined, 'error');
      return;
    }

    // state must be at least 2 characters
    if (formData.state.trim().length < 2) {
      showAlert('Error', 'State must be at least 2 characters long', undefined, 'error');
      return;
    }

    // contactName must be at least 2 characters
    if (formData.contactName.trim().length < 2) {
      showAlert('Error', 'Contact name must be at least 2 characters long', undefined, 'error');
      return;
    }

    // contactPhone must be 10 digits starting with 6-9
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.contactPhone)) {
      showAlert('Error', 'Phone number must be 10 digits starting with 6, 7, 8, or 9', undefined, 'error');
      return;
    }

    if (formData.pincode.length !== 6) {
      showAlert('Error', 'Please enter a valid 6-digit pincode', undefined, 'error');
      return;
    }

    if (pincodeServiceable === false) {
      showAlert('Error', 'This pincode is not serviceable. Please enter a different pincode.', undefined, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get coordinates: use GPS coordinates if available, otherwise forward geocode the address
      let coordinates = formCoordinates;
      if (!coordinates) {
        const fullAddress = `${formData.addressLine1}, ${formData.locality}, ${formData.city}, ${formData.state}, ${formData.pincode}`;
        coordinates = await locationService.forwardGeocode(fullAddress);
      }

      await createAddressOnServer({
        label: formData.label,
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2 || undefined,
        landmark: formData.landmark || undefined,
        locality: formData.locality,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        isMain: addresses.length === 0, // First address is default
        coordinates: coordinates || undefined,
      });
      setShowAddModal(false);
      resetForm();
      showAlert('Success', 'Address added successfully', undefined, 'success');
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to add address', undefined, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      label: address.label || 'HOME',
      addressLine1: address.addressLine1 || '',
      addressLine2: address.addressLine2 || '',
      landmark: address.landmark || '',
      locality: address.locality || '',
      city: address.city || '',
      state: address.state || '',
      pincode: address.pincode || '',
      contactName: address.contactName || '',
      contactPhone: address.contactPhone || '',
    });
    setFormCoordinates(address.coordinates || null);
    setPincodeServiceable(address.isServiceable ?? null);
    setShowEditModal(true);
  };

  const handleUpdateAddress = async () => {
    if (!editingAddress) return;

    // Validation - check all required fields
    if (!formData.addressLine1 || !formData.locality || !formData.city ||
        !formData.state || !formData.pincode || !formData.contactName || !formData.contactPhone) {
      showAlert('Error', 'Please fill all required fields', undefined, 'error');
      return;
    }

    // addressLine1 must be at least 5 characters
    if (formData.addressLine1.trim().length < 5) {
      showAlert('Error', 'Address line 1 must be at least 5 characters long', undefined, 'error');
      return;
    }

    // locality must be at least 2 characters
    if (formData.locality.trim().length < 2) {
      showAlert('Error', 'Locality must be at least 2 characters long', undefined, 'error');
      return;
    }

    // city must be at least 2 characters
    if (formData.city.trim().length < 2) {
      showAlert('Error', 'City must be at least 2 characters long', undefined, 'error');
      return;
    }

    // state must be at least 2 characters
    if (formData.state.trim().length < 2) {
      showAlert('Error', 'State must be at least 2 characters long', undefined, 'error');
      return;
    }

    // contactName must be at least 2 characters
    if (formData.contactName.trim().length < 2) {
      showAlert('Error', 'Contact name must be at least 2 characters long', undefined, 'error');
      return;
    }

    // contactPhone must be 10 digits starting with 6-9
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.contactPhone)) {
      showAlert('Error', 'Phone number must be 10 digits starting with 6, 7, 8, or 9', undefined, 'error');
      return;
    }

    if (formData.pincode.length !== 6) {
      showAlert('Error', 'Please enter a valid 6-digit pincode', undefined, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get coordinates: use existing if available, otherwise forward geocode
      let coordinates = formCoordinates;
      if (!coordinates) {
        const fullAddress = `${formData.addressLine1}, ${formData.locality}, ${formData.city}, ${formData.state}, ${formData.pincode}`;
        coordinates = await locationService.forwardGeocode(fullAddress);
      }

      await updateAddressOnServer(editingAddress.id, {
        label: formData.label,
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2 || undefined,
        landmark: formData.landmark || undefined,
        locality: formData.locality,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        coordinates: coordinates || undefined,
      });
      setShowEditModal(false);
      setEditingAddress(null);
      resetForm();
      showAlert('Success', 'Address updated successfully', undefined, 'success');
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to update address', undefined, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAddress = (address: Address) => {
    showAlert(
      'Delete Address',
      `Are you sure you want to delete "${address.label}" address?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAddressOnServer(address.id);
              showAlert('Success', 'Address deleted successfully', undefined, 'success');
            } catch (error: any) {
              showAlert('Error', error.message || 'Failed to delete address', undefined, 'error');
            }
          },
        },
      ],
      'warning'
    );
  };

  const handleSetDefault = async (address: Address) => {
    console.log('[AddressScreen] handleSetDefault called for address:', address.id, address.label);
    if (address.isMain) {
      console.log('[AddressScreen] Address is already main, skipping');
      return;
    }

    try {
      console.log('[AddressScreen] Calling setDefaultAddressOnServer...');
      await setDefaultAddressOnServer(address.id);
      console.log('[AddressScreen] setDefaultAddressOnServer completed successfully');
      showAlert('Success', 'Default address updated. Go back to Home to see updated menu.', undefined, 'success');
    } catch (error: any) {
      console.error('[AddressScreen] Error in handleSetDefault:', error);
      showAlert('Error', error.message || 'Failed to set default address', undefined, 'error');
    }
  };

  const renderAddressForm = (isEdit: boolean) => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Use Current Location — opens the map picker centered on user's GPS. Only shown for new addresses. */}
      {!isEdit && (
        <TouchableOpacity
          onPress={() => navigation.navigate('LocationPicker')}
          activeOpacity={0.85}
          style={{
            marginBottom: 20,
            backgroundColor: '#FFF7ED',
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: '#FE8733',
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#FE8733',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                stroke="white"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#9A3412' }}>
              Use Current Location
            </Text>
            <Text style={{ fontSize: 12, color: '#9A3412', marginTop: 2 }}>
              Pinpoint on map to autofill your address
            </Text>
          </View>
          <Text style={{ fontSize: 20, color: '#FE8733', fontWeight: '700' }}>›</Text>
        </TouchableOpacity>
      )}

      {/* Label Selection */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Address Type *</Text>
        <View className="flex-row">
          {ADDRESS_LABELS.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setFormData({ ...formData, label: item.id })}
              className="flex-1 mr-2 rounded-xl py-3 items-center"
              style={{
                backgroundColor: formData.label === item.id ? '#FE8733' : '#F3F4F6',
                borderWidth: 1,
                borderColor: formData.label === item.id ? '#FE8733' : '#E5E7EB',
              }}
            >
              <MaterialCommunityIcons name={item.icon} size={22} color={formData.label === item.id ? '#FFFFFF' : '#6B7280'} style={{ marginBottom: 4 }} />
              <Text
                className="text-xs font-medium"
                style={{ color: formData.label === item.id ? '#FFFFFF' : '#374151' }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Contact Name */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Contact Name *</Text>
        <TextInput
          value={formData.contactName}
          onChangeText={(text) => setFormData({ ...formData, contactName: text })}
          placeholder="Enter recipient name"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900 border border-gray-200"
        />
      </View>

      {/* Contact Phone */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Contact Phone *</Text>
        <TextInput
          value={formData.contactPhone}
          onChangeText={(text) => setFormData({ ...formData, contactPhone: text })}
          placeholder="10-digit mobile number"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
          maxLength={10}
          className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900 border border-gray-200"
        />
      </View>

      {/* Address Line 1 */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Flat / House / Building *</Text>
        <TextInput
          value={formData.addressLine1}
          onChangeText={(text) => setFormData({ ...formData, addressLine1: text })}
          placeholder="e.g., Flat 401, Tower B, Green Heights"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900 border border-gray-200"
        />
      </View>

      {/* Address Line 2 */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Street / Road (Optional)</Text>
        <TextInput
          value={formData.addressLine2}
          onChangeText={(text) => setFormData({ ...formData, addressLine2: text })}
          placeholder="e.g., MG Road"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900 border border-gray-200"
        />
      </View>

      {/* Landmark */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Landmark (Optional)</Text>
        <TextInput
          value={formData.landmark}
          onChangeText={(text) => setFormData({ ...formData, landmark: text })}
          placeholder="e.g., Near City Mall"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900 border border-gray-200"
        />
      </View>

      {/* Locality */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Locality / Area *</Text>
        <TextInput
          value={formData.locality}
          onChangeText={(text) => setFormData({ ...formData, locality: text })}
          placeholder="e.g., Indiranagar"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900 border border-gray-200"
        />
      </View>

      {/* Pincode with serviceability check */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Pincode *</Text>
        <View className="flex-row items-center">
          <TextInput
            value={formData.pincode}
            onChangeText={handlePincodeChange}
            placeholder="6-digit pincode"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            maxLength={6}
            className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 text-gray-900 border border-gray-200"
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
        {pincodeServiceable === false && (
          <Text className="text-red-500 text-xs mt-1">
            Sorry, we don't deliver to this pincode yet
          </Text>
        )}
        {pincodeServiceable === true && (
          <Text className="text-green-600 text-xs mt-1">
            Great! We deliver to this location
          </Text>
        )}
      </View>

      {/* City and State — picker triggers (curated dropdown via PickerSheet) */}
      <View className="flex-row mb-4">
        <View className="flex-1 mr-2">
          <Text className="text-sm font-semibold text-gray-700 mb-2">City *</Text>
          <TouchableOpacity
            onPress={() => setShowCityPicker(true)}
            activeOpacity={0.7}
            className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200 flex-row items-center justify-between"
            style={{ minHeight: 48 }}
          >
            <Text style={{ color: formData.city ? '#111827' : '#9CA3AF', fontSize: 14 }}>
              {formData.city || 'Select city'}
            </Text>
            <Text style={{ color: '#9CA3AF', fontSize: 16 }}>▾</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 ml-2">
          <Text className="text-sm font-semibold text-gray-700 mb-2">State *</Text>
          <TouchableOpacity
            onPress={() => setShowStatePicker(true)}
            activeOpacity={0.7}
            className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200 flex-row items-center justify-between"
            style={{ minHeight: 48 }}
          >
            <Text style={{ color: formData.state ? '#111827' : '#9CA3AF', fontSize: 14 }}>
              {formData.state || 'Select state'}
            </Text>
            <Text style={{ color: '#9CA3AF', fontSize: 16 }}>▾</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        onPress={isEdit ? handleUpdateAddress : handleAddAddress}
        disabled={isSubmitting}
        className="rounded-full items-center justify-center mt-2 mb-4"
        style={{ backgroundColor: isSubmitting ? '#CCCCCC' : '#FE8733', minHeight: TOUCH_TARGETS.large }}
      >
        {isSubmitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold" style={{ fontSize: FONT_SIZES.base }}>
            {isEdit ? 'Update Address' : 'Save Address'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FE8733']} />
        }
      >
        {/* Header */}
        <View style={{ paddingHorizontal: isSmallDevice ? SPACING.lg : SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING['2xl'] }}>
          <View className="flex-row items-center mb-2">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FE8733', alignItems: 'center', justifyContent: 'center' }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M15 18l-6-6 6-6" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            <View className="flex-1 ml-3">
              <Text className="font-bold text-gray-900" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>My Addresses</Text>
              <Text className="text-gray-500 mt-1" style={{ fontSize: FONT_SIZES.sm }}>
                {isLoadingAddresses
                  ? 'Loading...'
                  : searchQuery
                  ? `${filteredAddresses.length} of ${addresses.length} Addresses`
                  : `${addresses.length} Addresses Saved`}
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View className="mx-5 mb-5">
          <View
            className="flex-row items-center rounded-full px-5"
            style={{
              paddingVertical: 3,
              borderWidth: 1,
              borderColor: 'rgba(217, 217, 217, 1)',
              backgroundColor: 'rgba(255, 255, 255, 1)',
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"
                stroke="#FE8733"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <TextInput
              placeholder="Search for an address"
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-gray-700 ml-3"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text className="text-gray-400 text-lg ml-2">x</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Single primary action — Add New Address. Inside the form, user can tap "Use Current Location" to open the map picker. */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (isGuest) {
              setShowGuestLoginPrompt(true);
              return;
            }
            console.log('[AddressScreen] Add New Address pressed');
            resetForm();
            setShowAddModal(true);
          }}
          style={{
            marginHorizontal: 20,
            marginBottom: 24,
            backgroundColor: '#FE8733',
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#FE8733',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" style={{ marginRight: 10 }}>
            <Path
              d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
            Add New Address
          </Text>
        </TouchableOpacity>

        {/* Loading State */}
        {isLoadingAddresses && addresses.length === 0 && (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#FE8733" />
            <Text className="text-gray-500 mt-4">Loading addresses...</Text>
          </View>
        )}

        {/* Addresses List */}
        <View className="mx-5 mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">Delivery Addresses</Text>

          {!isLoadingAddresses && filteredAddresses.length === 0 ? (
            <View className="items-center justify-center py-12">
              <MaterialCommunityIcons name="map-marker-outline" size={56} color="#D1D5DB" style={{ marginBottom: 16 }} />
              <Text className="text-lg font-semibold text-gray-900 mb-2">No Address Found</Text>
              <Text className="text-sm text-gray-500 text-center">
                {searchQuery ? 'No addresses match your search' : 'Add your first delivery address'}
              </Text>
            </View>
          ) : (
            filteredAddresses.map((address) => (
              <TouchableOpacity
                key={address.id}
                activeOpacity={0.7}
                onPress={() => handleSetDefault(address)}
                className="mb-4 bg-white rounded-2xl p-5"
                style={{
                  borderWidth: 1,
                  borderColor: address.isMain ? 'rgba(255, 136, 0, 1)' : 'rgba(228, 228, 228, 1)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                {/* Header: Label, Main Badge, Edit */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Text className="text-lg font-bold text-gray-900">{address.label}</Text>
                    {address.isMain && (
                      <View className="ml-3 bg-green-100 px-3 py-1 rounded-full">
                        <Text className="text-xs font-semibold text-green-700">Default</Text>
                      </View>
                    )}
                    {address.isServiceable === false && (
                      <View className="ml-2 bg-red-100 px-2 py-1 rounded-full">
                        <Text className="text-xs font-semibold text-red-600">Not Serviceable</Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center">
                    <TouchableOpacity
                      className="flex-row items-center mr-4"
                      onPress={() => handleDeleteAddress(address)}
                    >
                      <Text style={{ color: 'rgba(250, 84, 84, 1)', fontWeight: '600', marginRight: 4 }}>
                        Delete
                      </Text>
                      <Image
                        source={require('../../assets/icons/delete.png')}
                        style={{ width: 16, height: 16, tintColor: 'rgba(250, 84, 84, 1)' }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-row items-center"
                      onPress={() => handleEditAddress(address)}
                    >
                      <Text className="text-green-600 font-semibold mr-1">Edit</Text>
                      <Image
                        source={require('../../assets/icons/edit2.png')}
                        style={{ width: 16, height: 16, tintColor: '#16a34a' }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Horizontal Divider Line */}
                <View
                  style={{
                    width: '113%',
                    height: 1,
                    backgroundColor: 'rgba(228, 228, 228, 1)',
                    marginBottom: 12,
                    marginLeft: -20,
                    marginRight: -30,
                  }}
                />

                {/* Contact Name and Phone Number */}
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-bold text-gray-900">{address.contactName}</Text>
                  <View className="flex-row items-center">
                    <Image
                      source={require('../../assets/icons/call2.png')}
                      style={{ width: 16, height: 16, tintColor: '#FDB766', marginRight: 8 }}
                      resizeMode="contain"
                    />
                    <Text className="text-sm text-gray-700">{address.contactPhone}</Text>
                  </View>
                </View>

                {/* Full Address */}
                <Text className="text-sm text-gray-600 mb-2">
                  {address.addressLine1}
                  {address.addressLine2 ? `, ${address.addressLine2}` : ''}
                  {address.landmark ? ` (${address.landmark})` : ''}
                </Text>
                <Text className="text-sm text-gray-600 mb-3">
                  {address.locality}, {address.city}, {address.state} - {address.pincode}
                </Text>

                {/* Set as Default Button */}
                {!address.isMain && (
                  <TouchableOpacity
                    onPress={() => handleSetDefault(address)}
                    className="mt-2 py-2 px-4 rounded-full border self-start"
                    style={{ borderColor: '#FE8733' }}
                  >
                    <Text className="text-sm font-medium" style={{ color: '#FE8733' }}>
                      Set as Default
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Address Overlay - Using absolute positioning instead of Modal for Fabric compatibility */}
      {showAddModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          elevation: 1000,
        }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Backdrop */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setShowAddModal(false)}
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            >
              {/* Content - stop propagation */}
              <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                <View style={{
                  backgroundColor: 'white',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingHorizontal: 24,
                  paddingVertical: 24,
                  maxHeight: '90%',
                }}>
                  {/* Modal Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>Add New Address</Text>
                    <TouchableOpacity onPress={() => setShowAddModal(false)}>
                      <Text style={{ color: '#6B7280', fontSize: 30 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                  {renderAddressForm(false)}
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Edit Address Overlay - Using absolute positioning instead of Modal for Fabric compatibility */}
      {showEditModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          elevation: 1000,
        }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Backdrop */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {
                setShowEditModal(false);
                setEditingAddress(null);
                resetForm();
              }}
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            >
              {/* Content - stop propagation */}
              <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                <View style={{
                  backgroundColor: 'white',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingHorizontal: 24,
                  paddingVertical: 24,
                  maxHeight: '90%',
                }}>
                  {/* Modal Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>Edit Address</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowEditModal(false);
                        setEditingAddress(null);
                        resetForm();
                      }}
                    >
                      <Text style={{ color: '#6B7280', fontSize: 30 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                  {renderAddressForm(true)}
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Login prompt for guest users trying to add an address */}
      <ConfirmationModal
        visible={showGuestLoginPrompt}
        title="Login Required"
        message="Please login to save delivery addresses and use your current location for orders."
        confirmText="Login"
        cancelText="Not Now"
        confirmStyle="primary"
        onConfirm={() => {
          setShowGuestLoginPrompt(false);
          exitGuestMode();
        }}
        onCancel={() => setShowGuestLoginPrompt(false)}
      />

      {/* City picker — selecting a city auto-fills its mapped state if known */}
      <PickerSheet<CityEntry>
        visible={showCityPicker}
        title="Select City"
        searchPlaceholder="Search city..."
        options={INDIAN_CITIES}
        selectedValue={formData.city}
        getLabel={item => item.city}
        getSubtitle={item => item.state}
        getValue={item => item.city}
        onSelect={item => {
          setFormData(prev => ({
            ...prev,
            city: item.city,
            // Auto-fill state if it isn't already set or if it doesn't match the city's mapped state
            state: prev.state && prev.state === item.state ? prev.state : item.state,
          }));
          setShowCityPicker(false);
        }}
        onClose={() => setShowCityPicker(false)}
      />

      {/* State picker */}
      <PickerSheet<string>
        visible={showStatePicker}
        title="Select State"
        searchPlaceholder="Search state..."
        options={INDIAN_STATES}
        selectedValue={formData.state}
        getLabel={item => item}
        getValue={item => item}
        onSelect={item => {
          setFormData(prev => ({ ...prev, state: item }));
          setShowStatePicker(false);
        }}
        onClose={() => setShowStatePicker(false)}
      />
    </SafeAreaView>
  );
};

export default AddressScreen;
