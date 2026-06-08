// src/components/PendingReviewPrompt.tsx
//
// Zomato/Swiggy-style "you have an order to review" prompt. Mounted on the Home
// screen so that when the app is opened with a recently delivered, unrated order,
// the rating modal is shown once (and remembered via AsyncStorage so it isn't
// re-shown). This complements the in-screen auto-prompt on OrderTrackingScreen,
// catching orders that were delivered while the app was closed.
import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useAlert } from '../context/AlertContext';
import apiService, { Order } from '../services/api.service';
import RateOrderModal from './RateOrderModal';

interface PendingReviewPromptProps {
  // Only check/prompt when the user is logged in.
  enabled?: boolean;
}

const promptedKey = (orderId: string) => `@review_prompted_${orderId}`;

const PendingReviewPrompt: React.FC<PendingReviewPromptProps> = ({ enabled = true }) => {
  const { showAlert } = useAlert();
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [visible, setVisible] = useState(false);
  const [isRating, setIsRating] = useState(false);

  // Look for a delivered, unrated order that we haven't already prompted for.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      if (!enabled) return;

      const check = async () => {
        try {
          // Don't interrupt if a prompt is already showing.
          if (visible) return;

          const response = await apiService.getMyOrders({ status: 'DELIVERED', limit: 10 });
          const data: any = response?.data;
          const orders: Order[] = data && typeof data === 'object' ? data.orders || [] : [];

          for (const order of orders) {
            if (order.rating || order.canRate === false) continue;
            const already = await AsyncStorage.getItem(promptedKey(order._id));
            if (already) continue;

            // Found one: mark as prompted and show the modal.
            if (cancelled) return;
            await AsyncStorage.setItem(promptedKey(order._id), '1');
            setPendingOrder(order);
            setVisible(true);
            return;
          }
        } catch (e) {
          // Silent: a guest/expired session or network error just means no prompt.
          console.log('[PendingReviewPrompt] check skipped:', (e as any)?.message);
        }
      };

      check();
      return () => {
        cancelled = true;
      };
    }, [enabled, visible]),
  );

  const handleSubmit = async (stars: number, comment?: string, tags?: string[]) => {
    if (!pendingOrder) return;
    try {
      setIsRating(true);
      const response = await apiService.rateOrder(pendingOrder._id, stars, comment, tags);
      if (response.success) {
        setVisible(false);
        setPendingOrder(null);
        showAlert('Thank you!', 'Your rating has been submitted successfully', undefined, 'success');
      } else {
        showAlert('Error', response.message || 'Failed to submit rating', undefined, 'error');
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to submit rating', undefined, 'error');
    } finally {
      setIsRating(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    setPendingOrder(null);
  };

  if (!pendingOrder) return null;

  return (
    <RateOrderModal
      visible={visible}
      onClose={handleClose}
      onSubmit={handleSubmit}
      onSkip={handleClose}
      orderNumber={pendingOrder.orderNumber}
      isLoading={isRating}
    />
  );
};

export default PendingReviewPrompt;
