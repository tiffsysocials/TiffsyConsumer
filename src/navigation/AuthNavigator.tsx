// src/navigation/AuthNavigator.tsx
import React from 'react';
import {
  createStackNavigator,
  TransitionPresets
} from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import UserOnboardingScreen from '../screens/auth/UserOnboardingScreen';
import TermsOfServiceScreen from '../screens/legal/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/legal/PrivacyPolicyScreen';
import { AuthStackParamList } from '../types/navigation';

const Stack = createStackNavigator<AuthStackParamList>();

const AuthNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#FFFFFF' },
        // Smooth horizontal slide animation
        ...TransitionPresets.SlideFromRightIOS,
        // Optional: You can also use these alternatives:
        // cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        // Or for a fade effect:
        // cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <Stack.Screen name="UserOnboarding" component={UserOnboardingScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      {/* Register, ForgotPassword go here later */}
    </Stack.Navigator>
  );
};

export default AuthNavigator;
