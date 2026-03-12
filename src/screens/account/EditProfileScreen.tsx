// src/screens/account/EditProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { MainTabParamList } from '../../types/navigation';
import { useUser } from '../../context/UserContext';
import apiService from '../../services/api.service';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Polyline } from 'react-native-svg';

type Props = StackScreenProps<MainTabParamList, 'EditProfile'>;

// Dietary preference options
const DIETARY_OPTIONS = [
  { id: 'VEG', label: 'Veg' },
  { id: 'NON_VEG', label: 'Non-Veg' },
  { id: 'VEGAN', label: 'Vegan' },
  { id: 'JAIN', label: 'Jain' },
  { id: 'EGGETARIAN', label: 'Eggetarian' },
];

const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, refreshUser } = useUser();
  const { isSmallDevice } = useResponsive();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  // Load user data on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      console.log('[EditProfile] Loading profile data');
      const response = await apiService.getProfile();
      console.log('[EditProfile] Profile loaded:', JSON.stringify(response, null, 2));

      // Handle response format
      const userData = response.data?.user || (response as any).error?.user;
      if (userData) {
        setName(userData.name || '');
        setEmail(userData.email || '');
        setPhone(userData.phone || '');
        setProfileImage(userData.profileImage || null);
        setDietaryPreferences(userData.dietaryPreferences || []);
      }
    } catch (error: any) {
      console.error('[EditProfile] Error loading profile:', error.message || error);
      // Fallback to context user data
      if (user) {
        setName(user.name || '');
        setEmail(user.email || '');
        setPhone(user.phone || '');
        setProfileImage(user.profileImage || null);
        setDietaryPreferences(user.dietaryPreferences || []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: { name?: string; email?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Name must be less than 100 characters';
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Invalid email format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Toggle dietary preference
  const toggleDietaryPreference = (prefId: string) => {
    setDietaryPreferences(prev =>
      prev.includes(prefId)
        ? prev.filter(p => p !== prefId)
        : [...prev, prefId]
    );
  };

  // Handle image picker
  const handleImagePicker = () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to add your profile picture',
      [
        {
          text: 'Camera',
          onPress: () => openCamera(),
        },
        {
          text: 'Gallery',
          onPress: () => openGallery(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const openCamera = async () => {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
      });

      if (result.assets && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error('[EditProfile] Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const openGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
      });

      if (result.assets && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error('[EditProfile] Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  const uploadImage = async (asset: any) => {
    if (!asset.uri) return;

    setIsUploadingImage(true);
    try {
      console.log('[EditProfile] Uploading image:', asset.fileName);

      const file = {
        uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `profile_${Date.now()}.jpg`,
      };

      const uploadResponse = await apiService.uploadFile(file, 'profiles');
      console.log('[EditProfile] Upload response:', JSON.stringify(uploadResponse, null, 2));

      const imageUrl = uploadResponse.data?.files?.[0]?.url;
      if (imageUrl) {
        // Update profile image in backend
        const updateResponse = await apiService.updateProfileImage(imageUrl);
        console.log('[EditProfile] Profile image updated:', JSON.stringify(updateResponse, null, 2));

        setProfileImage(imageUrl);
        Alert.alert('Success', 'Profile picture updated');
      } else {
        throw new Error('No image URL in response');
      }
    } catch (error: any) {
      console.error('[EditProfile] Upload error:', error.message || error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save profile
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      console.log('[EditProfile] Saving profile');

      // Build update data - only include changed fields
      const updateData: {
        name?: string;
        email?: string;
        dietaryPreferences?: string[];
      } = {};

      if (name.trim() !== (user?.name || '')) {
        updateData.name = name.trim();
      }

      if (email.trim() !== (user?.email || '')) {
        updateData.email = email.trim() || undefined;
      }

      const currentPrefs = user?.dietaryPreferences || [];
      if (JSON.stringify(dietaryPreferences.sort()) !== JSON.stringify(currentPrefs.sort())) {
        updateData.dietaryPreferences = dietaryPreferences;
      }

      // Only call API if there are changes
      if (Object.keys(updateData).length > 0) {
        console.log('[EditProfile] Update data:', JSON.stringify(updateData));
        const response = await apiService.updateCustomerProfile(updateData);
        console.log('[EditProfile] Update response:', JSON.stringify(response, null, 2));
      } else {
        console.log('[EditProfile] No changes to save');
      }

      // Refresh user context
      if (refreshUser) {
        await refreshUser();
      }

      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error('[EditProfile] Save error:', error.message || error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#FE8733" />
        <Text className="mt-4 text-gray-600" style={{ fontSize: FONT_SIZES.base }}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FD9E2F' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient
        colors={['#FD9E2F', '#FF6636']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="pb-6"
        style={{ position: 'relative', overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingTop: StatusBar.currentHeight ?? 0 }}
      >
        {/* Decorative Background Elements */}
        <Image
          source={require('../../assets/images/homepage/halfcircle.png')}
          style={{ position: 'absolute', top: -90, right: -125, width: 300, height: 380 }}
          resizeMode="contain"
        />
        <Image
          source={require('../../assets/images/homepage/halfline.png')}
          style={{ position: 'absolute', top: 30, right: -150, width: 380, height: 150 }}
          resizeMode="contain"
        />

        <View className="flex-row items-center pt-4" style={{ paddingHorizontal: isSmallDevice ? SPACING.lg : SPACING.xl }}>
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: TOUCH_TARGETS.minimum,
              height: TOUCH_TARGETS.minimum,
              borderRadius: TOUCH_TARGETS.minimum / 2,
              backgroundColor: 'white',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Polyline points="15,18 9,12 15,6" stroke="#FE8733" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Title */}
          <Text className="flex-1 text-white font-bold text-center mr-10" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>
            Edit Profile
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile Picture Section */}
        <View className="items-center mb-6" style={{ marginTop: SPACING['2xl'] }}>
          <TouchableOpacity
            onPress={handleImagePicker}
            disabled={isUploadingImage}
            className="relative"
          >
            {isUploadingImage ? (
              <View className="rounded-full bg-gray-200 items-center justify-center" style={{ width: isSmallDevice ? 96 : 112, height: isSmallDevice ? 96 : 112 }}>
                <ActivityIndicator size="large" color="#FE8733" />
              </View>
            ) : profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={{ width: isSmallDevice ? 96 : 112, height: isSmallDevice ? 96 : 112, borderRadius: isSmallDevice ? 48 : 56 }}
                resizeMode="cover"
              />
            ) : (
              <View className="rounded-full bg-gray-200 items-center justify-center" style={{ width: isSmallDevice ? 96 : 112, height: isSmallDevice ? 96 : 112 }}>
                <Image
                  source={require('../../assets/images/myaccount/user2.png')}
                  style={{ width: isSmallDevice ? 64 : 80, height: isSmallDevice ? 64 : 80, borderRadius: isSmallDevice ? 32 : 40 }}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Edit Icon Overlay */}
            <View
              className="absolute bottom-0 right-0 rounded-full items-center justify-center"
              style={{
                width: SPACING.iconLg + 4,
                height: SPACING.iconLg + 4,
                backgroundColor: '#FE8733',
                borderWidth: 3,
                borderColor: 'white',
              }}
            >
              <Image
                source={require('../../assets/icons/edit2.png')}
                style={{ width: SPACING.iconSm, height: SPACING.iconSm, tintColor: 'white' }}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>

          <Text className="text-gray-500 mt-2" style={{ fontSize: FONT_SIZES.sm }}>Tap to change photo</Text>
        </View>

        {/* Form Fields */}
        <View style={{ paddingHorizontal: isSmallDevice ? SPACING.lg : SPACING.xl }}>
          {/* Name Input */}
          <View className="mb-4">
            <Text className="font-semibold text-gray-700 mb-2" style={{ fontSize: FONT_SIZES.sm }}>Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#9CA3AF"
              className={`bg-gray-50 rounded-xl text-gray-900 ${
                errors.name ? 'border-2 border-red-500' : 'border border-gray-200'
              }`}
              style={{ paddingHorizontal: SPACING.md, minHeight: TOUCH_TARGETS.comfortable, fontSize: FONT_SIZES.base }}
            />
            {errors.name && (
              <Text className="text-red-500 mt-1" style={{ fontSize: FONT_SIZES.sm }}>{errors.name}</Text>
            )}
          </View>

          {/* Email Input */}
          <View className="mb-4">
            <Text className="font-semibold text-gray-700 mb-2" style={{ fontSize: FONT_SIZES.sm }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              className={`bg-gray-50 rounded-xl text-gray-900 ${
                errors.email ? 'border-2 border-red-500' : 'border border-gray-200'
              }`}
              style={{ paddingHorizontal: SPACING.md, minHeight: TOUCH_TARGETS.comfortable, fontSize: FONT_SIZES.base }}
            />
            {errors.email && (
              <Text className="text-red-500 mt-1" style={{ fontSize: FONT_SIZES.sm }}>{errors.email}</Text>
            )}
          </View>

          {/* Phone (Read-only) */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Phone Number</Text>
            <View className="bg-gray-100 rounded-xl px-4 py-3 flex-row items-center">
              <Image
                source={require('../../assets/icons/call2.png')}
                style={{ width: 20, height: 20, tintColor: '#6B7280', marginRight: 10 }}
                resizeMode="contain"
              />
              <Text className="text-gray-500">{phone || 'Not available'}</Text>
              <View className="ml-auto bg-gray-200 rounded-full px-2 py-1">
                <Text className="text-xs text-gray-500">Read-only</Text>
              </View>
            </View>
            <Text className="text-xs text-gray-400 mt-1">
              Phone number cannot be changed
            </Text>
          </View>

          {/* Dietary Preferences */}
          <View className="mb-6">
            <Text className="font-semibold text-gray-700 mb-3" style={{ fontSize: FONT_SIZES.sm }}>Dietary Preferences</Text>
            <View className="flex-row flex-wrap">
              {DIETARY_OPTIONS.map((option) => {
                const isSelected = dietaryPreferences.includes(option.id);
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => toggleDietaryPreference(option.id)}
                    className={`rounded-full mr-2 mb-2 ${
                      isSelected ? 'bg-orange-400' : 'bg-gray-100'
                    }`}
                    style={{
                      borderWidth: isSelected ? 0 : 1,
                      borderColor: '#E5E7EB',
                      paddingHorizontal: SPACING.md,
                      minHeight: TOUCH_TARGETS.minimum,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      className={`font-medium ${
                        isSelected ? 'text-white' : 'text-gray-700'
                      }`}
                      style={{ fontSize: FONT_SIZES.sm }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100" style={{ paddingHorizontal: isSmallDevice ? SPACING.lg : SPACING.xl, paddingVertical: SPACING.md }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className="bg-orange-400 rounded-full items-center justify-center"
          style={{
            opacity: isSaving ? 0.7 : 1,
            minHeight: TOUCH_TARGETS.large,
          }}
        >
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold" style={{ fontSize: FONT_SIZES.h4 }}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default EditProfileScreen;
