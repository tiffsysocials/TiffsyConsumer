import React, { useState, useRef, useEffect } from 'react';
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
import { useUser } from '../../context/UserContext';
import { useAlert } from '../../context/AlertContext';
import apiService from '../../services/api.service';
import NotificationPermissionModal from '../../components/NotificationPermissionModal';
import notificationService from '../../services/notification.service';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

// This screen is rendered directly in RootStackNavigator when user is authenticated but not onboarded
// Navigation is handled automatically by AppNavigator based on state changes

const UserOnboardingScreen: React.FC = () => {
  const { completeOnboarding, registerFcmToken, logout } = useUser();
  const { showAlert } = useAlert();
  const { isSmallDevice } = useResponsive();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Referral code state
  const [referralCode, setReferralCode] = useState('');
  const [referralStatus, setReferralStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [referralName, setReferralName] = useState('');
  const referralDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (referralDebounceRef.current) clearTimeout(referralDebounceRef.current);
    };
  }, []);

  // Notification permission modal state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleReferralCodeChange = (text: string) => {
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setReferralCode(cleaned);
    if (referralDebounceRef.current) clearTimeout(referralDebounceRef.current);
    if (!cleaned) {
      setReferralStatus('idle');
      setReferralName('');
      return;
    }
    if (cleaned.length >= 6) {
      setReferralStatus('checking');
      referralDebounceRef.current = setTimeout(async () => {
        try {
          const res = await apiService.validateReferralCode(cleaned);
          if (res.success && res.data?.valid) {
            setReferralStatus('valid');
            setReferralName(res.data.referrerName || '');
          } else {
            setReferralStatus('invalid');
            setReferralName('');
          }
        } catch {
          setReferralStatus('invalid');
          setReferralName('');
        }
      }, 600);
    } else {
      setReferralStatus('idle');
      setReferralName('');
    }
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
      // Call backend API through UserContext
      await completeOnboarding({
        name: name.trim(),
        email: email.trim() || undefined,
        referralCode: referralStatus === 'valid' ? referralCode.trim() : undefined,
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

          {/* Referral Code Input */}
          <View className="mb-5">
            <Text className="text-gray-700 font-semibold mb-2 text-base">
              Referral Code (Optional)
            </Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                className="bg-gray-50 rounded-2xl px-4 py-4 text-base"
                style={{
                  borderWidth: referralStatus === 'valid' ? 1.5 : referralStatus === 'invalid' ? 1.5 : 1,
                  borderColor: referralStatus === 'valid' ? '#10B981' : referralStatus === 'invalid' ? '#EF4444' : '#EAEAEA',
                  paddingRight: 44,
                }}
                placeholder="Enter referral code"
                placeholderTextColor="#9CA3AF"
                value={referralCode}
                onChangeText={handleReferralCodeChange}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
              />
              {referralStatus === 'checking' && (
                <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color="#FE8733" />
                </View>
              )}
              {referralStatus === 'valid' && (
                <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="check-circle" size={22} color="#10B981" />
                </View>
              )}
              {referralStatus === 'invalid' && (
                <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="close-circle" size={22} color="#EF4444" />
                </View>
              )}
            </View>
            {referralStatus === 'valid' && referralName ? (
              <Text className="text-green-600 text-xs mt-1 ml-1">
                Referred by {referralName}
              </Text>
            ) : referralStatus === 'invalid' ? (
              <Text className="text-red-500 text-xs mt-1 ml-1">
                Invalid referral code
              </Text>
            ) : null}
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleContinue}
            disabled={isLoading}
            className="bg-orange-400 rounded-full items-center mb-8"
            style={{
              paddingVertical: SPACING.lg,
              minHeight: TOUCH_TARGETS.large,
              backgroundColor: isLoading ? '#CCCCCC' : '#FE8733',
              shadowColor: '#FE8733',
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
