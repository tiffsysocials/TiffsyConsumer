// src/components/CheckoutModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';

export type PaymentOption =
  | 'PAY_FULL'
  | 'VOUCHER_ONLY'
  | 'PARTIAL_PAY'
  | 'PAY_BEFORE_MEAL'
  | 'PAY_AFTER_MEAL';

interface CheckoutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (option: PaymentOption, voucherCount: number, paymentMethod: string) => void;
  isLoading?: boolean;
  // Pricing data
  subtotal: number;
  totalCharges: number;
  grandTotal: number;
  // Voucher data
  availableVouchers: number;
  maxVouchersForOrder: number; // Max vouchers that can be used (based on main courses)
  voucherValue: number; // Value of one voucher (thali price)
  // Cutoff info
  cutoffPassed?: boolean;
  cutoffMessage?: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  visible,
  onClose,
  onConfirm,
  isLoading = false,
  subtotal,
  totalCharges,
  grandTotal,
  availableVouchers,
  maxVouchersForOrder,
  voucherValue,
  cutoffPassed = false,
  cutoffMessage,
}) => {
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(null);
  const [voucherCount, setVoucherCount] = useState(0);

  // Debug logging
  console.log('[CheckoutModal] Rendering with visible:', visible);
  console.log('  - subtotal:', subtotal);
  console.log('  - grandTotal:', grandTotal);
  console.log('  - availableVouchers:', availableVouchers);

  // Calculate amounts based on selected option
  // If voucher is used, charges should be 0
  const effectiveTotalCharges = voucherCount > 0 ? 0 : totalCharges;
  const effectiveGrandTotal = subtotal + effectiveTotalCharges;
  const voucherCoverage = voucherCount * voucherValue;
  const amountToPay = Math.max(0, effectiveGrandTotal - voucherCoverage);

  // Pre-calculate partial pay amount for display (before user selects the option)
  // This shows what the user would pay if they select Partial Pay (with 1 voucher)
  const partialPayVoucherCount = Math.min(availableVouchers, maxVouchersForOrder, 1);
  // When voucher is used, charges are 0
  const partialPayEffectiveTotalCharges = partialPayVoucherCount > 0 ? 0 : totalCharges;
  const partialPayGrandTotal = subtotal + partialPayEffectiveTotalCharges;
  const partialPayAmount = Math.max(0, partialPayGrandTotal - (partialPayVoucherCount * voucherValue));

  // Check if voucher-only is possible (vouchers cover entire order)
  const canUseVoucherOnly = availableVouchers >= maxVouchersForOrder &&
    (maxVouchersForOrder * voucherValue) >= grandTotal;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedOption(null);
      setVoucherCount(0);
    }
  }, [visible]);

  // Update voucher count based on selected option
  useEffect(() => {
    if (selectedOption === 'VOUCHER_ONLY') {
      setVoucherCount(Math.min(availableVouchers, maxVouchersForOrder));
    } else if (selectedOption === 'PARTIAL_PAY') {
      setVoucherCount(Math.min(availableVouchers, maxVouchersForOrder, 1));
    } else if (selectedOption === 'PAY_FULL' || selectedOption === 'PAY_BEFORE_MEAL' || selectedOption === 'PAY_AFTER_MEAL') {
      setVoucherCount(0);
    }
  }, [selectedOption, availableVouchers, maxVouchersForOrder]);

  const handleConfirm = () => {
    console.log('[CheckoutModal] handleConfirm called');
    console.log('  - selectedOption:', selectedOption);
    console.log('  - voucherCount:', voucherCount);

    if (!selectedOption) {
      console.log('[CheckoutModal] No option selected, returning');
      return;
    }

    let paymentMethod = 'OTHER';
    if (selectedOption === 'PAY_FULL') {
      paymentMethod = 'UPI'; // Default to UPI for now
    } else if (selectedOption === 'VOUCHER_ONLY') {
      paymentMethod = 'VOUCHER_ONLY';
    } else if (selectedOption === 'PARTIAL_PAY') {
      paymentMethod = 'UPI';
    } else if (selectedOption === 'PAY_BEFORE_MEAL') {
      paymentMethod = 'PAY_BEFORE_MEAL';
    } else if (selectedOption === 'PAY_AFTER_MEAL') {
      paymentMethod = 'PAY_AFTER_MEAL';
    }

    console.log('[CheckoutModal] Calling onConfirm with:', selectedOption, voucherCount, paymentMethod);
    onConfirm(selectedOption, voucherCount, paymentMethod);
  };

  const renderPaymentOption = (
    option: PaymentOption,
    title: string,
    description: string,
    amount: number | null,
    disabled: boolean = false,
    badge?: string,
    icon?: any,
  ) => {
    const isSelected = selectedOption === option;

    return (
      <TouchableOpacity
        key={option}
        className={`rounded-2xl p-4 mb-3 border-2 ${
          isSelected ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'
        } ${disabled ? 'opacity-50' : ''}`}
        onPress={() => !disabled && setSelectedOption(option)}
        disabled={disabled}
      >
        <View className="flex-row items-center">
          {/* Radio Button */}
          <View
            className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
              isSelected ? 'border-orange-400' : 'border-gray-300'
            }`}
          >
            {isSelected && <View className="w-3 h-3 rounded-full bg-orange-400" />}
          </View>

          {/* Icon */}
          {icon && (
            <Image
              source={icon}
              style={{ width: 24, height: 24, marginRight: 12 }}
              resizeMode="contain"
            />
          )}

          {/* Content */}
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className={`font-semibold ${isSelected ? 'text-orange-600' : 'text-gray-900'}`}>
                {title}
              </Text>
              {badge && (
                <View className="bg-green-100 rounded-full px-2 py-0.5 ml-2">
                  <Text className="text-green-700 text-xs font-medium">{badge}</Text>
                </View>
              )}
            </View>
            <Text className="text-gray-500 text-sm mt-1">{description}</Text>
          </View>

          {/* Amount */}
          {amount !== null && (
            <Text className={`font-bold text-lg ${isSelected ? 'text-orange-600' : 'text-gray-900'}`}>
              {amount === 0 ? 'FREE' : `₹${amount.toFixed(0)}`}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
            <Text className="text-xl font-bold text-gray-900">Choose Payment Option</Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Text className="text-2xl text-gray-400">×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
            {/* Order Summary */}
            <View className="bg-gray-50 rounded-2xl p-4 mb-4">
              <Text className="font-semibold text-gray-900 mb-3">Order Summary</Text>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600">Subtotal</Text>
                <Text className="text-gray-900">₹{subtotal.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600">Delivery & Charges</Text>
                <Text className={voucherCount > 0 ? "text-green-600 font-semibold" : "text-gray-900"}>
                  {voucherCount > 0 ? 'FREE' : `₹${totalCharges.toFixed(2)}`}
                </Text>
              </View>
              {voucherCount > 0 && (
                <Text className="text-green-600 text-xs mb-2">
                  Charges waived with voucher use
                </Text>
              )}
              <View className="border-t border-gray-200 pt-2 mt-2">
                <View className="flex-row justify-between">
                  <Text className="font-semibold text-gray-900">Grand Total</Text>
                  <Text className="font-bold text-gray-900">₹{effectiveGrandTotal.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            {/* Voucher Info */}
            {availableVouchers > 0 && (
              <View className="bg-green-50 rounded-2xl p-4 mb-4 flex-row items-center">
                <Image
                  source={require('../assets/icons/voucher4.png')}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
                <View className="ml-3 flex-1">
                  <Text className="font-semibold text-green-800">
                    {availableVouchers} Vouchers Available
                  </Text>
                  <Text className="text-green-600 text-sm">
                    Each voucher covers 1 meal (₹{voucherValue})
                  </Text>
                </View>
              </View>
            )}

            {/* Cutoff Warning */}
            {cutoffPassed && (
              <View className="bg-red-50 rounded-2xl p-4 mb-4">
                <Text className="text-red-600 font-medium">
                  {cutoffMessage || 'Voucher cutoff time has passed for this order.'}
                </Text>
              </View>
            )}

            {/* Payment Options */}
            <Text className="font-semibold text-gray-900 mb-3">Payment Options</Text>

            {/* Pay Full */}
            {renderPaymentOption(
              'PAY_FULL',
              'Pay Full Amount',
              'Pay the complete amount via UPI/Card',
              effectiveGrandTotal,
              false,
              undefined,
              require('../assets/icons/reciept.png'),
            )}

            {/* Pay with Voucher Only */}
            {availableVouchers > 0 && !cutoffPassed && canUseVoucherOnly && (
              renderPaymentOption(
                'VOUCHER_ONLY',
                'Pay with Voucher Only',
                `Use ${Math.min(availableVouchers, maxVouchersForOrder)} voucher(s) - No payment needed`,
                0,
                false,
                'Best Value',
                require('../assets/icons/voucher4.png'),
              )
            )}

            {/* Partial Pay */}
            {availableVouchers > 0 && !cutoffPassed && (
              renderPaymentOption(
                'PARTIAL_PAY',
                'Partial Pay',
                'Use vouchers for meal, pay for add-ons & charges',
                selectedOption === 'PARTIAL_PAY' ? amountToPay : partialPayAmount,
                false,
                undefined,
                require('../assets/icons/voucher4.png'),
              )
            )}

            {/* Pay Before Meal Time */}
            {renderPaymentOption(
              'PAY_BEFORE_MEAL',
              'Pay Before Meal Time',
              'We\'ll remind you to pay before delivery',
              grandTotal,
              true, // Not implemented yet
              'Coming Soon',
              require('../assets/icons/time.png'),
            )}

            {/* Pay After Meal Time */}
            {renderPaymentOption(
              'PAY_AFTER_MEAL',
              'Pay After Delivery',
              'Pay after your meal is delivered (COD)',
              grandTotal,
              true, // Not implemented yet
              'Coming Soon',
              require('../assets/icons/time.png'),
            )}

            {/* Voucher Adjustment for Partial Pay */}
            {selectedOption === 'PARTIAL_PAY' && availableVouchers > 1 && maxVouchersForOrder > 1 && (
              <View className="bg-orange-50 rounded-2xl p-4 mb-4">
                <Text className="font-semibold text-gray-900 mb-3">Vouchers to Use</Text>
                <View className="flex-row items-center justify-center">
                  <TouchableOpacity
                    onPress={() => setVoucherCount(Math.max(1, voucherCount - 1))}
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center"
                  >
                    <Text className="text-xl font-bold text-gray-600">−</Text>
                  </TouchableOpacity>
                  <View className="mx-6">
                    <Text className="text-2xl font-bold text-orange-600 text-center">{voucherCount}</Text>
                    <Text className="text-gray-500 text-sm">voucher(s)</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setVoucherCount(Math.min(availableVouchers, maxVouchersForOrder, voucherCount + 1))}
                    className="w-10 h-10 rounded-full bg-orange-400 items-center justify-center"
                  >
                    <Text className="text-xl font-bold text-white">+</Text>
                  </TouchableOpacity>
                </View>
                <View className="mt-3 pt-3 border-t border-orange-100">
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600">Voucher Coverage</Text>
                    <Text className="text-green-600 font-semibold">- ₹{voucherCoverage.toFixed(0)}</Text>
                  </View>
                  <View className="flex-row justify-between mt-1">
                    <Text className="font-semibold text-gray-900">Amount to Pay</Text>
                    <Text className="font-bold text-orange-600">₹{amountToPay.toFixed(0)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Bottom Spacing */}
            <View className="h-4" />
          </ScrollView>

          {/* Confirm Button */}
          <View className="px-5 py-4 border-t border-gray-100">
            <TouchableOpacity
              className={`rounded-full py-4 items-center ${
                selectedOption ? 'bg-orange-400' : 'bg-gray-300'
              }`}
              onPress={handleConfirm}
              disabled={!selectedOption || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">
                  {selectedOption === 'VOUCHER_ONLY'
                    ? 'Place Order (Free)'
                    : selectedOption === 'PARTIAL_PAY'
                    ? `Pay ₹${amountToPay.toFixed(0)} & Place Order`
                    : selectedOption
                    ? `Pay ₹${effectiveGrandTotal.toFixed(0)} & Place Order`
                    : 'Select Payment Option'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CheckoutModal;
