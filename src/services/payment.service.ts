import RazorpayCheckout from 'react-native-razorpay';
import apiService from './api.service';
import {
  RazorpayOptions,
  RazorpaySuccessResponse,
  RazorpayErrorResponse,
  PaymentConfig,
  InitiateOrderPaymentData,
  InitiateSubscriptionPaymentData,
  VerifyPaymentRequest,
  OrderPaymentResult,
  SubscriptionPaymentResult,
} from '../types/payment';

const MERCHANT_NAME = 'TiffinDabba';
const THEME_COLOR = '#ff8800';

class PaymentService {
  private razorpayKey: string | null = null;
  private isConfigured: boolean = false;

  /**
   * Initialize payment service by fetching config from backend
   * Returns false if backend is unreachable (non-critical error)
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('[PaymentService] Initializing...');
      const response = await apiService.getPaymentConfig();

      if (response.success && response.data.available && response.data.key) {
        this.razorpayKey = response.data.key;
        this.isConfigured = true;
        console.log('[PaymentService] Initialized successfully with key:', this.razorpayKey.substring(0, 10) + '...');
        return true;
      }

      console.warn('[PaymentService] Payment not available:', response.message);
      return false;
    } catch (error: any) {
      // Use console.warn instead of console.error for network failures
      // This is a non-critical error - app can continue without payment functionality
      if (error?.data?.error === 'NETWORK_ERROR') {
        console.warn('[PaymentService] Backend unreachable - payment features will be unavailable');
      } else {
        console.warn('[PaymentService] Initialization failed (non-critical):', error?.message || error);
      }
      return false;
    }
  }

  /**
   * Get payment config from backend
   */
  async getConfig(): Promise<PaymentConfig> {
    const response = await apiService.getPaymentConfig();
    return response.data;
  }

  /**
   * Check if payment service is ready to process payments
   */
  isReady(): boolean {
    return this.isConfigured && !!this.razorpayKey;
  }

  /**
   * Open Razorpay checkout modal
   */
  async openCheckout(options: RazorpayOptions): Promise<RazorpaySuccessResponse> {
    console.log('[PaymentService] Opening Razorpay checkout with options:', {
      ...options,
      key: options.key.substring(0, 10) + '...',
    });

    return new Promise((resolve, reject) => {
      RazorpayCheckout.open(options)
        .then((data: RazorpaySuccessResponse) => {
          console.log('[PaymentService] Razorpay payment successful:', {
            payment_id: data.razorpay_payment_id,
            order_id: data.razorpay_order_id,
          });
          resolve(data);
        })
        .catch((error: any) => {
          console.error('[PaymentService] Razorpay payment failed/cancelled:', error);
          console.error('[PaymentService] Raw error object:', JSON.stringify(error, null, 2));

          // Normalize error structure - Razorpay can return errors in different formats
          // Possible formats:
          // 1. { code: 0, description: "Payment cancelled by user" }
          // 2. { error: { code: 2, description: "...", reason: "..." } }
          // 3. { code: X, message: "..." }
          // 4. Plain error object with message property

          let errorCode = -1;
          let errorDescription = 'Payment failed';
          let errorMessage = 'Payment failed';

          // Extract error code from various possible locations
          if (typeof error?.code === 'number') {
            errorCode = error.code;
          } else if (typeof error?.error?.code === 'number') {
            errorCode = error.error.code;
          }

          // Extract error description (user-friendly message)
          if (error?.description) {
            errorDescription = error.description;
          } else if (error?.error?.description) {
            errorDescription = error.error.description;
          } else if (error?.message) {
            errorDescription = error.message;
          } else if (error?.error?.reason) {
            errorDescription = error.error.reason;
          }

          // Extract error message (technical message)
          if (error?.message) {
            errorMessage = error.message;
          } else if (error?.error?.reason) {
            errorMessage = error.error.reason;
          } else if (error?.description) {
            errorMessage = error.description;
          }

          const normalizedError = {
            code: errorCode,
            description: errorDescription,
            message: errorMessage,
            originalError: error, // Preserve original error for debugging
          };

          console.log('[PaymentService] Normalized error:', JSON.stringify(normalizedError, null, 2));
          reject(normalizedError);
        });
    });
  }

  /**
   * Build Razorpay checkout options for order payment
   */
  buildOrderCheckoutOptions(data: InitiateOrderPaymentData): RazorpayOptions {
    return {
      key: data.key,
      amount: data.amount,
      currency: data.currency,
      name: MERCHANT_NAME,
      description: `Order #${data.orderNumber}`,
      order_id: data.razorpayOrderId,
      prefill: {
        name: data.prefill.name,
        contact: data.prefill.contact,
        email: data.prefill.email,
      },
      theme: {
        color: THEME_COLOR,
      },
    };
  }

