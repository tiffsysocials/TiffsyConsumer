import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingNavigator from './OnboardingNavigator';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import SplashScreen, { SplashView } from '../screens/SplashScreen';
import UserOnboardingScreen from '../screens/auth/UserOnboardingScreen';
import AddressSetupScreen from '../screens/auth/AddressSetupScreen';
import { RootStackParamList } from '../types/navigation';
import { useUser } from '../context/UserContext';
import { navigationRef } from './navigationRef';

const Stack = createStackNavigator<RootStackParamList>();
const { width } = Dimensions.get('window');

const AuthErrorView: React.FC<{
  onRetry: () => Promise<void>;
  onLogout: () => Promise<void>;
}> = ({ onRetry, onLogout }) => {
  const [retrying, setRetrying] = React.useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
      <Image
        source={require('../assets/images/logo.png')}
        style={{ width: width * 0.3, height: width * 0.3, marginBottom: 32 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' }}>
        Connection Error
      </Text>
      <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
        We couldn't connect to our servers. Please check your internet connection and try again.
      </Text>
      <TouchableOpacity
        onPress={handleRetry}
        disabled={retrying}
        style={{
          backgroundColor: '#FE8733',
          borderRadius: 100,
          paddingVertical: 14,
          paddingHorizontal: 48,
          marginBottom: 16,
          opacity: retrying ? 0.6 : 1,
          width: '100%',
          alignItems: 'center',
        }}
      >
        {retrying ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Try Again</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onLogout}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 48,
          width: '100%',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#6B7280', fontSize: 15, fontWeight: '500' }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const AppNavigator = () => {
  const { user, isLoading, isGuest, needsAddressSetup, authError, retrySync, logout, isAuthenticated } = useUser();
  const [showSplash, setShowSplash] = React.useState(true);

  // Always show animated splash on every app launch
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Show static splash while checking auth state
  if (isLoading) {
    return <SplashView />;
  }

  // Show error/retry screen when sync failed with no cached data
  if (authError && !user) {
    return <AuthErrorView onRetry={retrySync} onLogout={logout} />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: false,
        colors: {
          primary: '#FE8733',
          background: '#FFFFFF',
          card: '#FFFFFF',
          text: '#000000',
          border: '#FFFFFF',
          notification: '#FE8733',
        },
        fonts: {
          regular: {
            fontFamily: 'System',
            fontWeight: '400',
          },
          medium: {
            fontFamily: 'System',
            fontWeight: '500',
          },
          bold: {
            fontFamily: 'System',
            fontWeight: '700',
          },
          heavy: {
            fontFamily: 'System',
            fontWeight: '900',
          },
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        {isGuest ? (
          // Guest mode - show main app with limited access
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : !user ? (
          // User is not authenticated - show onboarding and auth screens
          <>
            <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
            <Stack.Screen name="Auth" component={AuthNavigator} />
          </>
        ) : !user.isOnboarded ? (
          // User is authenticated but hasn't completed profile onboarding
          <Stack.Screen name="UserOnboarding" component={UserOnboardingScreen} />
        ) : needsAddressSetup ? (
          // User is onboarded but needs to set up delivery address
          <Stack.Screen name="AddressSetup" component={AddressSetupScreen} />
        ) : (
          // User is fully authenticated, onboarded, and has address - show main app
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
