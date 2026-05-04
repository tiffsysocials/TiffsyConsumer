// src/screens/payment/PaymentScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { MainTabParamList } from '../../types/navigation';
import { useCart } from '../../context/CartContext';
import OrderSuccessModal from '../../components/OrderSuccessModal';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';

type Props = StackScreenProps<MainTabParamList, 'Payment'>;

interface PaymentMethod {
  id: string;
  name: string;
  icon: ImageSourcePropType;
  subtitle?: string;
}

const PaymentScreen: React.FC<Props> = ({ navigation }) => {
  const { cartItems } = useCart();
  const [selectedPayment, setSelectedPayment] = useState<string>('upi');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { isSmallDevice } = useResponsive();

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'upi',
      name: 'UPI',
      icon: require('../../assets/images/payment/payment.png'),
      subtitle: 'Pay via UPI Apps',
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: require('../../assets/images/payment/payment2.png'),
      subtitle: 'Visa, Mastercard, Rupay',
    },
    {
      id: 'wallet',
      name: 'Wallets',
      icon: require('../../assets/images/payment/payment3.png'),
      subtitle: 'Paytm, PhonePe, Amazon Pay',
    },
    {
      id: 'netbanking',
      name: 'Net Banking',
      icon: require('../../assets/images/payment/payment4.png'),
      subtitle: 'All major banks',
    },
    {
      id: 'emi',
      name: 'EMI',
      icon: require('../../assets/images/payment/payment5.png'),
      subtitle: 'Easy installments',
    },
    {
      id: 'cod',
      name: 'Cash on Delivery',
      icon: require('../../assets/images/payment/payment6.png'),
      subtitle: 'Pay when you receive',
    },
  ];

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxesAndCharges = 10;
  const discount = Math.min(100, subtotal * 0.1);
  const totalAmount = subtotal + taxesAndCharges - discount;

  const handlePayment = () => {
    // Handle payment logic here
    console.log(`Processing payment of �${totalAmount.toFixed(2)} via ${
      paymentMethods.find(m => m.id === selectedPayment)?.name
    }`);
    // Show success modal after payment
    setShowSuccessModal(true);
  };

  const handleGoHome = () => {
    setShowSuccessModal(false);
    navigation.navigate('Home');
  };

  const handleTrackOrder = () => {
    // Navigate first, then close modal
    navigation.navigate('OrderTracking');
    setShowSuccessModal(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-4 mb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-orange-400 items-center justify-center mr-4"
          >
            <Text className="text-white text-xl">�</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 flex-1">Payment</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Amount to Pay */}
        <View className="bg-white px-6 py-5 mb-4">
          <Text className="text-sm text-gray-600 mb-2">Amount to Pay</Text>
          <Text className="text-3xl font-bold text-orange-400">₹{totalAmount.toFixed(2)}</Text>
          <View className="mt-3 pt-3 border-t border-gray-200">
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Subtotal</Text>
              <Text className="text-sm text-gray-900">�{subtotal.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Taxes & Charges</Text>
              <Text className="text-sm text-gray-900">�{taxesAndCharges.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-gray-600">Discount</Text>
              <Text className="text-sm text-red-500">- �{discount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Methods */}
        <View className="bg-white px-6 py-5 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-4">Select Payment Method</Text>

          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              onPress={() => setSelectedPayment(method.id)}
              className={`flex-row items-center rounded-2xl mb-3 border-2 ${
                selectedPayment === method.id
                  ? 'bg-orange-50 border-orange-400'
                  : 'bg-gray-50 border-gray-200'
              }`}
              style={{
                padding: isSmallDevice ? SPACING.md : SPACING.lg,
                minHeight: TOUCH_TARGETS.large
              }}
            >
              {/* Payment Icon */}
              <View className="w-12 h-12 rounded-full bg-white items-center justify-center mr-4">
                <Image
                  source={method.icon}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
              </View>

              {/* Payment Info */}
              <View className="flex-1">
                <Text className={`text-base font-semibold ${
                  selectedPayment === method.id ? 'text-gray-900' : 'text-gray-700'
                }`}>
                  {method.name}
                </Text>
                {method.subtitle && (
                  <Text className="text-xs text-gray-500 mt-1">{method.subtitle}</Text>
                )}
              </View>

              {/* Radio Button */}
              <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                selectedPayment === method.id
                  ? 'border-orange-400'
                  : 'border-gray-300'
              }`}>
                {selectedPayment === method.id && (
                  <View className="w-3 h-3 rounded-full bg-orange-400" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Terms */}
        <View className="px-6 mb-6">
          <Text className="text-xs text-gray-500 text-center leading-5">
            By proceeding, you agree to our{' '}
            <Text className="text-orange-400 font-semibold">Terms & Conditions</Text>
            {' '}and{' '}
            <Text className="text-orange-400 font-semibold">Privacy Policy</Text>
          </Text>
        </View>

        {/* Bottom Spacing */}
        <View className="h-32" />
      </ScrollView>

      {/* Bottom Payment Button */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-orange-400 rounded-t-3xl px-6 py-4 flex-row items-center justify-between"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 10,
        }}
      >
        <View>
          <Text className="text-white text-2xl font-bold">�{totalAmount.toFixed(2)}</Text>
          <Text className="text-white text-sm opacity-90">Total</Text>
        </View>
        <TouchableOpacity
          className="bg-white rounded-full px-8 flex-row items-center"
          onPress={handlePayment}
          style={{ minHeight: TOUCH_TARGETS.comfortable, paddingVertical: SPACING.md }}
        >
          <Text className="text-orange-400 font-bold text-base mr-2">Checkout</Text>
          <Text className="text-orange-400 font-bold">�</Text>
        </TouchableOpacity>
      </View>

      {/* Order Success Modal */}
      <OrderSuccessModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onGoHome={handleGoHome}
        onTrackOrder={handleTrackOrder}
      />
    </SafeAreaView>
  );
};

export default PaymentScreen;
