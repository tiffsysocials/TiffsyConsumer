// Payment status enum matching backend
export type PaymentStatus =
  | 'CREATED'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

// Purchase type enum
export type PurchaseType = 'ORDER' | 'SUBSCRIPTION' | 'BULK_SCHEDULED';

// Razorpay checkout options
export interface RazorpayOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
}

// Razorpay success response from checkout
export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

// Razorpay error response from checkout
export interface RazorpayErrorResponse {
  code: number;
  description: string;
  source: string;
  step: string;
  reason: string;
  metadata: {
    order_id: string;
    payment_id?: string;
  };
}

// Payment config from backend (GET /api/payment/config)
export interface PaymentConfig {
  available: boolean;
  key: string | null;
  currency: string;
  provider: string;
}

export interface PaymentConfigResponse {
  success: boolean;
  message: string;
  data: PaymentConfig;
}

// Prefill data for Razorpay checkout
export interface PaymentPrefill {
  name: string;
  contact: string;
  email?: string;
}

// Initiate order payment response (POST /api/payment/order/:orderId/initiate)
export interface InitiateOrderPaymentData {
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  key: string;
  orderId: string;
  orderNumber: string;
  expiresAt: string;
  prefill: PaymentPrefill;
}

export interface InitiateOrderPaymentResponse {
  success: boolean;
  message: string;
  data: InitiateOrderPaymentData;
}

// Initiate subscription payment response (POST /api/payment/subscription/initiate)
export interface InitiateSubscriptionPaymentData {
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  key: string;
  planId: string;
  planName: string;
  expiresAt: string;
  prefill: PaymentPrefill;
}

export interface InitiateSubscriptionPaymentResponse {
  success: boolean;
  message: string;
  data: InitiateSubscriptionPaymentData;
}

// Verify payment request (POST /api/payment/verify)
export interface VerifyPaymentRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

// Verify payment response
export interface VerifyPaymentData {
  success: boolean;
  status: PaymentStatus;
  purchaseType: PurchaseType;
  referenceId: string;
  paymentId: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  data: VerifyPaymentData;
}

// Payment status response (GET /api/payment/status/:razorpayOrderId)
export interface PaymentStatusData {
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  status: PaymentStatus;
  amount: number; // in paise
  amountRupees: number;
  paymentMethod: string | null;
  paidAt: string | null;
  failureReason: string | null;
  purchaseType: PurchaseType;
  referenceId: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  message: string;
  data: PaymentStatusData;
}

// Payment transaction for history
export interface PaymentTransaction {
  _id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  purchaseType: PurchaseType;
  status: PaymentStatus;
  amountRupees: number;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
}

// Payment history response (GET /api/payment/history)
export interface PaymentHistoryResponse {
  success: boolean;
  message: string;
  data: {
    transactions: PaymentTransaction[];
    count: number;
  };
}

// Payment history query params
export interface PaymentHistoryParams {
  status?: PaymentStatus;
  purchaseType?: PurchaseType;
  limit?: number;
  skip?: number;
}

// Payment result types for context
export interface OrderPaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export interface SubscriptionPaymentResult {
  success: boolean;
  paymentId?: string;
  subscriptionId?: string;
  error?: string;
}
