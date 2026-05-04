# Auth Flow Implementation Plan

This document outlines all changes required to fix and complete the authentication flow for the Tiffin Delivery app.

---

## Overview

The auth flow needs fixes in these areas:
- OTP verification navigation logic
- UserOnboarding screen navigation cleanup
- Guest mode implementation
- Backend status verification on app launch
- Profile skip handling

---

## File Changes Summary

Files to modify:
- src/context/UserContext.tsx
- src/screens/auth/OTPVerificationScreen.tsx
- src/screens/auth/UserOnboardingScreen.tsx
- src/screens/auth/LoginScreen.tsx
- src/navigation/AppNavigator.tsx
- src/types/navigation.ts

---

## 1. UserContext Changes

File: `src/context/UserContext.tsx`

### 1.1 Add Guest Mode Support

Add `isGuest` flag to track guest users who skip authentication.

Add to UserProfile interface:
- isGuest: boolean (optional, defaults to false)

Add to UserContextType interface:
- isGuest: boolean
- enterGuestMode: () => Promise<void>
- exitGuestMode: () => void

Add state:
- const [isGuest, setIsGuest] = useState(false)

Add function enterGuestMode:
- Set isGuest to true
- Store guest flag in AsyncStorage
- Do NOT set firebaseUser or call backend

Add function exitGuestMode:
- Set isGuest to false
- Remove guest flag from AsyncStorage
- This is called when guest decides to login/register

### 1.2 Always Verify Backend Status

Modify the onAuthStateChanged handler to always call backend when firebaseUser exists, not just when AsyncStorage is empty.

Current logic:
```
if (storedUser) use cached data
else call checkProfileStatusInternal()
```

New logic:
```
always call checkProfileStatusInternal()
use cached data only as fallback if backend call fails
```

### 1.3 Add verifyOTP Return Value

Modify verifyOTP to return the user profile status after verification so the calling screen can make navigation decisions.

Change return type from Promise<void> to Promise<{ isOnboarded: boolean }>

After confirmation.confirm(code) and checkProfileStatusInternal():
- Return { isOnboarded: user.isOnboarded }

### 1.4 Load Guest State on App Start

In the useEffect that runs on mount:
- Check AsyncStorage for 'is_guest' flag
- If true, set isGuest state to true

### 1.5 Update Context Provider Value

Add to provider value:
- isGuest
- enterGuestMode
- exitGuestMode

---

## 2. OTPVerificationScreen Changes

File: `src/screens/auth/OTPVerificationScreen.tsx`

### 2.1 Fix Navigation After OTP Verification

Current problem: Always navigates to UserOnboarding regardless of profile status.

Modify handleVerifyOTP function:

After calling verifyOTP():
- Get the returned status { isOnboarded }
- If isOnboarded is true: do nothing (AppNavigator will auto-switch to Main)
- If isOnboarded is false: navigate to UserOnboarding

Alternative approach (simpler):
- Remove the navigation.navigate('UserOnboarding') call entirely
- Let AppNavigator handle all navigation based on state changes
- The verifyOTP call updates user state which triggers AppNavigator re-render

Recommended approach: Remove manual navigation, rely on AppNavigator state.

### 2.2 Add Loading State for Navigation

After OTP verification succeeds:
- Keep loading state true
- Show "Setting up your account..." message
- Let AppNavigator handle the transition

---

## 3. UserOnboardingScreen Changes

File: `src/screens/auth/UserOnboardingScreen.tsx`

### 3.1 Remove Broken Navigation Reset

Current code after completeOnboarding:
```typescript
navigation.reset({
  index: 0,
  routes: [{ name: 'Main' as never }],
});
```

Remove this entirely. The AppNavigator is state-driven and will automatically show MainNavigator when user.isOnboarded becomes true.

New code after completeOnboarding success:
- Just let the try block complete
- The state update in completeOnboarding() triggers AppNavigator re-render
- User is automatically taken to Main

### 3.2 Fix Skip Button Behavior

Current handleSkip shows an alert but the actual skip action is broken (same navigation.reset issue).

