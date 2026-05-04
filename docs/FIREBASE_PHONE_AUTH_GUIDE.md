# Firebase Phone Auth Implementation Guide

**Project:** TiffinDeliveryFrontend (React Native 0.82.1)
**Target:** AI Assistant Implementation
**Status:** Firebase console setup ✓ | Android config ✓ | npm packages ✗

---

## CURRENT STATE

**Existing:**
- Auth UI: LoginScreen → OTPVerificationScreen → UserOnboardingScreen
- Navigation: AuthNavigator, MainNavigator with TypeScript types
- State: UserContext (no persistence)
- Android: google-services.json configured, build.gradle ready
- NO Firebase packages installed

**Flow:** User enters phone → "Get OTP" → 6-digit OTP input → User profile → Main app

---

## IMPLEMENTATION STEPS

### 1. INSTALL PACKAGES

```bash
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-async-storage/async-storage
```

**Post-install:** `cd android && ./gradlew clean && cd ..`

### 2. FIREBASE INITIALIZATION

**File:** `src/config/firebase.ts` (NEW)

```typescript
import auth from '@react-native-firebase/auth';

export const firebaseAuth = auth();

export const sendOTP = async (phoneNumber: string) => {
  const confirmation = await firebaseAuth.signInWithPhoneNumber(phoneNumber);
  return confirmation;
};

export const verifyOTP = async (confirmation: any, code: string) => {
  const credential = await confirmation.confirm(code);
  return credential;
};

export const signOut = async () => {
  await firebaseAuth.signOut();
};
```

### 3. UPDATE UserContext

**File:** `src/context/UserContext.tsx`

