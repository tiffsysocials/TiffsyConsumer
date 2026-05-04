import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthScreenProps } from '../../types/navigation';
import { useUser } from '../../context/UserContext';
import { useAlert } from '../../context/AlertContext';
import { useResponsive } from '../../hooks/useResponsive';
import { TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = AuthScreenProps<'Login'>;

const REMEMBER_PHONE_KEY = '@tiffsy_remember_phone';

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const { sendOTP } = useUser();
  const { showAlert } = useAlert();
  const { height } = useResponsive();
  const scrollRef = useRef<ScrollView>(null);

  // Scroll down when keyboard opens so input + button are visible
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        scrollRef.current?.scrollTo({ y: 200, animated: true });
      },
    );
    return () => showSub.remove();
  }, []);

  // Load saved phone number on mount
  useEffect(() => {
    loadSavedPhone();
  }, []);

  const loadSavedPhone = async () => {
    try {
      const savedPhone = await AsyncStorage.getItem(REMEMBER_PHONE_KEY);
      if (savedPhone) {
        setPhone(savedPhone);
        setRemember(true);
      }
    } catch (error) {
      console.error('Error loading saved phone:', error);
    }
  };

  const savePhone = async (phoneNumber: string) => {
    try {
      await AsyncStorage.setItem(REMEMBER_PHONE_KEY, phoneNumber);
    } catch (error) {
      console.error('Error saving phone:', error);
    }
  };

  const clearSavedPhone = async () => {
    try {
      await AsyncStorage.removeItem(REMEMBER_PHONE_KEY);
    } catch (error) {
      console.error('Error clearing saved phone:', error);
    }
  };

  const handleGetOtp = async () => {
    if (phone.length !== 10) {
      showAlert('Error', 'Please enter a valid 10-digit phone number', undefined, 'error');
      return;
    }

    setLoading(true);
    try {
      // Send OTP via backend (MSG91)
      await sendOTP(phone);

      // Save or clear phone number based on remember checkbox
      if (remember) {
        await savePhone(phone);
      } else {
        await clearSavedPhone();
      }

      navigation.navigate('OTPVerification', {
        phoneNumber: phone,
      });
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      showAlert(
        'Error',
        error.message || 'Failed to send OTP. Please try again.',
        undefined,
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FE8733' }} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#FE8733" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          {/* Top image / header area */}
          <View
            style={{
              height: 220,
              backgroundColor: '#FE8733',
              paddingHorizontal: 20,
              paddingTop: 10,
            }}
          >
            {/* Back arrow in circle */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image
                source={require('../../assets/icons/backarrow.png')}
                style={{ width: 40, height: 40 }}
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
                  width: 200,
                  height: height * 0.28,
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
              paddingBottom: 30,
            }}
          >
            {/* Welcome heading */}
            <Text
              style={{
                color: '#111827',
                fontSize: 24,
                fontWeight: '700',
                marginBottom: 8,
              }}
            >
              Welcome to Tiffsy
            </Text>
            <Text
              style={{
                color: '#6B7280',
                fontSize: 14,
                marginBottom: 24,
              }}
            >
              Enter your phone number to continue
            </Text>

            {/* Your Number label */}
            <Text
              style={{
                color: '#111827',
                fontSize: 16,
                fontWeight: '600',
                marginBottom: 12,
              }}
            >
              Your Number
            </Text>

            {/* Phone input */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 19,
                backgroundColor: 'rgba(250, 250, 252, 1)',
                borderWidth: 1.5,
                borderColor: phone.length === 10 ? 'rgba(55, 200, 127, 1)' : 'rgba(239, 239, 239, 1)',
                paddingHorizontal: 15,
                paddingVertical: 4,
                marginBottom: 12,
                minHeight: TOUCH_TARGETS.comfortable,
              }}
            >
              {/* Country / code */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingRight: 10,
                  borderRightWidth: 1,
                  borderRightColor: '#D1D5DB',
                  marginRight: 10,
                }}
              >
                <Image
                  source={require('../../assets/icons/indianflag2.png')}
                  style={{ width: 24, height: 24 }}
                  resizeMode="contain"
                />
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#111827',
                  }}
                >
                  +91
                </Text>
                <Image
                  source={require('../../assets/icons/downarrow.png')}
                  style={{ width: 12, height: 12, marginLeft: 4 }}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              {/* Phone number */}
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: '#111827',
                  paddingVertical: 12,
                }}
                placeholder="Enter the number"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                placeholderTextColor="rgba(206, 206, 206, 1)"
                maxLength={10}
              />

              {/* Green tick icon */}
              {phone.length === 10 && (
                <Image
                  source={require('../../assets/icons/greentick.png')}
                  style={{ width: 20, height: 20, marginLeft: 8 }}
                  resizeMode="contain"
                />
              )}
            </View>

            {/* Remember me */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 30,
              }}
              onPress={() => setRemember(!remember)}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  borderWidth: 2,
                  borderColor: remember ? 'rgba(36, 36, 36, 1)' : '#D1D5DB',
                  backgroundColor: remember ? 'white' : 'white',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                {remember && (
                  <Text style={{ color: 'rgba(36, 36, 36, 1)', fontSize: 10, fontWeight: 'bold' }}>✓</Text>
                )}
              </View>
              <Text style={{ color: 'rgba(36, 36, 36, 1)', fontSize: 14 }}>Remember me</Text>
            </TouchableOpacity>

            {/* Get OTP button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleGetOtp}
              disabled={loading || phone.length !== 10}
              style={{
                backgroundColor: loading || phone.length !== 10 ? '#CCCCCC' : '#FE8733',
                borderRadius: 100,
                paddingVertical: 15,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
                minHeight: TOUCH_TARGETS.comfortable,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text
                  style={{ color: 'white', fontSize: FONT_SIZES.base, fontWeight: '600' }}
                >
                  Get OTP
                </Text>
              )}
            </TouchableOpacity>

            {/* Footer text */}
            <Text
              style={{
                fontSize: 12,
                color: '#9CA3AF',
                textAlign: 'center',
                lineHeight: 18,
                marginTop: 10,
                marginBottom: 45,
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
    </SafeAreaView>
  );
};

export default LoginScreen;