Two options for skip behavior:

Option A - Skip with minimal profile:
- Call completeOnboarding with just the name (required field)
- User enters Main app with basic profile

Option B - Skip enters guest-like state:
- Don't call backend
- Set a "skipped onboarding" flag
- Allow limited app access
- Prompt to complete profile later

Recommended: Option A - require at least a name before entering the app.

If truly skipping without any data:
- Need to handle this in backend (allow null profile)
- Or force name input before skip is allowed

### 3.3 Add Navigation Prop Type Fix

The current navigation prop type doesn't allow navigating to Main.

Since we're removing the navigation.reset call, no type changes needed here.

---

## 4. LoginScreen Changes

File: `src/screens/auth/LoginScreen.tsx`

### 4.1 Implement Guest Mode (Explore Button)

Current handleExplore is empty.

New implementation:

```typescript
const handleExplore = async () => {
  await enterGuestMode();
};
```

Get enterGuestMode from useUser hook at top of component.

### 4.2 Update useUser Destructuring

Add enterGuestMode to the destructured values from useUser().

---

## 5. AppNavigator Changes

File: `src/navigation/AppNavigator.tsx`

### 5.1 Handle Guest Mode in Navigation

Current logic:
- !firebaseUser -> Splash/Onboarding/Auth
- firebaseUser && !isOnboarded -> Auth
- firebaseUser && isOnboarded -> Main

New logic:
- isGuest -> Main (with limited access)
- !firebaseUser && !isGuest -> Splash/Onboarding/Auth
- firebaseUser && !isOnboarded -> Auth
- firebaseUser && isOnboarded -> Main

### 5.2 Get isGuest from Context

Add isGuest to the destructured values from useUser().

### 5.3 Update Conditional Rendering

```typescript
if (isLoading) {
  return <LoadingScreen />;
}

if (isGuest) {
  return <MainNavigator />; // Guest has limited access
}

if (!firebaseUser) {
  return <SplashOnboardingAuthStack />;
}

if (!user?.isOnboarded) {
  return <AuthNavigator />; // For profile completion
}

return <MainNavigator />;
```

---

## 6. Navigation Types Changes

File: `src/types/navigation.ts`

### 6.1 No Changes Required

The current types are sufficient. The navigation issues are solved by removing manual navigation calls and relying on state-driven AppNavigator.

---

## 7. Guest Mode Behavior Throughout App

This section documents how guest mode should affect different screens.

### 7.1 Main App Screens (when isGuest is true)

Home Screen:
- Show menu and items normally
- Hide or disable "Add to Cart" buttons
- Show banner: "Login to place orders"

Menu Screen:
- Display all items
- Disable ordering functionality
- Show login prompt on item tap

Cart Screen:
- Show empty state with login prompt
- Or redirect to login

Profile Screen:
- Show "Guest User" as name
- Show prominent login/register section
- Hide order history, saved addresses

### 7.2 Implementing Guest Restrictions

Option A - Check isGuest in each screen:
- Each screen checks isGuest from context
- Conditionally renders UI elements

Option B - Create GuestGuard component:
- Wrapper component that checks isGuest
- Shows login prompt for restricted actions
- Reusable across screens

Recommended: Combination of both. Use GuestGuard for actions, direct checks for UI.

---

## 8. Implementation Order

Phase 1 - Fix Critical Issues:
1. Modify UserContext to return status from verifyOTP
2. Remove navigation.reset from OTPVerificationScreen
3. Remove navigation.reset from UserOnboardingScreen
4. Test: Login -> OTP -> Onboarding -> Main flow works

Phase 2 - Add Guest Mode:
5. Add guest state and functions to UserContext
6. Update AppNavigator to handle isGuest
7. Implement handleExplore in LoginScreen
8. Test: Explore button works and shows Main

Phase 3 - Guest Restrictions:
9. Add guest checks to Cart functionality
10. Add guest checks to Profile screen
11. Add login prompts throughout app
12. Test: Guest cannot place orders

