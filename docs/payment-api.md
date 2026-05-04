# TiffinDabba Payment Integration - Frontend Guide and API Documentation

## Frontend Integration Prompt

You are integrating Razorpay payment gateway into a React Native (Expo) food delivery app called TiffinDabba. The backend payment flow has been implemented and is ready for frontend integration.

### Payment Flow Overview

The app supports two main payment scenarios: ordering meals and purchasing subscriptions.

**Order Payment Flow:**

Step 1: User places an order through the app by selecting meals, addons, and optionally choosing to use vouchers from their subscription.

Step 2: If the order requires payment (amountToPay greater than 0), the frontend calls the initiate payment endpoint with the orderId.

Step 3: The backend creates a Razorpay order and returns the razorpayOrderId, amount, currency, Razorpay key, and prefill data for the user.

Step 4: The frontend opens the Razorpay checkout modal using the react-native-razorpay package, passing the order details received from the backend.

Step 5: User completes payment through Razorpay (UPI, Card, Wallet, or Netbanking).

Step 6: On successful payment, Razorpay returns paymentId and signature to the frontend callback.

Step 7: The frontend sends these credentials to the verify endpoint to confirm payment authenticity.

Step 8: Backend verifies the signature, updates the order status to PAID, and returns success.

Step 9: Frontend navigates user to order confirmation screen.

**Subscription Purchase Flow:**

Step 1: User selects a subscription plan to purchase.

Step 2: Frontend calls the subscription initiate endpoint with the planId.

Step 3: Backend creates a Razorpay order and returns payment details.

Step 4: Frontend opens Razorpay checkout modal.

Step 5: On successful payment, frontend calls verify endpoint with payment credentials.

Step 6: Backend verifies payment, creates the subscription, issues vouchers, and returns success.

Step 7: Frontend navigates to subscription confirmation screen.

**Voucher-Only Orders:**

When a user has sufficient vouchers and chooses to use them for the entire order (no addons or additional items), the amountToPay will be 0. In this case, the order is marked as PAID with paymentMethod as VOUCHER_ONLY and no Razorpay flow is needed.

**Voucher Pricing Rules:**

When vouchers are used, delivery charges are waived completely. Service fee, packaging fee, and tax on main courses are covered by the voucher. However, addons and tax on addons are always paid by the customer. Users can choose partial voucher usage - for example, if they have 5 vouchers and order 3 meals with addons, they can choose to use only 2 vouchers and pay for the rest.

**Payment Failure Handling:**

If payment fails, the order remains in PENDING payment status. The frontend can call the retry endpoint to get a new Razorpay order for the same order. The user can then attempt payment again.

**Key Implementation Notes:**

Install react-native-razorpay package for the Razorpay checkout modal. Store the Razorpay key ID in your app config (this is the public key, safe to expose). Always verify payment on your backend - never trust client-side payment confirmation alone. Handle network failures gracefully - the webhook will eventually update order status even if verify call fails. Show appropriate loading states during payment processing. Implement proper error handling for all payment failure scenarios.

---

## API Documentation

### Authentication

All authenticated endpoints require a JWT token in the Authorization header. The token is obtained after user login through Firebase OTP authentication.

Header format: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

The token contains the user ID and role (CUSTOMER, ADMIN, DRIVER). Most payment endpoints require CUSTOMER or ADMIN role.

---

### GET /api/payment/config

Purpose: Retrieve Razorpay configuration for initializing the checkout on the client.

Authentication: Not required

Request Headers: None required

Request Body: None

Response Body on Success:
success: true
message: "Payment config retrieved"
data.available: true
data.key: "rzp_test_S6VAm4ILw7Z9ZD"
data.currency: "INR"
data.provider: "razorpay"

Sample Success Response:
success is true, message is "Payment config retrieved", data contains available as true, key as "rzp_test_S6VAm4ILw7Z9ZD", currency as "INR", provider as "razorpay"

Happy Case: Razorpay is configured and the endpoint returns the public key and currency settings. Use this to initialize the Razorpay SDK on app startup.

Sad Case: If Razorpay is not configured on the server, available will be false and key will be null. In this case, disable payment functionality and show an appropriate message to the user.

---

### POST /api/payment/order/:orderId/initiate

Purpose: Create a Razorpay payment order for an existing order that requires payment.

Authentication: Required (CUSTOMER or ADMIN)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2NzgiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MzcyOTEyMDB9.abc123

Request Body: None (orderId comes from URL path)

