import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUser, DietaryPreferences } from '../../context/UserContext';
import { useAlert } from '../../context/AlertContext';
import NotificationPermissionModal from '../../components/NotificationPermissionModal';
import notificationService from '../../services/notification.service';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

// This screen is rendered directly in RootStackNavigator when user is authenticated but not onboarded
// Navigation is handled automatically by AppNavigator based on state changes

const FOOD_TYPES = [
  { id: 'VEG', label: 'Veg', icon: 'leaf' },
  { id: 'NON-VEG', label: 'Non-Veg', icon: 'food-drumstick' },
  { id: 'VEGAN', label: 'Vegan', icon: 'sprout' },
];

const DABBA_TYPES = [
  { id: 'DISPOSABLE', label: 'Disposable', icon: 'package-variant' },
  { id: 'STEEL DABBA', label: 'Steel Dabba', icon: 'bowl-mix' },
];

const SPICE_LEVELS = [
  { id: 'LOW', label: 'Low', icon: 'chili-mild', iconCount: 1 },
  { id: 'MEDIUM', label: 'Medium', icon: 'chili-medium', iconCount: 2 },
  { id: 'HIGH', label: 'High', icon: 'chili-hot', iconCount: 3 },
];

const UserOnboardingScreen: React.FC = () => {
  const { completeOnboarding, registerFcmToken, logout } = useUser();
  const { showAlert } = useAlert();
  const { isSmallDevice } = useResponsive();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [foodType, setFoodType] = useState<'VEG' | 'NON-VEG' | 'VEGAN'>('VEG');
  const [eggiterian, setEggiterian] = useState(false);
  const [jainFriendly, setJainFriendly] = useState(false);
  const [dabbaType, setDabbaType] = useState<'DISPOSABLE' | 'STEEL DABBA'>('DISPOSABLE');
  const [spiceLevel, setSpiceLevel] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Notification permission modal state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleContinue = async () => {
    let hasError = false;

    // Validate name
    if (name.trim().length < 2) {
      setNameError('Please enter a valid name (at least 2 characters)');
      hasError = true;
    } else {
      setNameError('');
    }

    // Validate email (optional but if provided, must be valid)
    if (email.trim() && !validateEmail(email.trim())) {
      setEmailError('Please enter a valid email address');
      hasError = true;
    } else {
      setEmailError('');
    }

    if (hasError) {
      return;
    }

    setIsLoading(true);
    try {
      // Prepare dietary preferences
      const dietaryPreferences: DietaryPreferences = {
        foodType,
        eggiterian,
        jainFriendly,
        dabbaType,
        spiceLevel,
      };

      // Call backend API through UserContext
      await completeOnboarding({
        name: name.trim(),
        email: email.trim() || undefined,
        dietaryPreferences,
      });

      // Profile saved successfully - now show notification permission modal
      setIsLoading(false);
      setShowNotificationModal(true);
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      showAlert(
        'Error',
        error.message || 'Failed to save profile. Please try again.',
        undefined,
        'error'
      );
      setIsLoading(false);
    }
  };

  const handleAllowNotifications = async () => {
    setIsRequestingPermission(true);
    try {
      // Request notification permission
      const granted = await notificationService.requestPermission();

      if (granted) {
        // Permission granted - register FCM token with backend
        await registerFcmToken();
      }

      // Close modal - navigation will happen automatically via AppNavigator
      // (needsAddressSetup was set to true by completeOnboarding)
      setShowNotificationModal(false);
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      // Close modal anyway - don't block the flow
      setShowNotificationModal(false);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleSkipNotifications = () => {
    // User chose to skip - close modal and proceed
    // Navigation will happen automatically via AppNavigator
    setShowNotificationModal(false);
  };

  const handleBackPress = async () => {
    try {
      // Log out the user - this will automatically redirect to login screen
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
      showAlert('Error', 'Failed to log out. Please try again.', undefined, 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View className="bg-orange-400 pb-8 pt-12 px-5 relative" style={{ borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}>
          {/* Back Button */}
          <TouchableOpacity
            onPress={handleBackPress}
            className="absolute top-12 left-5 z-10"
            style={{
              minWidth: TOUCH_TARGETS.minimum,
              minHeight: TOUCH_TARGETS.minimum,
              borderRadius: TOUCH_TARGETS.minimum / 2,
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons name="arrow-left" size={SPACING.iconSize} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Decorative elements */}
          <View className="absolute top-0 right-0">
            <View className="w-20 h-20 bg-orange-300 rounded-full opacity-50" style={{ top: 20, right: -10 }} />
          </View>
          <View className="absolute bottom-0 left-0">
            <View className="w-16 h-16 bg-orange-300 rounded-full opacity-50" style={{ bottom: 40, left: -8 }} />
          </View>

          <View className="items-center mt-4">
            <View className="flex-row items-center mb-2">
              <Text className="text-white font-bold text-center" style={{ fontSize: isSmallDevice ? FONT_SIZES.h2 : FONT_SIZES['2xl'] }}>
                Welcome!
              </Text>
              <MaterialCommunityIcons
                name="hand-wave"
                size={SPACING.iconXl}
                color="#FFFFFF"
                style={{ marginLeft: SPACING.sm }}
              />
            </View>
            <Text className="text-white text-center opacity-90" style={{ fontSize: FONT_SIZES.base }}>
              Let's personalize your experience
            </Text>
          </View>
        </View>

        {/* Form Section */}
        <View className="px-5 mt-6">
          {/* Name Input */}
          <View className="mb-5">
            <Text className="text-gray-700 font-semibold mb-2 text-base">
              Full Name <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="bg-gray-50 rounded-2xl px-4 py-4 text-base"
              style={{
                borderWidth: nameError ? 1.5 : 1,
                borderColor: nameError ? '#EF4444' : name.length > 0 ? '#10B981' : '#EAEAEA',
              }}
              placeholder="Enter your full name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError('');
              }}
              autoCapitalize="words"
            />
            {nameError ? (
              <Text className="text-red-500 text-xs mt-1 ml-1">{nameError}</Text>
            ) : null}
          </View>

          {/* Email Input */}
          <View className="mb-5">
            <Text className="text-gray-700 font-semibold mb-2 text-base">
              Email Address (Optional)
            </Text>
            <TextInput
              className="bg-gray-50 rounded-2xl px-4 py-4 text-base"
              style={{
                borderWidth: emailError ? 1.5 : 1,
                borderColor: emailError ? '#EF4444' : validateEmail(email) && email.length > 0 ? '#10B981' : '#EAEAEA',
              }}
              placeholder="your.email@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailError ? (
              <Text className="text-red-500 text-xs mt-1 ml-1">{emailError}</Text>
            ) : null}
          </View>

          {/* Food Type */}
          <View className="mb-5">
            <Text className="text-gray-700 font-semibold mb-2 text-base">
              Food Preference <Text className="text-red-500">*</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {FOOD_TYPES.map((type) => {
                const isSelected = foodType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => setFoodType(type.id as any)}
                    className="rounded-full flex-row items-center flex-1"
                    style={{
                      paddingHorizontal: SPACING.lg,
                      paddingVertical: SPACING.md,
                      minHeight: TOUCH_TARGETS.comfortable,
                      backgroundColor: isSelected ? '#ff8800' : '#F3F4F6',
                      borderWidth: 1,
                      borderColor: isSelected ? '#ff8800' : '#E5E7EB',
                      minWidth: 100,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={type.icon}
                      size={18}
                      color={isSelected ? '#FFFFFF' : '#374151'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      className="text-sm font-medium"
                      style={{ color: isSelected ? '#FFFFFF' : '#374151' }}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Additional Preferences */}
          <View className="mb-5">
            <Text className="text-gray-700 font-semibold mb-2 text-base">
              Additional Preferences
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <TouchableOpacity
                onPress={() => setEggiterian(!eggiterian)}
                className="rounded-full px-4 py-3 flex-row items-center"
                style={{
                  backgroundColor: eggiterian ? '#ff8800' : '#F3F4F6',
                  borderWidth: 1,
                  borderColor: eggiterian ? '#ff8800' : '#E5E7EB',
                }}
              >
                <MaterialCommunityIcons
                  name="egg"
                  size={18}
                  color={eggiterian ? '#FFFFFF' : '#374151'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  className="text-sm font-medium"
                  style={{ color: eggiterian ? '#FFFFFF' : '#374151' }}
                >
                  Eggetarian
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setJainFriendly(!jainFriendly)}
                className="rounded-full px-4 py-3 flex-row items-center"
                style={{
                  backgroundColor: jainFriendly ? '#ff8800' : '#F3F4F6',
                  borderWidth: 1,
                  borderColor: jainFriendly ? '#ff8800' : '#E5E7EB',
                }}
              >
                <MaterialCommunityIcons
                  name="hand-peace"
                  size={18}
                  color={jainFriendly ? '#FFFFFF' : '#374151'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  className="text-sm font-medium"
                  style={{ color: jainFriendly ? '#FFFFFF' : '#374151' }}
                >
                  Jain Friendly
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dabba Type */}
          <View className="mb-5">
            <Text className="text-gray-700 font-semibold mb-2 text-base">
              Container Type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DABBA_TYPES.map((type) => {
                const isSelected = dabbaType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => setDabbaType(type.id as any)}
                    className="rounded-full px-4 py-3 flex-row items-center flex-1"
                    style={{
                      backgroundColor: isSelected ? '#ff8800' : '#F3F4F6',
                      borderWidth: 1,
                      borderColor: isSelected ? '#ff8800' : '#E5E7EB',
                    }}
                  >
                    <MaterialCommunityIcons
                      name={type.icon}
                      size={18}
                      color={isSelected ? '#FFFFFF' : '#374151'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      className="text-sm font-medium"
                      style={{ color: isSelected ? '#FFFFFF' : '#374151' }}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Spice Level */}
          <View className="mb-6">
            <Text className="text-gray-700 font-semibold mb-2 text-base">
              Spice Level
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SPICE_LEVELS.map((level) => {
                const isSelected = spiceLevel === level.id;
                return (
                  <TouchableOpacity
                    key={level.id}
                    onPress={() => setSpiceLevel(level.id as any)}
                    className="rounded-full px-4 py-3 flex-row items-center flex-1"
                    style={{
                      backgroundColor: isSelected ? '#ff8800' : '#F3F4F6',
                      borderWidth: 1,
                      borderColor: isSelected ? '#ff8800' : '#E5E7EB',
                    }}
                  >
                    <MaterialCommunityIcons
                      name={level.icon}
                      size={18}
                      color={isSelected ? '#FFFFFF' : '#374151'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      className="text-sm font-medium"
                      style={{ color: isSelected ? '#FFFFFF' : '#374151' }}
                    >
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Benefits Section */}
          <View className="bg-orange-50 rounded-2xl p-4 mb-6">
            <View className="flex-row items-center mb-2">
              <Text className="text-orange-700 font-bold text-base">
                Why we ask?
              </Text>
              <MaterialCommunityIcons
                name="help-circle"
                size={18}
                color="#C2410C"
                style={{ marginLeft: 4 }}
              />
            </View>
            <View className="space-y-2">
              <View className="flex-row items-start">
                <Text className="text-orange-600 mr-2">•</Text>
                <Text className="text-gray-700 text-sm flex-1">
                  Get personalized meal recommendations based on your preferences
                </Text>
              </View>
              <View className="flex-row items-start">
                <Text className="text-orange-600 mr-2">•</Text>
                <Text className="text-gray-700 text-sm flex-1">
                  Filter menu items that match your dietary needs
                </Text>
              </View>
              <View className="flex-row items-start">
                <Text className="text-orange-600 mr-2">•</Text>
                <Text className="text-gray-700 text-sm flex-1">
                  Receive special offers tailored just for you
                </Text>
              </View>
            </View>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleContinue}
            disabled={isLoading}
            className="bg-orange-400 rounded-full items-center mb-8"
            style={{
              paddingVertical: SPACING.lg,
              minHeight: TOUCH_TARGETS.large,
              backgroundColor: isLoading ? '#CCCCCC' : '#ff8800',
              shadowColor: '#ff8800',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold" style={{ fontSize: FONT_SIZES.base }}>
                Continue to App →
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Notification Permission Modal */}
      <NotificationPermissionModal
        visible={showNotificationModal}
        onAllow={handleAllowNotifications}
        onSkip={handleSkipNotifications}
        isLoading={isRequestingPermission}
      />
    </KeyboardAvoidingView>
  );
};

export default UserOnboardingScreen;
