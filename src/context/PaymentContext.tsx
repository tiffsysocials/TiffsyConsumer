import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import paymentService from '../services/payment.service';
import {
  PaymentTransaction,
  PaymentStatus,
  OrderPaymentResult,
  SubscriptionPaymentResult,
} from '../types/payment';

interface PaymentContextType {
  // State
  isPaymentReady: boolean;
  isProcessing: boolean;
  paymentHistory: PaymentTransaction[];
  historyLoading: boolean;
  error: string | null;

  // Actions
  initializePayment: () => Promise<boolean>;
  processOrderPayment: (orderId: string) => Promise<OrderPaymentResult>;
  processSubscriptionPayment: (planId: string) => Promise<SubscriptionPaymentResult>;
  retryOrderPayment: (orderId: string) => Promise<OrderPaymentResult>;
  fetchPaymentHistory: (params?: {
    status?: PaymentStatus;
    purchaseType?: 'ORDER' | 'SUBSCRIPTION';
  }) => Promise<void>;
  checkPaymentStatus: (razorpayOrderId: string) => Promise<PaymentStatus | null>;
  clearError: () => void;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

interface PaymentProviderProps {
  children: ReactNode;
}

export const PaymentProvider: React.FC<PaymentProviderProps> = ({ children }) => {
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize payment service on mount
   */
  const initializePayment = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[PaymentContext] Initializing payment service...');
      const ready = await paymentService.initialize();
      setIsPaymentReady(ready);
      console.log('[PaymentContext] Payment service ready:', ready);
      return ready;
    } catch (err: any) {
      console.error('[PaymentContext] Init error:', err);
      setError(err.message || 'Failed to initialize payment');
      return false;
    }
  }, []);

  /**
   * Process order payment via Razorpay
   */
  const processOrderPayment = useCallback(
    async (orderId: string): Promise<OrderPaymentResult> => {
      setIsProcessing(true);
      setError(null);

      try {
        console.log('[PaymentContext] Processing order payment:', orderId);
        const result = await paymentService.processOrderPayment(orderId);

        if (!result.success && result.error !== 'Payment cancelled') {
          setError(result.error || 'Payment failed');
        }

        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Payment processing failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  /**
   * Process subscription payment via Razorpay
   */
  const processSubscriptionPayment = useCallback(
    async (planId: string): Promise<SubscriptionPaymentResult> => {
      setIsProcessing(true);
      setError(null);

      try {
        console.log('[PaymentContext] Processing subscription payment:', planId);
        const result = await paymentService.processSubscriptionPayment(planId);

        if (!result.success && result.error !== 'Payment cancelled') {
          setError(result.error || 'Payment failed');
        }

        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Payment processing failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  /**
   * Retry failed order payment
   */
  const retryOrderPayment = useCallback(
    async (orderId: string): Promise<OrderPaymentResult> => {
      setIsProcessing(true);
      setError(null);

      try {
        console.log('[PaymentContext] Retrying order payment:', orderId);
        const result = await paymentService.retryOrderPayment(orderId);

        if (!result.success && result.error !== 'Payment cancelled') {
          setError(result.error || 'Payment failed');
        }

        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Retry payment failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  /**
   * Fetch payment history
   */
  const fetchPaymentHistory = useCallback(
    async (params?: {
      status?: PaymentStatus;
      purchaseType?: 'ORDER' | 'SUBSCRIPTION';
    }): Promise<void> => {
      setHistoryLoading(true);

      try {
        console.log('[PaymentContext] Fetching payment history');
        const response = await paymentService.getPaymentHistory(params);

        if (response.success) {
          setPaymentHistory(response.data.transactions);
        }
      } catch (err: any) {
        console.error('[PaymentContext] Fetch history error:', err);
      } finally {
        setHistoryLoading(false);
      }
    },
    []
  );

  /**
   * Check payment status by Razorpay order ID
   */
  const checkPaymentStatus = useCallback(
    async (razorpayOrderId: string): Promise<PaymentStatus | null> => {
      try {
        console.log('[PaymentContext] Checking payment status:', razorpayOrderId);
        const response = await paymentService.getPaymentStatus(razorpayOrderId);

        if (response.success) {
          return response.data.status as PaymentStatus;
        }
        return null;
      } catch (err) {
        console.error('[PaymentContext] Check status error:', err);
        return null;
      }
    },
    []
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize payment service on mount (silently fail if backend is unreachable)
  useEffect(() => {
    initializePayment().catch(err => {
      console.warn('[PaymentContext] Payment initialization failed (non-critical):', err.message);
      // Silently fail - payment will be unavailable but app continues to work
    });
  }, [initializePayment]);

  const value: PaymentContextType = {
    isPaymentReady,
    isProcessing,
    paymentHistory,
    historyLoading,
    error,
    initializePayment,
    processOrderPayment,
    processSubscriptionPayment,
    retryOrderPayment,
    fetchPaymentHistory,
    checkPaymentStatus,
    clearError,
  };

  return (
    <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>
  );
};

/**
 * Hook to use payment context
 */
export const usePayment = (): PaymentContextType => {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
};

export default PaymentContext;
