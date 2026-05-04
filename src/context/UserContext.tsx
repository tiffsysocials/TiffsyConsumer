import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import apiService from '../services/api.service';
import notificationService from '../services/notification.service';
import dataPreloader from '../services/dataPreloader.service';
import {
  hasValidToken,
  storeAuthToken,
  clearAuthToken,
  refreshAuthToken,
  isTokenExpiringSoon,
} from '../services/auth.token.service';
import { authEvents } from '../services/auth.events';

const API_BASE_URL = 'https://d31od4t2t5epcb.cloudfront.net';

// ============================================
// OFFLINE MODE FLAG - Set to false to enable backend
// ============================================
const OFFLINE_MODE = false;

export interface DietaryPreferences {
  foodType?: 'VEG' | 'NON-VEG' | 'VEGAN';
  eggiterian?: boolean;
  jainFriendly?: boolean;
  dabbaType?: 'DISPOSABLE' | 'STEEL DABBA';
  spiceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface UserProfile {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  dietaryPreferences?: DietaryPreferences | string[];
  isOnboarded: boolean;
  isProfileComplete?: boolean;
  isNewUser?: boolean;
  hasAddress?: boolean;
  createdAt?: Date;
  registrationToken?: string;
}

interface UserContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isGuest: boolean;
  needsAddressSetup: boolean;
  setUser: (user: UserProfile | null) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  sendOTP: (phoneNumber: string) => Promise<void>;
  verifyOTP: (phone: string, code: string) => Promise<{ isOnboarded: boolean; isNewUser: boolean; isProfileComplete: boolean }>;
  resendOTP: (phone: string, retryType?: 'text' | 'voice') => Promise<void>;
  completeOnboarding: (data: {
    name: string;
    email?: string;
    dietaryPreferences?: DietaryPreferences;
    referralCode?: string;
  }) => Promise<void>;
  registerFcmToken: () => Promise<boolean>;
  logout: () => Promise<void>;
  enterGuestMode: () => Promise<void>;
  exitGuestMode: () => Promise<void>;
  skipOnboarding: boolean;
  isAuthenticated: boolean;
  checkProfileStatus: () => Promise<void>;
  setNeedsAddressSetup: (value: boolean) => void;
  refreshUser: () => Promise<void>;
  authError: string | null;
  retrySync: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [needsAddressSetup, setNeedsAddressSetup] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [skipOnboarding, setSkipOnboarding] = useState(false);

  // Check if user needs to set up address
  const checkAddressSetup = async (userProfile?: UserProfile | null) => {
    if (OFFLINE_MODE) return;
    const currentUser = userProfile || user;
    try {
      if (currentUser?.isOnboarded) {
        const response = await apiService.getAddresses();
        const addresses = response.data?.addresses || [];
        if (addresses.length === 0) {
          console.log('[UserContext] User has no addresses, setting needsAddressSetup = true');
          setNeedsAddressSetup(true);
        } else {
          console.log('[UserContext] User has addresses:', addresses.length);
          setNeedsAddressSetup(false);
        }
      }
    } catch (error) {
      console.error('[UserContext] Error checking addresses:', error);
    }
  };