Path Parameter: orderId must be a valid 24-character MongoDB ObjectId

Response Body on Success:
success: true
message: "Payment order created"
data.razorpayOrderId: "order_PQR123abc456"
data.amount: 15900 (in paise, so this is Rs 159.00)
data.currency: "INR"
data.key: "rzp_test_S6VAm4ILw7Z9ZD"
data.orderId: "678fa1b2c4e5d60012345678"
data.orderNumber: "ORD-20250121-0001"
data.expiresAt: "2025-01-21T12:30:00.000Z"
data.prefill.name: "Rahul Sharma"
data.prefill.contact: "9876543210"
data.prefill.email: "rahul@example.com"

Sample Request: POST /api/payment/order/678fa1b2c4e5d60012345678/initiate with Authorization header

Sample Success Response: success is true, razorpayOrderId is "order_PQR123abc456", amount is 15900, currency is "INR", key is "rzp_test_S6VAm4ILw7Z9ZD", orderId is "678fa1b2c4e5d60012345678", orderNumber is "ORD-20250121-0001", prefill contains name "Rahul Sharma", contact "9876543210"

Happy Case: Order exists, belongs to the user, has PENDING payment status, and requires payment. Backend creates Razorpay order and returns all data needed to open checkout modal.

Sad Case - Order Not Found: HTTP 404, success is false, message is "Order not found"

Sad Case - Unauthorized: HTTP 403, success is false, message is "You are not authorized to access this order"

Sad Case - Already Paid: HTTP 400, success is false, message is "Payment already completed for this order"

Sad Case - No Payment Required: HTTP 400, success is false, message is "No payment required for this order (voucher-only)"

---

### POST /api/payment/order/:orderId/retry

Purpose: Create a new Razorpay payment order for an order with failed payment.

Authentication: Required (CUSTOMER or ADMIN)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2NzgiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MzcyOTEyMDB9.abc123

Request Body: None

Path Parameter: orderId must be a valid 24-character MongoDB ObjectId

Response Body on Success:
success: true
message: "New payment order created"
data.razorpayOrderId: "order_XYZ789def012"
data.amount: 15900
data.currency: "INR"
data.key: "rzp_test_S6VAm4ILw7Z9ZD"
data.orderId: "678fa1b2c4e5d60012345678"
data.expiresAt: "2025-01-21T13:00:00.000Z"

Sample Request: POST /api/payment/order/678fa1b2c4e5d60012345678/retry with Authorization header

Sample Success Response: success is true, message is "New payment order created", razorpayOrderId is "order_XYZ789def012", amount is 15900

Happy Case: Order has failed payment status, is not cancelled, and belongs to the user. A new Razorpay order is created with a fresh 30-minute expiry.

Sad Case - Order Not Found: HTTP 404, success is false, message is "Order not found"

Sad Case - Already Paid: HTTP 400, success is false, message is "Payment already completed for this order"

Sad Case - Order Cancelled: HTTP 400, success is false, message is "Cannot retry payment for cancelled order"

---

### POST /api/payment/subscription/initiate

Purpose: Create a Razorpay payment order for purchasing a subscription plan.

Authentication: Required (CUSTOMER or ADMIN)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2NzgiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MzcyOTEyMDB9.abc123
Content-Type: application/json

Request Body:
planId: "678fa1b2c4e5d60012345999"

Validation: planId is required and must be a valid 24-character MongoDB ObjectId

Response Body on Success:
success: true
message: "Payment order created"
data.razorpayOrderId: "order_SUB456ghi789"
data.amount: 99900 (Rs 999.00)
data.currency: "INR"
data.key: "rzp_test_S6VAm4ILw7Z9ZD"
data.planId: "678fa1b2c4e5d60012345999"
data.planName: "Premium 30-Day Plan"
data.expiresAt: "2025-01-21T12:30:00.000Z"
data.prefill.name: "Rahul Sharma"
data.prefill.contact: "9876543210"
data.prefill.email: "rahul@example.com"

Sample Request: POST /api/payment/subscription/initiate with body containing planId "678fa1b2c4e5d60012345999"

Sample Success Response: success is true, razorpayOrderId is "order_SUB456ghi789", amount is 99900, planName is "Premium 30-Day Plan"

Happy Case: Plan exists and is purchasable. Backend creates Razorpay order with plan details and user prefill data.

Sad Case - Plan Not Found: HTTP 404, success is false, message is "Subscription plan not found"

Sad Case - Plan Not Purchasable: HTTP 400, success is false, message is "This subscription plan is not available for purchase"

