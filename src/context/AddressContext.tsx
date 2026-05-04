// src/context/AddressContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService, { AddressData, ServerAddress } from '../services/api.service';
import locationService, { LocationResult } from '../services/location.service';
import { useUser } from './UserContext';

export interface Address {
  id: string;
  label: string;
  isMain: boolean;
  // New fields matching backend schema
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isServiceable?: boolean;
  zoneId?: string;
  // Legacy fields for backward compatibility
  name?: string;
  phone?: string;
  address?: string;
  distance?: string;
}

interface ServiceabilityResult {
  isServiceable: boolean;
  message: string;
}

interface AddressContextType {
  addresses: Address[];
  selectedAddressId: string | null;
  isCheckingServiceability: boolean;
  isLoadingAddresses: boolean;
  currentLocation: LocationResult | null;
  isGettingLocation: boolean;
  addAddress: (address: Omit<Address, 'id'>) => void;
  updateAddress: (id: string, address: Partial<Address>) => void;
  removeAddress: (id: string) => void;
  setMainAddress: (id: string) => void;
  getMainAddress: () => Address | undefined;
  setSelectedAddressId: (id: string | null) => void;
  checkServiceability: (pincode: string) => Promise<ServiceabilityResult>;
  createAddressOnServer: (address: Omit<Address, 'id'>) => Promise<string>;
  fetchAddresses: () => Promise<void>;
  updateAddressOnServer: (id: string, address: Partial<AddressData>) => Promise<void>;
  deleteAddressOnServer: (id: string) => Promise<void>;
  setDefaultAddressOnServer: (id: string) => Promise<void>;
  getCurrentLocationWithAddress: () => Promise<LocationResult>;
  requestLocationPermission: () => Promise<boolean>;
}

const AddressContext = createContext<AddressContextType | undefined>(undefined);

// Helper to convert server address to local Address format
const serverToLocalAddress = (serverAddr: ServerAddress): Address => ({
  id: serverAddr._id,
  label: serverAddr.label,
  isMain: serverAddr.isDefault,
  addressLine1: serverAddr.addressLine1,
  addressLine2: serverAddr.addressLine2,
  landmark: serverAddr.landmark,
  locality: serverAddr.locality,
  city: serverAddr.city,
  state: serverAddr.state,
  pincode: serverAddr.pincode,
  contactName: serverAddr.contactName,
  contactPhone: serverAddr.contactPhone,
  coordinates: serverAddr.coordinates,
  isServiceable: serverAddr.isServiceable,
  zoneId: serverAddr.zoneId,
  // Legacy fields
  name: serverAddr.contactName,
  phone: serverAddr.contactPhone,
  address: `${serverAddr.addressLine1}, ${serverAddr.locality}, ${serverAddr.city}`,
});