  // Initialize auth on app start - check for stored JWT token
  useEffect(() => {
    const initializeAuth = async () => {
      // Check if user was in guest mode
      const guestFlag = await AsyncStorage.getItem('is_guest');
      if (guestFlag === 'true') {
        setIsGuest(true);
        setIsLoading(false);
        return;
      }

      // Check for stored JWT token
      const hasToken = await hasValidToken();
      if (hasToken) {
        // Token exists - fetch user profile from backend
        try {
          const { userProfile } = await fetchUserProfile();
          await checkAddressSetup(userProfile);
          setAuthError(null);
        } catch (error: any) {
          console.error('[UserContext] Error loading profile on init:', error);
          // Fallback to cached data
          const storedUser = await AsyncStorage.getItem('user_profile');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setAuthError(null);
            await checkAddressSetup(parsedUser);
          } else {
            // No cache AND fetch failed - clear token and show login
            await clearAuthToken();
            setAuthError(null);
          }
        }
      } else {
        // No JWT, but if OTP was verified for a new user we cached a pending
        // profile with a registrationToken. Restore it so the user resumes
        // onboarding instead of being sent back to the OTP screen.
        // Otherwise leave the cache alone — it acts as a fallback if a future
        // sign-in restores the same user, and removing it here used to
        // amplify auto-logout when the token was wiped by a transient error.
        const storedUser = await AsyncStorage.getItem('user_profile');
        if (storedUser) {
          const parsedUser: UserProfile = JSON.parse(storedUser);
          if (parsedUser.isNewUser && parsedUser.registrationToken && !parsedUser.isOnboarded) {
            setUser(parsedUser);
          }
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // When the API layer detects a definitive auth failure (refresh endpoint
  // returned 401/403), drop the in-memory user so the navigator routes to
  // login. Transient network failures do NOT fire this event.
  useEffect(() => {
    const unsubscribe = authEvents.onAuthExpired(() => {
      console.log('[UserContext] Auth expired — clearing user state');
      setUser(null);
      setIsGuest(false);
      AsyncStorage.removeItem('user_profile').catch(() => {});
    });
    return unsubscribe;
  }, []);

  // Refresh the token when the app returns to the foreground after being
  // backgrounded long enough for it to be near/past expiry. Without this,
  // the first request on resume hits 401 and triggers reactive refresh —
  // which is exactly the scenario where transient errors used to log users out.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      try {
        if (await isTokenExpiringSoon(10 * 60 * 1000)) {
          await refreshAuthToken(API_BASE_URL);
        }
      } catch {
        // Silent — response interceptor handles 401 via the same singleton.
      }
    });
    return () => sub.remove();
  }, []);

  // Fetch user profile from /auth/me endpoint
  const fetchUserProfile = async (): Promise<{ userProfile: UserProfile | null }> => {
    if (OFFLINE_MODE) {
      const storedUser = await AsyncStorage.getItem('user_profile');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        return { userProfile: parsedUser };
      }
      return { userProfile: null };
    }

    // Use /profile/status (not /profile) so we get the backend's authoritative
    // isComplete flag. /profile alone has no completion field, which previously
    // caused half-onboarded users to be marked onboarded on app relaunch.
    const response = await apiService.getProfileStatus();
    const userData = response.data?.profile;
    const isComplete = !!response.data?.isComplete;
    if (userData) {
      const profileData: UserProfile = {
        id: userData._id,
        name: userData.name || undefined,
        email: userData.email || undefined,
        phone: userData.phone || undefined,
        profileImage: userData.profileImage || undefined,
        dietaryPreferences: userData.dietaryPreferences || undefined,
        isOnboarded: isComplete,
        isProfileComplete: isComplete,
        isNewUser: false,
        createdAt: userData.createdAt ? new Date(userData.createdAt) : undefined,
      };
      setUser(profileData);
      await AsyncStorage.setItem('user_profile', JSON.stringify(profileData));
      return { userProfile: profileData };
    }
    return { userProfile: null };
  };

  const checkProfileStatus = async () => {
    await fetchUserProfile();
  };

  // Refresh user profile from API (used after profile updates)
  const refreshUser = async () => {
    console.log('[UserContext] Refreshing user profile');
    try {
      const { userProfile } = await fetchUserProfile();
      if (userProfile) {
        console.log('[UserContext] Profile refreshed successfully');
        await checkAddressSetup(userProfile);
      }
    } catch (error: any) {
      console.error('[UserContext] Error refreshing profile:', error.message || error);
    }
  };

  const retrySync = async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const hasToken = await hasValidToken();
      if (hasToken) {
        const { userProfile } = await fetchUserProfile();
        await checkAddressSetup(userProfile);
      }
    } catch (error: any) {
      console.error('[UserContext] Retry sync failed:', error);
      const storedUser = await AsyncStorage.getItem('user_profile');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setAuthError(null);
      } else {
        setAuthError(error?.message || 'Failed to connect to server');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Send OTP to phone number via backend (MSG91)
  const sendOTP = async (phoneNumber: string): Promise<void> => {
    await apiService.sendOTP(phoneNumber);
  };

  // Verify OTP via backend - returns auth result
  const verifyOTP = async (
    phone: string,
    code: string
  ): Promise<{ isOnboarded: boolean; isNewUser: boolean; isProfileComplete: boolean }> => {
    const response = await apiService.verifyOTP(phone, code);
    const { user: userData, token, expiresIn, registrationToken, isNewUser, isProfileComplete } = response.data;

    if (token && expiresIn) {
      // Existing user - store JWT token
      await storeAuthToken(token, expiresIn);
    }

    if (userData) {
      // Existing user
      const profileData: UserProfile = {
        id: userData._id,
        name: userData.name || undefined,
        email: userData.email || undefined,
        phone: userData.phone || undefined,
        profileImage: userData.profileImage || undefined,
        dietaryPreferences: userData.dietaryPreferences || undefined,
        isOnboarded: isProfileComplete,
        isProfileComplete,
        isNewUser,
        createdAt: userData.createdAt ? new Date(userData.createdAt) : undefined,
      };
      setUser(profileData);
      await AsyncStorage.setItem('user_profile', JSON.stringify(profileData));
      await checkAddressSetup(profileData);
    } else {
      // New user - store registrationToken for use during registration
      const newUserProfile: UserProfile = {
        phone,
        isOnboarded: false,
        isProfileComplete: false,
        isNewUser: true,
        registrationToken: registrationToken || undefined,
      };
      setUser(newUserProfile);
      // Persist so a kill/restart between OTP and onboarding completion
      // doesn't force the user to re-verify OTP.
      await AsyncStorage.setItem('user_profile', JSON.stringify(newUserProfile));
    }

    // Register FCM token after successful login (fire-and-forget)
    if (token) {
      registerFcmToken().catch(error => {
        console.error('Failed to register FCM token after login:', error);
      });
    }

    return {
      isOnboarded: isProfileComplete && !isNewUser,
      isNewUser,
      isProfileComplete,
    };
  };

  // Resend OTP via backend (MSG91)
  const resendOTP = async (phone: string, retryType?: 'text' | 'voice'): Promise<void> => {
    await apiService.resendOTP(phone, retryType);
  };

  const enterGuestMode = async () => {
    setIsGuest(true);
    await AsyncStorage.setItem('is_guest', 'true');
  };

  const exitGuestMode = async () => {
    setSkipOnboarding(true);
    setIsGuest(false);
    await AsyncStorage.removeItem('is_guest');
  };

  const updateUser = (updates: Partial<UserProfile>) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const updatedUser = { ...prevUser, ...updates };
      AsyncStorage.setItem('user_profile', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  const completeOnboarding = async (data: {
    name: string;
    email?: string;
    dietaryPreferences?: DietaryPreferences;
    referralCode?: string;
  }) => {
    // OFFLINE MODE: Skip backend call, save locally
    if (OFFLINE_MODE) {
      console.log('[OFFLINE MODE] Completing onboarding locally');
      const updatedUser: UserProfile = {
        ...user,
        id: 'offline_user_' + Date.now(),
        name: data.name,
        email: data.email,
        phone: user?.phone || undefined,
        dietaryPreferences: data.dietaryPreferences,
        isOnboarded: true,
        isProfileComplete: true,
        isNewUser: false,
        createdAt: new Date(),
      };

      setUser(updatedUser);
      await AsyncStorage.setItem('user_profile', JSON.stringify(updatedUser));
      setNeedsAddressSetup(true);
      return;
    }

    // BACKEND MODE: Call register for new users, updateProfile for existing users
    try {
      // Convert dietaryPreferences to array format expected by backend
      const dietaryPrefsArray: string[] = [];
      if (data.dietaryPreferences) {
        if (data.dietaryPreferences.foodType) {
          dietaryPrefsArray.push(data.dietaryPreferences.foodType);
        }
        if (data.dietaryPreferences.jainFriendly) {
          dietaryPrefsArray.push('JAIN');
        }
        if (data.dietaryPreferences.eggiterian) {
          dietaryPrefsArray.push('EGGETARIAN');
        }
      }

      const isNewUser = user?.isNewUser === true;
      let responseData;

      if (isNewUser && user?.registrationToken) {
        // New user - call register endpoint with registrationToken
        console.log('Registering new user...');
        const response = await apiService.registerUser({
          name: data.name,
          email: data.email,
          dietaryPreferences: dietaryPrefsArray,
          referralCode: data.referralCode || undefined,
        }, user.registrationToken);
        responseData = response.data;

        // Store the JWT token from registration response
        if (responseData?.token && responseData?.expiresIn) {
          await storeAuthToken(responseData.token, responseData.expiresIn);
        }
      } else {
        // Existing user with incomplete profile - call update endpoint
        console.log('Updating existing user profile...');
        const response = await apiService.updateProfile({
          name: data.name,
          email: data.email,
          dietaryPreferences: dietaryPrefsArray,
        });
        responseData = response.data;
      }

      if (responseData) {
        const { user: userData, isProfileComplete } = responseData;
        const updatedUser: UserProfile = {
          ...user,
          id: userData._id,
          name: userData.name,
          email: userData.email,
          phone: userData.phone || user?.phone || undefined,
          dietaryPreferences: data.dietaryPreferences,
          isOnboarded: isProfileComplete,
          isProfileComplete: isProfileComplete,
          isNewUser: false,
          registrationToken: undefined,
          createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
        };

        setUser(updatedUser);
        await AsyncStorage.setItem('user_profile', JSON.stringify(updatedUser));
        setNeedsAddressSetup(true);
      }
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  };

  const registerFcmToken = async (): Promise<boolean> => {
    if (OFFLINE_MODE) {
      console.log('[OFFLINE MODE] Skipping FCM token registration');
      return true;
    }

    try {
      const hasPermission = await notificationService.requestPermission();
      if (!hasPermission) {
        console.log('[FCM] Notification permission denied by user');
        return false;
      }

      const fcmToken = await notificationService.getToken();
      if (!fcmToken) {
        console.log('[FCM] No FCM token available');
        return false;
      }

      const deviceId = await notificationService.getDeviceId();
      const deviceType = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

      console.log('[FCM] Registering token with backend...', {
        deviceType,
        deviceId,
        tokenLength: fcmToken.length,
      });

      try {
        await apiService.registerFcmToken({
          fcmToken,
          deviceType,
          deviceId,
        });

        console.log('[FCM] Token registered successfully with backend');

        await notificationService.setupTokenRefreshListener(async (newToken: string) => {
          console.log('[FCM] Token refreshed, updating backend...');
          try {
            await apiService.registerFcmToken({
              fcmToken: newToken,
              deviceType,
              deviceId,
            });
            console.log('[FCM] Refreshed token registered successfully');
          } catch (error) {
            console.error('[FCM] Error registering refreshed token:', error);
          }
        });

        return true;
      } catch (apiError: any) {
        console.warn('[FCM] Backend registration failed (non-blocking):', {
          message: apiError?.message || 'Unknown error',
          status: apiError?.status,
        });

        if (apiError?.status === 500 || apiError?.message === 'Server error') {
          console.warn('[FCM] Backend FCM endpoint may not be fully configured yet');
        }

        try {
          await notificationService.setupTokenRefreshListener(async (newToken: string) => {
            try {
              await apiService.registerFcmToken({
                fcmToken: newToken,
                deviceType,
                deviceId,
              });
            } catch (error) {
              console.error('[FCM] Error registering refreshed token:', error);
            }
          });
        } catch (listenerError) {
          console.error('[FCM] Error setting up token refresh listener:', listenerError);
        }

        return false;
      }
    } catch (error: any) {
      console.error('[FCM] Unexpected error during FCM setup:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      // Remove FCM token before logging out
      if (!OFFLINE_MODE) {
        try {
          const fcmToken = await notificationService.getStoredToken();
          if (fcmToken) {
            console.log('[FCM] Removing token from backend...');
            await apiService.removeFcmToken(fcmToken);
            console.log('[FCM] Token removed successfully from backend');
          }
        } catch (error: any) {
          console.warn('[FCM] Error removing token from backend (non-blocking):', {
            message: error?.message || 'Unknown error',
            status: error?.status,
          });
        }
      }

      // Delete local FCM token
      try {
        await notificationService.deleteToken();
        console.log('[FCM] Local token deleted');
      } catch (error) {
        console.warn('[FCM] Error deleting local token:', error);
      }

      // Clean up notification listeners
      try {
        notificationService.cleanup();
        console.log('[FCM] Notification listeners cleaned up');
      } catch (error) {
        console.warn('[FCM] Error cleaning up notification listeners:', error);
      }

      // Clear all preloaded data caches
      try {
        dataPreloader.clearAllCaches();
        console.log('[DataPreloader] All caches cleared on logout');
      } catch (error) {
        console.warn('[DataPreloader] Error clearing caches:', error);
      }

      // Clear JWT token
      await clearAuthToken();
      setUser(null);
      setIsGuest(false);
      setAuthError(null);
      await AsyncStorage.removeItem('user_profile');
      await AsyncStorage.removeItem('is_guest');
      console.log('[Auth] User logged out successfully');
    } catch (error) {
      console.error('[Auth] Error during logout:', error);
      throw error;
    }
  };

  const isAuthenticated = !!user?.isOnboarded;

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        isGuest,
        needsAddressSetup,
        setUser,
        updateUser,
        sendOTP,
        verifyOTP,
        resendOTP,
        completeOnboarding,
        registerFcmToken,
        logout,
        enterGuestMode,
        exitGuestMode,
        skipOnboarding,
        isAuthenticated,
        checkProfileStatus,
        setNeedsAddressSetup,
        refreshUser,
        authError,
        retrySync,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
