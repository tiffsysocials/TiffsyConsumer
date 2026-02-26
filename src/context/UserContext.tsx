import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { firebaseAuth } from '../config/firebase';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import apiService from '../services/api.service';
import notificationService from '../services/notification.service';
import dataPreloader from '../services/dataPreloader.service';

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
}

interface UserContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  isGuest: boolean;
  needsAddressSetup: boolean;
  setUser: (user: UserProfile | null) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  loginWithPhone: (phoneNumber: string) => Promise<FirebaseAuthTypes.ConfirmationResult>;
  verifyOTP: (confirmation: FirebaseAuthTypes.ConfirmationResult, code: string) => Promise<{ isOnboarded: boolean; isNewUser: boolean; isProfileComplete: boolean }>;
  completeOnboarding: (data: {
    name: string;
    email?: string;
    dietaryPreferences?: DietaryPreferences;
  }) => Promise<void>;
  registerFcmToken: () => Promise<boolean>;
  logout: () => Promise<void>;
  enterGuestMode: () => Promise<void>;
  exitGuestMode: () => Promise<void>;
  isAuthenticated: boolean;
  checkProfileStatus: () => Promise<void>;
  setNeedsAddressSetup: (value: boolean) => void;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [needsAddressSetup, setNeedsAddressSetup] = useState(false);

  // Check if user needs to set up address
  const checkAddressSetup = async (userProfile?: UserProfile | null) => {
    // Skip in offline mode
    if (OFFLINE_MODE) {
      return;
    }

    // Use provided user or fallback to state user
    const currentUser = userProfile || user;

    try {
      // Only check for onboarded users
      if (currentUser?.isOnboarded) {
        const response = await apiService.getAddresses();
        const addresses = response.data?.addresses || [];

        // If user has no addresses, they need to set up address
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
      // Don't set needsAddressSetup on error - let user proceed
    }
  };

  // Listen to Firebase auth state changes
  useEffect(() => {
    const initializeAuth = async () => {
      // Check if user was in guest mode
      const guestFlag = await AsyncStorage.getItem('is_guest');
      if (guestFlag === 'true') {
        setIsGuest(true);
      }

      // ALWAYS set up Firebase auth listener (even for guests who may login later)
      const unsubscribe = firebaseAuth.onAuthStateChanged(async (fbUser) => {
        console.log('Auth state changed:', fbUser?.uid);
        setFirebaseUser(fbUser);

        if (fbUser) {
          // User authenticated - exit guest mode if active
          if (guestFlag === 'true') {
            setIsGuest(false);
            await AsyncStorage.removeItem('is_guest');
          }

          // Always verify with backend (use cached data as fallback)
          try {
            const { userProfile } = await syncUserInternal();
            // Check if user needs to set up address (pass the synced user profile)
            await checkAddressSetup(userProfile);
          } catch (error) {
            console.error('Error checking profile status:', error);
            // Fallback to cached data if backend fails
            const storedUser = await AsyncStorage.getItem('user_profile');
            if (storedUser) {
              const parsedUser = JSON.parse(storedUser);
              setUser(parsedUser);
              // Also check address setup for cached user
              await checkAddressSetup(parsedUser);
            }
          }
        } else {
          // User logged out
          setUser(null);
          await AsyncStorage.removeItem('user_profile');
        }

        setIsLoading(false);
      });

      return unsubscribe;
    };

    const unsubscribePromise = initializeAuth();

    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, []);

  const syncUserInternal = async (): Promise<{ userProfile: UserProfile | null; isNewUser: boolean; isProfileComplete: boolean }> => {
    // OFFLINE MODE: Skip backend call, use cached data or return new user as not onboarded
    if (OFFLINE_MODE) {
      console.log('[OFFLINE MODE] Skipping backend sync');
      const storedUser = await AsyncStorage.getItem('user_profile');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        return { userProfile: parsedUser, isNewUser: false, isProfileComplete: parsedUser.isProfileComplete ?? false };
      }
      // New user - not onboarded yet
      const newUserProfile: UserProfile = {
        id: firebaseUser?.uid,
        phone: firebaseUser?.phoneNumber || undefined,
        isOnboarded: false,
        isProfileComplete: false,
        isNewUser: true,
      };
      setUser(newUserProfile);
      return { userProfile: newUserProfile, isNewUser: true, isProfileComplete: false };
    }

    // BACKEND MODE: Call /api/auth/sync
    try {
      const response = await apiService.syncUser();
      if (response.data) {
        const { user: userData, isNewUser, isProfileComplete } = response.data;

        // If user is null (new user not registered yet), create a temporary profile
        if (userData === null) {
          const newUserProfile: UserProfile = {
            id: undefined,
            phone: firebaseUser?.phoneNumber || undefined,
            isOnboarded: false,
            isProfileComplete: false,
            isNewUser: true,
          };
          setUser(newUserProfile);
          return { userProfile: newUserProfile, isNewUser: true, isProfileComplete: false };
        }

        // Existing user (either complete or incomplete profile)
        const profileData: UserProfile = {
          id: userData._id,
          name: userData.name || undefined,
          email: userData.email || undefined,
          phone: userData.phone || firebaseUser?.phoneNumber || undefined,
          profileImage: userData.profileImage || undefined,
          dietaryPreferences: userData.dietaryPreferences || undefined,
          isOnboarded: isProfileComplete,
          isProfileComplete: isProfileComplete,
          isNewUser: isNewUser,
          createdAt: userData.createdAt ? new Date(userData.createdAt) : undefined,
        };
        setUser(profileData);
        await AsyncStorage.setItem('user_profile', JSON.stringify(profileData));
        return { userProfile: profileData, isNewUser, isProfileComplete };
      }
    } catch (error: any) {
      console.error('Error syncing user:', error);
      // Fallback to cached data if backend fails
      const storedUser = await AsyncStorage.getItem('user_profile');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        return { userProfile: parsedUser, isNewUser: false, isProfileComplete: parsedUser.isProfileComplete ?? false };
      }
    }
    return { userProfile: null, isNewUser: true, isProfileComplete: false };
  };

  const checkProfileStatus = async () => {
    await syncUserInternal();
  };

  // Refresh user profile from API (used after profile updates)
  const refreshUser = async () => {
    console.log('[UserContext] Refreshing user profile');
    try {
      const response = await apiService.getProfile();
      console.log('[UserContext] Profile refresh response:', JSON.stringify(response, null, 2));

      // Handle response format (data.user or error.user)
      const userData = response.data?.user || (response as any).error?.user;
      if (userData) {
        const profileData: UserProfile = {
          id: userData._id,
          name: userData.name || undefined,
          email: userData.email || undefined,
          phone: userData.phone || firebaseUser?.phoneNumber || undefined,
          profileImage: userData.profileImage || undefined,
          dietaryPreferences: userData.dietaryPreferences || undefined,
          isOnboarded: true,
          isProfileComplete: true,
          isNewUser: false,
          createdAt: userData.createdAt ? new Date(userData.createdAt) : undefined,
        };
        setUser(profileData);
        await AsyncStorage.setItem('user_profile', JSON.stringify(profileData));
        console.log('[UserContext] Profile refreshed successfully');
        // Check if user needs to set up address
        await checkAddressSetup(profileData);
      }
    } catch (error: any) {
      console.error('[UserContext] Error refreshing profile:', error.message || error);
      // Fallback to sync if getProfile fails
      await syncUserInternal();
    }
  };

  const loginWithPhone = async (phoneNumber: string): Promise<FirebaseAuthTypes.ConfirmationResult> => {
    const confirmation = await firebaseAuth.signInWithPhoneNumber(phoneNumber);
    return confirmation;
  };

  const verifyOTP = async (
    confirmation: FirebaseAuthTypes.ConfirmationResult,
    code: string
  ): Promise<{ isOnboarded: boolean; isNewUser: boolean; isProfileComplete: boolean }> => {
    await confirmation.confirm(code);
    // After successful verification, sync with backend
    const { userProfile, isNewUser, isProfileComplete } = await syncUserInternal();

    // Check if user needs to set up address
    await checkAddressSetup(userProfile);

    // Register FCM token after successful login
    registerFcmToken().catch(error => {
      console.error('Failed to register FCM token after login:', error);
      // Don't throw - continue with login flow even if FCM fails
    });

    // Return the onboarding status from the fresh data
    return {
      isOnboarded: userProfile?.isOnboarded ?? false,
      isNewUser,
      isProfileComplete,
    };
  };

  const enterGuestMode = async () => {
    setIsGuest(true);
    await AsyncStorage.setItem('is_guest', 'true');
  };

  const exitGuestMode = async () => {
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
  }) => {
    // OFFLINE MODE: Skip backend call, save locally
    if (OFFLINE_MODE) {
      console.log('[OFFLINE MODE] Completing onboarding locally');
      const updatedUser: UserProfile = {
        ...user,
        id: firebaseUser?.uid || 'offline_user_' + Date.now(),
        name: data.name,
        email: data.email,
        phone: firebaseUser?.phoneNumber || undefined,
        dietaryPreferences: data.dietaryPreferences,
        isOnboarded: true,
        isProfileComplete: true,
        isNewUser: false,
        createdAt: new Date(),
      };

      setUser(updatedUser);
      await AsyncStorage.setItem('user_profile', JSON.stringify(updatedUser));
      // Trigger address setup after profile completion
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
          dietaryPrefsArray.push('EGG');
        }
      }

      // Determine if we need to register (new user) or update profile (existing user)
      const isNewUser = user?.isNewUser === true;

      let responseData;
      if (isNewUser) {
        // New user - call register endpoint
        console.log('Registering new user...');
        const response = await apiService.registerUser({
          name: data.name,
          email: data.email,
          dietaryPreferences: dietaryPrefsArray,
        });
        responseData = response.data;
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
          phone: userData.phone || firebaseUser?.phoneNumber || undefined,
          dietaryPreferences: data.dietaryPreferences,
          isOnboarded: isProfileComplete,
          isProfileComplete: isProfileComplete,
          isNewUser: false,
          createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
        };

        setUser(updatedUser);
        await AsyncStorage.setItem('user_profile', JSON.stringify(updatedUser));
        // Trigger address setup after profile completion
        setNeedsAddressSetup(true);
      }
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  };

  const registerFcmToken = async (): Promise<boolean> => {
    // Skip in offline mode
    if (OFFLINE_MODE) {
      console.log('[OFFLINE MODE] Skipping FCM token registration');
      return true;
    }

    try {
      // Request permission and get FCM token
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

      // Get device ID and type
      const deviceId = await notificationService.getDeviceId();
      const deviceType = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

      console.log('[FCM] Registering token with backend...', {
        deviceType,
        deviceId,
        tokenLength: fcmToken.length,
      });

      // Register with backend
      try {
        await apiService.registerFcmToken({
          fcmToken,
          deviceType,
          deviceId,
        });

        console.log('[FCM] Token registered successfully with backend');

        // Set up token refresh listener
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
        // Log detailed error but don't fail the login flow
        console.warn('[FCM] Backend registration failed (non-blocking):', {
          message: apiError?.message || 'Unknown error',
          status: apiError?.status,
          error: apiError,
        });

        // Check if it's a server error (500) - backend might not be ready yet
        if (apiError?.status === 500 || apiError?.message === 'Server error') {
          console.warn('[FCM] Backend FCM endpoint may not be fully configured yet');
          console.warn('[FCM] Notifications will still work once backend is ready');
        }

        // Still set up token refresh listener for future attempts
        try {
          await notificationService.setupTokenRefreshListener(async (newToken: string) => {
            console.log('[FCM] Token refreshed, attempting backend registration...');
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
        } catch (listenerError) {
          console.error('[FCM] Error setting up token refresh listener:', listenerError);
        }

        return false;
      }
    } catch (error: any) {
      console.error('[FCM] Unexpected error during FCM setup:', error);
      // Don't throw - FCM registration failure shouldn't block the flow
      return false;
    }
  };

  const logout = async () => {
    try {
      // Remove FCM token before logging out (if not in offline mode)
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
          // Continue with logout even if FCM removal fails
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

      // Sign out from Firebase
      await firebaseAuth.signOut();
      setUser(null);
      setFirebaseUser(null);
      setIsGuest(false);
      await AsyncStorage.removeItem('user_profile');
      await AsyncStorage.removeItem('is_guest');
      console.log('[Auth] User logged out successfully');
    } catch (error) {
      console.error('[Auth] Error during logout:', error);
      throw error;
    }
  };

  const isAuthenticated = !!firebaseUser && !!user?.isOnboarded;

  return (
    <UserContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        isGuest,
        needsAddressSetup,
        setUser,
        updateUser,
        loginWithPhone,
        verifyOTP,
        completeOnboarding,
        registerFcmToken,
        logout,
        enterGuestMode,
        exitGuestMode,
        isAuthenticated,
        checkProfileStatus,
        setNeedsAddressSetup,
        refreshUser,
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
