// src/context/CartContext.tsx
import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OrderItem, OrderItemAddon } from '../services/api.service';

const CART_STORAGE_KEY = '@tiffsy_cart';
const CART_CONTEXT_STORAGE_KEY = '@tiffsy_cart_context';

// Addon item in cart
export interface CartItemAddon {
  addonId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// Cart item interface
export interface CartItem {
  id: string;                    // menuItemId
  name: string;
  image: any;
  subtitle: string;
  price: number;                 // Unit price
  quantity: number;
  hasVoucher?: boolean;          // Can use voucher for this item
  addons?: CartItemAddon[];      // Nested addons
  mealWindow?: MealWindow;       // Per-item meal window tag
}

// Menu type for order
export type MenuType = 'MEAL_MENU' | 'ON_DEMAND_MENU';

// Meal window for MEAL_MENU orders
export type MealWindow = 'LUNCH' | 'DINNER';

// Per-slot voucher counts
export type SlotVoucherCounts = Record<MealWindow, number>;

interface CartContextType {
  // Cart items
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  replaceCart: (item: CartItem) => void;  // Atomic clear + add (avoids race condition)
  updateQuantity: (id: string, quantity: number) => void;
  updateAddonQuantity: (itemId: string, addonIndex: number, quantity: number) => void;
  addAddonToItem: (itemId: string, addon: CartItemAddon) => void;
  removeAddon: (itemId: string, addonIndex: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;

  // Order context
  kitchenId: string | null;
  menuType: MenuType | null;
  mealWindow: MealWindow | null;  // backward compat: returns first selected window
  deliveryAddressId: string | null;
  voucherCount: number;           // backward compat: total across slots
  couponCode: string | null;
  specialInstructions: string;
  deliveryNotes: string;

  // Setters for order context
  setKitchenId: (id: string | null) => void;
  setMenuType: (type: MenuType | null) => void;
  setMealWindow: (window: MealWindow | null) => void;
  setDeliveryAddressId: (id: string | null) => void;
  setVoucherCount: (count: number) => void;
  setCouponCode: (code: string | null) => void;
  setSpecialInstructions: (instructions: string) => void;
  setDeliveryNotes: (notes: string) => void;

  // Multi-slot support
  selectedMealWindows: MealWindow[];
  toggleMealWindow: (window: MealWindow) => void;
  addToCartForSlot: (item: CartItem, window: MealWindow) => void;
  getItemsForSlot: (window: MealWindow) => CartItem[];
  getOrderItemsForSlot: (window: MealWindow) => OrderItem[];
  removeItemsForSlot: (window: MealWindow) => void;

  // Per-slot voucher tracking
  slotVoucherCounts: SlotVoucherCounts;
  setSlotVoucherCount: (window: MealWindow, count: number) => void;

  // Helper to build order items for API
  getOrderItems: () => OrderItem[];

  // Reset order context (after successful order)
  resetOrderContext: () => void;

  // Check if cart is ready for checkout
  isReadyForCheckout: () => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Cart items state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Order context state
  const [kitchenId, setKitchenId] = useState<string | null>(null);
  const [menuType, setMenuType] = useState<MenuType | null>(null);
  const [selectedMealWindowsState, setSelectedMealWindowsState] = useState<MealWindow[]>([]);
  const [deliveryAddressId, setDeliveryAddressId] = useState<string | null>(null);
  const [slotVoucherCounts, setSlotVoucherCounts] = useState<SlotVoucherCounts>({ LUNCH: 0, DINNER: 0 });
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');

  // Backward compat: mealWindow returns first selected window
  const mealWindow: MealWindow | null = selectedMealWindowsState.length > 0
    ? selectedMealWindowsState[0]
    : null;

  // Backward compat: voucherCount returns total across slots
  const voucherCount = slotVoucherCounts.LUNCH + slotVoucherCounts.DINNER;

  // Backward compat: setMealWindow sets a single window
  const setMealWindow = useCallback((window: MealWindow | null) => {
    if (window) {
      setSelectedMealWindowsState([window]);
    } else {
      setSelectedMealWindowsState([]);
    }
  }, []);

  // Backward compat: setVoucherCount distributes to first selected slot
  const setVoucherCount = useCallback((count: number) => {
    const firstSlot = selectedMealWindowsState.length > 0 ? selectedMealWindowsState[0] : 'LUNCH';
    setSlotVoucherCounts(prev => ({ ...prev, [firstSlot]: count }));
  }, [selectedMealWindowsState]);

  // Multi-slot: toggle a meal window on/off
  const toggleMealWindow = useCallback((window: MealWindow) => {
    setSelectedMealWindowsState(prev => {
      if (prev.includes(window)) {
        return prev.filter(w => w !== window);
      } else {
        return [...prev, window];
      }
    });
  }, []);

  // Per-slot voucher setter
  const setSlotVoucherCount = useCallback((window: MealWindow, count: number) => {
    setSlotVoucherCounts(prev => ({ ...prev, [window]: count }));
  }, []);

  // Load cart from AsyncStorage on mount
  useEffect(() => {
    const loadCart = async () => {
      try {
        const [cartData, contextData] = await Promise.all([
          AsyncStorage.getItem(CART_STORAGE_KEY),
          AsyncStorage.getItem(CART_CONTEXT_STORAGE_KEY),
        ]);

        let savedMealWindow: MealWindow | null = null;
        let savedSelectedWindows: MealWindow[] | null = null;

        // Load context first to get meal window
        if (contextData) {
          const context = JSON.parse(contextData);
          savedMealWindow = context.mealWindow;
          savedSelectedWindows = context.selectedMealWindows;
          if (context.kitchenId) setKitchenId(context.kitchenId);
          if (context.menuType) setMenuType(context.menuType);
          // Load multi-slot or fallback to single
          if (context.selectedMealWindows && Array.isArray(context.selectedMealWindows)) {
            setSelectedMealWindowsState(context.selectedMealWindows);
          } else if (context.mealWindow) {
            setSelectedMealWindowsState([context.mealWindow]);
          }
          if (context.deliveryAddressId) setDeliveryAddressId(context.deliveryAddressId);
          if (context.slotVoucherCounts) {
            setSlotVoucherCounts(context.slotVoucherCounts);
          } else if (context.voucherCount) {
            // Backward compat: old single voucherCount → assign to first slot
            const slot = context.mealWindow || 'LUNCH';
            setSlotVoucherCounts({ LUNCH: 0, DINNER: 0, [slot]: context.voucherCount });
          }
          if (context.couponCode) setCouponCode(context.couponCode);
          if (context.specialInstructions) setSpecialInstructions(context.specialInstructions);
          if (context.deliveryNotes) setDeliveryNotes(context.deliveryNotes);
          console.log('[CartContext] Loaded cart context from storage');
        }

        // Load cart and reconstruct images
        if (cartData) {
          const parsedCart = JSON.parse(cartData);

          // Reconstruct image objects based on per-item mealWindow or fallback
          const cartWithImages = parsedCart.map((item: any) => ({
            ...item,
            image: (item.mealWindow || savedMealWindow) === 'LUNCH'
              ? require('../assets/images/homepage/lunch2.png')
              : require('../assets/images/homepage/dinneritem.png'),
            // Backward compat: tag items without mealWindow
            mealWindow: item.mealWindow || savedMealWindow || undefined,
          }));

          setCartItems(cartWithImages);
          console.log('[CartContext] Loaded cart from storage:', parsedCart.length, 'items');
        }
      } catch (error) {
        console.error('[CartContext] Error loading cart from storage:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadCart();
  }, []);

  // Save cart to AsyncStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return; // Don't save on initial load

    const saveCart = async () => {
      try {
        // Remove image objects before saving (they can't be serialized)
        const cartToSave = cartItems.map(({ image, ...item }) => item);
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartToSave));
        console.log('[CartContext] Saved cart to storage:', cartItems.length, 'items');
      } catch (error) {
        console.error('[CartContext] Error saving cart:', error);
      }
    };

    saveCart();
  }, [cartItems, isLoaded]);