**Add imports:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseAuth } from '../config/firebase';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
```

**Add to interface:**
```typescript
interface UserContextType {
  // ... existing fields
  firebaseUser: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  loginWithPhone: (phoneNumber: string) => Promise<any>;
  verifyOTP: (confirmation: any, code: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

**Update provider state:**
```typescript
const [user, setUser] = useState<UserProfile | null>(null);
const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
const [isLoading, setIsLoading] = useState(true);
```

**Add useEffect for auth listener:**
```typescript
useEffect(() => {
  const unsubscribe = firebaseAuth.onAuthStateChanged(async (fbUser) => {
    setFirebaseUser(fbUser);
    if (fbUser) {
      const storedUser = await AsyncStorage.getItem('user_profile');
      if (storedUser) setUser(JSON.parse(storedUser));
    } else {
      setUser(null);
      await AsyncStorage.removeItem('user_profile');
    }
    setIsLoading(false);
  });
  return unsubscribe;
}, []);
```

**Add methods:**
```typescript
const loginWithPhone = async (phoneNumber: string) => {
  const confirmation = await firebaseAuth.signInWithPhoneNumber(phoneNumber);
  return confirmation;
};

const verifyOTP = async (confirmation: any, code: string) => {
  await confirmation.confirm(code);
};

const logout = async () => {
  await firebaseAuth.signOut();
  setUser(null);
  await AsyncStorage.removeItem('user_profile');
};

const completeOnboarding = async (data: Partial<UserProfile>) => {
  const updatedUser = {
    ...user,
    id: firebaseUser?.uid,
    phone: firebaseUser?.phoneNumber || undefined,
    ...data,
    isOnboarded: true,
    createdAt: new Date(),
  };
  setUser(updatedUser);
  await AsyncStorage.setItem('user_profile', JSON.stringify(updatedUser));
};
```

**Update value prop:**
```typescript
<UserContext.Provider value={{
  user, setUser, updateUser, completeOnboarding, logout,
  firebaseUser, isLoading, loginWithPhone, verifyOTP,
  isAuthenticated: !!firebaseUser && !!user
}}>
```

### 4. UPDATE LoginScreen

**File:** `src/screens/auth/LoginScreen.tsx`

**Add imports:**
```typescript
import { useUser } from '../../context/UserContext';
import { Alert } from 'react-native';
```

**Add state:**
```typescript
const { loginWithPhone } = useUser();
const [confirmation, setConfirmation] = useState<any>(null);
const [loading, setLoading] = useState(false);
```

**Replace handleGetOTP:**
```typescript
const handleGetOTP = async () => {
  if (phoneNumber.length !== 10) {
    Alert.alert('Error', 'Please enter a valid 10-digit phone number');
    return;
  }

  setLoading(true);
  try {
    const fullPhone = `+91${phoneNumber}`;
    const confirm = await loginWithPhone(fullPhone);
    setConfirmation(confirm);
    navigation.navigate('OTPVerification', {
      phoneNumber: fullPhone,
      confirmation: confirm
    });
  } catch (error: any) {
    Alert.alert('Error', error.message || 'Failed to send OTP');
  } finally {
    setLoading(false);
  }
};
```

**Update button:**
```typescript
<TouchableOpacity
  onPress={handleGetOTP}
  disabled={loading}
  // ... existing styles
>
  <Text>{loading ? 'Sending...' : 'Get OTP'}</Text>
</TouchableOpacity>
```

### 5. UPDATE OTPVerificationScreen

**File:** `src/screens/auth/OTPVerificationScreen.tsx`

**Add imports:**
```typescript
import { useUser } from '../../context/UserContext';
import { Alert } from 'react-native';
```

**Update route params type in navigation.ts:**
```typescript
OTPVerification: { phoneNumber: string; confirmation: any };
```

**Add to component:**
```typescript
const { verifyOTP } = useUser();
const { confirmation } = route.params;
const [loading, setLoading] = useState(false);
```

**Replace handleVerification:**
```typescript
const handleVerification = async () => {
  const otpCode = otp.join('');
  if (otpCode.length !== 6) {
    Alert.alert('Error', 'Please enter complete OTP');
    return;
  }

  setLoading(true);
  try {
    await verifyOTP(confirmation, otpCode);
    navigation.navigate('UserOnboarding');
  } catch (error: any) {
    Alert.alert('Error', error.message || 'Invalid OTP');
    setOtp(['', '', '', '', '', '']);
  } finally {
    setLoading(false);
  }
};
```

**Update resendOTP:**
```typescript
const resendOTP = async () => {
  try {
    const newConfirmation = await loginWithPhone(route.params.phoneNumber);
    route.params.confirmation = newConfirmation;
    setResendTimer(30);
    Alert.alert('Success', 'OTP resent successfully');
  } catch (error: any) {
    Alert.alert('Error', 'Failed to resend OTP');
  }
};
```

### 6. UPDATE UserOnboardingScreen

**File:** `src/screens/auth/UserOnboardingScreen.tsx`

**Update handleContinue:**
```typescript
const handleContinue = async () => {
  if (!validateForm()) return;

  setIsLoading(true);
  try {
    await completeOnboarding({
      name: formData.name,
      email: formData.email,
      dietaryPreferences: formData.dietaryPreferences,
    });
    navigation.replace('Main');
  } catch (error) {
    Alert.alert('Error', 'Failed to save profile');
  } finally {
    setIsLoading(false);
  }
};
```

### 7. UPDATE AppNavigator

**File:** `src/navigation/AppNavigator.tsx`

**Add imports:**
```typescript
import { useUser } from '../context/UserContext';
import { ActivityIndicator, View } from 'react-native';
```

**Replace component:**
```typescript
const AppNavigator = () => {
  const { firebaseUser, user, isLoading } = useUser();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const isAuthenticated = !!firebaseUser && user?.isOnboarded;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!firebaseUser ? (
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="OnboardingNav" component={OnboardingNavigator} />
            <Stack.Screen name="Auth" component={AuthNavigator} />
          </>
        ) : !user?.isOnboarded ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

### 8. ANDROID PERMISSIONS

**File:** `android/app/src/main/AndroidManifest.xml`

**Add before `<application>`:**
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
```

### 9. LOGOUT IMPLEMENTATION

**Files needing logout:** Account screens, settings

**Example:**
```typescript
import { useUser } from '../../context/UserContext';

const { logout } = useUser();

const handleLogout = async () => {
  Alert.alert(
    'Logout',
    'Are you sure?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        }
      }
    ]
  );
};
```

---

## BUILD & TEST

```bash
# Clean and rebuild
cd android && ./gradlew clean && cd ..
npx react-native run-android

# iOS additional steps (if needed)
cd ios && pod install && cd ..
npx react-native run-ios
```

---

## ERROR HANDLING

**Common errors:**

1. **"Missing reCAPTCHA"** → Firebase Console: Enable Phone Auth, add SHA certificates
2. **"Network error"** → Check internet, Firebase project settings
3. **"Invalid phone number"** → Ensure +countrycode format (+91 for India)
4. **"Too many requests"** → Firebase quota exceeded, wait or upgrade plan
5. **Auto-verify not working** → Android: Add SHA-256 to Firebase Console

---

## TESTING WITHOUT SMS (Development)

**Firebase Console → Authentication → Phone → Add Test Number:**
```
Phone: +91 9876543210
OTP: 123456
```

---

## KEY FILES SUMMARY

**New:** `src/config/firebase.ts`
**Modified:** `src/context/UserContext.tsx`, `src/screens/auth/LoginScreen.tsx`, `src/screens/auth/OTPVerificationScreen.tsx`, `src/screens/auth/UserOnboardingScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/types/navigation.ts`
**Config:** `android/app/src/main/AndroidManifest.xml`

---

## VERIFICATION CHECKLIST

- [ ] Packages installed
- [ ] Firebase initialized
- [ ] UserContext updated with auth methods
- [ ] LoginScreen sends OTP
- [ ] OTPVerificationScreen verifies code
- [ ] UserOnboardingScreen saves to Firebase user
- [ ] AppNavigator shows correct screens based on auth state
- [ ] Logout works
- [ ] AsyncStorage persists user data
- [ ] App rebuilds successfully

---

**Implementation Time:** ~30-45 minutes
**Testing:** Use Firebase test phone numbers during development