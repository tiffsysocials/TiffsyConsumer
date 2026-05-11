// src/screens/home/HomeScreen.tsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ImageSourcePropType,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainTabParamList } from '../../types/navigation';
import { useCart } from '../../context/CartContext';
import { useAddress } from '../../context/AddressContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useNotifications } from '../../context/NotificationContext';
import { useBanners } from '../../context/BannerContext';
import { useUser } from '../../context/UserContext';
import BannerSliderWidget from '../../components/BannerSliderWidget';
import apiService, { KitchenInfo, MenuItem, AddonItem, Order, extractKitchensFromResponse } from '../../services/api.service';
import dataPreloader from '../../services/dataPreloader.service';
import MealWindowModal from '../../components/MealWindowModal';
import ActiveOrderBanner from '../../components/ActiveOrderBanner';
import ConfirmationModal from '../../components/ConfirmationModal';
import {
  getTodaysActiveBasicOrders,
  getActiveOrderBannerContent,
} from '../../utils/todaysOrdersBanner';
import { getMealWindowInfo as getWindowInfo, isMealWindowAvailable } from '../../utils/timeUtils';
import {
  SlotCutoffState,
  SlotState,
  mapCutoffState,
  getSlotState,
  describeNextTransition,
  nextTransitionAt,
  isInScheduleWindow,
  parseTimeToMinutes,
} from '../../utils/mealCutoff';
import NotificationBell from '../../components/NotificationBell';
import { useResponsive, useScaling } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { FONT_SIZES } from '../../constants/typography';
import VoucherPaymentModal from '../../components/VoucherPaymentModal';
import LinearGradient from 'react-native-linear-gradient';
import { useTourTarget } from '../../components/CustomerTour/useTourTarget';

type Props = StackScreenProps<MainTabParamList, 'Home'>;

type MealType = 'lunch' | 'dinner';

interface AddOn {
  id: string;
  name: string;
  image: ImageSourcePropType;
  quantity: string;
  price: number;
  selected: boolean;
  count: number;
}

interface MenuData {
  lunch?: MenuItem;
  dinner?: MenuItem;
  onDemandMenu: MenuItem[];
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const {
    cartItems,
    replaceCart,
    removeItem,
    updateQuantity: updateCartItemQuantity,
    setKitchenId,
    setMenuType,
    setMealWindow,
    setDeliveryAddressId,
    setVoucherCount,
  } = useCart();
  const { getMainAddress, selectedAddressId, addresses, currentLocation, isGettingLocation } = useAddress();
  const { usableVouchers, subscriptions, fetchSubscriptions, fetchVouchers, autoOrderConfigs } = useSubscription();
  const { fetchUnreadCount, fetchNotifications } = useNotifications();
  const { isGuest, exitGuestMode } = useUser();
  const { banners, isLoading: isBannersLoading, loadBanners } = useBanners();
  const insets = useSafeAreaInsets();
  const { width, isSmallDevice } = useResponsive();
  const { scale } = useScaling();
  const locationTourTarget = useTourTarget('location');
  const vouchersTourTarget = useTourTarget('vouchers');
  const planAheadTourTarget = useTourTarget('planAhead');
  const autoOrdersTourTarget = useTourTarget('autoOrders');
  const addToCartTourTarget = useTourTarget('addToCart');
  const [selectedMeal, setSelectedMeal] = useState<MealType>(() => {
    const now = new Date();
    const totalMin = now.getHours() * 60 + now.getMinutes();
    return totalMin >= 11 * 60 && totalMin < 21 * 60 ? 'dinner' : 'lunch';
  });
  const [showCartModal, setShowCartModal] = useState(false);
  const [bottomOverlayHeight, setBottomOverlayHeight] = useState(0);
  // Reset overlay measurement when no overlay is mounted, so the scroll spacer
  // doesn't keep stale padding after the popup/banner closes.
  useEffect(() => {
    const overlayShown = showCartModal || (!!activeOrderBanner && cartItems.length === 0);
    if (!overlayShown && bottomOverlayHeight !== 0) {
      setBottomOverlayHeight(0);
    }
  });
  const [mealQuantity, setMealQuantity] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [addOnsExpanded, setAddOnsExpanded] = useState(false);
  const [includesExpanded, setIncludesExpanded] = useState(false);

  // Menu state
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [currentKitchen, setCurrentKitchen] = useState<KitchenInfo | null>(null);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [requiresAddress, setRequiresAddress] = useState(false);

  // Dynamic add-ons from API
  const [addOns, setAddOns] = useState<AddOn[]>([]);

  // Meal window modal state
  const [showMealWindowModal, setShowMealWindowModal] = useState(false);
  // Focus counter to recalculate meal window on screen focus
  const [focusCount, setFocusCount] = useState(0);

  // Auto-order notification state
  const [showAutoOrderNotification, setShowAutoOrderNotification] = useState(false);
  const [autoOrderTextIndex, setAutoOrderTextIndex] = useState(0);
  const autoOrderSlideAnim = useRef(new Animated.Value(0)).current;

  // Today's active basic orders — drives the "Your lunch/dinner is coming" banner
  const [todaysActiveOrders, setTodaysActiveOrders] = useState<Order[]>([]);

  // Login prompt for guests trying to add to cart or buy now
  const [showGuestLoginPrompt, setShowGuestLoginPrompt] = useState(false);

  // Background data preload tracking
  const hasPreloadedRef = useRef(false);

  // Buy Now flow state
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [isBuyNowFlow, setIsBuyNowFlow] = useState(false);

  // Load banners on mount
  useEffect(() => {
    loadBanners();
  }, []);

  // Note: We no longer use fallback addons with fake IDs as they cause API validation errors
  // Addons must come from the API with valid MongoDB ObjectIds
  // If no addons are returned from API, we show an empty list

  // Three-state meal window info — drives banner, voucher chip, Buy Now flow, and tab auto-switch.
  // Source of truth: backend `canOrder` + `canUseVoucher` + `voucherCutoffTime` + `orderCutoffTime`
  // (see api.service.ts MenuItem). Mapped via shared util at src/utils/mealCutoff.ts.
  const mealWindowInfo = useMemo(() => {
    const lunchCutoff = mapCutoffState(menuData?.lunch);
    const dinnerCutoff = mapCutoffState(menuData?.dinner);
    const lunchState = getSlotState(lunchCutoff);
    const dinnerState = getSlotState(dinnerCutoff);

    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    // A meal whose orderCutoffTime (or voucherCutoffTime) is still in the future will become
    // orderable later today even if `canOrder=false` right now (e.g. dinner before its window
    // opens). Distinguish this "upcoming" state from a meal that has truly ended for the day.
    const hasFutureCutoff = (cutoff: typeof lunchCutoff): boolean => {
      const v = parseTimeToMinutes(cutoff.voucherCutoffTime);
      const o = parseTimeToMinutes(cutoff.orderCutoffTime);
      return (v !== null && v > currentMin) || (o !== null && o > currentMin);
    };
    const lunchUpcoming = lunchState === 'closed' && hasFutureCutoff(lunchCutoff);
    const dinnerUpcoming = dinnerState === 'closed' && hasFutureCutoff(dinnerCutoff);

    // Pick active meal: prefer orderable; if both closed, prefer the upcoming one so the
    // user lands on the meal that's about to open rather than seeing yesterday's stale tab.
    let activeMeal: MealType = 'lunch';
    if (lunchState !== 'closed' && dinnerState !== 'closed') {
      activeMeal = currentMin < 11 * 60 ? 'lunch' : 'dinner';
    } else if (lunchState !== 'closed') {
      activeMeal = 'lunch';
    } else if (dinnerState !== 'closed') {
      activeMeal = 'dinner';
    } else if (dinnerUpcoming) {
      activeMeal = 'dinner';
    } else if (lunchUpcoming) {
      activeMeal = 'lunch';
    }

    const isAllClosed = lunchState === 'closed' && dinnerState === 'closed';
    // Truly done for the day: both meals closed AND neither has a future cutoff.
    // Drives the "Today's orders are closed → Schedule for Tomorrow" modal.
    const isAllClosedForToday = isAllClosed && !lunchUpcoming && !dinnerUpcoming;
    const nextMealWindow: MealType =
      lunchState === 'closed' && dinnerState !== 'closed' ? 'dinner' : 'lunch';
    const { label: nextMealWindowTime } = describeNextTransition(lunchCutoff, dinnerCutoff, now);

    return {
      lunchCutoff,
      dinnerCutoff,
      lunchState,
      dinnerState,
      activeMeal,
      nextMealWindow,
      nextMealWindowTime,
      isAllClosed,
      isAllClosedForToday,
      lunchUpcoming,
      dinnerUpcoming,
      isInScheduleWindow: isInScheduleWindow(now),
      // Legacy field retained for any remaining call sites — true if at least one meal is orderable.
      isWindowOpen: !isAllClosed,
    };
  }, [menuData, focusCount]);