  /**
   * Build Razorpay checkout options for subscription payment
   */
  buildSubscriptionCheckoutOptions(data: InitiateSubscriptionPaymentData): RazorpayOptions {
    return {
      key: data.key,
      amount: data.amount,
      currency: data.currency,
      name: MERCHANT_NAME,
      description: `${data.planName} Subscription`,
      order_id: data.razorpayOrderId,
      prefill: {
        name: data.prefill.name,
        contact: data.prefill.contact,
        email: data.prefill.email,
      },
      theme: {
        color: THEME_COLOR,
      },
    };
  }

  /**
   * Process complete order payment flow
   * 1. Initiate payment with backend
   * 2. Open Razorpay checkout
   * 3. Verify payment with backend
   */
  async processOrderPayment(orderId: string): Promise<OrderPaymentResult> {
    try {
      console.log('[PaymentService] Processing order payment for orderId:', orderId);

      // Step 1: Initiate payment with backend
      const initiateResponse = await apiService.initiateOrderPayment(orderId);
      if (!initiateResponse.success) {
        throw new Error(initiateResponse.message || 'Failed to initiate payment');
      }

      console.log('[PaymentService] Payment initiated, Razorpay order:', initiateResponse.data.razorpayOrderId);

      // Step 2: Open Razorpay checkout
      const checkoutOptions = this.buildOrderCheckoutOptions(initiateResponse.data);
      const paymentResponse = await this.openCheckout(checkoutOptions);

      // Step 3: Verify payment with backend
      console.log('[PaymentService] Verifying payment...');
      const verifyResponse = await apiService.verifyPayment({
        razorpayOrderId: paymentResponse.razorpay_order_id,
        razorpayPaymentId: paymentResponse.razorpay_payment_id,
        razorpaySignature: paymentResponse.razorpay_signature,
      });

      if (!verifyResponse.success || !verifyResponse.data.success) {
        throw new Error(verifyResponse.message || 'Payment verification failed');
      }

      console.log('[PaymentService] Order payment completed successfully');
      return {
        success: true,
        paymentId: paymentResponse.razorpay_payment_id,
      };
    } catch (error: any) {
      console.error('[PaymentService] Order payment failed:', error);
      console.error('[PaymentService] Error details:', {
        code: error?.code,
        message: error?.message,
        description: error?.description,
      });

      // Check if user cancelled (Razorpay error code 0 or 2)
      if (error.code === 0 || error.code === 2) {
        console.log('[PaymentService] User cancelled payment');
        return {
          success: false,
          error: 'Payment cancelled',
        };
      }

      // Return user-friendly error message
      const errorMessage = error.description || error.message || 'Payment failed. Please try again.';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Process complete subscription payment flow
   * 1. Initiate subscription payment with backend
   * 2. Open Razorpay checkout
   * 3. Verify payment with backend
   */
  async processSubscriptionPayment(planId: string): Promise<SubscriptionPaymentResult> {
    try {
      console.log('[PaymentService] Processing subscription payment for planId:', planId);

      // Step 1: Initiate payment with backend
      const initiateResponse = await apiService.initiateSubscriptionPayment(planId);
      if (!initiateResponse.success) {
        throw new Error(initiateResponse.message || 'Failed to initiate payment');
      }

      console.log('[PaymentService] Subscription payment initiated, Razorpay order:', initiateResponse.data.razorpayOrderId);

      // Step 2: Open Razorpay checkout
      const checkoutOptions = this.buildSubscriptionCheckoutOptions(initiateResponse.data);
      const paymentResponse = await this.openCheckout(checkoutOptions);

      // Step 3: Verify payment with backend
      console.log('[PaymentService] Verifying subscription payment...');
      const verifyResponse = await apiService.verifyPayment({
        razorpayOrderId: paymentResponse.razorpay_order_id,
        razorpayPaymentId: paymentResponse.razorpay_payment_id,
        razorpaySignature: paymentResponse.razorpay_signature,
      });

      if (!verifyResponse.success || !verifyResponse.data.success) {
        throw new Error(verifyResponse.message || 'Payment verification failed');
      }

      console.log('[PaymentService] Subscription payment completed successfully');
      return {
        success: true,
        paymentId: paymentResponse.razorpay_payment_id,
        subscriptionId: verifyResponse.data.referenceId,
      };
    } catch (error: any) {
      console.error('[PaymentService] Subscription payment failed:', error);
      console.error('[PaymentService] Error details:', {
        code: error?.code,
        message: error?.message,
        description: error?.description,
      });

      // Check if user cancelled
      if (error.code === 0 || error.code === 2) {
        console.log('[PaymentService] User cancelled subscription payment');
        return {
          success: false,
          error: 'Payment cancelled',
        };
      }

      // Return user-friendly error message
      const errorMessage = error.description || error.message || 'Payment failed. Please try again.';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Retry order payment for failed orders
   */
  async retryOrderPayment(orderId: string): Promise<OrderPaymentResult> {
    try {
      console.log('[PaymentService] Retrying order payment for orderId:', orderId);

      // Step 1: Get new Razorpay order via retry endpoint
      const retryResponse = await apiService.retryOrderPayment(orderId);
      if (!retryResponse.success) {
        throw new Error(retryResponse.message || 'Failed to retry payment');
      }

      console.log('[PaymentService] Retry initiated, new Razorpay order:', retryResponse.data.razorpayOrderId);

      // Step 2: Open Razorpay checkout
      const checkoutOptions: RazorpayOptions = {
        key: retryResponse.data.key,
        amount: retryResponse.data.amount,
        currency: retryResponse.data.currency,
        name: MERCHANT_NAME,
        description: `Order Payment Retry`,
        order_id: retryResponse.data.razorpayOrderId,
        prefill: retryResponse.data.prefill
          ? {
              name: retryResponse.data.prefill.name,
              contact: retryResponse.data.prefill.contact,
              email: retryResponse.data.prefill.email,
            }
          : undefined,
        theme: {
          color: THEME_COLOR,
        },
      };

      const paymentResponse = await this.openCheckout(checkoutOptions);

      // Step 3: Verify payment
      console.log('[PaymentService] Verifying retry payment...');
      const verifyResponse = await apiService.verifyPayment({
        razorpayOrderId: paymentResponse.razorpay_order_id,
        razorpayPaymentId: paymentResponse.razorpay_payment_id,
        razorpaySignature: paymentResponse.razorpay_signature,
      });

      if (!verifyResponse.success || !verifyResponse.data.success) {
        throw new Error(verifyResponse.message || 'Payment verification failed');
      }

      console.log('[PaymentService] Retry payment completed successfully');
      return {
        success: true,
        paymentId: paymentResponse.razorpay_payment_id,
      };
    } catch (error: any) {
      console.error('[PaymentService] Retry payment failed:', error);
      console.error('[PaymentService] Error details:', {
        code: error?.code,
        message: error?.message,
        description: error?.description,
      });

      // Check if user cancelled
      if (error.code === 0 || error.code === 2) {
        console.log('[PaymentService] User cancelled retry payment');
        return {
          success: false,
          error: 'Payment cancelled',
        };
      }

      // Return user-friendly error message
      const errorMessage = error.description || error.message || 'Payment failed. Please try again.';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Process bulk scheduled meal payment.
   * Unlike processOrderPayment, Razorpay details come from the bulk creation response
   * (no separate initiate step needed).
   */
  async processBulkPayment(paymentData: {
    razorpayOrderId: string;
    amount: number;
    key: string;
    currency: string;
    prefill: { name: string; contact: string; email?: string };
    batchId: string;
    totalOrders: number;
  }): Promise<OrderPaymentResult> {
    try {
      console.log('[PaymentService] Processing bulk payment for batch:', paymentData.batchId);

      const checkoutOptions: RazorpayOptions = {
        key: paymentData.key,
        amount: paymentData.amount,
        currency: paymentData.currency,
        name: MERCHANT_NAME,
        description: `Bulk Meal Schedule (${paymentData.totalOrders} meals)`,
        order_id: paymentData.razorpayOrderId,
        prefill: paymentData.prefill,
        theme: { color: THEME_COLOR },
      };

      const paymentResponse = await this.openCheckout(checkoutOptions);

      console.log('[PaymentService] Verifying bulk payment...');
      const verifyResponse = await apiService.verifyPayment({
        razorpayOrderId: paymentResponse.razorpay_order_id,
        razorpayPaymentId: paymentResponse.razorpay_payment_id,
        razorpaySignature: paymentResponse.razorpay_signature,
      });

      if (!verifyResponse.success || !verifyResponse.data.success) {
        throw new Error(verifyResponse.message || 'Payment verification failed');
      }

      console.log('[PaymentService] Bulk payment completed successfully');
      return { success: true, paymentId: paymentResponse.razorpay_payment_id };
    } catch (error: any) {
      console.error('[PaymentService] Bulk payment failed:', error);

      if (error.code === 0 || error.code === 2) {
        console.log('[PaymentService] User cancelled bulk payment');
        return { success: false, error: 'Payment cancelled' };
      }

      const errorMessage = error.description || error.message || 'Payment failed. Please try again.';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get payment status from backend
   */
  async getPaymentStatus(razorpayOrderId: string) {
    return apiService.getPaymentStatus(razorpayOrderId);
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(params?: {
    status?: string;
    purchaseType?: 'ORDER' | 'SUBSCRIPTION';
    limit?: number;
    skip?: number;
  }) {
    return apiService.getPaymentHistory(params);
  }
}

export default new PaymentService();