Sad Case - Validation Error: HTTP 400, success is false, message is "planId is required" or "planId must be a valid ObjectId"

---

### POST /api/payment/verify

Purpose: Verify payment after user completes Razorpay checkout. This confirms the payment signature and updates the order or subscription status.

Authentication: Required (CUSTOMER or ADMIN)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2NzgiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MzcyOTEyMDB9.abc123
Content-Type: application/json

Request Body:
razorpayOrderId: "order_PQR123abc456"
razorpayPaymentId: "pay_ABC789xyz012"
razorpaySignature: "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"

Validation: All three fields are required strings

Response Body on Success:
success: true
message: "Payment verified successfully"
data.success: true
data.status: "CAPTURED"
data.purchaseType: "ORDER"
data.referenceId: "678fa1b2c4e5d60012345678"
data.paymentId: "pay_ABC789xyz012"

Sample Request: POST /api/payment/verify with body containing razorpayOrderId "order_PQR123abc456", razorpayPaymentId "pay_ABC789xyz012", razorpaySignature "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"

Sample Success Response for Order: success is true, status is "CAPTURED", purchaseType is "ORDER", referenceId is "678fa1b2c4e5d60012345678"

Sample Success Response for Subscription: success is true, status is "CAPTURED", purchaseType is "SUBSCRIPTION", referenceId is "678fa1b2c4e5d60012345aaa"

Happy Case: Signature verification passes, payment transaction is found and belongs to the user. Order status is updated to PAID or subscription is created with vouchers issued.

Sad Case - Transaction Not Found: HTTP 404, success is false, message is "Payment transaction not found"

Sad Case - Unauthorized: HTTP 403, success is false, message is "You are not authorized to verify this payment"

Sad Case - Invalid Signature: HTTP 400, success is false, message is "Payment verification failed: Invalid signature"

Sad Case - Payment Expired: HTTP 400, success is false, message is "Payment order has expired"

Sad Case - Already Verified: HTTP 400, success is false, message is "Payment has already been verified"

---

### GET /api/payment/status/:razorpayOrderId

Purpose: Check the current status of a payment transaction.

Authentication: Required (CUSTOMER or ADMIN)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2NzgiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MzcyOTEyMDB9.abc123

Request Body: None

Path Parameter: razorpayOrderId is the Razorpay order ID string

Response Body on Success:
success: true
message: "Payment status retrieved"
data.razorpayOrderId: "order_PQR123abc456"
data.razorpayPaymentId: "pay_ABC789xyz012"
data.status: "CAPTURED"
data.amount: 15900
data.amountRupees: 159
data.paymentMethod: "UPI"
data.paidAt: "2025-01-21T10:30:00.000Z"
data.failureReason: null
data.purchaseType: "ORDER"
data.referenceId: "678fa1b2c4e5d60012345678"

Sample Request: GET /api/payment/status/order_PQR123abc456 with Authorization header

Sample Success Response - Payment Captured: success is true, status is "CAPTURED", paymentMethod is "UPI", paidAt is "2025-01-21T10:30:00.000Z"

Sample Success Response - Payment Pending: success is true, status is "CREATED", razorpayPaymentId is null, paidAt is null

Sample Success Response - Payment Failed: success is true, status is "FAILED", failureReason is "Payment declined by bank"

Status Values: CREATED means payment order created but not yet paid. AUTHORIZED means payment authorized (rare, used in manual capture mode). CAPTURED means payment successful and captured. FAILED means payment attempt failed. EXPIRED means payment order expired after 30 minutes. REFUNDED means full refund processed. PARTIALLY_REFUNDED means partial refund processed.

Happy Case: Transaction found and belongs to user. Returns current status and payment details.

Sad Case - Not Found: HTTP 404, success is false, message is "Payment transaction not found"

Sad Case - Unauthorized: HTTP 403, success is false, message is "You are not authorized to view this payment"

---

### GET /api/payment/history

Purpose: Get the authenticated user's payment transaction history.

Authentication: Required (CUSTOMER or ADMIN)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2NzgiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3MzcyOTEyMDB9.abc123

Request Body: None

Query Parameters (all optional):
status: Filter by payment status (CREATED, CAPTURED, FAILED, REFUNDED, PARTIALLY_REFUNDED, EXPIRED)
purchaseType: Filter by purchase type (ORDER, SUBSCRIPTION)
limit: Number of results to return, default 20, max 100
skip: Number of results to skip for pagination, default 0