  // Convenience: state of currently selected meal — used across banner / Buy Now / voucher chip.
  const currentMealState: SlotState =
    selectedMeal === 'lunch' ? mealWindowInfo.lunchState : mealWindowInfo.dinnerState;


  // Tracks whether the user has explicitly dismissed the all-closed modal during the
  // current all-closed cycle. Once dismissed, the auto-open effect must not reopen the
  // modal even if it re-runs (which it does frequently: focusCount bumps from focus /
  // setTimeout / AppState 'active' each give mealWindowInfo a new reference). Resets when
  // the day reopens.
  const wasAllClosedRef = useRef(false);
  const userDismissedClosedModalRef = useRef(false);

  // Show MealWindowModal only when both meals are closed.
  // cash_only does NOT trigger a tab switch — the banner + Buy Now branching handle that case.
  // Gate on menuData — pre-fetch, the memo treats null menu as 'closed' which would falsely
  // pop the modal before the menu has loaded. Also skip if kitchen has no menu at all
  // (the "No Meal Available" panel handles that case).
  useEffect(() => {
    if (!menuData) {
      setShowMealWindowModal(false);
      wasAllClosedRef.current = false;
      userDismissedClosedModalRef.current = false;
      return;
    }
    const hasAnyMealItem = !!(menuData.lunch || menuData.dinner);
    const shouldShowClosedModal = hasAnyMealItem && mealWindowInfo.isAllClosedForToday;
    if (shouldShowClosedModal && !wasAllClosedRef.current && !userDismissedClosedModalRef.current) {
      // Transitioned from open → all-closed — auto-open the modal once.
      setShowMealWindowModal(true);
    } else if (!shouldShowClosedModal) {
      // Back to open (or no menu items) — close the modal and reset for the next closure.
      setShowMealWindowModal(false);
      userDismissedClosedModalRef.current = false;
    }
    wasAllClosedRef.current = shouldShowClosedModal;
  }, [mealWindowInfo, menuData]);

  // Sync selectedMeal with the computed activeMeal. Kept in its own effect so it doesn't
  // cause the all-closed modal effect above to re-render on every recompute.
  useEffect(() => {
    if (!menuData) return;
    setSelectedMeal(prev => (prev === mealWindowInfo.activeMeal ? prev : mealWindowInfo.activeMeal));
  }, [mealWindowInfo.activeMeal, menuData]);

  // Schedule a setTimeout to the next state transition (cutoff or midnight rollover).
  // This drives auto-flip without burning battery on a 1-minute interval.
  useEffect(() => {
    if (!menuData) return;
    const fireAt = nextTransitionAt(mealWindowInfo.lunchCutoff, mealWindowInfo.dinnerCutoff);
    const ms = Math.max(1000, fireAt.getTime() - Date.now());
    const id = setTimeout(() => {
      setFocusCount(c => c + 1);
      fetchMenu();
    }, ms);
    return () => clearTimeout(id);
  }, [menuData, mealWindowInfo]);