export const AddressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, isGuest } = useUser();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isCheckingServiceability, setIsCheckingServiceability] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationResult | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Load addresses from AsyncStorage on mount
  useEffect(() => {
    const loadCachedAddresses = async () => {
      try {
        const cached = await AsyncStorage.getItem('addresses');
        if (cached) {
          setAddresses(JSON.parse(cached));
        }
      } catch (error) {
        console.error('Error loading cached addresses:', error);
      }
    };
    loadCachedAddresses();
  }, []);

  // Fetch addresses from server
  const fetchAddresses = useCallback(async () => {
    setIsLoadingAddresses(true);
    try {
      const response = await apiService.getAddresses();
      if (response.data?.addresses) {
        const localAddresses = response.data.addresses.map(serverToLocalAddress);
        setAddresses(localAddresses);
        await AsyncStorage.setItem('addresses', JSON.stringify(localAddresses));

        // Set default address as selected if none selected
        const defaultAddr = localAddresses.find(a => a.isMain);
        if (defaultAddr && !selectedAddressId) {
          setSelectedAddressId(defaultAddr.id);
        }
      }
    } catch (error: any) {
      console.error('Error fetching addresses:', error);
      // Fall back to cached addresses (already loaded)
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [selectedAddressId]);

  // Fetch addresses from server when user authenticates
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      console.log('[AddressContext] User authenticated, fetching addresses from server');
      fetchAddresses();
    } else if (!isAuthenticated || isGuest) {
      console.log('[AddressContext] User not authenticated or is guest, clearing addresses');
      // Clear addresses when user logs out or is in guest mode
      setAddresses([]);
      setSelectedAddressId(null);
    }
  }, [isAuthenticated, isGuest, fetchAddresses]);

  const addAddress = (newAddress: Omit<Address, 'id'>) => {
    const address: Address = {
      ...newAddress,
      id: 'local_' + Date.now().toString(),
    };
    setAddresses(prevAddresses => {
      const updated = [...prevAddresses, address];
      AsyncStorage.setItem('addresses', JSON.stringify(updated));
      return updated;
    });
  };

  const updateAddress = (id: string, updatedFields: Partial<Address>) => {
    setAddresses(prevAddresses => {
      const updated = prevAddresses.map(addr =>
        addr.id === id ? { ...addr, ...updatedFields } : addr
      );
      AsyncStorage.setItem('addresses', JSON.stringify(updated));
      return updated;
    });
  };

  const removeAddress = (id: string) => {
    setAddresses(prevAddresses => {
      const updated = prevAddresses.filter(addr => addr.id !== id);
      AsyncStorage.setItem('addresses', JSON.stringify(updated));
      return updated;
    });
  };

  const setMainAddress = (id: string) => {
    setAddresses(prevAddresses => {
      const updated = prevAddresses.map(addr => ({
        ...addr,
        isMain: addr.id === id,
      }));
      AsyncStorage.setItem('addresses', JSON.stringify(updated));
      return updated;
    });
  };

  const getMainAddress = () => {
    return addresses.find(addr => addr.isMain);
  };

  const checkServiceability = async (pincode: string): Promise<ServiceabilityResult> => {
    setIsCheckingServiceability(true);
    try {
      const response = await apiService.checkServiceability(pincode);
      // Handle the zone lookup response format
      return {
        isServiceable: response.data.isServiceable,
        message: response.data.message,
      };
    } catch (error: any) {
      console.error('Error checking serviceability:', error);
      return {
        isServiceable: false,
        message: error.message || 'Unable to check serviceability. Please try again.',
      };
    } finally {
      setIsCheckingServiceability(false);
    }
  };

  const createAddressOnServer = async (addressData: Omit<Address, 'id'>): Promise<string> => {
    try {
      const apiAddressData: AddressData = {
        label: addressData.label,
        addressLine1: addressData.addressLine1,
        addressLine2: addressData.addressLine2,
        landmark: addressData.landmark,
        locality: addressData.locality,
        city: addressData.city,
        state: addressData.state,
        pincode: addressData.pincode,
        contactName: addressData.contactName,
        contactPhone: addressData.contactPhone,
        coordinates: addressData.coordinates,
        isDefault: addressData.isMain,
      };

      const response = await apiService.createAddress(apiAddressData);

      if (response.data && response.data.address) {
        const serverAddress = response.data.address;
        const newAddress: Address = {
          id: serverAddress._id,
          label: serverAddress.label,
          isMain: serverAddress.isDefault ?? addressData.isMain,
          addressLine1: serverAddress.addressLine1,
          addressLine2: serverAddress.addressLine2,
          landmark: serverAddress.landmark,
          locality: serverAddress.locality,
          city: serverAddress.city,
          state: serverAddress.state,
          pincode: serverAddress.pincode,
          contactName: serverAddress.contactName,
          contactPhone: serverAddress.contactPhone,
          coordinates: serverAddress.coordinates,
          isServiceable: serverAddress.isServiceable,
          zoneId: serverAddress.zoneId,
          // Compute legacy fields
          name: addressData.contactName,
          phone: addressData.contactPhone,
          address: `${serverAddress.addressLine1}, ${serverAddress.locality}, ${serverAddress.city}`,
        };

        setAddresses(prevAddresses => {
          const updated = [...prevAddresses, newAddress];
          AsyncStorage.setItem('addresses', JSON.stringify(updated));
          return updated;
        });

        // Set as selected address
        setSelectedAddressId(serverAddress._id);

        return serverAddress._id;
      }

      throw new Error('Failed to create address on server');
    } catch (error: any) {
      console.error('Error creating address:', error);
      throw error;
    }
  };

  // Update address on server
  const updateAddressOnServer = async (id: string, addressData: Partial<AddressData>) => {
    try {
      const response = await apiService.updateAddress(id, addressData);
      if (response.data?.address) {
        const updatedAddr = serverToLocalAddress(response.data.address);
        setAddresses(prevAddresses => {
          const updated = prevAddresses.map(addr =>
            addr.id === id ? updatedAddr : addr
          );
          AsyncStorage.setItem('addresses', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error: any) {
      console.error('Error updating address:', error);
      throw error;
    }
  };

  // Delete address on server
  const deleteAddressOnServer = async (id: string) => {
    try {
      await apiService.deleteAddress(id);
      setAddresses(prevAddresses => {
        const updated = prevAddresses.filter(addr => addr.id !== id);
        AsyncStorage.setItem('addresses', JSON.stringify(updated));
        return updated;
      });
      // Clear selected if deleted
      if (selectedAddressId === id) {
        setSelectedAddressId(null);
      }
    } catch (error: any) {
      console.error('Error deleting address:', error);
      throw error;
    }
  };

  // Set address as default on server
  const setDefaultAddressOnServer = async (id: string) => {
    console.log('[AddressContext] setDefaultAddressOnServer called with id:', id);
    try {
      // Use PATCH /api/address/:id/default endpoint
      const response = await apiService.setDefaultAddress(id);
      console.log('[AddressContext] setDefaultAddress API response:', JSON.stringify(response));

      // Update local state - set selected as main, others as not main
      setAddresses(prevAddresses => {
        const updated = prevAddresses.map(addr => ({
          ...addr,
          isMain: addr.id === id,
        }));
        console.log('[AddressContext] Updated addresses - new default id:', id);
        AsyncStorage.setItem('addresses', JSON.stringify(updated));
        return updated;
      });

      // Update selected address ID to trigger menu refresh
      console.log('[AddressContext] Setting selectedAddressId to:', id);
      setSelectedAddressId(id);
    } catch (error: any) {
      console.error('[AddressContext] Error setting default address:', error);
      throw error;
    }
  };

  // Request location permission
  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const granted = await locationService.requestLocationPermission();
      return granted;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  };

  // Get current location with full address including pincode
  const getCurrentLocationWithAddress = async (): Promise<LocationResult> => {
    setIsGettingLocation(true);
    try {
      const locationResult = await locationService.getLocationWithAddress();
      setCurrentLocation(locationResult);

      // Store in AsyncStorage for persistence
      await AsyncStorage.setItem('lastKnownLocation', JSON.stringify(locationResult));

      return locationResult;
    } catch (error: any) {
      console.error('Error getting location:', error);
      throw error;
    } finally {
      setIsGettingLocation(false);
    }
  };

  return (
    <AddressContext.Provider
      value={{
        addresses,
        selectedAddressId,
        isCheckingServiceability,
        isLoadingAddresses,
        currentLocation,
        isGettingLocation,
        addAddress,
        updateAddress,
        removeAddress,
        setMainAddress,
        getMainAddress,
        setSelectedAddressId,
        checkServiceability,
        createAddressOnServer,
        fetchAddresses,
        updateAddressOnServer,
        deleteAddressOnServer,
        setDefaultAddressOnServer,
        getCurrentLocationWithAddress,
        requestLocationPermission,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
};

export const useAddress = () => {
  const context = useContext(AddressContext);
  if (!context) {
    throw new Error('useAddress must be used within an AddressProvider');
  }
  return context;
};