  // Save cart context to AsyncStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return; // Don't save on initial load

    const saveContext = async () => {
      try {
        const context = {
          kitchenId,
          menuType,
          mealWindow,
          selectedMealWindows: selectedMealWindowsState,
          deliveryAddressId,
          slotVoucherCounts,
          couponCode,
          specialInstructions,
          deliveryNotes,
        };
        await AsyncStorage.setItem(CART_CONTEXT_STORAGE_KEY, JSON.stringify(context));
        console.log('[CartContext] Saved cart context to storage');
      } catch (error) {
        console.error('[CartContext] Error saving cart context:', error);
      }
    };

    saveContext();
  }, [kitchenId, menuType, mealWindow, selectedMealWindowsState, deliveryAddressId, slotVoucherCounts, couponCode, specialInstructions, deliveryNotes, isLoaded]);

  const addToCart = useCallback((item: CartItem) => {
    console.log('[CartContext] addToCart called with item:', JSON.stringify({
      id: item.id,
      name: item.name,
      addons: item.addons,
      mealWindow: item.mealWindow,
    }));
    setCartItems(prevItems => {
      console.log('[CartContext] addToCart - prevItems count:', prevItems.length);
      const existingItem = prevItems.find(i => i.id === item.id && i.mealWindow === item.mealWindow);
      if (existingItem) {
        console.log('[CartContext] addToCart - Found existing item, updating with addons');
        // Update quantity AND addons for existing item
        return prevItems.map(i =>
          (i.id === item.id && i.mealWindow === item.mealWindow) ? { ...i, quantity: i.quantity + item.quantity, addons: item.addons } : i
        );
      }
      console.log('[CartContext] addToCart - Adding new item with addons:', item.addons?.length || 0);
      return [...prevItems, item];
    });
  }, []);

  // Add item to cart for a specific slot
  const addToCartForSlot = useCallback((item: CartItem, window: MealWindow) => {
    const taggedItem = { ...item, mealWindow: window };
    addToCart(taggedItem);
  }, [addToCart]);

  // Replace cart with a single item (atomic clear + add to avoid race conditions)
  const replaceCart = useCallback((item: CartItem) => {
    console.log('[CartContext] replaceCart called with item:', JSON.stringify({
      id: item.id,
      name: item.name,
      addons: item.addons,
      mealWindow: item.mealWindow,
    }));
    // Single atomic operation - clear and set new item
    setCartItems([item]);
    // Set selectedMealWindows to just this item's window
    if (item.mealWindow) {
      setSelectedMealWindowsState([item.mealWindow]);
    }
    // Also reset voucher and coupon when replacing cart
    setSlotVoucherCounts({ LUNCH: 0, DINNER: 0 });
    setCouponCode(null);
    setSpecialInstructions('');
    setDeliveryNotes('');
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
  }, []);

  // Remove all items for a specific meal window
  const removeItemsForSlot = useCallback((window: MealWindow) => {
    setCartItems(prevItems => prevItems.filter(item => item.mealWindow !== window));
    // Also clear that slot's vouchers
    setSlotVoucherCounts(prev => ({ ...prev, [window]: 0 }));
  }, []);

  // Get items for a specific meal window
  const getItemsForSlot = useCallback((window: MealWindow): CartItem[] => {
    return cartItems.filter(item => item.mealWindow === window);
  }, [cartItems]);

  // Update addon quantity for a specific item
  const updateAddonQuantity = useCallback((itemId: string, addonIndex: number, quantity: number) => {
    // If quantity is 0 or less, remove the addon
    if (quantity <= 0) {
      removeAddon(itemId, addonIndex);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item => {
        if (item.id === itemId && item.addons) {
          const updatedAddons = item.addons.map((addon, idx) =>
            idx === addonIndex ? { ...addon, quantity } : addon
          );
          return { ...item, addons: updatedAddons };
        }
        return item;
      })
    );
  }, [removeAddon]);

  // Remove an addon from a specific item
  const removeAddon = useCallback((itemId: string, addonIndex: number) => {
    setCartItems(prevItems =>
      prevItems.map(item => {
        if (item.id === itemId && item.addons) {
          const updatedAddons = item.addons.filter((_, idx) => idx !== addonIndex);
          return { ...item, addons: updatedAddons.length > 0 ? updatedAddons : undefined };
        }
        return item;
      })
    );
  }, []);

  // Add an addon to an existing cart item (or increment quantity if already present)
  const addAddonToItem = useCallback((itemId: string, addon: CartItemAddon) => {
    setCartItems(prevItems =>
      prevItems.map(item => {
        if (item.id === itemId) {
          const existingAddons = item.addons || [];
          const existingIndex = existingAddons.findIndex(a => a.addonId === addon.addonId);
          if (existingIndex >= 0) {
            const updatedAddons = existingAddons.map((a, idx) =>
              idx === existingIndex ? { ...a, quantity: a.quantity + addon.quantity } : a
            );
            return { ...item, addons: updatedAddons };
          }
          return { ...item, addons: [...existingAddons, addon] };
        }
        return item;
      })
    );
  }, []);

  const clearCart = useCallback(async () => {
    setCartItems([]);
    // Also reset voucher and coupon when clearing cart
    setSlotVoucherCounts({ LUNCH: 0, DINNER: 0 });
    setCouponCode(null);
    setSpecialInstructions('');
    setDeliveryNotes('');
    setSelectedMealWindowsState([]);

    // Clear from AsyncStorage
    try {
      await AsyncStorage.removeItem(CART_STORAGE_KEY);
      await AsyncStorage.removeItem(CART_CONTEXT_STORAGE_KEY);
      console.log('[CartContext] Cleared cart from storage');
    } catch (error) {
      console.error('[CartContext] Error clearing cart from storage:', error);
    }
  }, []);

  const getTotalItems = useCallback(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  const getSubtotal = useCallback(() => {
    return cartItems.reduce((total, item) => {
      // Item total
      let itemTotal = item.price * item.quantity;

      // Add addon totals
      if (item.addons && item.addons.length > 0) {
        const addonTotal = item.addons.reduce(
          (sum, addon) => sum + addon.unitPrice * addon.quantity,
          0
        );
        itemTotal += addonTotal * item.quantity; // Addons per item quantity
      }

      return total + itemTotal;
    }, 0);
  }, [cartItems]);

  // Helper to check if ID is a valid MongoDB ObjectId (24-character hex string)
  const isValidObjectId = (id: string): boolean => {
    return /^[a-fA-F0-9]{24}$/.test(id);
  };

  // Build order items for API call (all items)
  const getOrderItems = useCallback((): OrderItem[] => {
    return cartItems.map(item => {
      // Validate menuItemId
      if (!isValidObjectId(item.id)) {
        console.warn('[CartContext] Invalid menuItemId:', item.id, '- this may cause API errors');
      }

      const orderItem: OrderItem = {
        menuItemId: item.id,
        quantity: item.quantity,
      };

      // Add addons if present - only include addons with valid ObjectIds
      if (item.addons && item.addons.length > 0) {
        const validAddons = item.addons.filter(addon => {
          const isValid = isValidObjectId(addon.addonId);
          if (!isValid) {
            console.warn('[CartContext] Excluding addon with invalid ID:', addon.addonId, addon.name);
          }
          return isValid;
        });

        if (validAddons.length > 0) {
          orderItem.addons = validAddons.map(addon => ({
            addonId: addon.addonId,
            quantity: addon.quantity,
          }));
        }
      }

      return orderItem;
    });
  }, [cartItems]);

  // Build order items for a specific slot
  const getOrderItemsForSlot = useCallback((window: MealWindow): OrderItem[] => {
    const slotItems = cartItems.filter(item => item.mealWindow === window);
    return slotItems.map(item => {
      if (!isValidObjectId(item.id)) {
        console.warn('[CartContext] Invalid menuItemId:', item.id, '- this may cause API errors');
      }

      const orderItem: OrderItem = {
        menuItemId: item.id,
        quantity: item.quantity,
      };

      if (item.addons && item.addons.length > 0) {
        const validAddons = item.addons.filter(addon => isValidObjectId(addon.addonId));
        if (validAddons.length > 0) {
          orderItem.addons = validAddons.map(addon => ({
            addonId: addon.addonId,
            quantity: addon.quantity,
          }));
        }
      }

      return orderItem;
    });
  }, [cartItems]);

  // Reset order context after successful order
  const resetOrderContext = useCallback(async () => {
    setCartItems([]);
    setKitchenId(null);
    setMenuType(null);
    setSelectedMealWindowsState([]);
    // Keep delivery address selected
    setSlotVoucherCounts({ LUNCH: 0, DINNER: 0 });
    setCouponCode(null);
    setSpecialInstructions('');
    setDeliveryNotes('');

    // Clear from AsyncStorage
    try {
      await AsyncStorage.removeItem(CART_STORAGE_KEY);
      await AsyncStorage.removeItem(CART_CONTEXT_STORAGE_KEY);
      console.log('[CartContext] Reset cart context and cleared storage');
    } catch (error) {
      console.error('[CartContext] Error clearing cart from storage:', error);
    }
  }, []);

  // Check if cart is ready for checkout
  const isReadyForCheckout = useCallback(() => {
    return (
      cartItems.length > 0 &&
      kitchenId !== null &&
      menuType !== null &&
      deliveryAddressId !== null &&
      (menuType === 'ON_DEMAND_MENU' || selectedMealWindowsState.length > 0)
    );
  }, [cartItems, kitchenId, menuType, selectedMealWindowsState, deliveryAddressId]);

  return (
    <CartContext.Provider
      value={{
        // Cart items
        cartItems,
        addToCart,
        replaceCart,
        updateQuantity,
        updateAddonQuantity,
        addAddonToItem,
        removeAddon,
        removeItem,
        clearCart,
        getTotalItems,
        getSubtotal,

        // Order context
        kitchenId,
        menuType,
        mealWindow,
        deliveryAddressId,
        voucherCount,
        couponCode,
        specialInstructions,
        deliveryNotes,

        // Setters
        setKitchenId,
        setMenuType,
        setMealWindow,
        setDeliveryAddressId,
        setVoucherCount,
        setCouponCode,
        setSpecialInstructions,
        setDeliveryNotes,

        // Multi-slot support
        selectedMealWindows: selectedMealWindowsState,
        toggleMealWindow,
        addToCartForSlot,
        getItemsForSlot,
        getOrderItemsForSlot,
        removeItemsForSlot,

        // Per-slot vouchers
        slotVoucherCounts,
        setSlotVoucherCount,

        // Helpers
        getOrderItems,
        resetOrderContext,
        isReadyForCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