Phase 4 - Polish:
13. Handle skip button properly in UserOnboardingScreen
14. Add loading states during transitions
15. Handle edge cases (network errors, stale data)

---

## 9. Backend Considerations

### 9.1 Current Endpoints Used

GET /api/auth/customer/status
- Returns: { success, data: { customerId, isProfileComplete } }
- Called: On auth state change, after OTP verification

PUT /api/auth/customer/onboarding
- Body: { name, email?, dietaryPreferences? }
- Returns: { success, data: { customerId, name, email, dietaryPreferences, isProfileComplete } }
- Called: When user completes onboarding form

### 9.2 No Backend Changes Required

The current backend API is sufficient for the auth flow fixes.

Guest mode is entirely client-side - guests don't interact with backend until they register.

---

## 10. Testing Checklist

New User Flow:
- [ ] App opens -> Splash -> Onboarding carousel -> Login
- [ ] Enter phone -> Get OTP -> Verify OTP
- [ ] New user goes to UserOnboarding form
- [ ] Complete form -> Main app
- [ ] Close and reopen app -> Goes directly to Main

Returning User Flow:
- [ ] User with completed profile
- [ ] App opens -> Brief loading -> Main app
- [ ] No onboarding screens shown

Guest Flow:
- [ ] App opens -> Splash -> Onboarding -> Login
- [ ] Tap "Explore" -> Main app
- [ ] Cannot add to cart
- [ ] Profile shows login prompt
- [ ] Tap login -> Auth flow -> Main app with full access

Incomplete Profile Flow:
- [ ] User verified phone but didn't complete onboarding
- [ ] App opens -> UserOnboarding form
- [ ] Complete form -> Main app

Skip Onboarding Flow:
- [ ] New user verifies OTP -> UserOnboarding
- [ ] Tap Skip -> Confirmation dialog
- [ ] Confirm skip -> Handled appropriately

---

## 11. Code Snippets

### 11.1 UserContext Guest Mode Addition

```typescript
// Add to state
const [isGuest, setIsGuest] = useState(false);

// Add functions
const enterGuestMode = async () => {
  setIsGuest(true);
  await AsyncStorage.setItem('is_guest', 'true');
};

const exitGuestMode = async () => {
  setIsGuest(false);
  await AsyncStorage.removeItem('is_guest');
};

// Check on mount (in existing useEffect)
const checkGuestStatus = async () => {
  const guestFlag = await AsyncStorage.getItem('is_guest');
  if (guestFlag === 'true') {
    setIsGuest(true);
  }
};
```

### 11.2 Modified verifyOTP

```typescript
const verifyOTP = async (
  confirmation: FirebaseAuthTypes.ConfirmationResult,
  code: string
): Promise<{ isOnboarded: boolean }> => {
  await confirmation.confirm(code);
  await checkProfileStatusInternal();
  return { isOnboarded: user?.isOnboarded ?? false };
};
```

### 11.3 OTPVerificationScreen After Fix

```typescript
const handleVerifyOTP = async (otpCode?: string) => {
  const code = otpCode || otp.join('');
  if (code.length !== 6) {
    Alert.alert('Error', 'Please enter complete 6-digit OTP');
    return;
  }

  setLoading(true);
  try {
    await verifyOTP(confirmation, code);
    // Navigation handled by AppNavigator state change
    // No manual navigation needed
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    Alert.alert('Error', error.message || 'Invalid OTP. Please try again.');
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
    setLoading(false);
  }
  // Don't set loading to false on success - let screen transition happen
};
```

### 11.4 AppNavigator with Guest Mode

```typescript
const AppNavigator = () => {
  const { firebaseUser, user, isLoading, isGuest } = useUser();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#F56B4C" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isGuest ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : !firebaseUser ? (
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
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

---

## 12. Notes

- All navigation after auth actions should be state-driven via AppNavigator
- Manual navigation.navigate() or navigation.reset() calls cause bugs
- Guest mode is client-side only until user decides to register
- AsyncStorage is used for persistence but backend is source of truth for authenticated users
- Loading states should persist through screen transitions to avoid flicker
