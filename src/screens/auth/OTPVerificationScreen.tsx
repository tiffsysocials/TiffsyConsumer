// src/screens/auth/OTPVerificationScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthScreenProps } from '../../types/navigation';
import { useUser } from '../../context/UserContext';
import { useAlert } from '../../context/AlertContext';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = AuthScreenProps<'OTPVerification'>;

const OTPVerificationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phoneNumber, confirmation } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Verifying...');

  const { verifyOTP, loginWithPhone } = useUser();
  const { showAlert } = useAlert();
  const { isSmallDevice, width, height } = useResponsive();

  // Refs for input fields
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Start timer
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if all fields are filled
    if (newOtp.every(digit => digit !== '')) {
      handleVerifyOTP(newOtp.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      showAlert('Error', 'Please enter complete 6-digit OTP', undefined, 'error');
      return;
    }

    setLoading(true);
    setLoadingMessage('Verifying OTP...');

    try {
      const { isOnboarded } = await verifyOTP(confirmation, code);

      // Show checking profile message
      setLoadingMessage('Checking your profile...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show different message based on profile status
      if (isOnboarded) {
        setLoadingMessage('Welcome back!');
        // For returning users, wait longer to ensure smooth transition to home
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        setLoadingMessage('Setting up your account...');
        // For new users, shorter delay
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Navigation is handled automatically by AppNavigator based on state changes
      // - If user is onboarded: AppNavigator shows MainNavigator
      // - If user needs onboarding: AppNavigator shows UserOnboarding screen
      // Keep loading true to prevent UI flash during transition
    } catch (error: any) {
      console.error('Error verifying OTP:', error);

      // If Firebase auth succeeded but backend sync failed, don't show "Invalid OTP"
      // The AuthErrorView in AppNavigator will handle the sync failure
      const errorMsg = error?.message || error?.error || '';
      const isSyncError = typeof errorMsg === 'string' && (
        errorMsg.includes('Unauthorized') ||
        errorMsg.includes('Invalid token') ||
        errorMsg.includes('Failed to connect')
      );

      if (isSyncError) {
        // Sync failed after OTP was verified - let AppNavigator show error/retry
        setLoading(false);
        return;
      }

      showAlert('Invalid OTP', 'Please try again.', undefined, 'error');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setLoading(false);
    }
    // Don't set loading to false on success - let AppNavigator handle the transition
  };

  const handleResendOTP = async () => {
    if (!canResend) return;

    try {
      const newConfirmation = await loginWithPhone(phoneNumber);
      // Update route params with new confirmation
      route.params.confirmation = newConfirmation;
      setTimer(30);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      showAlert('Success', 'OTP resent successfully', undefined, 'success');
    } catch (error: any) {
      console.error('Error resending OTP:', error);
      showAlert('Error', 'Failed to resend OTP. Please try again.', undefined, 'error');
    }
  };

  const handleGetStarted = async () => {
    await handleVerifyOTP();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top image / header area */}
          <View
            style={{
              height: 250,
              backgroundColor: '#ff8800',
              paddingHorizontal: 20,
              paddingTop: 10,
            }}
          >
            {/* Back arrow in circle */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                minWidth: TOUCH_TARGETS.minimum,
                minHeight: TOUCH_TARGETS.minimum,
                borderRadius: TOUCH_TARGETS.minimum / 2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image
                source={require('../../assets/icons/backarrow.png')}
                style={{ width: SPACING.iconXl, height: SPACING.iconXl }}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* Illustration placeholder */}
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Delivery illustration */}
              <Image
                source={require('../../assets/images/login/pana.png')}
                style={{
                  width: width * 0.5,
                  height: height * 0.2,
                }}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Bottom white card */}
          <View
            style={{
              flex: 1,
              backgroundColor: 'white',
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 15,
              minHeight: 400,
            }}
          >
            {/* Verify OTP title */}
            <Text
              style={{
                fontSize: isSmallDevice ? FONT_SIZES.h2 : FONT_SIZES.h1,
                fontWeight: '700',
                color: '#111827',
                marginBottom: 8,
              }}
            >
              Verify OTP
            </Text>

            {/* Description */}
            <Text
              style={{
                fontSize: FONT_SIZES.base,
                color: '#6B7280',
                marginBottom: SPACING.xl,
                lineHeight: FONT_SIZES.base * 1.4,
              }}
            >
              Enter the 6-digit code sent to{'\n'}
              {phoneNumber}
            </Text>

            {/* OTP Input Fields */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              {otp.map((digit, index) => (
                <React.Fragment key={index}>
                  <TextInput
                    ref={(ref) => {
                      if (ref) {
                        inputRefs.current[index] = ref;
                      }
                    }}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                    style={{
                      width: isSmallDevice ? 48 : 52,
                      height: isSmallDevice ? 48 : 52,
                      borderWidth: 1,
                      borderColor: digit ? 'rgba(55, 200, 127, 1)' : 'rgba(239, 239, 239, 1)',
                      borderRadius: 10,
                      textAlign: 'center',
                      fontSize: FONT_SIZES.h3,
                      fontWeight: '600',
                      color: '#111827',
                      backgroundColor: 'rgba(250, 250, 252, 1)',
                    }}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                  {index === 2 && (
                    <Text style={{ color: '#D1D5DB', fontSize: 20, marginHorizontal: 4 }}>-</Text>
                  )}
                </React.Fragment>
              ))}
            </View>

            {/* Resend code text */}
            <Text
              style={{
                textAlign: 'center',
                fontSize: FONT_SIZES.base,
                color: '#6B7280',
                marginBottom: SPACING.lg,
              }}
            >
              {canResend ? (
                <Text>
                  Didn't receive code?{' '}
                  <Text
                    onPress={handleResendOTP}
                    style={{ color: '#ff8800', fontWeight: '600' }}
                  >
                    Resend
                  </Text>
                </Text>
              ) : (
                <Text>
                  Re-send code in{' '}
                  <Text style={{ color: '#ff8800', fontWeight: '600' }}>
                    {timer}s
                  </Text>
                </Text>
              )}
            </Text>

            {/* Get Started button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleGetStarted}
              disabled={loading}
              style={{
                backgroundColor: '#ff8800',
                borderRadius: 100,
                minHeight: TOUCH_TARGETS.large,
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.xl,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: SPACING.lg,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
                opacity: loading ? 0.5 : 1,
              }}
            >
              <Text
                style={{ color: 'white', fontSize: FONT_SIZES.base, fontWeight: '600' }}
              >
                Get Started
              </Text>
            </TouchableOpacity>

            {/* Footer text */}
            <Text
              style={{
                fontSize: FONT_SIZES.xs,
                color: '#9CA3AF',
                textAlign: 'center',
                lineHeight: FONT_SIZES.xs * 1.5,
                marginBottom: SPACING.sm,
              }}
            >
              By signing in, you agree to{' '}
              <Text
                style={{ textDecorationLine: 'underline', color: '#6B7280' }}
                onPress={() => navigation.navigate('TermsOfService')}
              >
                Terms of Service
              </Text>
              {'\n'}and{' '}
              <Text
                style={{ textDecorationLine: 'underline', color: '#6B7280' }}
                onPress={() => navigation.navigate('PrivacyPolicy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Loading Overlay */}
      {loading && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 20,
              padding: 30,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <ActivityIndicator size="large" color="#ff8800" style={{ marginBottom: SPACING.lg }} />
            <Text
              style={{
                fontSize: FONT_SIZES.h4,
                fontWeight: '600',
                color: '#111827',
                marginBottom: SPACING.sm,
              }}
            >
              {loadingMessage}
            </Text>
            <Text
              style={{
                fontSize: FONT_SIZES.base,
                color: '#6B7280',
                textAlign: 'center',
              }}
            >
              Please wait...
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default OTPVerificationScreen;