  // AppState backstop — RN throttles timers in background, so refresh on resume.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        setFocusCount(c => c + 1);
        fetchMenu();
      }
    });
    return () => sub.remove();
  }, []);

  // Handle modal close - switch to the next meal window tab. Wrapped in useCallback so the
  // Modal receives a stable onClose reference across re-renders (prevents the TouchableOpacity
  // from missing presses while the parent re-renders from focusCount / AppState churn).
  const handleMealWindowModalClose = useCallback(() => {
    userDismissedClosedModalRef.current = true;
    setShowMealWindowModal(false);
    setSelectedMeal(mealWindowInfo.nextMealWindow);
  }, [mealWindowInfo.nextMealWindow]);

  // Fetch menu using new flow: address → kitchens → menu
  const fetchMenu = async () => {
    console.log('[HomeScreen] === FETCH MENU STARTED ===');
    setIsLoadingMenu(true);
    setMenuError(null);
    setRequiresAddress(false);

    try {
      const mainAddress = getMainAddress();
      const addressId = selectedAddressId || mainAddress?.id;
      const activeAddress = addressId ? addresses.find(addr => addr.id === addressId) : null;

      console.log('[HomeScreen] Address info:', {
        mainAddress: mainAddress ? { id: mainAddress.id, locality: mainAddress.locality } : null,
        selectedAddressId,
        finalAddressId: addressId,
        currentLocation: currentLocation ? { pincode: currentLocation.pincode } : null,
      });

      if (activeAddress?.isServiceable === false) {
        setCurrentKitchen(null);
        setKitchenId(null);
        setDeliveryAddressId(addressId || null);
        setMenuError('No kitchen available in your address.');
        setAddOns([]);
        setIsLoadingMenu(false);
        return;
      }

      let kitchensResponse;

      // If no address but location is available, use pincode to get kitchens
      if (!addressId && currentLocation?.pincode) {
        console.log('[HomeScreen] No address, using location pincode:', currentLocation.pincode);

        try {
          // Step 1a: Get zone by pincode
          console.log('[HomeScreen] Calling getZoneByPincode...');
          const zoneResponse = await apiService.getZoneByPincode(currentLocation.pincode);
          console.log('[HomeScreen] Zone response:', JSON.stringify(zoneResponse, null, 2));

          if (!zoneResponse.data) {
            setMenuError('No kitchens available for your location. Please add a delivery address.');
            setRequiresAddress(true);
            setIsLoadingMenu(false);
            return;
          }

          // Access zone data - handle both nested and flat response structures
          const zoneData = (zoneResponse.data as any).zone || zoneResponse.data;
          const zoneId = zoneData._id;

          if (!zoneId) {
            setMenuError('No kitchens available for your location. Please add a delivery address.');
            setRequiresAddress(true);
            setIsLoadingMenu(false);
            return;
          }

          console.log('[HomeScreen] Zone found:', zoneId);

          // Step 1b: Get kitchens for the zone
          console.log('[HomeScreen] Calling getKitchensForZone...');
          kitchensResponse = await apiService.getKitchensForZone(zoneId, 'MEAL_MENU');
        } catch (error: any) {
          console.error('[HomeScreen] Error in zone/kitchen lookup:', error);
          throw error;
        }
      } else if (!addressId) {
        // If no address and no location, user needs to add one
        setRequiresAddress(true);
        setIsLoadingMenu(false);
        return;
      } else {
        // Step 1: Get kitchens for the address
        console.log('[HomeScreen] Calling getAddressKitchens with addressId:', addressId);
        try {
          kitchensResponse = await apiService.getAddressKitchens(addressId, 'MEAL_MENU');
        } catch (error: any) {
          console.error('[HomeScreen] Error in getAddressKitchens:', error);
          throw error;
        }
      }

      console.log('[HomeScreen] Raw kitchens response:', JSON.stringify(kitchensResponse, null, 2));

      // Extract kitchens using helper function (handles both old and new formats)
      let allKitchens = extractKitchensFromResponse(kitchensResponse);

      // Backend filters kitchens by current operating window when menuType is passed.
      // If empty, retry without the filter so a kitchen whose windows have ended for the day
      // is still surfaced — the three-state cutoff UI then renders "Ordering closed for today /
      // Schedule for tomorrow" instead of a misleading "No kitchen available" error.
      if (!allKitchens.length) {
        console.log('[HomeScreen] No kitchens with active window — retrying without menuType filter');
        try {
          if (!addressId && currentLocation?.pincode) {
            const zoneResp = await apiService.getZoneByPincode(currentLocation.pincode);
            const zoneData2: any = (zoneResp.data as any)?.zone || zoneResp.data;
            const zoneId2 = zoneData2?._id;
            if (zoneId2) {
              kitchensResponse = await apiService.getKitchensForZone(zoneId2);
            }
          } else if (addressId) {
            kitchensResponse = await apiService.getAddressKitchens(addressId);
          }
          allKitchens = extractKitchensFromResponse(kitchensResponse);
          console.log('[HomeScreen] Fallback kitchens count:', allKitchens.length);
        } catch (err) {
          console.warn('[HomeScreen] Kitchen fallback lookup failed:', err);
        }
      }

      console.log('[HomeScreen] Extracted kitchens count:', allKitchens.length);
      console.log('[HomeScreen] First kitchen full data:', JSON.stringify(allKitchens[0], null, 2));

      if (!allKitchens.length) {
        setMenuError(addressId ? 'No kitchen available in your address.' : 'No kitchens available for your location.');
        setIsLoadingMenu(false);
        return;
      }

      console.log('[HomeScreen] Available kitchens:', allKitchens.map(k => ({
        name: k.name,
        type: k.type,
        _id: k._id,
        hasOperatingHours: !!k.operatingHours,
        lunchAvailable: !!k.operatingHours?.lunch,
        dinnerAvailable: !!k.operatingHours?.dinner,
      })));

      // Select the best kitchen based on:
      // 1. TIFFSY type preferred
      // 2. Has operating hours for current meal window
      // 3. Is accepting orders
      const now = new Date();
      const tifsyKitchens = allKitchens.filter(k => k.type === 'TIFFSY');
      const acceptingKitchens = allKitchens.filter(k => k.isAcceptingOrders !== false);

      let selectedKitchen: KitchenInfo | undefined;

      // Try to find TIFFSY kitchen with active meal window
      if (tifsyKitchens.length > 0) {
        selectedKitchen = tifsyKitchens.find(k => {
          if (!k.operatingHours) return true; // If no hours defined, assume available
          const info = getWindowInfo(k.operatingHours, now);
          return info.isWindowOpen;
        }) || tifsyKitchens[0]; // Fallback to first TIFFSY kitchen
      }

      // If no TIFFSY kitchen, try accepting kitchens with active window
      if (!selectedKitchen && acceptingKitchens.length > 0) {
        selectedKitchen = acceptingKitchens.find(k => {
          if (!k.operatingHours) return true;
          const info = getWindowInfo(k.operatingHours, now);
          return info.isWindowOpen;
        }) || acceptingKitchens[0];
      }

      // Last resort: pick any kitchen
      if (!selectedKitchen) {
        selectedKitchen = allKitchens[0];
      }

      console.log('[HomeScreen] Selected kitchen:', {
        name: selectedKitchen?.name,
        type: selectedKitchen?.type,
        operatingHours: selectedKitchen?.operatingHours,
      });

      setCurrentKitchen(selectedKitchen);
      // Set kitchen in cart context
      setKitchenId(selectedKitchen._id);
      // Set delivery address in cart context
      setDeliveryAddressId(addressId || null);

      // Step 2: Get menu for the kitchen
      console.log('[HomeScreen] Calling getKitchenMenu for kitchen:', selectedKitchen._id);
      let menuResponse;
      try {
        menuResponse = await apiService.getKitchenMenu(selectedKitchen._id, 'MEAL_MENU');
        console.log('[HomeScreen] Menu response:', JSON.stringify(menuResponse, null, 2));
      } catch (error: any) {
        console.error('[HomeScreen] Error in getKitchenMenu:', error);
        throw error;
      }

      if (menuResponse.data) {
        const { lunch, dinner } = menuResponse.data.mealMenu;
        console.log('[HomeScreen] Menu received - lunch:', lunch?._id || 'null', 'dinner:', dinner?._id || 'null');

        // Warn if menu items are null (kitchen may not have menu configured)
        if (!lunch && !dinner) {
          console.warn('[HomeScreen] Kitchen has no menu items configured!');
        }

        setMenuData({
          lunch: lunch,
          dinner: dinner,
          onDemandMenu: menuResponse.data.onDemandMenu || [],
        });

        // The mealWindowInfo memo + the sync useEffect handle tab auto-switch on the next
        // render. Compute the effective meal here only so the addon list matches what the
        // user will see, without waiting for that state update.
        const lunchSlotState = getSlotState(mapCutoffState(lunch));
        const dinnerSlotState = getSlotState(mapCutoffState(dinner));
        const effectiveMeal: MealType =
          selectedMeal === 'lunch' && lunchSlotState === 'closed' && dinnerSlotState !== 'closed'
            ? 'dinner'
            : selectedMeal === 'dinner' && dinnerSlotState === 'closed' && lunchSlotState !== 'closed'
              ? 'lunch'
              : selectedMeal;

        const currentMealItem = effectiveMeal === 'lunch' ? lunch : dinner;

        if (currentMealItem?.addonIds && currentMealItem.addonIds.length > 0) {
          console.log('[HomeScreen] Addons found:', currentMealItem.addonIds.length);
          const apiAddons: AddOn[] = currentMealItem.addonIds.map((addon: AddonItem) => ({
            id: addon._id,
            name: addon.name,
            image: require('../../assets/images/homepage/roti.png'), // Default image
            quantity: addon.description || '1 serving',
            price: addon.price,
            selected: false,
            count: 0,
          }));
          setAddOns(apiAddons);
        } else {
          console.log('[HomeScreen] No addons available for this meal');
          setAddOns([]);
        }
      }
    } catch (error: any) {
      console.error('[HomeScreen] Error fetching menu:', error);
      console.error('[HomeScreen] Error type:', typeof error);
      console.error('[HomeScreen] Error details:', {
        message: error.message,
        data: error.data,
        response: error.response?.data,
        stack: error.stack,
      });

      // Extract meaningful error message
      let errorMessage = 'Failed to load menu';

      // Handle different error formats
      if (error.data?.message) {
        errorMessage = error.data.message;
      } else if (error.message === 'Network Error') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message === 'timeout of 10000ms exceeded') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.log('[HomeScreen] Final error message:', errorMessage);
      setMenuError(errorMessage);
      setAddOns([]);
    } finally {
      setIsLoadingMenu(false);
    }
  };

  // Fetch menu on mount and when address changes
  useEffect(() => {
    console.log('[HomeScreen] useEffect triggered - selectedAddressId:', selectedAddressId, 'addresses.length:', addresses.length);
    fetchMenu();
  }, [selectedAddressId, addresses.length]);

  // Also refetch menu when screen comes into focus (e.g., returning from AddressScreen)
  useFocusEffect(
    useCallback(() => {
      console.log('[HomeScreen] useFocusEffect triggered - refetching menu');
      // Recalculate correct meal tab based on current time
      const now = new Date();
      const totalMin = now.getHours() * 60 + now.getMinutes();
      const timeMeal: MealType = totalMin >= 11 * 60 && totalMin < 21 * 60 ? 'dinner' : 'lunch';
      setSelectedMeal(timeMeal);
      // Increment focus counter to recalculate mealWindowInfo
      setFocusCount(c => c + 1);
      fetchMenu();
    }, [selectedAddressId])
  );

  // Check for auto-ordering status and show notification
  useFocusEffect(
    useCallback(() => {
      if (autoOrderConfigs.some(c => c.enabled)) {
        setShowAutoOrderNotification(true);
      } else {
        setShowAutoOrderNotification(false);
      }
    }, [autoOrderConfigs])
  );

  // Load today's active orders (cache-first) for the "Your meal is coming" banner
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadTodaysOrders = async () => {
        try {
          const cached = dataPreloader.getCachedOrders();
          if (cached && !dataPreloader.isCacheExpired('orders')) {
            if (!cancelled) setTodaysActiveOrders(getTodaysActiveBasicOrders(cached));
            return;
          }
          const response = await apiService.getMyOrders({ limit: 20 });
          const data = response.data;
          if (!cancelled && response.success && data && typeof data !== 'string' && data.orders) {
            setTodaysActiveOrders(getTodaysActiveBasicOrders(data.orders));
          }
        } catch (err) {
          console.warn('[HomeScreen] Failed to load orders for active-order banner:', err);
        }
      };
      loadTodaysOrders();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const activeOrderBanner = useMemo(
    () => getActiveOrderBannerContent(todaysActiveOrders),
    [todaysActiveOrders],
  );

  // Cycling text animation for auto-order enabled banner
  const hasActiveAutoOrder = useMemo(() =>
    autoOrderConfigs.some(c => c.enabled),
    [autoOrderConfigs]
  );

  useEffect(() => {
    if (!hasActiveAutoOrder) return;

    const interval = setInterval(() => {
      // Animate current text up (out)
      Animated.timing(autoOrderSlideAnim, {
        toValue: -1,
        duration: 350,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        // Switch text index
        setAutoOrderTextIndex(prev => (prev + 1) % 2);
        // Reset position to below (ready to enter from bottom)
        autoOrderSlideAnim.setValue(1);
        // Animate new text up (in)
        Animated.timing(autoOrderSlideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [hasActiveAutoOrder, autoOrderSlideAnim]);

  // Background data preload - triggers after menu loads successfully
  useFocusEffect(
    useCallback(() => {
      // Only trigger preload once per app session
      // Only when menu data has finished loading (no error, not loading)
      if (!hasPreloadedRef.current && !isLoadingMenu && !menuError && menuData) {
        console.log('[HomeScreen] 🚀 Starting background data preload');
        hasPreloadedRef.current = true;

        // Start background preload (non-blocking)
        // Pass context methods for preloader to call
        dataPreloader
          .startBackgroundPreload(
            { fetchSubscriptions, fetchVouchers },
            { fetchUnreadCount, fetchNotifications }
          )
          .catch(error => {
            console.warn('[HomeScreen] ⚠️ Background preload failed (non-critical):', error);
            // Don't show error to user - screens will fall back to on-demand fetch
          });
      }
    }, [isLoadingMenu, menuError, menuData, fetchSubscriptions, fetchVouchers, fetchUnreadCount, fetchNotifications])
  );

  // Sync local state with cart when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!menuData) return;

      const currentMealItem = selectedMeal === 'lunch' ? menuData.lunch : menuData.dinner;
      if (!currentMealItem?._id) return;

      // Find cart item for current meal
      const cartItem = cartItems.find(item => item.id === currentMealItem._id);

      if (cartItem) {
        console.log('[HomeScreen] Syncing local state with cart:', {
          quantity: cartItem.quantity,
          addons: cartItem.addons?.length || 0,
        });

        // Restore meal quantity from cart
        setMealQuantity(cartItem.quantity);

        // Restore addon selections and quantities from cart
        if (currentMealItem.addonIds && currentMealItem.addonIds.length > 0) {
          const restoredAddons = currentMealItem.addonIds.map((addon: AddonItem) => {
            // Check if this addon is in the cart
            const cartAddon = cartItem.addons?.find(a => a.addonId === addon._id);
            return {
              id: addon._id,
              name: addon.name,
              image: require('../../assets/images/homepage/roti.png'),
              quantity: addon.description || '1 serving',
              price: addon.price,
              selected: !!cartAddon,
              count: cartAddon?.quantity || 0,
            };
          });
          setAddOns(restoredAddons);
        }

        // Show cart modal if there are items
        setShowCartModal(true);
      } else {
        // No cart item - reset to defaults
        setMealQuantity(1);
        setShowCartModal(false);

        // Reset addons to unselected state with count 0
        if (currentMealItem.addonIds && currentMealItem.addonIds.length > 0) {
          const defaultAddons = currentMealItem.addonIds.map((addon: AddonItem) => ({
            id: addon._id,
            name: addon.name,
            image: require('../../assets/images/homepage/roti.png'),
            quantity: addon.description || '1 serving',
            price: addon.price,
            selected: false,
            count: 0,
          }));
          setAddOns(defaultAddons);
        }
      }
    }, [cartItems, selectedMeal, menuData])
  );

  // Resume Buy Now flow after address setup
  useFocusEffect(
    useCallback(() => {
      if (isBuyNowFlow) {
        setIsBuyNowFlow(false);

        // Check if address was added
        const mainAddress = getMainAddress();
        if (mainAddress) {
          console.log('[HomeScreen] Address added, resuming Buy Now flow');
          // Resume Buy Now flow
          handleBuyNow();
        } else {
          console.log('[HomeScreen] No address added, cancelling Buy Now flow');
        }
      }
    }, [isBuyNowFlow, getMainAddress, handleBuyNow])
  );

  // Update addons when meal type changes - sync with cart
  useEffect(() => {
    if (menuData) {
      const currentMealItem = selectedMeal === 'lunch' ? menuData.lunch : menuData.dinner;

      // Find cart item for current meal
      const cartItem = currentMealItem?._id ? cartItems.find(item => item.id === currentMealItem._id) : null;

      if (currentMealItem?.addonIds && currentMealItem.addonIds.length > 0) {
        const apiAddons: AddOn[] = currentMealItem.addonIds.map((addon: AddonItem) => {
          // Check if this addon is in the cart
          const cartAddon = cartItem?.addons?.find(a => a.addonId === addon._id);
          return {
            id: addon._id,
            name: addon.name,
            image: require('../../assets/images/homepage/roti.png'),
            quantity: addon.description || '1 serving',
            price: addon.price,
            selected: !!cartAddon,
            count: cartAddon?.quantity || 0,
          };
        });
        setAddOns(apiAddons);
      } else {
        setAddOns([]);
      }

      // Sync meal quantity and modal state
      if (cartItem) {
        setMealQuantity(cartItem.quantity);
        setShowCartModal(true);
      } else {
        setMealQuantity(1);
        setShowCartModal(false);
      }
    }
  }, [selectedMeal, menuData, cartItems]);

  const handleBannerPress = (redirectLink?: string) => {
    if (!redirectLink) return;
    if (redirectLink === '/menu') {
      navigation.navigate('Menu');
    } else if (redirectLink === '/offers') {
      navigation.navigate('Vouchers');
    } else if (redirectLink === '/subscription') {
      navigation.navigate('MealPlans');
    }
    // Unrecognized link — do nothing
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMenu(), loadBanners(true)]);
    setRefreshing(false);
  };

  // Header indicator should reflect *where the user is right now*, not the saved
  // delivery address. Saved address still drives ordering — selectedAddressId,
  // menu fetch, etc. — but the visible label should match the user's location
  // after backgrounding the app and moving around.
  const getDisplayLocation = () => {
    const liveLocality = currentLocation?.address?.locality;
    const liveCity = currentLocation?.address?.city;
    if (liveLocality || liveCity) {
      return `${liveLocality || liveCity}${liveCity && liveLocality ? `, ${liveCity}` : ''}`;
    }
    const mainAddress = getMainAddress();
    if (mainAddress) {
      return `${mainAddress.locality}, ${mainAddress.city}`;
    }
    return 'Select Location';
  };

  // Get current meal item from menu
  const getCurrentMealItem = (): MenuItem | undefined => {
    if (!menuData) return undefined;
    return selectedMeal === 'lunch' ? menuData.lunch : menuData.dinner;
  };

  // Get meal price
  const getMealPrice = (): number => {
    const mealItem = getCurrentMealItem();
    return mealItem?.discountedPrice || mealItem?.price || 0;
  };

  // Check if current meal can be ordered (not past cutoff)
  const canOrderCurrentMeal = (): boolean => {
    const mealItem = getCurrentMealItem();
    return mealItem?.canOrder !== false;
  };

  // Helper to check if ID is a valid MongoDB ObjectId (24-character hex string)
  const isValidObjectId = (id: string): boolean => {
    return /^[a-fA-F0-9]{24}$/.test(id);
  };

  // Helper to update cart with current meal and addons
  const updateCartWithAddons = (updatedAddOns: AddOn[]) => {
    const mealItem = getCurrentMealItem();

    // Check if we have a valid meal item ID from the API
    const mealItemId = mealItem?._id;
    if (!mealItemId || !isValidObjectId(mealItemId)) {
      console.error('[HomeScreen] Cannot add to cart: Invalid or missing meal item ID:', mealItemId);
      console.error('[HomeScreen] Menu item data:', JSON.stringify(mealItem, null, 2));
      return; // Don't add to cart with invalid ID
    }

    const mealPrice = getMealPrice();
    const mealName = mealItem.name;
    const mealWindowValue: 'LUNCH' | 'DINNER' = selectedMeal === 'lunch' ? 'LUNCH' : 'DINNER';

    // Set cart context for order creation
    setMenuType('MEAL_MENU');
    setMealWindow(mealWindowValue);

    // Build addons array - only include addons with valid MongoDB ObjectIds and count > 0
    const selectedAddons = updatedAddOns
      .filter(item => item.selected && item.count > 0 && isValidObjectId(item.id))
      .map(item => ({
        addonId: item.id,
        name: item.name,
        quantity: item.count,
        unitPrice: item.price,
      }));

    // Log if any selected addons were excluded due to invalid IDs
    const invalidAddons = updatedAddOns.filter(item => item.selected && !isValidObjectId(item.id));
    if (invalidAddons.length > 0) {
      console.warn('[HomeScreen] Excluded addons with invalid IDs:', invalidAddons.map(a => ({ id: a.id, name: a.name })));
    }

    const cartItem = {
      id: mealItemId, // Only use valid _id from API
      name: mealName,
      image: selectedMeal === 'lunch'
        ? require('../../assets/images/homepage/lunch2.png')
        : require('../../assets/images/homepage/dinneritem.png'),
      subtitle: '1 Thali',
      price: mealPrice,
      quantity: mealQuantity,
      hasVoucher: true, // Thalis always support vouchers; cutoff is handled separately in cart
      addons: selectedAddons.length > 0 ? selectedAddons : undefined,
      mealWindow: mealWindowValue,
    };

    console.log('[HomeScreen] updateCartWithAddons - Cart item:', JSON.stringify({
      id: cartItem.id,
      name: cartItem.name,
      addons: cartItem.addons,
    }));

    replaceCart(cartItem);
  };

  const toggleAddOn = (id: string) => {
    // Calculate the new addons state
    const updatedAddOns = addOns.map(item => {
      if (item.id === id) {
        // When selecting, set count to 1
        // When deselecting, reset count to 0
        return {
          ...item,
          selected: !item.selected,
          count: !item.selected ? 1 : 0
        };
      }
      return item;
    });

    // Update local state
    setAddOns(updatedAddOns);

    // Immediately update cart with the new addons
    updateCartWithAddons(updatedAddOns);

    // Show cart modal when an addon is selected
    const toggledItem = updatedAddOns.find(item => item.id === id);
    if (toggledItem?.selected) {
      setShowCartModal(true);
    }
  };

  const updateQuantity = (id: string, increment: boolean) => {
    const updatedAddOns = addOns.map(item => {
      if (item.id === id) {
        const newCount = increment ? item.count + 1 : Math.max(0, item.count - 1);

        // If count goes to 0, deselect the addon
        if (newCount === 0) {
          return { ...item, count: 0, selected: false };
        }

        return { ...item, count: newCount };
      }
      return item;
    });

    // Update local state
    setAddOns(updatedAddOns);

    // Immediately update cart with the new quantity
    updateCartWithAddons(updatedAddOns);
  };

  const handleAddToCart = () => {
    // Guests can browse but must login to actually order
    if (isGuest) {
      setShowGuestLoginPrompt(true);
      return;
    }

    const mealItem = getCurrentMealItem();

    // Don't allow adding to cart if ordering is closed
    if (mealItem?.canOrder === false) {
      console.warn('[HomeScreen] Cannot add to cart: Ordering is closed for', selectedMeal);
      return;
    }

    // Don't allow adding to cart if no valid menu item
    if (!mealItem?._id || !isValidObjectId(mealItem._id)) {
      console.error('[HomeScreen] Cannot add to cart: No valid menu item available');
      return;
    }

    const mealPrice = getMealPrice();
    const mealName = mealItem.name;
    const mealWindow = selectedMeal === 'lunch' ? 'LUNCH' : 'DINNER';

    // Set cart context for order creation
    setMenuType('MEAL_MENU');
    setMealWindow(mealWindow);

    // Build addons array for the meal item - only include items with count > 0
    const selectedAddons = addOns
      .filter(item => item.selected && item.count > 0)
      .map(item => ({
        addonId: item.id,
        name: item.name,
        quantity: item.count,
        unitPrice: item.price,
      }));

    // Debug logging
    console.log('[HomeScreen] handleAddToCart called');
    console.log('[HomeScreen] All addOns state:', JSON.stringify(addOns.map(a => ({ name: a.name, selected: a.selected, count: a.count }))));
    console.log('[HomeScreen] Selected addons:', JSON.stringify(selectedAddons));

    const cartItem = {
      id: mealItem._id,
      name: mealName,
      image: selectedMeal === 'lunch'
        ? require('../../assets/images/homepage/lunch2.png')
        : require('../../assets/images/homepage/dinneritem.png'),
      subtitle: '1 Thali',
      price: mealPrice,
      quantity: mealQuantity,
      hasVoucher: true, // Thalis always support vouchers; cutoff is handled separately in cart
      addons: selectedAddons.length > 0 ? selectedAddons : undefined,
      mealWindow: mealWindow as 'LUNCH' | 'DINNER',
    };

    console.log('[HomeScreen] Cart item to add:', JSON.stringify({
      id: cartItem.id,
      name: cartItem.name,
      addons: cartItem.addons,
    }));

    // Replace cart with new meal (atomic operation to avoid race conditions with addons)
    replaceCart(cartItem);

    // Show cart modal
    setShowCartModal(true);
  };

  const handleBuyNow = useCallback(() => {
    console.log('[HomeScreen] handleBuyNow called');

    // Guests can browse but must login to actually order
    if (isGuest) {
      setShowGuestLoginPrompt(true);
      return;
    }

    // Validation: Check if menu item exists
    const mealItem = getCurrentMealItem();

    // Don't allow buying if ordering is closed
    if (mealItem?.canOrder === false) {
      console.warn('[HomeScreen] Cannot Buy Now: Ordering is closed for', selectedMeal);
      return;
    }

    if (!mealItem?._id || !isValidObjectId(mealItem._id)) {
      console.error('[HomeScreen] Cannot Buy Now: No valid menu item available');
      return;
    }

    // Step 1: Check for main address
    const mainAddress = getMainAddress();

    if (!mainAddress) {
      console.log('[HomeScreen] No main address, navigating to Address screen');
      // Set flag to resume Buy Now after address is added
      setIsBuyNowFlow(true);

      // Navigate to the regular Address tab (AddressSetup is no longer a forced gated screen)
      navigation.navigate('Address');
      return;
    }

    // Step 2: Set delivery address in cart context
    setDeliveryAddressId(mainAddress.id);

    // Step 3: Check for available vouchers — only offer the choice when the meal is fully
    // available. In cash_only mode, skip the modal and route straight to cash checkout.
    if (currentMealState === 'available' && usableVouchers > 0) {
      console.log('[HomeScreen] User has', usableVouchers, 'vouchers, showing modal');
      setShowVoucherModal(true);
    } else {
      console.log('[HomeScreen] Skipping voucher modal — state:', currentMealState, 'vouchers:', usableVouchers);
      proceedWithBuyNow(false);
    }
  }, [isGuest, getCurrentMealItem, getMainAddress, usableVouchers, navigation, setDeliveryAddressId, currentMealState]);

  const proceedWithBuyNow = useCallback((useVoucher: boolean) => {
    console.log('[HomeScreen] proceedWithBuyNow, useVoucher:', useVoucher);

    // Close voucher modal if open
    setShowVoucherModal(false);

    // Add current meal to cart (includes addons if selected)
    handleAddToCart();

    // Set voucher count
    setVoucherCount(useVoucher ? 1 : 0);

    // Small delay to ensure cart is updated
    setTimeout(() => {
      // Navigate to Cart with directCheckout flag
      navigation.navigate('Cart', { directCheckout: true } as any);
    }, 100);
  }, [handleAddToCart, setVoucherCount, navigation]);

  const updateMealQuantity = (increment: boolean) => {
    const newQuantity = increment ? mealQuantity + 1 : Math.max(0, mealQuantity - 1);

    // Update local state
    setMealQuantity(newQuantity);

    // Update cart if item already added (modal is showing)
    if (showCartModal) {
      const mealItem = getCurrentMealItem();
      if (mealItem?._id && isValidObjectId(mealItem._id)) {
        updateCartItemQuantity(mealItem._id, newQuantity);

        // If quantity reaches 0, hide cart modal and reset state
        if (newQuantity === 0) {
          setShowCartModal(false);
          setMealQuantity(1);
          setAddOns(addOns.map(addon => ({ ...addon, selected: false, count: 0 })));
        }
      }
    }
  };

  const getSelectedAddOnsCount = () => {
    return addOns.filter(item => item.selected).length;
  };

  // Get meal name
  const getMealName = (): string => {
    const mealItem = getCurrentMealItem();
    return mealItem?.name || '';
  };

  // Get meal description
  const getMealDescription = (): string => {
    const mealItem = getCurrentMealItem();
    return mealItem?.description || '';
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: 'white' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FE8733']} tintColor="#FFFFFF" />
        }
      >
        {/* Background behind header curves */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300, backgroundColor: 'white' }} />

        {/* Header */}
        <LinearGradient colors={['#FD9E2F', '#FF6636']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={{ position: 'relative', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', zIndex: 10 }}>
          <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          {/* Decorative Background Elements */}
          <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, bottom: 0, overflow: 'hidden' }} pointerEvents="none">
            <Image
              source={require('../../assets/images/homepage/halfcircle.png')}
              style={{ position: 'absolute', top: -90, right: -125, width: 300, height: 380 }}
              resizeMode="contain"
            />
            <Image
              source={require('../../assets/images/homepage/halfline.png')}
              style={{ position: 'absolute', top: 30, right: -150, width: 380, height: 150 }}
              resizeMode="contain"
            />
          </View>

          <View className="px-5 pt-4">
            {/* Top Row: Logo, Location, Actions */}
            <View className="flex-row items-center justify-between mb-3">
              {/* Logo */}
              <View style={{ width: isSmallDevice ? SPACING.iconXl * 1.2 : SPACING.iconXl * 1.45 }}>
                <Image
                  source={require('../../assets/icons/Tiffsy.png')}
                  style={{
                    width: isSmallDevice ? SPACING.iconXl * 1.2 : SPACING.iconXl * 1.45,
                    height: isSmallDevice ? SPACING.iconXl * 0.7 : SPACING.iconXl * 0.875,
                    borderRadius: 8,
                  }}
                  resizeMode="contain"
                />
              </View>

              {/* Location */}
              <TouchableOpacity
                ref={locationTourTarget.ref}
                onLayout={locationTourTarget.onLayout}
                className="items-center mx-3"
                style={{ flex: 1, maxWidth: 180 }}
                onPress={() => navigation.navigate('Address')}
              >
                <Text className="text-white opacity-90" style={{ fontSize: FONT_SIZES.xs }}>Location</Text>
                <View className="flex-row items-center mt-1">
                  {isGettingLocation ? (
                    <>
                      <ActivityIndicator size="small" color="white" style={{ marginRight: 4 }} />
                      <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                        Detecting...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text className="text-white font-semibold" style={{ fontSize: FONT_SIZES.sm }} numberOfLines={1}>
                        {getDisplayLocation()}
                      </Text>
                      <Image
                        source={require('../../assets/icons/down2.png')}
                        style={{ width: SPACING.iconXs, height: SPACING.iconXs, marginLeft: 4, tintColor: 'white' }}
                        resizeMode="contain"
                      />
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Right Actions */}
              <View className="flex-row items-center" style={{ gap: SPACING.sm + 2 }}>
                {/* Notification Bell */}
                <NotificationBell color="white" size={SPACING.iconSize - 2} />

                {/* Voucher Button — hidden in guest mode only. Logged-in users
                    always see their voucher balance, regardless of today's meal state. */}
                {!isGuest && (
                  <TouchableOpacity
                    ref={vouchersTourTarget.ref}
                    onLayout={vouchersTourTarget.onLayout}
                    onPress={() => navigation.navigate('MealPlans')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'white',
                      borderRadius: SPACING.md,
                      paddingVertical: SPACING.xs,
                      paddingHorizontal: SPACING.sm - 2,
                      gap: 3,
                    }}
                  >
                    <Image
                      source={require('../../assets/icons/voucher5.png')}
                      style={{ width: SPACING.iconSm, height: SPACING.iconSm }}
                      resizeMode="contain"
                    />
                    <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: 'bold', color: '#FE8733' }}>
                      {usableVouchers}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

          </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Content area with background design */}
        <View style={{ position: 'relative', marginTop: -30 }}>
          {/* Background Image - covers carousel, buttons, and thali */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
            <Image
              source={require('../../assets/images/homepage/homebackground.png')}
              style={{
                width: '100%',
                height: '100%',
                opacity: 0.17,
              }}
              resizeMode="cover"
            />
          </View>

        {/* Promotional Carousel - Dynamic banners from API */}
        <BannerSliderWidget
          banners={banners}
          isLoading={isBannersLoading}
          screenWidth={width}
          onBannerPress={handleBannerPress}
        />

        {/* Quick Action Buttons */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: SPACING.lg,
            marginTop: SPACING.md,
            gap: SPACING.sm,
          }}
        >
          {/* Scheduled Ordering */}
          <TouchableOpacity
            ref={planAheadTourTarget.ref}
            onLayout={planAheadTourTarget.onLayout}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MealCalendar')}
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: SPACING.md,
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING.md,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <MaterialCommunityIcons name="calendar-clock" size={24} color="#FE8733" style={{ marginRight: SPACING.xs }} />
            <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937', flex: 1 }} numberOfLines={1}>
              Schedule Order
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Auto Orders */}
          <TouchableOpacity
            ref={autoOrdersTourTarget.ref}
            onLayout={autoOrdersTourTarget.onLayout}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('AutoOrderSettings')}
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: SPACING.md,
              paddingVertical: SPACING.md,
              paddingHorizontal: SPACING.md,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <MaterialCommunityIcons name="toggle-switch-outline" size={24} color="#FE8733" style={{ marginRight: SPACING.xs }} />
            <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#1F2937', flex: 1 }} numberOfLines={1}>
              Auto Orders
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* White Container with Meal Options and Image */}
        <View className="mb-6" style={{ position: 'relative', overflow: 'visible', marginTop: SPACING.md }}>

          {/* Main Meal Image */}
          <View className="items-center justify-center pb-4" style={{ width: '100%' }}>
            <Image
              source={
                selectedMeal === 'lunch'
                  ? require('../../assets/images/homepage/lunchThali.png')
                  : require('../../assets/images/homepage/dinnerThali.png')
              }
              style={{ width: width * 0.80, height: width * 0.80, alignSelf: 'center', marginLeft: SPACING.lg + 4 }}
              resizeMode="contain"
            />
          </View>
        </View>

        </View>{/* End background design wrapper */}

        {/* Special Thali, Details and Add-ons Container */}
        <View
          className="bg-white px-6 pt-5 pb-10"
          style={{
            marginTop: -40,
            borderTopLeftRadius: 33,
            borderTopRightRadius: 33,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {/* Loading State */}
          {isLoadingMenu && (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color="#FE8733" />
              <Text className="text-gray-500 mt-3">Loading menu...</Text>
            </View>
          )}

          {/* Error State */}
          {menuError && !isLoadingMenu && (
            <View className="items-center justify-center py-8 px-4">
              {isGuest && /unauth|auth/i.test(menuError) ? (
                <>
                  <Text className="text-gray-900 text-lg font-bold mb-2">Login to see</Text>
                  <Text className="text-gray-600 text-center mb-4">
                    Sign in to view the menu and place orders.
                  </Text>
                  <TouchableOpacity
                    onPress={() => { exitGuestMode(); }}
                    className="bg-orange-400 px-6 py-3 rounded-full"
                  >
                    <Text className="text-white font-semibold">Login</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text className="text-red-500 text-lg mb-2">Oops!</Text>
                  <Text className="text-gray-600 text-center mb-4">{menuError}</Text>
                  <TouchableOpacity
                    onPress={fetchMenu}
                    className="bg-orange-400 px-6 py-3 rounded-full"
                  >
                    <Text className="text-white font-semibold">Try Again</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Requires Address State */}
          {requiresAddress && !isLoadingMenu && (
            <View className="items-center justify-center py-8 px-4">
              <Text className="text-6xl mb-4">📍</Text>
              <Text className="text-xl font-bold text-gray-900 mb-2">Add Your Address</Text>
              <Text className="text-gray-600 text-center mb-4">
                Please add a delivery address to see the menu
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Address')}
                className="bg-orange-400 px-6 py-3 rounded-full"
              >
                <Text className="text-white font-semibold">Add Address</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* No Meal Available — when both lunch and dinner are null, treat it as "today's orders
              are closed" and offer a path to schedule for tomorrow rather than a dead-end refresh. */}
          {!isLoadingMenu && !menuError && !requiresAddress && !getCurrentMealItem() && (
            <View className="items-center justify-center py-8 px-4">
              <Text className="text-6xl mb-4">🍽️</Text>
              <Text className="text-xl font-bold text-gray-900 mb-2">
                {!menuData?.lunch && !menuData?.dinner ? 'Lunch and Dinner Not Available' : `${selectedMeal === 'lunch' ? 'Lunch' : 'Dinner'} Not Available`}
              </Text>
              <Text className="text-gray-600 text-center mb-4">
                {!menuData?.lunch && !menuData?.dinner
                  ? "Schedule a meal for tomorrow's lunch or dinner."
                  : `The ${selectedMeal} menu is currently not available. Please try the other meal option.`}
              </Text>
              {!menuData?.lunch && !menuData?.dinner ? (
                <TouchableOpacity
                  onPress={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const yyyy = tomorrow.getFullYear();
                    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
                    const dd = String(tomorrow.getDate()).padStart(2, '0');
                    navigation.navigate('MealCalendar', { scheduledDate: `${yyyy}-${mm}-${dd}` });
                  }}
                  className="bg-orange-400 px-6 py-3 rounded-full"
                >
                  <Text className="text-white font-semibold">Schedule for Tomorrow</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={fetchMenu}
                  className="bg-orange-400 px-6 py-3 rounded-full"
                >
                  <Text className="text-white font-semibold">Refresh</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Cash-only banner (amber) — shown when voucher cutoff has passed but ordering is still open */}
          {!isLoadingMenu && !menuError && !requiresAddress && getCurrentMealItem() && currentMealState === 'cash_only' && (
            <View style={{
              backgroundColor: '#FEF3C7',
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#FCD34D',
            }}>
              <MaterialCommunityIcons name="cash" size={20} color="#92400E" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FONT_SIZES.sm, color: '#92400E', fontWeight: '600' }}>
                  Vouchers no longer accepted for {selectedMeal === 'lunch' ? 'Lunch' : 'Dinner'}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#92400E', marginTop: 2 }}>
                  Cash orders open until {(selectedMeal === 'lunch' ? mealWindowInfo.lunchCutoff : mealWindowInfo.dinnerCutoff).orderCutoffTime || mealWindowInfo.nextMealWindowTime}
                </Text>
              </View>
            </View>
          )}

          {/* Ordering closed banner (red) */}
          {!isLoadingMenu && !menuError && !requiresAddress && getCurrentMealItem() && currentMealState === 'closed' && (
            <View style={{
              backgroundColor: '#FEF2F2',
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#FECACA',
            }}>
              <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FONT_SIZES.sm, color: '#991B1B', fontWeight: '600' }}>
                  {mealWindowInfo.isAllClosedForToday
                    ? 'Ordering closed for today'
                    : ((selectedMeal === 'lunch' ? mealWindowInfo.lunchUpcoming : mealWindowInfo.dinnerUpcoming)
                      ? `${selectedMeal === 'lunch' ? 'Lunch' : 'Dinner'} ordering not yet open`
                      : `${selectedMeal === 'lunch' ? 'Lunch' : 'Dinner'} ordering is closed`)}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#B91C1C', marginTop: 2 }}>
                  {mealWindowInfo.isAllClosedForToday
                    ? `Orders reopen at ${mealWindowInfo.nextMealWindowTime}`
                    : (getCurrentMealItem()?.cutoffMessage ||
                      `Orders close at ${(selectedMeal === 'lunch' ? mealWindowInfo.lunchCutoff : mealWindowInfo.dinnerCutoff).orderCutoffTime || mealWindowInfo.nextMealWindowTime}`)}
                </Text>
              </View>
            </View>
          )}

          {/* Special Thali and Buttons */}
          {!isLoadingMenu && !menuError && !requiresAddress && getCurrentMealItem() && (
          <>
          <View className="flex-row justify-between items-start mb-6">
            {/* Left: Meal Name and Price */}
            <View className="flex-1 pr-4">
              {mealWindowInfo.isAllClosedForToday && (
                <Text style={{ fontSize: FONT_SIZES.xs, color: '#FE8733', fontWeight: '600', marginBottom: 4 }}>
                  Tomorrow's Menu
                </Text>
              )}
              <Text className="font-bold text-gray-900" style={{ fontSize: FONT_SIZES.h3 }}>{getMealName()}</Text>
              <Text className="text-gray-600 mt-1" style={{ fontSize: FONT_SIZES.base }}>
                From: <Text className="font-semibold text-gray-900">₹{getMealPrice().toFixed(2)}</Text>
              </Text>
            </View>

            {/* Right: Buttons Stack */}
            <View style={{ gap: SPACING.sm }}>
              {!showCartModal ? (
              <TouchableOpacity
                ref={addToCartTourTarget.ref}
                onLayout={addToCartTourTarget.onLayout}
                onPress={canOrderCurrentMeal() ? handleAddToCart : (mealWindowInfo.isAllClosedForToday ? () => {
                  if (mealWindowInfo.isInScheduleWindow) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const yyyy = tomorrow.getFullYear();
                    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
                    const dd = String(tomorrow.getDate()).padStart(2, '0');
                    navigation.navigate('MealCalendar', { scheduledDate: `${yyyy}-${mm}-${dd}` });
                  } else {
                    navigation.navigate('MealCalendar');
                  }
                } : undefined)}
                activeOpacity={canOrderCurrentMeal() || mealWindowInfo.isAllClosedForToday ? 0.7 : 1}
                disabled={!canOrderCurrentMeal() && !mealWindowInfo.isAllClosedForToday}
                style={{
                  backgroundColor: canOrderCurrentMeal() || mealWindowInfo.isAllClosedForToday ? '#FE8733' : 'rgba(209, 213, 219, 1)',
                  borderRadius: SPACING['3xl'],
                  minWidth: SPACING['5xl'] * 3.125,
                  height: SPACING['2xl'] + SPACING.xl + 1,
                  paddingHorizontal: SPACING.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons name={canOrderCurrentMeal() ? "cart-plus" : (mealWindowInfo.isAllClosedForToday ? "calendar-clock" : "clock-alert-outline")} size={18} color="white" style={{ marginRight: 6 }} />
                <Text style={{ color: 'white', fontSize: FONT_SIZES.sm, fontWeight: '600' }}>
                  {canOrderCurrentMeal() ? 'Add to Cart' : (mealWindowInfo.isAllClosedForToday ? 'Schedule for Tomorrow' : 'Ordering Closed')}
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: SPACING['3xl'],
                  height: SPACING['2xl'] + SPACING.lg,
                  paddingHorizontal: SPACING.xs + 2,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minWidth: SPACING['4xl'] + SPACING['3xl'] - 2,
                  borderWidth: 1,
                  borderColor: 'rgba(232, 235, 234, 1)',
                }}
              >
                <TouchableOpacity
                  onPress={() => updateMealQuantity(false)}
                  style={{
                    width: SPACING.xl + 8,
                    height: SPACING.xl + 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image
                    source={require('../../assets/icons/subtract.png')}
                    style={{ width: SPACING.xs + 6, height: SPACING.xs + 6 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                <Text style={{ color: 'rgba(0, 0, 0, 1)', fontSize: FONT_SIZES.lg, fontWeight: '600', marginHorizontal: SPACING.sm }}>{mealQuantity}</Text>
                <TouchableOpacity
                  onPress={() => updateMealQuantity(true)}
                  style={{
                    width: SPACING.xl + 8,
                    height: SPACING.xl + 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image
                    source={require('../../assets/icons/plus.png')}
                    style={{ width: SPACING['3xl'] - 2, height: SPACING['3xl'] }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            )}

              {/* Buy Now Button - hidden for now */}
            </View>
          </View>

          {/* Details Section */}
          <View className="mb-6">
            <Text className="font-bold text-gray-900 mb-3" style={{ fontSize: FONT_SIZES.h4 }}>Details</Text>
            <Text className="text-gray-600" style={{ fontSize: FONT_SIZES.base, lineHeight: FONT_SIZES.base * 1.5 }}>
              {getMealDescription()}
            </Text>
            {getCurrentMealItem()?.includes && getCurrentMealItem()!.includes!.length > 0 && (
              <View className="mt-3 flex-row flex-wrap" style={{ gap: 6 }}>
                <Text className="text-gray-500" style={{ fontSize: FONT_SIZES.sm, marginRight: 4 }}>Includes:</Text>
                {getCurrentMealItem()!.includes!.map((item, index) => (
                  <View
                    key={index}
                    style={{
                      backgroundColor: '#FFF7ED',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(251, 146, 60, 0.3)',
                    }}
                  >
                    <Text style={{ fontSize: FONT_SIZES.xs, color: '#9a3412' }}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Add-ons Section */}
          <View>
            <TouchableOpacity
              onPress={() => setAddOnsExpanded(!addOnsExpanded)}
              className="flex-row items-center justify-between mb-4"
              activeOpacity={0.7}
            >
              <Text className="font-bold text-gray-900" style={{ fontSize: FONT_SIZES.h4 }}>Add-ons</Text>
              <View className="flex-row items-center">
                {addOns.length > 0 && (
                  <Text className="text-gray-500 mr-2" style={{ fontSize: FONT_SIZES.sm }}>
                    {addOns.length} items
                  </Text>
                )}
                <Image
                  source={require('../../assets/icons/down2.png')}
                  style={{
                    width: SPACING.iconSm,
                    height: SPACING.iconSm,
                    tintColor: '#9CA3AF',
                    transform: [{ rotate: addOnsExpanded ? '180deg' : '0deg' }],
                  }}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>

            {addOnsExpanded && addOns.length > 0 ? (
              addOns.map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center py-3"
                  style={{ borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' }}
                >
                  {/* Item Image */}
                  <Image
                    source={item.image}
                    style={{ width: SPACING.iconXl + 16, height: SPACING.iconXl + 16, borderRadius: (SPACING.iconXl + 16) / 2 }}
                    resizeMode="contain"
                  />

                  {/* Item Info */}
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-gray-900" style={{ fontSize: FONT_SIZES.base }}>
                      {item.name}
                    </Text>
                    <Text className="text-gray-500 mt-0.5" style={{ fontSize: FONT_SIZES.sm }}>
                      {item.quantity}  <Text className="font-semibold text-gray-900">+ ₹{item.price.toFixed(2)}</Text>
                    </Text>
                  </View>

                  {item.selected ? (
                    /* Quantity Controls (visible when selected) */
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#FFF7ED',
                        borderRadius: 16,
                        paddingVertical: 4,
                        paddingHorizontal: 6,
                        borderWidth: 1,
                        borderColor: '#FE8733',
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.id, false)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: 'white',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: '#FE8733',
                        }}
                      >
                        <Text style={{ color: '#FE8733', fontSize: 13, fontWeight: '600' }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ color: '#FE8733', fontSize: 13, fontWeight: '700', marginHorizontal: 6 }}>{item.count}</Text>
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.id, true)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: '#FE8733',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* Checkbox (visible when not selected) */
                    <TouchableOpacity
                      onPress={() => toggleAddOn(item.id)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: '#D1D5DB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    />
                  )}
                </View>
              ))
            ) : addOnsExpanded ? (
              <View className="py-10 items-center">
                <Text className="text-gray-400" style={{ fontSize: FONT_SIZES.base }}>No add-ons available</Text>
              </View>
            ) : null}
          </View>

          </>
          )}

          {/* Bottom Spacing — rendered for EVERY inner state (loading / error /
              requires-address / no-meal / has-meal) so any CTA at the end of the
              container clears the BottomNavBar plus any sticky overlay
              (cart popup / active-order banner). Overlay height is measured at runtime;
              the SPACING['4xl']*2 baseline matches the overlay's `bottom` offset. */}
          <View style={{ height: SPACING['4xl'] * 2 + insets.bottom + bottomOverlayHeight + 16 }} />
        </View>
      </ScrollView>

      {/* Cart Popup - Sticky at bottom */}
      {showCartModal && (
        <View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h && Math.abs(h - bottomOverlayHeight) > 1) {
              setBottomOverlayHeight(h);
            }
          }}
          className="absolute left-5 right-5 bg-white rounded-full px-5 flex-row items-center justify-between"
          style={{
            bottom: SPACING['4xl'] * 2 + insets.bottom,
            paddingVertical: SPACING.md,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {/* Meal Image and Info */}
          <View className="flex-row items-center flex-1">
            <Image
              source={
                selectedMeal === 'lunch'
                  ? require('../../assets/images/homepage/lunch2.png')
                  : require('../../assets/images/homepage/dinneritem.png')
              }
              style={{ width: SPACING['5xl'], height: SPACING['5xl'], borderRadius: SPACING['5xl'] / 2 }}
              resizeMode="contain"
            />
            <View className="ml-3 flex-1" style={{ marginRight: 10 }}>
              <Text className="font-bold text-gray-900" style={{ fontSize: FONT_SIZES.base }} numberOfLines={1}>{getMealName()}</Text>
              <Text className="text-gray-500 mt-0.5" style={{ fontSize: FONT_SIZES.xs }}>
                {getSelectedAddOnsCount()} Add-ons
              </Text>
            </View>
          </View>

          {/* View Cart Button */}
          <TouchableOpacity
            className="bg-orange-400 rounded-full flex-row items-center"
            style={{ paddingHorizontal: SPACING.lg + 4, paddingVertical: SPACING.xs + 6 }}
            onPress={() => navigation.navigate('Cart')}
          >
            <Image
              source={require('../../assets/icons/cart3.png')}
              style={{ width: SPACING.iconSm + 2, height: SPACING.iconSm + 2, tintColor: 'white', marginRight: 6 }}
              resizeMode="contain"
            />
            <Text className="text-white font-semibold" style={{ fontSize: FONT_SIZES.sm }} numberOfLines={1}>View Cart</Text>
          </TouchableOpacity>

          {/* Close Button — removes the current meal from the cart so it doesn't reappear on the next sync */}
          <TouchableOpacity
            onPress={() => {
              const currentMealItem = getCurrentMealItem();
              if (currentMealItem?._id) {
                removeItem(currentMealItem._id);
              }
              setShowCartModal(false);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="items-center justify-center"
            style={{
              width: TOUCH_TARGETS.minimum,
              height: TOUCH_TARGETS.minimum,
              marginRight: -8,
            }}
          >
            <Text className="text-gray-500" style={{ fontSize: FONT_SIZES.h3 }}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Today's Active Order Banner — show ONLY when (a) there's a placed today's order AND (b) the cart is empty */}
      {activeOrderBanner && cartItems.length === 0 && (
        <View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h && Math.abs(h - bottomOverlayHeight) > 1) {
              setBottomOverlayHeight(h);
            }
          }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: SPACING['4xl'] * 2 + insets.bottom,
          }}
          pointerEvents="box-none"
        >
          <ActiveOrderBanner
            title={activeOrderBanner.title}
            subtitle={activeOrderBanner.subtitle}
            hasLunch={todaysActiveOrders.some(o => o.mealWindow === 'LUNCH')}
            hasDinner={todaysActiveOrders.some(o => o.mealWindow === 'DINNER')}
            onPress={() => {
              if (activeOrderBanner.orderId) {
                navigation.navigate('OrderDetail', { orderId: activeOrderBanner.orderId });
              } else {
                navigation.navigate('YourOrders');
              }
            }}
          />
        </View>
      )}

      {/* Meal Window Modal - Shows when ordering window is closed */}
      <MealWindowModal
        visible={showMealWindowModal}
        nextMealWindow={mealWindowInfo.nextMealWindow}
        nextMealWindowTime={mealWindowInfo.nextMealWindowTime}
        onClose={handleMealWindowModalClose}
        mode={mealWindowInfo.isAllClosedForToday ? 'all-closed' : 'next-window'}
        onSchedule={
          // Only expose Schedule CTA in the 9 PM - midnight window when truly done for today.
          mealWindowInfo.isAllClosedForToday && mealWindowInfo.isInScheduleWindow
            ? () => {
                userDismissedClosedModalRef.current = true;
                setShowMealWindowModal(false);
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const yyyy = tomorrow.getFullYear();
                const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
                const dd = String(tomorrow.getDate()).padStart(2, '0');
                navigation.navigate('MealCalendar', { scheduledDate: `${yyyy}-${mm}-${dd}` });
              }
            : undefined
        }
      />

      {/* Voucher Payment Choice Modal */}
      <VoucherPaymentModal
        visible={showVoucherModal}
        voucherCount={usableVouchers}
        onUseVoucher={() => proceedWithBuyNow(true)}
        onPayDirectly={() => proceedWithBuyNow(false)}
        onCancel={() => setShowVoucherModal(false)}
      />

      {/* Login prompt for guests trying to add to cart or buy now */}
      <ConfirmationModal
        visible={showGuestLoginPrompt}
        title="Login Required"
        message="Please login to place an order and start enjoying delicious meals delivered to you."
        confirmText="Login"
        cancelText="Not Now"
        confirmStyle="primary"
        onConfirm={() => {
          setShowGuestLoginPrompt(false);
          exitGuestMode();
        }}
        onCancel={() => setShowGuestLoginPrompt(false)}
      />
    </View>
  );
};

export default HomeScreen;
