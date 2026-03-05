import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAddress } from '../../context/AddressContext';
import apiService, {
  WeeklySchedule,
  AutoOrderAddressConfig,
  AddonItem,
  extractKitchensFromResponse,
} from '../../services/api.service';
import AddonSelector, { SelectedAddon } from '../../components/AddonSelector';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';
import { MainTabParamList } from '../../types/navigation';
import WeeklyScheduleGrid from '../../components/WeeklyScheduleGrid';
import WeeklyScheduleQuickSets from '../../components/WeeklyScheduleQuickSets';
import ConfirmationModal from '../../components/ConfirmationModal';

type Props = StackScreenProps<MainTabParamList, 'AutoOrderConfig'>;

const AutoOrderConfigScreen: React.FC<Props> = ({ route, navigation }) => {
  const addressId = route.params?.addressId;

  const {
    getConfigForAddress,
    fetchConfigForAddress,
    updateAutoOrderConfig,
    deleteAutoOrderConfig,
    fetchAllAutoOrderConfigs,
    autoOrderConfigs,
  } = useSubscription();

  // Determine edit mode: addressId is passed AND a config exists for it
  const existingConfig = addressId ? getConfigForAddress(addressId) : null;
  const isEditMode = !!existingConfig;
  const { addresses } = useAddress();

  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<AutoOrderAddressConfig | null>(null);

  // Form state
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(addressId || null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(null);
  const [selectedKitchenId, setSelectedKitchenId] = useState<string | null>(null);
  const [selectedKitchenName, setSelectedKitchenName] = useState<string | null>(null);

  // Kitchen auto-resolution state (not shown to user)
  const [kitchensLoading, setKitchensLoading] = useState(false);

  // Address picker state (create mode)
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Feedback modals
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  // Track if changes have been made
  const [hasChanges, setHasChanges] = useState(false);

  // Add-on state
  const [kitchenAddons, setKitchenAddons] = useState<AddonItem[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);

  // Filter addresses that don't already have a config (create mode)
  const existingAddressIds = autoOrderConfigs.map(c => c.addressId);
  const availableAddresses = addresses.filter(a => !existingAddressIds.includes(a.id));

  // Load existing config in edit mode
  useEffect(() => {
    if (isEditMode && existingConfig) {
      setConfig(existingConfig);
      setIsEnabled(existingConfig.enabled);
      setWeeklySchedule(existingConfig.weeklySchedule);
      setSelectedKitchenId(existingConfig.kitchen?._id || null);
      setSelectedKitchenName(existingConfig.kitchen?.name || null);
      // Pre-populate addons from existing config
      if (existingConfig.addons && existingConfig.addons.length > 0) {
        setSelectedAddons(existingConfig.addons.map(a => ({
          addonId: a.addonId,
          name: a.name,
          quantity: a.quantity,
          unitPrice: a.price,
        })));
      }
    }
  }, [isEditMode]);

  // Auto-resolve kitchen when address is selected (not shown to user)
  useEffect(() => {
    if (!selectedAddressId) return;

    const resolveKitchen = async () => {
      setKitchensLoading(true);
      try {
        const response = await apiService.getAddressKitchens(selectedAddressId, 'MEAL_MENU');
        const kitchenList = extractKitchensFromResponse(response);

        // Auto-select Tiffsy kitchen or first available
        if (kitchenList.length > 0) {
          const tiffsyKitchen = kitchenList.find(k => k.type === 'TIFFSY') || kitchenList[0];
          setSelectedKitchenId(tiffsyKitchen._id);
          setSelectedKitchenName(tiffsyKitchen.name);
        }
      } catch (err) {
        console.log('[AutoOrderConfigScreen] Failed to resolve kitchen:', err);
      } finally {
        setKitchensLoading(false);
      }
    };

    resolveKitchen();
  }, [selectedAddressId]);

  // Fetch available add-ons when kitchen is resolved
  useEffect(() => {
    if (!selectedKitchenId) {
      setKitchenAddons([]);
      return;
    }

    const fetchAddons = async () => {
      setAddonsLoading(true);
      try {
        const menuResponse = await apiService.getKitchenMenu(selectedKitchenId, 'MEAL_MENU');
        const { lunch, dinner } = menuResponse.data.mealMenu;
        // Merge lunch + dinner addons, deduplicate by _id
        const allAddons: AddonItem[] = [];
        const seen = new Set<string>();
        const addUnique = (items?: AddonItem[]) => {
          items?.forEach(a => {
            if (!seen.has(a._id)) {
              seen.add(a._id);
              allAddons.push(a);
            }
          });
        };
        addUnique(lunch?.addonIds);
        addUnique(dinner?.addonIds);
        setKitchenAddons(allAddons);

        // In create mode or when address changes, clear selected addons that are no longer available
        if (!isEditMode) {
          setSelectedAddons(prev => prev.filter(sa => allAddons.some(a => a._id === sa.addonId)));
        }
      } catch (err) {
        console.log('[AutoOrderConfigScreen] Failed to fetch addons:', err);
        setKitchenAddons([]);
      } finally {
        setAddonsLoading(false);
      }
    };

    fetchAddons();
  }, [selectedKitchenId]);

  // Initialize default schedule for create mode
  useEffect(() => {
    if (!isEditMode && !weeklySchedule) {
      const defaultSchedule: WeeklySchedule = {};
      const days: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'> = [
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      ];
      days.forEach(day => {
        defaultSchedule[day] = { lunch: true, dinner: true };
      });
      setWeeklySchedule(defaultSchedule);
    }
  }, [isEditMode]);

  // Handle address selection (create mode)
  const handleSelectAddress = (id: string, label: string) => {
    setSelectedAddressId(id);
    setShowAddressPicker(false);
    setHasChanges(true);
  };

  // Handle schedule change
  const handleScheduleChange = (newSchedule: WeeklySchedule) => {
    setWeeklySchedule(newSchedule);
    setHasChanges(true);
  };

  // Handle enabled toggle
  const handleToggleEnabled = (value: boolean) => {
    setIsEnabled(value);
    setHasChanges(true);
  };

  // Add-on handlers
  const handleAddonAdd = useCallback((addon: AddonItem) => {
    setSelectedAddons(prev => {
      const existing = prev.find(a => a.addonId === addon._id);
      if (existing) return prev;
      return [...prev, { addonId: addon._id, name: addon.name, quantity: 1, unitPrice: addon.price }];
    });
    setHasChanges(true);
  }, []);

  const handleAddonRemove = useCallback((addonId: string) => {
    setSelectedAddons(prev => prev.filter(a => a.addonId !== addonId));
    setHasChanges(true);
  }, []);

  const handleAddonQuantityChange = useCallback((addonId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedAddons(prev => prev.filter(a => a.addonId !== addonId));
    } else {
      setSelectedAddons(prev => prev.map(a => a.addonId === addonId ? { ...a, quantity } : a));
    }
    setHasChanges(true);
  }, []);

  // Save config
  const handleSave = async () => {
    if (!selectedAddressId) {
      setModalTitle('Missing Address');
      setModalMessage('Please select a delivery address');
      setShowErrorModal(true);
      return;
    }
    if (!selectedKitchenId) {
      setModalTitle('No Kitchen Available');
      setModalMessage('No kitchen is available for this address. Please try a different address.');
      setShowErrorModal(true);
      return;
    }

    setIsSaving(true);
    try {
      await updateAutoOrderConfig({
        addressId: selectedAddressId,
        enabled: isEnabled,
        kitchenId: selectedKitchenId,
        weeklySchedule: weeklySchedule,
        autoOrderingEnabled: true,
        addons: selectedAddons.length > 0
          ? selectedAddons.map(a => ({ addonId: a.addonId, quantity: a.quantity }))
          : undefined,
      });
      setHasChanges(false);
      setModalTitle('Success');
      setModalMessage(isEditMode ? 'Config updated successfully' : 'Auto-order config created');
      setShowSuccessModal(true);
    } catch (error: any) {
      setModalTitle('Error');
      setModalMessage(error.message || 'Failed to save config');
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!addressId) return;
    setShowDeleteConfirm(false);
    setIsLoading(true);
    try {
      await deleteAutoOrderConfig(addressId);
      navigation.goBack();
    } catch (error: any) {
      setModalTitle('Error');
      setModalMessage(error.message || 'Failed to delete config');
      setShowErrorModal(true);
      setIsLoading(false);
    }
  };

  // Get selected address display info
  const getAddressDisplay = () => {
    if (isEditMode && config) {
      return { line1: config.address.addressLine1, city: config.address.city };
    }
    if (selectedAddressId) {
      const addr = addresses.find(a => a.id === selectedAddressId);
      if (addr) return { line1: addr.addressLine1, city: addr.city };
    }
    return null;
  };

  const addressDisplay = getAddressDisplay();

  // Loading state
  if (isLoading && !config && isEditMode) {
    return (
      <SafeAreaView style={styles.container} className="flex-1 justify-center items-center bg-gray-50">
        <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
        <ActivityIndicator size="large" color="#ff8800" />
        <Text className="mt-4 text-gray-600">Loading config...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container} className="flex-1 bg-white">
      <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
      <SafeAreaView style={{ backgroundColor: '#ff8800' }} edges={['top']} />

      {/* Header */}
      <View
        className="bg-orange-400 px-5 py-4"
        style={{ borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}
      >
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              minWidth: TOUCH_TARGETS.minimum,
              minHeight: TOUCH_TARGETS.minimum,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              source={require('../../assets/icons/backarrow3.png')}
              style={{ width: SPACING.iconLg, height: SPACING.iconLg }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text
            className="font-bold text-white flex-1 text-center"
            style={{ fontSize: FONT_SIZES.h4 }}
            numberOfLines={1}
          >
            {isEditMode ? 'Edit Config' : 'New Config'}
          </Text>
          <View style={{ width: SPACING.iconLg }} />
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-gray-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING['4xl'] * 2, paddingTop: SPACING.lg }}
      >
        {/* Address Section */}
        <View className="mx-4 mb-4">
          <View className="flex-row items-center mb-3">
            <View className="w-2 h-6 bg-orange-400 rounded-full mr-3" />
            <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>
              Delivery Address
            </Text>
          </View>

          {isEditMode ? (
            /* Read-only in edit mode */
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <MaterialCommunityIcons name="map-marker" size={24} color="#ff8800" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827' }} numberOfLines={1}>
                  {addressDisplay?.line1 || 'Unknown'}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                  {addressDisplay?.city || ''}
                </Text>
              </View>
            </View>
          ) : (
            /* Address picker in create mode */
            <TouchableOpacity
              onPress={() => setShowAddressPicker(true)}
              activeOpacity={0.7}
              style={{
                backgroundColor: addressDisplay ? 'white' : '#FFF7ED',
                borderRadius: 16,
                padding: 16,
                borderWidth: addressDisplay ? 1 : 2,
                borderStyle: addressDisplay ? 'solid' : 'dashed',
                borderColor: addressDisplay ? '#E5E7EB' : '#FED7AA',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <MaterialCommunityIcons name={addressDisplay ? 'map-marker' : 'map-marker-plus-outline'} size={24} color="#ff8800" />
              </View>
              <View style={{ flex: 1 }}>
                {addressDisplay ? (
                  <>
                    <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827' }} numberOfLines={1}>
                      {addressDisplay.line1}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                      {addressDisplay.city}
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '600', color: '#ff8800' }}>
                    Select Delivery Address
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 20, color: '#9CA3AF' }}>›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Enabled Toggle */}
        {selectedAddressId && (
          <View className="mx-4 mb-4">
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827' }}>
                  Auto-Order Enabled
                </Text>
                <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: 2 }}>
                  {isEnabled ? 'Orders will be placed automatically' : 'Auto-ordering is off for this address'}
                </Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={handleToggleEnabled}
                trackColor={{ false: '#E5E7EB', true: '#ff880060' }}
                thumbColor={isEnabled ? '#ff8800' : '#f4f3f4'}
              />
            </View>
          </View>
        )}

        {/* Weekly Schedule Section */}
        {selectedAddressId && !kitchensLoading && (
          <View className="mx-4 mb-4" style={{ opacity: isEnabled ? 1 : 0.4 }} pointerEvents={isEnabled ? 'auto' : 'none'}>
            <View className="flex-row items-center mb-3">
              <View className="w-2 h-6 bg-orange-400 rounded-full mr-3" />
              <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>
                Weekly Schedule
              </Text>
            </View>

            <Text className="text-sm text-gray-600 mb-4 pl-1" numberOfLines={3}>
              Customize which days and meals to auto-order
            </Text>

            <WeeklyScheduleQuickSets
              onSelectPattern={handleScheduleChange}
              disabled={isSaving || !isEnabled}
            />

            <WeeklyScheduleGrid
              schedule={weeklySchedule}
              onChange={handleScheduleChange}
              disabled={isSaving || !isEnabled}
            />
          </View>
        )}

        {/* Meal Add-ons Section */}
        {selectedAddressId && selectedKitchenId && !kitchensLoading && (
          <View className="mx-4 mb-4" style={{ opacity: isEnabled ? 1 : 0.4 }} pointerEvents={isEnabled ? 'auto' : 'none'}>
            <View className="flex-row items-center mb-3">
              <View className="w-2 h-6 bg-orange-400 rounded-full mr-3" />
              <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>
                Meal Add-ons
              </Text>
            </View>

            <Text className="text-sm text-gray-600 mb-3 pl-1" numberOfLines={2}>
              These add-ons will be included with every auto-order
            </Text>

            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              <AddonSelector
                availableAddons={kitchenAddons}
                selectedAddons={selectedAddons}
                onAdd={handleAddonAdd}
                onRemove={handleAddonRemove}
                onQuantityChange={handleAddonQuantityChange}
                loading={addonsLoading}
                title="Add-ons for every order"
              />
            </View>
          </View>
        )}

        {/* Quick Actions (edit mode only) */}
        {isEditMode && config && (
          <View className="mx-4 mb-4" style={{ opacity: isEnabled ? 1 : 0.4 }} pointerEvents={isEnabled ? 'auto' : 'none'}>
            <View className="flex-row items-center mb-3">
              <View className="w-2 h-6 bg-orange-400 rounded-full mr-3" />
              <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>
                Quick Actions
              </Text>
            </View>

            {/* Skip Meals */}
            <TouchableOpacity
              onPress={() => navigation.navigate('MealCalendar')}
              activeOpacity={0.7}
              style={{ marginBottom: 12 }}
            >
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: '#3B82F6',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <MaterialCommunityIcons name="calendar-remove" size={24} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827' }}>
                    Skip Meals
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>
                    Skip specific days when needed
                  </Text>
                </View>
                <Text style={{ fontSize: 20, color: '#3B82F6' }}>›</Text>
              </View>
            </TouchableOpacity>

            {/* Delete Config */}
            <TouchableOpacity
              onPress={() => setShowDeleteConfirm(true)}
              activeOpacity={0.7}
            >
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: '#FCA5A5',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <MaterialCommunityIcons name="delete-outline" size={24} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#EF4444' }}>
                    Delete Config
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>
                    Remove auto-ordering for this address
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Save Button */}
        {selectedAddressId && !kitchensLoading && (
          <View className="mx-4 mb-4">
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving || (!hasChanges && isEditMode)}
              activeOpacity={0.7}
              style={{
                backgroundColor: (isSaving || (!hasChanges && isEditMode)) ? '#D1D5DB' : '#ff8800',
                borderRadius: 25,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: 'white' }}>
                  {isEditMode ? 'Save Changes' : 'Create Config'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Address Picker Modal (create mode) */}
      <Modal visible={showAddressPicker} transparent animationType="fade" onRequestClose={() => setShowAddressPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddressPicker(false)}>
          <Pressable style={styles.sheetContainer} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetContent}>
              <Text style={styles.sheetTitle}>Select Address</Text>
              {availableAddresses.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <Text style={{ fontSize: FONT_SIZES.base, color: '#6B7280', textAlign: 'center' }}>
                    All your addresses already have auto-order configs.
                  </Text>
                  <TouchableOpacity
                    onPress={() => { setShowAddressPicker(false); navigation.navigate('Address'); }}
                    style={{ marginTop: 16 }}
                  >
                    <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '600', color: '#ff8800' }}>
                      Add New Address
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  {availableAddresses.map(addr => (
                    <TouchableOpacity
                      key={addr.id}
                      onPress={() => handleSelectAddress(addr.id, addr.label || addr.addressLine1)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F3F4F6',
                        backgroundColor: selectedAddressId === addr.id ? '#FFF7ED' : 'transparent',
                      }}
                    >
                      <MaterialCommunityIcons name="map-marker-outline" size={24} color="#ff8800" style={{ marginRight: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
                          {addr.label || addr.addressLine1}
                        </Text>
                        <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                          {addr.addressLine1}, {addr.city}
                        </Text>
                      </View>
                      {selectedAddressId === addr.id && (
                        <MaterialCommunityIcons name="check-circle" size={24} color="#ff8800" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        visible={showDeleteConfirm}
        title="Delete Auto-Order Config"
        message="Are you sure you want to remove auto-ordering for this address? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmStyle="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Loading Overlay */}
      {(isLoading || isSaving) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff8800" />
            <Text style={styles.loadingText}>{isSaving ? 'Saving...' : 'Loading...'}</Text>
          </View>
        </View>
      )}

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSuccessModal(false)}>
          <Pressable style={styles.modalContainer} onPress={e => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Text style={styles.modalMessage}>{modalMessage}</Text>
              <TouchableOpacity onPress={() => { setShowSuccessModal(false); if (!isEditMode) navigation.goBack(); }} style={styles.modalButton}>
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Error Modal */}
      <Modal visible={showErrorModal} transparent animationType="fade" onRequestClose={() => setShowErrorModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowErrorModal(false)}>
          <Pressable style={styles.modalContainer} onPress={e => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Text style={styles.modalMessage}>{modalMessage}</Text>
              <TouchableOpacity onPress={() => setShowErrorModal(false)} style={[styles.modalButton, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: FONT_SIZES.h3,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: FONT_SIZES.base,
    color: '#6B7280',
    marginBottom: SPACING.xl,
    textAlign: 'center',
    lineHeight: FONT_SIZES.base * 1.4,
  },
  modalButton: {
    backgroundColor: '#ff8800',
    minHeight: TOUCH_TARGETS.comfortable,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  modalButtonText: {
    fontSize: FONT_SIZES.base,
    fontWeight: 'bold',
    color: 'white',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 400,
  },
  sheetContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  sheetTitle: {
    fontSize: FONT_SIZES.h4,
    fontWeight: 'bold',
    color: '#111827',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: 'white',
    borderRadius: SPACING.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.base,
    color: '#6B7280',
  },
});

export default AutoOrderConfigScreen;
