// src/screens/cart/CartScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainTabParamList } from '../../types/navigation';
import { useCart } from '../../context/CartContext';
import { useAddress } from '../../context/AddressContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { usePayment } from '../../context/PaymentContext';
import { useAlert } from '../../context/AlertContext';
import OrderSuccessModal from '../../components/OrderSuccessModal';
import apiService, {
  PricingBreakdown,
  PricingCharges,
  VoucherEligibility,
  Order,
  AddonItem,
} from '../../services/api.service';
import AddonSelector from '../../components/AddonSelector';
import CouponSheet from '../../components/CouponSheet';
import dataPreloader from '../../services/dataPreloader.service';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';

type Props = StackScreenProps<MainTabParamList, 'Cart'>;

interface OrderResult {
  orderId: string;
  orderNumber: string;
  amountToPay: number;
  cancelDeadline?: string;
}

const CartScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    cartItems,
    updateQuantity: updateCartQuantity,
    updateAddonQuantity,
    addAddonToItem,
    removeAddon,
    removeItem,
    replaceCart,
    kitchenId,
    menuType,
    mealWindow,
    deliveryAddressId,
    voucherCount,
    couponCode,
    setVoucherCount,
    setCouponCode,
    setDeliveryAddressId,
    getOrderItems,
    resetOrderContext,
    setMealWindow,
    // Multi-slot support
    selectedMealWindows,
    toggleMealWindow,
    addToCartForSlot,
    getItemsForSlot,
    getOrderItemsForSlot,
    removeItemsForSlot,
    slotVoucherCounts,
    setSlotVoucherCount,
  } = useCart();

  const { addresses, getMainAddress } = useAddress();
  const { voucherSummary, usableVouchers, fetchVouchers } = useSubscription();
  const { processOrderPayment, retryOrderPayment, isProcessing: isPaymentProcessing } = usePayment();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const { isSmallDevice } = useResponsive();

  // Scheduling mode detection
  const scheduledDate = route.params?.scheduledDate;
  const isSchedulingMode = !!scheduledDate;

  // Local state for selected address (display purposes)
  const [localSelectedAddressId, setLocalSelectedAddressId] = useState<string>(
    route.params?.deliveryAddressId || deliveryAddressId || getMainAddress()?.id || (addresses.length > 0 ? addresses[0].id : '')
  );

  // Per-slot pricing state
  interface SlotPricing {
    pricing: PricingBreakdown | null;
    voucherInfo: VoucherEligibility | null;
    error: string | null;
  }
  const [lunchPricing, setLunchPricing] = useState<SlotPricing>({ pricing: null, voucherInfo: null, error: null });
  const [dinnerPricing, setDinnerPricing] = useState<SlotPricing>({ pricing: null, voucherInfo: null, error: null });
  const [isCalculating, setIsCalculating] = useState(false);

  // Backward compat helpers
  const pricing = selectedMealWindows.length === 1
    ? (selectedMealWindows[0] === 'LUNCH' ? lunchPricing.pricing : dinnerPricing.pricing)
    : null;
  // voucherInfo: use first available slot's info (so voucher section shows even when both selected)
  const voucherInfo = (() => {
    if (selectedMealWindows.includes('LUNCH') && lunchPricing.voucherInfo) {
      return lunchPricing.voucherInfo;
    }
    if (selectedMealWindows.includes('DINNER') && dinnerPricing.voucherInfo) {
      return dinnerPricing.voucherInfo;
    }
    return null;
  })();
  const pricingError = lunchPricing.error || dinnerPricing.error || null;

  // Order state
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [pendingPaymentOrderId, setPendingPaymentOrderId] = useState<string | null>(null);

  // Coupon sheet state
  const [showCouponSheet, setShowCouponSheet] = useState(false);
  // Track extra vouchers from coupon for order success display
  const [extraVouchersIssued, setExtraVouchersIssued] = useState(0);

  // Voucher auto-apply state
  const [hasAutoApplied, setHasAutoApplied] = useState(false);

  // Payment summary expand state
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Delivery preferences
  const [cookingInstructions, setCookingInstructions] = useState('');
  const [showCookingInput, setShowCookingInput] = useState(false);
  const [leaveAtDoor, setLeaveAtDoor] = useState(false);
  const [doNotContact, setDoNotContact] = useState(false);

  // Three-state cutoff per slot
  interface SlotCutoffState {
    canOrder: boolean;
    canUseVoucher: boolean;
    voucherCutoffTime?: string;
    orderCutoffTime?: string;
  }
  const [lunchCutoff, setLunchCutoff] = useState<SlotCutoffState>({ canOrder: true, canUseVoucher: true });
  const [dinnerCutoff, setDinnerCutoff] = useState<SlotCutoffState>({ canOrder: true, canUseVoucher: true });

  // Helper to get slot state
  const getSlotState = (cutoff: SlotCutoffState): 'available' | 'cash_only' | 'closed' => {
    if (!cutoff.canOrder) return 'closed';
    if (!cutoff.canUseVoucher) return 'cash_only';
    return 'available';
  };


  // Refresh voucher data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[CartScreen] Screen focused - Refreshing voucher data');
      fetchVouchers().catch(err => {
        console.error('[CartScreen] Error refreshing vouchers on focus:', err);
      });
    }, [fetchVouchers])
  );

  // Per-slot addons
  const [lunchAddons, setLunchAddons] = useState<AddonItem[]>([]);
  const [dinnerAddons, setDinnerAddons] = useState<AddonItem[]>([]);
  // Backward compat: availableAddons for first selected slot
  const availableAddons = selectedMealWindows.includes('LUNCH') ? lunchAddons :
    selectedMealWindows.includes('DINNER') ? dinnerAddons : [];

  // Cache menu items for slot toggling
  const [menuItemCache, setMenuItemCache] = useState<{ lunch?: any; dinner?: any }>({});

  // Map MenuItem to three-state cutoff
  const mapCutoffState = (menuItem: any): SlotCutoffState => {
    if (!menuItem) return { canOrder: false, canUseVoucher: false };

    console.log('[CartScreen] mapCutoffState raw backend fields:', {
      isPastCutoff: menuItem.isPastCutoff,
      canOrder: menuItem.canOrder,
      canUseVoucher: menuItem.canUseVoucher,
      cutoffTime: menuItem.cutoffTime,
      voucherCutoffTime: menuItem.voucherCutoffTime,
      orderCutoffTime: menuItem.orderCutoffTime,
    });

    // New two-phase fields take priority
    if (menuItem.voucherCutoffTime !== undefined || menuItem.orderCutoffTime !== undefined) {
      return {
        canOrder: menuItem.canOrder ?? true,
        canUseVoucher: menuItem.canUseVoucher ?? true,
        voucherCutoffTime: menuItem.voucherCutoffTime,
        orderCutoffTime: menuItem.orderCutoffTime,
      };
    }
    // Backward compat: old single-cutoff model
    // isPastCutoff from old model = voucher cutoff passed (cash only), NOT order closed.
    // Ordering stays open — only the new canOrder field (from backend) can close ordering.
    const voucherCutoffPassed = menuItem.isPastCutoff ?? false;
    return {
      canOrder: menuItem.canOrder ?? true, // always open until backend sends explicit canOrder:false
      canUseVoucher: menuItem.canUseVoucher ?? !voucherCutoffPassed,
      voucherCutoffTime: menuItem.cutoffTime,
      orderCutoffTime: menuItem.cutoffTime,
    };
  };

  // Fetch menu data, cutoff info, and addons when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const fetchMenuData = async () => {
        if (!kitchenId) {
          console.log('[CartScreen] No kitchenId, skipping menu fetch');
          return;
        }
        console.log('[CartScreen] Fetching menu data for kitchen:', kitchenId);
        try {
          const menuResponse = await apiService.getKitchenMenu(kitchenId, 'MEAL_MENU');
          if (menuResponse.data) {
            const { lunch, dinner } = menuResponse.data.mealMenu;

            // Cache menu items for slot toggling
            setMenuItemCache({ lunch, dinner });

            // Update three-state cutoff (skip in scheduling mode — future dates have no cutoff)
            if (!isSchedulingMode) {
              setLunchCutoff(mapCutoffState(lunch));
              setDinnerCutoff(mapCutoffState(dinner));
            }

            // Update per-slot addons
            const lunchAddonCount = lunch?.addonIds?.length || 0;
            const dinnerAddonCount = dinner?.addonIds?.length || 0;
            console.log(`[CartScreen] Addons found - Lunch: ${lunchAddonCount}, Dinner: ${dinnerAddonCount}`);
            if (lunch?.addonIds && lunch.addonIds.length > 0) {
              setLunchAddons(lunch.addonIds);
            } else {
              setLunchAddons([]);
            }
            if (dinner?.addonIds && dinner.addonIds.length > 0) {
              setDinnerAddons(dinner.addonIds);
            } else {
              setDinnerAddons([]);
            }
          }
        } catch (error) {
          console.error('[CartScreen] Error fetching menu data:', error);
        }
      };
      fetchMenuData();
    }, [kitchenId])
  );

  // Sync local address selection with cart context
  useEffect(() => {
    if (localSelectedAddressId && localSelectedAddressId !== deliveryAddressId) {
      setDeliveryAddressId(localSelectedAddressId);
    }
  }, [localSelectedAddressId]);

  // When slots are toggled, add/remove items for that slot
  const handleToggleSlot = useCallback(async (slot: 'LUNCH' | 'DINNER') => {
    const cutoff = slot === 'LUNCH' ? lunchCutoff : dinnerCutoff;
    if (!cutoff.canOrder) return;

    if (selectedMealWindows.includes(slot)) {
      // Deselecting — remove items and reset vouchers for this slot
      removeItemsForSlot(slot);
      setSlotVoucherCount(slot, 0);
      toggleMealWindow(slot);
    } else {
      // Selecting — add item for this slot
      toggleMealWindow(slot);
      const menuItem = slot === 'LUNCH' ? menuItemCache.lunch : menuItemCache.dinner;
      if (menuItem?._id) {
        const existingItems = getItemsForSlot(slot);
        if (existingItems.length === 0) {
          addToCartForSlot({
            id: menuItem._id,
            name: menuItem.name,
            image: slot === 'LUNCH'
              ? require('../../assets/images/homepage/lunch2.png')
              : require('../../assets/images/homepage/dinneritem.png'),
            subtitle: '1 Thali',
            price: menuItem.discountedPrice || menuItem.price,
            quantity: 1,
            hasVoucher: true, // Thalis always support vouchers; cutoff handled separately
            mealWindow: slot,
          }, slot);
        }
      } else if (kitchenId) {
        // Menu item not cached, fetch it
        try {
          const menuResponse = await apiService.getKitchenMenu(kitchenId, 'MEAL_MENU');
          if (menuResponse.data) {
            const item = slot === 'LUNCH' ? menuResponse.data.mealMenu.lunch : menuResponse.data.mealMenu.dinner;
            if (item?._id) {
              addToCartForSlot({
                id: item._id,
                name: item.name,
                image: slot === 'LUNCH'
                  ? require('../../assets/images/homepage/lunch2.png')
                  : require('../../assets/images/homepage/dinneritem.png'),
                subtitle: '1 Thali',
                price: item.discountedPrice || item.price,
                quantity: 1,
                hasVoucher: true, // Thalis always support vouchers; cutoff handled separately
                mealWindow: slot,
              }, slot);
            }
          }
        } catch (error) {
          console.error('[CartScreen] Error fetching menu item for slot:', error);
        }
      }

      // If slot is cash-only, auto-clear vouchers for it
      if (!cutoff.canUseVoucher) {
        setSlotVoucherCount(slot, 0);
      }
    }
  }, [selectedMealWindows, lunchCutoff, dinnerCutoff, menuItemCache, kitchenId, getItemsForSlot, addToCartForSlot, removeItemsForSlot, toggleMealWindow, setSlotVoucherCount]);

  // Auto-remove vouchers when a slot enters cash-only phase
  useEffect(() => {
    selectedMealWindows.forEach(slot => {
      const cutoff = slot === 'LUNCH' ? lunchCutoff : dinnerCutoff;
      if (!cutoff.canUseVoucher && slotVoucherCounts[slot] > 0) {
        setSlotVoucherCount(slot, 0);
        showAlert(
          'Voucher Removed',
          `${slot === 'LUNCH' ? 'Lunch' : 'Dinner'} voucher ordering time has passed. This slot will proceed as a paid order.`,
          undefined,
          'warning'
        );
      }
    });
  }, [lunchCutoff, dinnerCutoff, selectedMealWindows, slotVoucherCounts]);

  // Calculate pricing per selected slot
  const calculateAllPricing = useCallback(async () => {
    console.log('[CartScreen] calculateAllPricing called, isSchedulingMode:', isSchedulingMode);

    if (cartItems.length === 0 || !localSelectedAddressId) {
      setLunchPricing({ pricing: null, voucherInfo: null, error: null });
      setDinnerPricing({ pricing: null, voucherInfo: null, error: null });
      return;
    }

    // For today orders, require kitchenId and menuType
    if (!isSchedulingMode && (!kitchenId || !menuType)) {
      setLunchPricing({ pricing: null, voucherInfo: null, error: null });
      setDinnerPricing({ pricing: null, voucherInfo: null, error: null });
      return;
    }

    if (selectedMealWindows.length === 0) {
      return;
    }

    setIsCalculating(true);

    const results = await Promise.allSettled(
      selectedMealWindows.map(async (slot) => {
        const items = getOrderItemsForSlot(slot);
        if (items.length === 0) return { slot, data: null };

        if (isSchedulingMode) {
          // Scheduling mode: use getScheduledMealPricing
          const response = await apiService.getScheduledMealPricing({
            deliveryAddressId: localSelectedAddressId,
            mealWindow: slot,
            scheduledDate: scheduledDate!,
            items: items.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              addons: item.addons,
            })),
            voucherCount: slotVoucherCounts[slot] || undefined,
            couponCode: couponCode || undefined,
          });

          if (response.success && response.data) {
            const p = response.data.pricing;
            // Map ScheduledMealPricingData → PricingBreakdown
            const mapped: PricingBreakdown = {
              items: response.data.items.map(i => ({
                name: i.name,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                total: i.totalPrice,
                addons: i.addons.map(a => ({
                  name: a.name,
                  quantity: a.quantity,
                  unitPrice: a.unitPrice,
                  totalPrice: a.totalPrice,
                })),
              })),
              subtotal: p.subtotal,
              charges: p.charges as PricingCharges,
              discount: p.discount as PricingBreakdown['discount'],
              voucherCoverage: p.voucherCoverage || null,
              grandTotal: p.grandTotal,
              amountToPay: p.amountToPay,
            };
            return { slot, data: { success: true, data: { breakdown: mapped, voucherEligibility: null } } };
          }
          return { slot, data: response };
        } else {
          // Today mode: use calculatePricing
          const response = await apiService.calculatePricing({
            kitchenId: kitchenId!,
            menuType: menuType!,
            mealWindow: menuType === 'MEAL_MENU' ? slot : undefined,
            deliveryAddressId: localSelectedAddressId,
            items,
            voucherCount: slotVoucherCounts[slot] || 0,
            couponCode: couponCode || null,
          });

          return { slot, data: response };
        }
      })
    );

    // Clear pricing for deselected slots
    if (!selectedMealWindows.includes('LUNCH')) {
      setLunchPricing({ pricing: null, voucherInfo: null, error: null });
    }
    if (!selectedMealWindows.includes('DINNER')) {
      setDinnerPricing({ pricing: null, voucherInfo: null, error: null });
    }

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value?.data) {
        const { slot, data } = result.value;
        if (data?.success && data.data) {
          const d = data.data as any;
          const slotPricing: SlotPricing = {
            pricing: d.breakdown,
            voucherInfo: d.voucherEligibility || null,
            error: null,
          };
          if (slot === 'LUNCH') setLunchPricing(slotPricing);
          else setDinnerPricing(slotPricing);
        }
      } else if (result.status === 'rejected') {
        console.error('[CartScreen] Error calculating pricing for slot:', result.reason);
      }
    });

    setIsCalculating(false);
  }, [cartItems, kitchenId, menuType, selectedMealWindows, localSelectedAddressId, slotVoucherCounts, couponCode, getOrderItemsForSlot, isSchedulingMode, scheduledDate]);

  // Backward compat: single calculatePricing reference
  const calculatePricing = calculateAllPricing;

  // Recalculate pricing on changes
  useEffect(() => {
    calculateAllPricing();
  }, [calculateAllPricing, cartItems, slotVoucherCounts, kitchenId, menuType, localSelectedAddressId, couponCode]);

  // Handle placing order — supports dual-slot (creates one order per selected slot)
  // In scheduling mode, uses createScheduledMeal instead of createOrder
  const handlePlaceOrder = async () => {
    console.log('[CartScreen] handlePlaceOrder called, isSchedulingMode:', isSchedulingMode);
    console.log('  - selectedMealWindows:', selectedMealWindows);

    if (!localSelectedAddressId || cartItems.length === 0) {
      showAlert('Error', 'Please ensure you have items in cart and a delivery address selected', undefined, 'error');
      return;
    }

    if (!isSchedulingMode && (!kitchenId || !menuType)) {
      showAlert('Error', 'Please ensure you have items in cart and a delivery address selected', undefined, 'error');
      return;
    }

    if (selectedMealWindows.length === 0) {
      showAlert('Error', 'Please select a delivery slot', undefined, 'error');
      return;
    }

    // Safety check: Prevent voucher orders after cutoff per slot (skip in scheduling mode)
    if (!isSchedulingMode) {
      for (const slot of selectedMealWindows) {
        const cutoff = slot === 'LUNCH' ? lunchCutoff : dinnerCutoff;
        if (slotVoucherCounts[slot] > 0 && !cutoff.canUseVoucher) {
          showAlert(
            'Voucher Unavailable',
            `${slot === 'LUNCH' ? 'Lunch' : 'Dinner'} voucher ordering time has passed. Please remove the voucher to continue.`,
            undefined,
            'error'
          );
          setSlotVoucherCount(slot, 0);
          return;
        }
      }
    }

    setIsPlacingOrder(true);

    const slots = [...selectedMealWindows];
    const orderResults: Array<{ orderId: string; orderNumber: string; amountToPay: number; cancelDeadline?: string; slot: string }> = [];
    let totalAmountToPay = 0;

    try {
      // Step 1: Create orders for each slot
      for (const slot of slots) {
        const slotItems = getOrderItemsForSlot(slot);
        if (slotItems.length === 0) continue;

        const slotVouchers = slotVoucherCounts[slot] || 0;
        const slotPricingData = slot === 'LUNCH' ? lunchPricing.pricing : dinnerPricing.pricing;

        if (isSchedulingMode) {
          // SCHEDULING MODE: use createScheduledMeal
          const response = await apiService.createScheduledMeal({
            deliveryAddressId: localSelectedAddressId,
            mealWindow: slot,
            scheduledDate: scheduledDate!,
            items: slotItems.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              addons: item.addons,
            })),
            voucherCount: slotVouchers || undefined,
            couponCode: couponCode || undefined,
            specialInstructions: cookingInstructions.trim() || undefined,
            leaveAtDoor: leaveAtDoor || undefined,
            doNotContact: doNotContact || undefined,
          });

          console.log(`[CartScreen] createScheduledMeal response for ${slot}:`, JSON.stringify(response));

          if (!response.success) {
            throw new Error(response.message || `Failed to schedule ${slot} meal`);
          }

          const { order, paymentRequired } = response.data;
          const orderId = order.id || order._id || '';
          const orderNumber = order.orderNumber;
          const orderAmountToPay = paymentRequired ? (order.pricing?.amountToPay || slotPricingData?.amountToPay || 0) : 0;

          orderResults.push({ orderId, orderNumber, amountToPay: orderAmountToPay, slot });
          totalAmountToPay += orderAmountToPay;
        } else {
          // TODAY MODE: use createOrder
          const orderPayload = {
            kitchenId: kitchenId!,
            menuType: menuType!,
            mealWindow: slot,
            deliveryAddressId: localSelectedAddressId,
            items: slotItems,
            voucherCount: slotVouchers,
            couponCode: couponCode || null,
            paymentMethod: slotVouchers > 0 && slotPricingData?.amountToPay === 0 ? 'VOUCHER_ONLY' : 'UPI',
            specialInstructions: cookingInstructions.trim() || undefined,
            leaveAtDoor: leaveAtDoor || undefined,
            doNotContact: doNotContact || undefined,
          };

          let response = await apiService.createOrder(orderPayload);
          console.log(`[CartScreen] createOrder response for ${slot}:`, JSON.stringify(response));

          // Handle duplicate order warning
          if (response.success && response.data?.warning) {
            const warningData = response.data;
            const sourceLabel = warningData.existingOrder?.orderSource === 'AUTO_ORDER'
              ? 'Auto-Order Already Placed'
              : warningData.existingOrder?.orderSource === 'SCHEDULED'
                ? 'Scheduled Order Exists'
                : 'Order Already Placed';

            const userConfirmed = await new Promise<boolean>((resolve) => {
              showAlert(
                sourceLabel,
                warningData.message || 'You already have an order for this meal window. Place another?',
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Place Anyway', onPress: () => resolve(true) },
                ],
                'warning'
              );
            });

            if (!userConfirmed) {
              setIsPlacingOrder(false);
              return;
            }

            // Re-send with confirmed: true
            response = await apiService.createOrder({ ...orderPayload, confirmed: true });
            console.log(`[CartScreen] createOrder confirmed response for ${slot}:`, JSON.stringify(response));
          }

          const isSuccess = response.success || (response as any).message === true;
          const orderData = response.data?.order ? response.data : (response as any).error;

          if (!isSuccess || !orderData?.order) {
            throw new Error(`Failed to create ${slot} order`);
          }

          const orderId = orderData.order._id;
          const orderNumber = orderData.order.orderNumber;
          const orderAmountToPay = orderData.amountToPay || 0;
          const cancelDeadline = orderData.cancelDeadline || undefined;

          orderResults.push({ orderId, orderNumber, amountToPay: orderAmountToPay, cancelDeadline, slot });
          totalAmountToPay += orderAmountToPay;
        }
      }

      // Refresh voucher data if any vouchers were used
      if (voucherCount > 0) {
        fetchVouchers().catch(err => console.error('[CartScreen] Error refreshing vouchers:', err));
      }

      // Step 2: Process payments sequentially
      for (const result of orderResults) {
        const shouldPay = result.amountToPay > 0;
        if (shouldPay) {
          console.log(`[CartScreen] Processing payment for ${result.slot} order ${result.orderNumber}...`);
          const paymentResult = await processOrderPayment(result.orderId);

          if (!paymentResult.success) {
            const successfulOrders = orderResults.filter(r => r.orderId !== result.orderId);
            const successInfo = successfulOrders.length > 0
              ? `\n\nOrder(s) ${successfulOrders.map(r => r.orderNumber).join(', ')} were placed successfully.`
              : '';

            showAlert(
              'Payment Failed',
              `Payment failed for ${result.slot === 'LUNCH' ? 'Lunch' : 'Dinner'} order #${result.orderNumber}.${successInfo}\n\nYou can retry payment from Your Orders.`,
              [
                { text: 'Go to Orders', onPress: () => navigation.navigate('YourOrders') },
                { text: 'OK', style: 'cancel' },
              ],
              'error'
            );
            setIsPlacingOrder(false);
            return;
          }
        }
      }

      // Step 3: All successful
      dataPreloader.invalidateCache('orders');
      if (voucherCount > 0) {
        dataPreloader.invalidateCache('vouchers');
      }

      if (isSchedulingMode) {
        // Scheduling success: show alert and navigate to MyScheduledMeals
        const orderNumbers = orderResults.map(r => r.orderNumber).join(' & ');
        showAlert(
          'Meal Scheduled!',
          `Your meal${orderResults.length > 1 ? 's' : ''} for ${scheduledDate} ${orderResults.length > 1 ? 'have' : 'has'} been scheduled successfully. (${orderNumbers})`,
          [
            { text: 'View Scheduled Meals', onPress: () => navigation.navigate('MyScheduledMeals') },
            { text: 'OK', style: 'cancel', onPress: () => navigation.goBack() },
          ],
          'success'
        );
      } else {
        // Today success: show success modal
        const bonusVouchers = orderResults.reduce((sum, r) => sum, 0);
        setExtraVouchersIssued(bonusVouchers);
        setOrderResult({
          orderId: orderResults[0].orderId,
          orderNumber: orderResults.map(r => r.orderNumber).join(' & '),
          amountToPay: totalAmountToPay,
          cancelDeadline: orderResults[0].cancelDeadline,
        });
        setShowSuccessModal(true);
        setPendingPaymentOrderId(null);
      }

    } catch (error: any) {
      console.error('Error placing order:', JSON.stringify(error));

      if (orderResults.length > 0) {
        showAlert(
          'Partial Order Issue',
          `${orderResults.length} order(s) placed successfully, but an error occurred. Check Your Orders for details.`,
          [
            { text: 'Go to Orders', onPress: () => navigation.navigate('YourOrders') },
            { text: 'OK', style: 'cancel' },
          ],
          'warning'
        );
      } else {
        const errorMessage = error.message || error.data || 'Failed to place order. Please try again.';
        const errorDetail = error.error ? (typeof error.error === 'string' ? error.error : JSON.stringify(error.error)) : '';
        showAlert('Order Failed', errorDetail ? `${errorMessage}\n${errorDetail}` : errorMessage, undefined, 'error');
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Handle retry payment for failed orders
  const handleRetryPayment = async (orderId: string, orderNumber: string, amountToPay: number) => {
    console.log('[CartScreen] Retrying payment for order:', orderId);
    setIsPlacingOrder(true);

    try {
      const paymentResult = await retryOrderPayment(orderId);

      if (paymentResult.success) {
        console.log('[CartScreen] Retry payment successful!');

        // Invalidate cached data after successful retry payment
        console.log('[CartScreen] 🗑️ Invalidating orders cache after retry payment');
        dataPreloader.invalidateCache('orders');

        setOrderResult({ orderId, orderNumber, amountToPay });
        setShowSuccessModal(true);
        setPendingPaymentOrderId(null);
      } else {
        if (paymentResult.error === 'Payment cancelled') {
          showAlert(
            'Payment Cancelled',
            'You can retry payment from your orders.',
            [{ text: 'OK' }],
            'warning'
          );
        } else {
          showAlert(
            'Payment Failed',
            paymentResult.error || 'Payment could not be processed.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Retry Again',
                onPress: () => handleRetryPayment(orderId, orderNumber, amountToPay),
              },
            ],
            'error'
          );
        }
      }
    } catch (error: any) {
      console.error('[CartScreen] Retry payment error:', error);
      showAlert('Error', error.message || 'Failed to process payment', undefined, 'error');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const updateQuantity = (id: string, increment: boolean) => {
    const item = cartItems.find(i => i.id === id);
    if (item) {
      if (!increment && item.quantity === 1) {
        // Remove item if trying to decrease from 1
        removeItem(id);
      } else {
        const newQuantity = increment ? item.quantity + 1 : item.quantity - 1;
        updateCartQuantity(id, newQuantity);
      }
    }
  };

  const handleSelectAddress = (addressId: string) => {
    setLocalSelectedAddressId(addressId);
  };

  const handleGoHome = () => {
    setShowSuccessModal(false);
    resetOrderContext();
    navigation.navigate('Home');
  };

  const handleTrackOrder = () => {
    setShowSuccessModal(false);
    if (orderResult) {
      resetOrderContext();
      // For multi-orders (orderNumber contains " & "), go to YourOrders list
      if (orderResult.orderNumber.includes(' & ')) {
        navigation.navigate('YourOrders');
      } else {
        navigation.navigate('OrderTracking', { orderId: orderResult.orderId });
      }
    }
  };

  const handleCancelOrder = async () => {
    if (!orderResult) return;
    try {
      console.log('[CartScreen] Cancelling order:', orderResult.orderId);
      const response = await apiService.cancelOrder(orderResult.orderId, 'Changed my mind');
      const isSuccess = response.success === true || (response as any).message === true;
      const responseData = (response as any).error || response.data;

      if (isSuccess) {
        console.log('[CartScreen] Order cancelled successfully');
        setShowSuccessModal(false);
        resetOrderContext();
        const successMessage = responseData?.message ||
          (typeof response.data === 'string' ? response.data : 'Order cancelled successfully.');
        showAlert('Order Cancelled', successMessage, [
          { text: 'OK', onPress: () => navigation.navigate('Home') },
        ], 'success');
      } else {
        const errorMessage = typeof response.data === 'string'
          ? response.data
          : (response.message && typeof response.message === 'string' ? response.message : 'Failed to cancel order');
        showAlert('Cannot Cancel', errorMessage, undefined, 'error');
      }
    } catch (err: any) {
      console.error('[CartScreen] Cancel error:', err.message || err);
      showAlert('Error', err.message || 'Failed to cancel order', undefined, 'error');
    }
  };

  // Combined pricing display values from both slots
  const localFallbackSubtotal = cartItems.reduce((sum, item) => {
    let itemTotal = item.price * item.quantity;
    if (item.addons) {
      item.addons.forEach(addon => {
        itemTotal += addon.unitPrice * addon.quantity * item.quantity;
      });
    }
    return sum + itemTotal;
  }, 0);

  const lunchSubtotal = lunchPricing.pricing?.subtotal ?? 0;
  const dinnerSubtotal = dinnerPricing.pricing?.subtotal ?? 0;
  const subtotal = (lunchSubtotal + dinnerSubtotal) || localFallbackSubtotal;

  const lunchCharges = lunchPricing.pricing?.charges ?? { deliveryFee: 0, serviceFee: 0, packagingFee: 0, handlingFee: 0, platformFee: 0, surgeFee: 0, smallOrderFee: 0, lateNightFee: 0, taxAmount: 0 };
  const dinnerCharges = dinnerPricing.pricing?.charges ?? { deliveryFee: 0, serviceFee: 0, packagingFee: 0, handlingFee: 0, platformFee: 0, surgeFee: 0, smallOrderFee: 0, lateNightFee: 0, taxAmount: 0 };
  const totalCharges = (lunchCharges.deliveryFee + lunchCharges.serviceFee + lunchCharges.packagingFee + (lunchCharges.platformFee || 0) + (lunchCharges.surgeFee || 0) + (lunchCharges.smallOrderFee || 0) + (lunchCharges.lateNightFee || 0) + lunchCharges.taxAmount)
    + (dinnerCharges.deliveryFee + dinnerCharges.serviceFee + dinnerCharges.packagingFee + (dinnerCharges.platformFee || 0) + (dinnerCharges.surgeFee || 0) + (dinnerCharges.smallOrderFee || 0) + (dinnerCharges.lateNightFee || 0) + dinnerCharges.taxAmount);

  const voucherDiscount = (lunchPricing.pricing?.voucherCoverage?.value ?? 0) + (dinnerPricing.pricing?.voucherCoverage?.value ?? 0);

  const getCouponDiscount = (p: PricingBreakdown | null) => {
    if (!p) return 0;
    const amt = (p.discount?.discountAmount ?? 0) + (p.discount?.addonDiscountAmount ?? 0);
    return amt || (p.discount?.value ?? 0);
  };
  const couponDiscount = getCouponDiscount(lunchPricing.pricing) + getCouponDiscount(dinnerPricing.pricing);
  const couponExtraVouchers = (lunchPricing.pricing?.discount?.extraVouchersToIssue ?? 0)
    + (dinnerPricing.pricing?.discount?.extraVouchersToIssue ?? 0);
  const couponDiscountType = lunchPricing.pricing?.discount?.discountType || dinnerPricing.pricing?.discount?.discountType || null;
  const totalDiscount = voucherDiscount + couponDiscount;

  // Check if cart has any add-ons
  const hasAddons = cartItems.some(item => item.addons && item.addons.length > 0);

  // Auto-clear addon coupons when no addons are selected
  useEffect(() => {
    if (!hasAddons && couponCode && pricing?.discount?.discountType) {
      const dt = pricing.discount.discountType;
      if (dt === 'FREE_ADDON_COUNT' || dt === 'FREE_ADDON_VALUE') {
        setCouponCode(null);
      }
    }
  }, [hasAddons, couponCode, pricing?.discount?.discountType, setCouponCode]);

  // Combined amountToPay from both slots
  const lunchAmountToPay = lunchPricing.pricing?.amountToPay ?? 0;
  const dinnerAmountToPay = dinnerPricing.pricing?.amountToPay ?? 0;
  const hasBackendPricing = lunchPricing.pricing !== null || dinnerPricing.pricing !== null;
  const amountToPay = hasBackendPricing
    ? (lunchAmountToPay + dinnerAmountToPay)
    : Math.max(0, subtotal + totalCharges - totalDiscount);

  // Debug: Log pricing changes with alert for debugging
  useEffect(() => {
    console.log('[CartScreen] ===== PRICING DISPLAY DEBUG =====');
    console.log('  - pricing object:', pricing ? 'exists' : 'null');
    console.log('  - pricing.subtotal:', pricing?.subtotal);
    console.log('  - pricing.amountToPay:', pricing?.amountToPay);
    console.log('  - pricing.grandTotal:', pricing?.grandTotal);
    console.log('  - pricing.voucherCoverage:', JSON.stringify(pricing?.voucherCoverage));
    console.log('  - pricing.discount:', JSON.stringify(pricing?.discount));
    console.log('  - pricing.charges:', JSON.stringify(pricing?.charges));
    console.log('  - calculated subtotal (display):', subtotal);
    console.log('  - calculated voucherDiscount (display):', voucherDiscount);
    console.log('  - calculated couponDiscount (display):', couponDiscount);
    console.log('  - calculated totalDiscount (display):', totalDiscount);
    console.log('  - calculated totalCharges (display):', totalCharges);
    console.log('  - calculated amountToPay (display):', amountToPay);
    console.log('  - current voucherCount:', voucherCount);
    console.log('  - cart items count:', cartItems.length);
    console.log('=====================================');

    // Debug alert when there's a discount but voucherCount is 0
    if (voucherDiscount > 0 && voucherCount === 0) {
      console.log('🚨 BUG DETECTED: voucherDiscount is', voucherDiscount, 'but voucherCount is 0!');
      console.log('🚨 Backend returned incorrect pricing with voucherCoverage:', pricing?.voucherCoverage);
    }
  }, [pricing, subtotal, voucherDiscount, couponDiscount, totalDiscount, totalCharges, amountToPay, voucherCount, cartItems.length]);

  // Voucher UI state - use pricing API's voucherInfo as authoritative source when available
  const effectiveVoucherCount = Math.max(usableVouchers, voucherInfo?.available ?? 0);
  const hasVouchers = effectiveVoucherCount > 0;
  // Calculate max vouchers that can be used based on thali count (main courses)
  const thaliCount = cartItems.reduce((sum, item) => item.hasVoucher !== false ? sum + item.quantity : sum, 0);
  const maxVouchersCanUse = Math.min(effectiveVoucherCount, thaliCount);
  // Show "Click to Redeem" button when:
  // 1. User has vouchers in their account (hasVouchers)
  // 2. No voucher is currently applied to this order (voucherCount === 0)
  // 3. Either voucherInfo is not loaded yet OR (canUse > 0 AND cutoff not passed)
  // The backend now correctly calculates canUse based on available vouchers, main courses, and cutoff time
  const canUseVoucher = voucherInfo ? maxVouchersCanUse > 0 && !voucherInfo.cutoffPassed : true;
  const showRedeemButton = hasVouchers && voucherCount === 0 && canUseVoucher;

  // Debug logging for cart items
  useEffect(() => {
    console.log('[CartScreen] Cart items debug:');
    console.log('  - cartItems count:', cartItems.length);
    cartItems.forEach((item, idx) => {
      console.log(`  - Item ${idx}: ${item.name}, addons:`, JSON.stringify(item.addons));
    });
  }, [cartItems]);

  // Auto-adjust voucher count when thali count decreases
  // This ensures voucherCount never exceeds the number of thalis in cart
  useEffect(() => {
    if (voucherCount > thaliCount) {
      console.log('[CartScreen] Adjusting voucherCount to match thaliCount');
      console.log('  - voucherCount was:', voucherCount);
      console.log('  - thaliCount is:', thaliCount);
      setVoucherCount(thaliCount);
    }
  }, [thaliCount, voucherCount, setVoucherCount]);

  // Debug logging for voucher UI state
  useEffect(() => {
    console.log('[CartScreen] Voucher UI Debug:');
    console.log('  - voucherSummary:', JSON.stringify(voucherSummary));
    console.log('  - voucherSummary.available:', voucherSummary?.available);
    console.log('  - hasVouchers:', hasVouchers);
    console.log('  - voucherCount:', voucherCount);
    console.log('  - voucherInfo:', JSON.stringify(voucherInfo));
    console.log('  - voucherInfo?.canUse:', voucherInfo?.canUse);
    console.log('  - voucherInfo?.cutoffPassed:', voucherInfo?.cutoffPassed);
    console.log('  - canUseVoucher:', canUseVoucher);
    console.log('  - showRedeemButton:', showRedeemButton);
    console.log('  - thaliCount:', thaliCount);
    console.log('  - usableVouchers:', usableVouchers);
    console.log('  - maxVouchersCanUse:', maxVouchersCanUse);
  }, [voucherSummary, hasVouchers, voucherCount, voucherInfo, canUseVoucher, showRedeemButton, thaliCount, usableVouchers, maxVouchersCanUse]);

  // Helper: apply 1 voucher to each selected eligible slot
  const applyVouchersToSlots = useCallback(() => {
    console.log('[CartScreen] applyVouchersToSlots called');
    selectedMealWindows.forEach(slot => {
      const cutoff = slot === 'LUNCH' ? lunchCutoff : dinnerCutoff;
      if (cutoff.canUseVoucher) {
        console.log(`  - Setting ${slot} voucher to 1`);
        setSlotVoucherCount(slot, 1);
      }
    });
  }, [selectedMealWindows, lunchCutoff, dinnerCutoff, setSlotVoucherCount]);

  // Auto-apply voucher when eligible (cutoff not passed and vouchers available)
  useEffect(() => {
    // Only auto-apply once per cart session
    if (hasAutoApplied) return;

    // Check if voucher can be auto-applied
    if (voucherInfo && !voucherInfo.cutoffPassed && maxVouchersCanUse > 0 && voucherCount === 0 && hasVouchers) {
      console.log('[CartScreen] Auto-applying voucher');
      applyVouchersToSlots();
      setHasAutoApplied(true);
    }
  }, [voucherInfo, voucherCount, hasVouchers, hasAutoApplied, applyVouchersToSlots, maxVouchersCanUse]);

  // Reset auto-apply flag when cart is emptied
  useEffect(() => {
    if (cartItems.length === 0) {
      setHasAutoApplied(false);
    }
  }, [cartItems.length]);

  // (voucher auto-remove on cutoff is handled in the slot cutoff effect above)

  // Auto-trigger order placement for "Buy Now" flow
  useEffect(() => {
    const directCheckout = route.params?.directCheckout;

    if (directCheckout && cartItems.length > 0 && localSelectedAddressId) {
      console.log('[CartScreen] Direct checkout detected, auto-placing order');

      // Small delay to ensure UI is ready and state is fully updated
      const timer = setTimeout(() => {
        handlePlaceOrder();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [route.params?.directCheckout, cartItems.length, localSelectedAddressId]);

  // Handler to remove all vouchers
  const handleRemoveVoucher = useCallback(() => {
    console.log('[CartScreen] Removing all vouchers');
    // Clear pricing state to immediately remove discount from UI
    setLunchPricing(prev => ({ ...prev, pricing: null, voucherInfo: null }));
    setDinnerPricing(prev => ({ ...prev, pricing: null, voucherInfo: null }));
    // Reset all slot voucher counts
    setSlotVoucherCount('LUNCH', 0);
    setSlotVoucherCount('DINNER', 0);
  }, [setSlotVoucherCount]);

  // Handler to add one more voucher
  const handleAddMoreVoucher = () => {
    console.log('[CartScreen] Adding one more voucher');
    handleIncrementVoucher();
  };

  // Handler to apply voucher (click to redeem)
  const handleApplyVoucher = () => {
    console.log('[CartScreen] handleApplyVoucher called');
    console.log('  - current voucherCount:', voucherCount);
    console.log('  - hasVouchers:', hasVouchers);
    console.log('  - usableVouchers:', usableVouchers);

    if (maxVouchersCanUse > 0 || hasVouchers) {
      applyVouchersToSlots();
    }
  };

  // Handler to increment voucher count
  const handleIncrementVoucher = () => {
    console.log('[CartScreen] handleIncrementVoucher called');
    console.log('  - current voucherCount:', voucherCount);
    console.log('  - maxVouchersCanUse:', maxVouchersCanUse);

    if (voucherCount < maxVouchersCanUse) {
      // Add 1 more to the first selected slot that has room
      for (const slot of selectedMealWindows) {
        const cutoff = slot === 'LUNCH' ? lunchCutoff : dinnerCutoff;
        if (cutoff.canUseVoucher) {
          const current = slotVoucherCounts[slot] || 0;
          const slotItems = getItemsForSlot(slot);
          const slotThalis = slotItems.reduce((sum, item) => item.hasVoucher !== false ? sum + item.quantity : sum, 0);
          if (current < slotThalis) {
            setSlotVoucherCount(slot, current + 1);
            break;
          }
        }
      }
    }
  };

  // Handler to decrement voucher count
  const handleDecrementVoucher = () => {
    console.log('[CartScreen] handleDecrementVoucher called');
    console.log('  - current voucherCount:', voucherCount);

    if (voucherCount > 1) {
      // Remove 1 from the last selected slot that has vouchers
      for (let i = selectedMealWindows.length - 1; i >= 0; i--) {
        const slot = selectedMealWindows[i];
        const current = slotVoucherCounts[slot] || 0;
        if (current > 0) {
          setSlotVoucherCount(slot, current - 1);
          break;
        }
      }
    } else {
      // Removing last voucher
      handleRemoveVoucher();
    }
  };

  // Format 24hr time (e.g. "14:00") to 12hr (e.g. "2:00 PM")
  const formatCutoffTime = (time24: string) => {
    const [hourStr, minuteStr] = time24.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = minuteStr || '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  // Check if cart is empty
  if (cartItems.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View className="bg-white px-5 pt-4 pb-4">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-full bg-orange-400 items-center justify-center mr-4"
            >
              <Image
                source={require('../../assets/icons/arrow.png')}
                style={{ width: 32, height: 32 }}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-900 text-center">My Cart</Text>
            </View>
            <View className="w-10" />
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">🛒</Text>
          <Text className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</Text>
          <Text className="text-gray-500 text-center mb-6">Add some delicious meals to get started!</Text>
          <TouchableOpacity
            className="bg-orange-400 px-8 py-3 rounded-full"
            onPress={() => navigation.navigate('Home')}
          >
            <Text className="text-white font-semibold text-base">Browse Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-4">
        <View className="flex-row items-center mb-2">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-orange-400 items-center justify-center mr-4"
          >
            <Image
              source={require('../../assets/icons/arrow.png')}
              style={{ width: 32, height: 32 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900 text-center">My Cart</Text>
          </View>
          <View className="w-10" />
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Your Order Section */}
        <View className="bg-white mb-4" style={{ paddingHorizontal: SPACING.screenHorizontal, paddingTop: isSmallDevice ? SPACING.lg : SPACING.xl, paddingBottom: isSmallDevice ? 10 : 14 }}>
          <Text className="text-xl font-bold text-gray-900 mb-4">Your Order</Text>

          {cartItems.map((item) => (
            <React.Fragment key={item.id}>
              {/* Main Item */}
              <View className="flex-row items-center mb-4 pb-4 border-b border-gray-100">
                {/* Item Image */}
                <Image
                  source={item.image}
                  className="w-16 h-16 rounded-full"
                  resizeMode="cover"
                />

                {/* Item Details */}
                <View className="flex-1 ml-4">
                  <Text className="text-base font-bold text-gray-900">{item.name}</Text>
                  <Text className="text-sm text-gray-500 mt-1">
                    {item.subtitle}{' '}
                    <Text className="text-gray-900 font-semibold">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </Text>
                  </Text>
                  {item.hasVoucher && item.mealWindow && (slotVoucherCounts[item.mealWindow] || 0) > 0 && (
                    <View className="flex-row items-center mt-2">
                      <Image
                        source={require('../../assets/icons/voucher.png')}
                        style={{ width: 14, height: 14, tintColor: '#16A34A', marginRight: 4 }}
                        resizeMode="contain"
                      />
                      <Text className="text-xs text-green-600 font-semibold">
                        Voucher Applied
                      </Text>
                    </View>
                  )}
                </View>

                {/* Quantity Controls & Delete */}
                <View className="items-end">
                  <View
                    className="flex-row items-center mb-2"
                    style={{ borderWidth: 1, borderColor: 'rgba(232, 235, 234, 1)', borderRadius: 60, paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <TouchableOpacity
                      onPress={() => updateQuantity(item.id, false)}
                      className="rounded-full items-center justify-center"
                      style={{ minWidth: TOUCH_TARGETS.minimum, minHeight: TOUCH_TARGETS.minimum }}
                    >
                      <Text className="text-gray-600 font-bold text-sm">−</Text>
                    </TouchableOpacity>
                    <Text className="mx-3 text-sm font-semibold">{item.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => updateQuantity(item.id, true)}
                      className="rounded-full items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(255, 217, 197, 1)',
                        minWidth: TOUCH_TARGETS.minimum,
                        minHeight: TOUCH_TARGETS.minimum
                      }}
                    >
                      <Image
                        source={require('../../assets/icons/plus.png')}
                        style={{ width: 23, height: 23 }}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Image
                      source={require('../../assets/icons/delete2.png')}
                      style={{ width: 20, height: 20 }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </React.Fragment>
          ))}

          {/* Add-ons — unified list of all available addons */}
          <AddonSelector
            availableAddons={availableAddons}
            selectedAddons={(cartItems[0]?.addons || []).map(a => ({
              addonId: a.addonId,
              name: a.name,
              quantity: a.quantity,
              unitPrice: a.unitPrice,
            }))}
            onAdd={(addon) => {
              const cartItem = cartItems[0];
              if (cartItem) {
                addAddonToItem(cartItem.id, {
                  addonId: addon._id,
                  name: addon.name,
                  quantity: 1,
                  unitPrice: addon.price,
                });
              }
            }}
            onRemove={(addonId) => {
              const cartItem = cartItems[0];
              if (cartItem?.addons) {
                const idx = cartItem.addons.findIndex(a => a.addonId === addonId);
                if (idx >= 0) removeAddon(cartItem.id, idx);
              }
            }}
            onQuantityChange={(addonId, quantity) => {
              const cartItem = cartItems[0];
              if (cartItem?.addons) {
                const idx = cartItem.addons.findIndex(a => a.addonId === addonId);
                if (idx >= 0) updateAddonQuantity(cartItem.id, idx, quantity);
              }
            }}
          />
        </View>

        {/* Vouchers Banner */}
        {voucherInfo && (
          <View className="mx-5 mb-4">
            {/* Applied Voucher Display */}
            {voucherCount > 0 && !voucherInfo.cutoffPassed ? (
              <View>
                {/* Applied Voucher Card */}
                <View
                  className="bg-green-50 rounded-2xl px-4 py-3 flex-row items-center justify-between mb-2"
                  style={{
                    borderWidth: 1,
                    borderColor: '#BBF7D0',
                  }}
                >
                  <View className="flex-row items-center flex-1">
                    <Image
                      source={require('../../assets/icons/voucher.png')}
                      style={{ width: 20, height: 20, tintColor: '#16A34A', marginRight: 10 }}
                      resizeMode="contain"
                    />
                    <View>
                      <Text className="text-green-700 font-semibold" style={{ fontSize: 14 }}>
                        {voucherCount} Voucher{voucherCount > 1 ? 's' : ''} Applied
                      </Text>
                      <Text className="text-green-600 text-xs">
                        Saving ₹{(cartItems.find(item => item.hasVoucher !== false)?.price || 0) * voucherCount}
                      </Text>
                    </View>
                  </View>
                  {/* Remove Button */}
                  <TouchableOpacity
                    onPress={handleRemoveVoucher}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: 'white',
                      borderWidth: 1.5,
                      borderColor: '#FE8733',
                    }}
                  >
                    <Text className="text-red-500 font-bold text-lg">×</Text>
                  </TouchableOpacity>
                </View>

                {/* Add More Voucher Button - Only show if more thalis than vouchers applied */}
                {voucherCount < maxVouchersCanUse && (
                  <TouchableOpacity
                    onPress={handleAddMoreVoucher}
                    className="bg-orange-400 rounded-full px-4 py-3 flex-row items-center justify-center"
                  >
                    <Image
                      source={require('../../assets/icons/whitevoucher.png')}
                      style={{ width: 18, height: 18, tintColor: 'white', marginRight: 8 }}
                      resizeMode="contain"
                    />
                    <Text className="text-white font-semibold text-sm">
                      + Add Another Voucher ({maxVouchersCanUse - voucherCount} more available)
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              /* No Voucher Applied - Show Available Vouchers Banner */
              <View
                className="bg-orange-400 rounded-full pl-6 pr-2 flex-row items-center justify-between"
                style={{
                  height: 60,
                }}
              >
                <View className="flex-row items-center flex-1">
                  <Image
                    source={require('../../assets/icons/whitevoucher.png')}
                    style={{ width: 20, height: 20, tintColor: 'white', marginRight: 8 }}
                    resizeMode="contain"
                  />
                  <Text className="text-white font-semibold" style={{ fontSize: 14 }}>
                    {voucherInfo.available} vouchers available
                  </Text>
                </View>
                {voucherInfo.cutoffPassed ? (
                  <View className="bg-white rounded-full px-4 items-center justify-center" style={{ height: 46 }}>
                    <Text className="text-red-500 font-semibold text-xs">Not Available</Text>
                  </View>
                ) : maxVouchersCanUse > 0 ? (
                  <TouchableOpacity
                    className="bg-white rounded-full px-5 items-center justify-center"
                    style={{ height: 46 }}
                    onPress={handleApplyVoucher}
                  >
                    <Text className="text-orange-400 font-semibold text-sm">Use Voucher</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    className="bg-white rounded-full px-5 items-center justify-center"
                    style={{ height: 46 }}
                    onPress={() => navigation.navigate('MealPlans')}
                  >
                    <Text className="text-orange-400 font-semibold text-sm">Buy Vouchers</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {voucherInfo.cutoffPassed && (
              <Text className="text-sm mt-2 text-center" style={{ color: '#92400E' }}>
                {mealWindow === 'DINNER' ? 'Dinner' : 'Lunch'} voucher ordering closed — cutoff was{' '}
                <Text className="font-semibold">
                  {formatCutoffTime(voucherInfo.cutoffInfo.voucherCutoffTime || voucherInfo.cutoffInfo.cutoffTime)}
                </Text>
              </Text>
            )}
            {!voucherInfo.cutoffPassed && usableVouchers === 0 && (
              <Text className="text-gray-500 text-xs mt-2 text-center">
                Purchase a meal plan to get vouchers and save on orders!
              </Text>
            )}
          </View>
        )}

        {/* Date banner — scheduling mode vs today */}
        <View className="bg-white mb-4" style={{ paddingHorizontal: SPACING.screenHorizontal, paddingVertical: isSmallDevice ? SPACING.lg : SPACING.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <MaterialCommunityIcons
                name={isSchedulingMode ? 'calendar-clock' : 'calendar-today'}
                size={20}
                color={isSchedulingMode ? '#3B82F6' : '#FE8733'}
                style={{ marginRight: 10 }}
              />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>
                  {isSchedulingMode ? 'Scheduling Meal' : 'Ordering for Today'}
                </Text>
                <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                  {isSchedulingMode
                    ? new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })
                    : new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })
                  }
                </Text>
              </View>
            </View>
            {!isSchedulingMode && (
              <TouchableOpacity
                onPress={() => navigation.navigate('MealCalendar')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FFF7ED',
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: '#FDBA74',
                }}
              >
                <MaterialCommunityIcons name="calendar-month" size={16} color="#FE8733" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FE8733', fontSize: 12, fontWeight: '600' }}>Plan Ahead</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Select Delivery Slot (multi-select) */}
        <View className="bg-white mb-4" style={{ paddingHorizontal: SPACING.screenHorizontal, paddingVertical: isSmallDevice ? SPACING.lg : SPACING.xl }}>
          <Text className="text-base font-bold text-gray-900 mb-3">Select Delivery Slot</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Lunch Card */}
            {(() => {
              const lunchState = getSlotState(lunchCutoff);
              const isSelected = selectedMealWindows.includes('LUNCH');
              const isClosed = lunchState === 'closed';
              const isCashOnly = lunchState === 'cash_only';
              return (
                <TouchableOpacity
                  onPress={() => handleToggleSlot('LUNCH')}
                  disabled={isClosed}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: isClosed ? '#E5E7EB' : isSelected ? '#FE8733' : '#E5E7EB',
                    backgroundColor: isClosed ? '#F9FAFB' : isSelected ? '#FFF7ED' : '#FFFFFF',
                    alignItems: 'center',
                    opacity: isClosed ? 0.5 : 1,
                  }}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <View style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FE8733', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓</Text>
                    </View>
                  )}
                  <MaterialCommunityIcons
                    name="white-balance-sunny"
                    size={28}
                    color={isClosed ? '#D1D5DB' : isSelected ? '#FE8733' : '#9CA3AF'}
                  />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isClosed ? '#9CA3AF' : isSelected ? '#FE8733' : '#374151', marginTop: 6 }}>
                    Lunch
                  </Text>
                  <Text style={{ fontSize: 11, color: isClosed ? '#D1D5DB' : isSelected ? '#EA580C' : '#9CA3AF', marginTop: 2 }}>
                    {lunchCutoff.voucherCutoffTime && lunchCutoff.orderCutoffTime
                      ? `${formatCutoffTime(lunchCutoff.voucherCutoffTime)} - ${formatCutoffTime(lunchCutoff.orderCutoffTime)}`
                      : lunchCutoff.voucherCutoffTime || lunchCutoff.orderCutoffTime
                        ? formatCutoffTime(lunchCutoff.voucherCutoffTime || lunchCutoff.orderCutoffTime!)
                        : '12:00 - 01:30 PM'}
                  </Text>
                  {isCashOnly && (
                    <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
                      <Text style={{ fontSize: 10, color: '#92400E', fontWeight: '600' }}>Cash Only</Text>
                    </View>
                  )}
                  {isClosed && (
                    <Text style={{ fontSize: 10, color: '#EF4444', marginTop: 4, fontWeight: '600' }}>
                      Ordering Closed{lunchCutoff.orderCutoffTime ? ` (${formatCutoffTime(lunchCutoff.orderCutoffTime)})` : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })()}

            {/* Dinner Card */}
            {(() => {
              const dinnerState = getSlotState(dinnerCutoff);
              const isSelected = selectedMealWindows.includes('DINNER');
              const isClosed = dinnerState === 'closed';
              const isCashOnly = dinnerState === 'cash_only';
              return (
                <TouchableOpacity
                  onPress={() => handleToggleSlot('DINNER')}
                  disabled={isClosed}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: isClosed ? '#E5E7EB' : isSelected ? '#FE8733' : '#E5E7EB',
                    backgroundColor: isClosed ? '#F9FAFB' : isSelected ? '#FFF7ED' : '#FFFFFF',
                    alignItems: 'center',
                    opacity: isClosed ? 0.5 : 1,
                  }}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <View style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FE8733', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓</Text>
                    </View>
                  )}
                  <MaterialCommunityIcons
                    name="moon-waning-crescent"
                    size={28}
                    color={isClosed ? '#D1D5DB' : isSelected ? '#FE8733' : '#9CA3AF'}
                  />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isClosed ? '#9CA3AF' : isSelected ? '#FE8733' : '#374151', marginTop: 6 }}>
                    Dinner
                  </Text>
                  <Text style={{ fontSize: 11, color: isClosed ? '#D1D5DB' : isSelected ? '#EA580C' : '#9CA3AF', marginTop: 2 }}>
                    {dinnerCutoff.voucherCutoffTime && dinnerCutoff.orderCutoffTime
                      ? `${formatCutoffTime(dinnerCutoff.voucherCutoffTime)} - ${formatCutoffTime(dinnerCutoff.orderCutoffTime)}`
                      : dinnerCutoff.voucherCutoffTime || dinnerCutoff.orderCutoffTime
                        ? formatCutoffTime(dinnerCutoff.voucherCutoffTime || dinnerCutoff.orderCutoffTime!)
                        : '07:00 - 08:30 PM'}
                  </Text>
                  {isCashOnly && (
                    <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
                      <Text style={{ fontSize: 10, color: '#92400E', fontWeight: '600' }}>Cash Only</Text>
                    </View>
                  )}
                  {isClosed && (
                    <Text style={{ fontSize: 10, color: '#EF4444', marginTop: 4, fontWeight: '600' }}>
                      Ordering Closed{dinnerCutoff.orderCutoffTime ? ` (${formatCutoffTime(dinnerCutoff.orderCutoffTime)})` : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>

        {/* Delivery Details */}
        <View className="bg-white mb-4" style={{ paddingHorizontal: SPACING.screenHorizontal, paddingVertical: isSmallDevice ? SPACING.lg : SPACING.xl }}>
          <Text className="text-base font-bold text-gray-900 mb-3">Delivery Details</Text>

          {/* Selected Address */}
          {addresses.length === 0 ? (
            <TouchableOpacity
              className="flex-row items-center justify-center py-4 border-b border-gray-100"
              onPress={() => navigation.navigate('Address')}
            >
              <Text className="text-orange-400 font-semibold">+ Add Delivery Address</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('Address')}
              className="flex-row items-center pb-3 mb-1 border-b border-gray-100"
              activeOpacity={0.7}
            >
              {(() => {
                const selectedAddress = addresses.find(a => a.id === localSelectedAddressId) || addresses[0];
                return (
                  <>
                    <View className="w-10 h-10 items-center justify-center mr-3">
                      <Image
                        source={
                          selectedAddress.label.toLowerCase() === 'home'
                            ? require('../../assets/icons/house2.png')
                            : require('../../assets/icons/office.png')
                        }
                        style={{ width: 32, height: 32 }}
                        resizeMode="contain"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-gray-900">{selectedAddress.label}</Text>
                      <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                        {selectedAddress.addressLine1}, {selectedAddress.locality}, {selectedAddress.city}
                      </Text>
                    </View>
                    <Text className="text-orange-400 font-semibold text-sm">Change</Text>
                  </>
                );
              })()}
            </TouchableOpacity>
          )}

          {/* Cooking Instructions */}
          <TouchableOpacity
            onPress={() => setShowCookingInput(!showCookingInput)}
            className="flex-row items-center py-3 border-b border-gray-100"
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: showCookingInput || cookingInstructions ? '#FFF7ED' : '#F3F4F6' }}
            >
              <MaterialCommunityIcons name="note-edit-outline" size={20} color={showCookingInput || cookingInstructions ? '#FE8733' : '#6B7280'} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">Cooking Instructions</Text>
              <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                {cookingInstructions || 'Add special requests for your meal'}
              </Text>
            </View>
            <Image
              source={require('../../assets/icons/down2.png')}
              style={{
                width: 14,
                height: 14,
                tintColor: '#9CA3AF',
                transform: [{ rotate: showCookingInput ? '180deg' : '0deg' }],
              }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          {showCookingInput && (
            <TextInput
              className="text-sm text-gray-900 mt-2 mb-2"
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                minHeight: 60,
                textAlignVertical: 'top',
              }}
              placeholder="E.g., Less spicy, no onions..."
              placeholderTextColor="#9CA3AF"
              value={cookingInstructions}
              onChangeText={setCookingInstructions}
              multiline
            />
          )}

          {/* Leave at Door */}
          <TouchableOpacity
            onPress={() => setLeaveAtDoor(!leaveAtDoor)}
            className="flex-row items-center py-3 border-b border-gray-100"
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: leaveAtDoor ? '#FFF7ED' : '#F3F4F6' }}
            >
              <MaterialCommunityIcons name="door-open" size={20} color={leaveAtDoor ? '#FE8733' : '#6B7280'} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">Leave at Door</Text>
              <Text className="text-xs text-gray-500 mt-0.5">Drop off without ringing the bell</Text>
            </View>
            <View
              className="w-5 h-5 rounded items-center justify-center"
              style={{
                borderWidth: 1.5,
                borderColor: leaveAtDoor ? '#FE8733' : '#D1D5DB',
                backgroundColor: leaveAtDoor ? '#FE8733' : 'white',
              }}
            >
              {leaveAtDoor && (
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>✓</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Do Not Contact */}
          <TouchableOpacity
            onPress={() => setDoNotContact(!doNotContact)}
            className="flex-row items-center py-3"
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: doNotContact ? '#FFF7ED' : '#F3F4F6' }}
            >
              <MaterialCommunityIcons name="bell-off-outline" size={20} color={doNotContact ? '#FE8733' : '#6B7280'} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">Do Not Contact</Text>
              <Text className="text-xs text-gray-500 mt-0.5">Avoid calls or messages on delivery</Text>
            </View>
            <View
              className="w-5 h-5 rounded items-center justify-center"
              style={{
                borderWidth: 1.5,
                borderColor: doNotContact ? '#FE8733' : '#D1D5DB',
                backgroundColor: doNotContact ? '#FE8733' : 'white',
              }}
            >
              {doNotContact && (
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>✓</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Coupon Section */}
        <View className="mx-5 mb-4">
          {couponCode && pricing?.discount ? (
            /* Applied Coupon Card */
            <View
              style={{
                borderWidth: 1,
                borderColor: '#BBF7D0',
                backgroundColor: '#F0FDF4',
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialCommunityIcons name="ticket-percent" size={22} color="#16A34A" />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#15803D' }}>
                      {couponCode} Applied
                    </Text>
                    {couponDiscountType === 'FREE_DELIVERY' ? (
                      <Text style={{ fontSize: 12, color: '#16A34A', marginTop: 1 }}>
                        Free delivery applied!
                      </Text>
                    ) : couponDiscount > 0 ? (
                      <Text style={{ fontSize: 12, color: '#16A34A', marginTop: 1 }}>
                        You save ₹{couponDiscount.toFixed(0)}
                      </Text>
                    ) : null}
                    {couponExtraVouchers > 0 && (
                      <Text style={{ fontSize: 12, color: '#2563EB', marginTop: 1 }}>
                        +{couponExtraVouchers} bonus meal voucher{couponExtraVouchers > 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setCouponCode(null)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: 'white',
                    borderWidth: 1.5,
                    borderColor: '#FE8733',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 16 }}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Promotional Coupon Banner */
            <TouchableOpacity
              onPress={() => setShowCouponSheet(true)}
              activeOpacity={0.8}
              style={{
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FE8733',
              }}
            >
              <MaterialCommunityIcons name="ticket-percent" size={24} color="white" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>
                  Save more with coupons!
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 }}>
                  View all coupons {'>'}
                </Text>
              </View>
              <View style={{
                backgroundColor: 'white',
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}>
                <Text style={{ color: '#FE8733', fontWeight: '700', fontSize: 13 }}>Apply</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Order Summary - Collapsible */}
        <View className="bg-white mb-4" style={{ paddingHorizontal: SPACING.screenHorizontal, paddingVertical: isSmallDevice ? SPACING.lg : SPACING.xl }}>
          {/* Collapsed Header — always visible */}
          <TouchableOpacity
            onPress={() => setSummaryExpanded(!summaryExpanded)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>To Pay</Text>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color="#9CA3AF"
                style={{ marginLeft: 6 }}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isCalculating ? (
                <ActivityIndicator size="small" color="#FE8733" />
              ) : (
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>₹{amountToPay.toFixed(2)}</Text>
              )}
              <Image
                source={require('../../assets/icons/down2.png')}
                style={{
                  width: 14,
                  height: 14,
                  tintColor: '#9CA3AF',
                  marginLeft: 8,
                  transform: [{ rotate: summaryExpanded ? '180deg' : '0deg' }],
                }}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>

          {/* Expanded Breakdown */}
          {summaryExpanded && (
            <View style={{ marginTop: 14 }}>
              {isCalculating ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <ActivityIndicator size="small" color="#FE8733" />
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 8 }}>Calculating...</Text>
                </View>
              ) : pricingError ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Pricing Error</Text>
                  <Text style={{ color: '#6B7280', textAlign: 'center', marginBottom: 12 }}>{pricingError}</Text>
                  <TouchableOpacity onPress={calculatePricing} style={{ backgroundColor: '#FE8733', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                    <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Per-slot subtotals when both selected */}
                  {selectedMealWindows.length > 1 ? (
                    <>
                      {selectedMealWindows.includes('LUNCH') && lunchSubtotal > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ fontSize: 14, color: '#374151' }}>Lunch Subtotal:</Text>
                          <Text style={{ fontSize: 14, color: '#374151' }}>₹{lunchSubtotal.toFixed(2)}</Text>
                        </View>
                      )}
                      {selectedMealWindows.includes('DINNER') && dinnerSubtotal > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ fontSize: 14, color: '#374151' }}>Dinner Subtotal:</Text>
                          <Text style={{ fontSize: 14, color: '#374151' }}>₹{dinnerSubtotal.toFixed(2)}</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, color: '#374151' }}>Subtotal:</Text>
                      <Text style={{ fontSize: 14, color: '#374151' }}>₹{subtotal.toFixed(2)}</Text>
                    </View>
                  )}

                  {/* Taxes & Charges */}
                  {totalCharges > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, color: '#374151' }}>Taxes & Charges:</Text>
                      <Text style={{ fontSize: 14, color: '#374151' }}>₹{totalCharges.toFixed(2)}</Text>
                    </View>
                  )}

                  {/* Voucher Discount */}
                  {voucherDiscount > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, color: '#10B981' }}>Voucher ({voucherCount} used):</Text>
                      <Text style={{ fontSize: 14, color: '#10B981' }}>- ₹{Math.round(voucherDiscount).toFixed(2)}</Text>
                    </View>
                  )}

                  {/* Coupon Discount */}
                  {couponCode && couponDiscountType === 'FREE_DELIVERY' && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, color: '#10B981' }}>Free Delivery ({couponCode}):</Text>
                      <Text style={{ fontSize: 14, color: '#10B981' }}>Applied</Text>
                    </View>
                  )}
                  {couponCode && couponDiscount > 0 && couponDiscountType !== 'FREE_DELIVERY' && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, color: '#10B981' }}>Discount ({couponCode}):</Text>
                      <Text style={{ fontSize: 14, color: '#10B981' }}>- ₹{Math.round(couponDiscount).toFixed(2)}</Text>
                    </View>
                  )}
                  {couponCode && couponExtraVouchers > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, color: '#2563EB' }}>Bonus Vouchers ({couponCode}):</Text>
                      <Text style={{ fontSize: 14, color: '#2563EB' }}>+{couponExtraVouchers}</Text>
                    </View>
                  )}

                  {/* Divider */}
                  <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', borderStyle: 'dashed', marginVertical: 10 }} />

                  {/* Total Amount */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Total Amount:</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>₹{amountToPay.toFixed(2)}</Text>
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* Bottom Spacing for fixed footer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'white',
          paddingBottom: Math.max(insets.bottom + 8, 16),
          paddingTop: 12,
          paddingHorizontal: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <View
          style={{
            backgroundColor: '#FE8733',
            borderRadius: 28,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 56,
            paddingLeft: 20,
            paddingRight: 6,
            opacity: (isPlacingOrder || isCalculating || addresses.length === 0 || pricingError) ? 0.7 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', marginRight: 6 }}>
              ₹{amountToPay.toFixed(2)}
            </Text>
            <Text style={{ color: 'white', fontSize: 13, opacity: 0.9 }}>Total</Text>
          </View>
          <TouchableOpacity
            style={{
              backgroundColor: 'white',
              borderRadius: 22,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              height: 44,
              paddingHorizontal: 20,
              minWidth: 130,
            }}
            onPress={handlePlaceOrder}
            disabled={isPlacingOrder || isCalculating || addresses.length === 0 || !!pricingError}
            activeOpacity={0.8}
          >
            {isPlacingOrder ? (
              <ActivityIndicator size="small" color="#FE8733" />
            ) : (
              <>
                <Text style={{ color: '#FE8733', fontWeight: '700', fontSize: 15, marginRight: 6 }}>
                  {addresses.length === 0 ? 'Add Address' : isSchedulingMode ? (amountToPay === 0 ? 'Schedule' : 'Schedule & Pay') : (amountToPay === 0 ? 'Place Order' : 'Pay Now')}
                </Text>
                <Image
                  source={require('../../assets/icons/uparrow.png')}
                  style={{ width: 14, height: 14 }}
                  resizeMode="contain"
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Coupon Selection Sheet */}
      {kitchenId && menuType && (
        <CouponSheet
          visible={showCouponSheet}
          onClose={() => setShowCouponSheet(false)}
          onApply={(code) => setCouponCode(code)}
          menuType={menuType}
          kitchenId={kitchenId}
          orderValue={subtotal}
          itemCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
          hasAddons={hasAddons}
        />
      )}

      {/* Order Success Modal */}
      <OrderSuccessModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onGoHome={handleGoHome}
        onTrackOrder={handleTrackOrder}
        onCancelOrder={handleCancelOrder}
        orderNumber={orderResult?.orderNumber}
        amountToPay={orderResult?.amountToPay}
        extraVouchersIssued={extraVouchersIssued}
        cancelDeadline={orderResult?.cancelDeadline}
      />

    </SafeAreaView>
  );
};

export default CartScreen;