Response Body on Success:
success: true
message: "Payment history retrieved"
data.transactions: array of transaction objects
data.count: 15

Each transaction object contains:
_id: "678fa1b2c4e5d60012345abc"
razorpayOrderId: "order_PQR123abc456"
razorpayPaymentId: "pay_ABC789xyz012"
purchaseType: "ORDER"
status: "CAPTURED"
amountRupees: 159
paymentMethod: "UPI"
paidAt: "2025-01-21T10:30:00.000Z"
createdAt: "2025-01-21T10:00:00.000Z"

Sample Request: GET /api/payment/history?status=CAPTURED&purchaseType=ORDER&limit=10&skip=0 with Authorization header

Sample Success Response: success is true, count is 15, transactions array contains transaction objects with razorpayOrderId, status, amountRupees, paymentMethod, paidAt

Happy Case: Returns paginated list of user's payment transactions matching the filters.

Sad Case - Invalid Status: HTTP 400, success is false, message is "Invalid status value"

Sad Case - Invalid Limit: HTTP 400, success is false, message is "limit must be between 1 and 100"

---

### POST /api/payment/webhook

Purpose: Handle asynchronous payment events from Razorpay. This endpoint is called by Razorpay servers, not by the frontend.

Authentication: None (uses Razorpay signature verification instead)

Request Headers:
x-razorpay-signature: 5e7f4a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f
Content-Type: application/json (raw body, not parsed)

Request Body: Raw JSON payload from Razorpay containing event type and payload data

Handled Events:
payment.authorized: Payment has been authorized
payment.captured: Payment has been successfully captured
payment.failed: Payment attempt failed
refund.created: Refund has been initiated
refund.processed: Refund has been successfully processed
refund.failed: Refund processing failed
order.paid: Razorpay order has been fully paid

Response Body:
received: true
event: "payment.captured"
handled: true

Note: This endpoint always returns HTTP 200 to acknowledge receipt. Razorpay will retry failed webhooks multiple times over 24 hours. The signature is verified using HMAC-SHA256 with the webhook secret. Frontend does not call this endpoint directly.

---

### GET /api/payment/admin/transactions

Purpose: Admin endpoint to list all payment transactions with filtering options.

Authentication: Required (ADMIN role only)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2MDEiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MzcyOTEyMDB9.xyz789

Request Body: None

Query Parameters (all optional):
status: Filter by payment status
purchaseType: Filter by purchase type (ORDER, SUBSCRIPTION, WALLET_RECHARGE)
userId: Filter by specific user's ObjectId
startDate: Filter transactions from this date (ISO string)
endDate: Filter transactions until this date (ISO string)
limit: Number of results, default 50, max 100
skip: Pagination offset, default 0

Response Body on Success:
success: true
message: "Transactions retrieved"
data.transactions: array of transaction objects with populated user data
data.total: 250
data.limit: 50
data.skip: 0

Each transaction includes user object with _id, name, phone, email

Sample Request: GET /api/payment/admin/transactions?status=CAPTURED&startDate=2025-01-01&limit=50 with Admin Authorization header

Sample Success Response: success is true, total is 250, transactions array contains full transaction details with user information

Happy Case: Returns filtered list of all transactions across all users with populated user details.

Sad Case - Unauthorized: HTTP 403, success is false, message is "Admin access required"

---

### GET /api/payment/admin/transactions/:id

Purpose: Get detailed information about a specific payment transaction.

Authentication: Required (ADMIN role only)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2MDEiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MzcyOTEyMDB9.xyz789

Request Body: None

Path Parameter: id is the transaction's MongoDB ObjectId

Response Body on Success includes full transaction details:
_id, razorpayOrderId, razorpayPaymentId, purchaseType, referenceId, userId (populated with name, phone, email), status, amountRupees, breakdown (subtotal, mainCourseTotal, addonTotal, deliveryFee, serviceFee, packagingFee, taxAmount, voucherDiscount, couponDiscount), paymentMethod, paidAt, refunds array, totalRefundedRupees, webhooksReceived array, createdAt, updatedAt

Sample Request: GET /api/payment/admin/transactions/678fa1b2c4e5d60012345abc with Admin Authorization header

Sample Success Response: Full transaction object with all fields including breakdown, refunds, and webhooks received

Happy Case: Returns complete transaction details including pricing breakdown, refund history, and webhook audit trail.

Sad Case - Not Found: HTTP 404, success is false, message is "Transaction not found"

---

### POST /api/payment/admin/refund

Purpose: Initiate a refund for a captured payment.

Authentication: Required (ADMIN role only)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2MDEiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MzcyOTEyMDB9.xyz789
Content-Type: application/json

Request Body:
paymentId: "pay_ABC789xyz012" (Razorpay payment ID, required)
amount: 159 (refund amount in rupees, required, must be positive)
reason: "Customer requested refund due to quality issues" (required, max 500 characters)
speed: "normal" (optional, either "normal" or "optimum", default is "normal")

Validation: paymentId is required string, amount is required positive number, reason is required string max 500 chars, speed if provided must be "normal" or "optimum"

Response Body on Success:
success: true
message: "Refund initiated"
data.refundId: "rfnd_DEF456jkl012"
data.paymentId: "pay_ABC789xyz012"
data.amount: 15900 (in paise)
data.amountRupees: 159
data.status: "processed"
data.response: full Razorpay refund response object

Sample Request: POST /api/payment/admin/refund with body containing paymentId "pay_ABC789xyz012", amount 159, reason "Customer requested refund due to quality issues"

Sample Success Response: success is true, refundId is "rfnd_DEF456jkl012", status is "processed", amountRupees is 159

Happy Case: Payment exists and has sufficient refundable balance. Razorpay processes the refund and returns the refund ID.

Sad Case - Payment Not Found: HTTP 404, success is false, message is "Payment not found"

Sad Case - Exceeds Refundable Amount: HTTP 400, success is false, message is "Refund amount exceeds refundable amount"

Sad Case - Already Fully Refunded: HTTP 400, success is false, message is "Payment has already been fully refunded"

---

### GET /api/payment/admin/stats

Purpose: Get aggregate payment statistics for analytics.

Authentication: Required (ADMIN role only)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2MDEiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MzcyOTEyMDB9.xyz789

Request Body: None

Query Parameters (optional):
startDate: Start of date range for stats (ISO string)
endDate: End of date range for stats (ISO string)

Response Body on Success:
success: true
message: "Stats retrieved"
data.total: 250 (total transaction count)
data.totalAmount: 125000 (total amount in rupees)
data.byStatus.CAPTURED.count: 200
data.byStatus.CAPTURED.amount: 100000
data.byStatus.FAILED.count: 30
data.byStatus.FAILED.amount: 15000
data.byStatus.REFUNDED.count: 20
data.byStatus.REFUNDED.amount: 10000
data.byPurchaseType.ORDER.count: 180
data.byPurchaseType.ORDER.amount: 90000
data.byPurchaseType.SUBSCRIPTION.count: 20
data.byPurchaseType.SUBSCRIPTION.amount: 10000

Sample Request: GET /api/payment/admin/stats?startDate=2025-01-01&endDate=2025-01-31 with Admin Authorization header

Sample Success Response: total is 250, totalAmount is 125000, byStatus contains CAPTURED, FAILED, REFUNDED counts and amounts, byPurchaseType contains ORDER and SUBSCRIPTION breakdowns

Happy Case: Returns aggregate statistics grouped by status and purchase type for the specified date range.

---

### POST /api/payment/admin/cleanup-expired

Purpose: Mark expired payment transactions. Useful for scheduled cleanup jobs.

Authentication: Required (ADMIN role only)

Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmYTFiMmM0ZTVkNjAwMTIzNDU2MDEiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MzcyOTEyMDB9.xyz789

Request Body: None

Response Body on Success:
success: true
message: "Expired transactions cleaned up"
data.count: 5 (number of transactions marked as expired)

Sample Request: POST /api/payment/admin/cleanup-expired with Admin Authorization header

Sample Success Response: success is true, count is 5

Happy Case: Finds all transactions with status CREATED that are past their expiresAt time (30 minutes from creation) and marks them as EXPIRED.

---

## Error Response Format

All endpoints return errors in a consistent format:
success: false
message: Human-readable error description
error: null or additional error details

HTTP Status Codes:
200: Success
201: Created (new resource)
400: Bad request, validation error, or business logic error
403: Authentication failed or insufficient permissions
404: Resource not found
500: Internal server error

---

## Testing

Test Cards for Razorpay Test Mode:
Success: 4111 1111 1111 1111, any future expiry, any CVV
Failure: Use card number that starts with 4000 for various failure scenarios

Test UPI for Razorpay Test Mode:
Success: success@razorpay
Failure: failure@razorpay

Webhook Testing:
Use Razorpay dashboard to manually trigger test webhook events. Check backend logs for webhook receipt confirmation.
