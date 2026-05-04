// src/screens/legal/TermsOfServiceScreen.tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthScreenProps } from '../../types/navigation';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING } from '../../constants/spacing';
import { FONT_SIZES, LINE_HEIGHTS } from '../../constants/typography';

type Props = AuthScreenProps<'Login'>;

const TermsOfServiceScreen: React.FC<Props> = ({ navigation }) => {
  const { verticalSpacingFactor } = useResponsive();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 15,
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={require('../../assets/icons/arrow.png')}
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            fontSize: 20,
            fontWeight: '700',
            color: '#111827',
            textAlign: 'center',
            marginRight: 36,
          }}
        >
          Terms of Service
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: SPACING.screenHorizontal,
          paddingVertical: SPACING.screenVertical * verticalSpacingFactor,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: FONT_SIZES.sm,
            color: '#6B7280',
            marginBottom: 20,
            lineHeight: FONT_SIZES.sm * LINE_HEIGHTS.relaxed,
          }}
        >
          Last Updated: January 26, 2026
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          1. Acceptance of Terms
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          By accessing and using Tiffsy's food delivery service, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use our service.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          2. Service Description
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          Tiffsy provides a platform for ordering and delivering home-cooked meals, tiffin services, and subscription-based meal plans. We connect you with quality food providers who prepare fresh, hygienic meals delivered to your doorstep.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          3. User Responsibilities
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 10,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          As a user of Tiffsy, you agree to:
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
            paddingLeft: 20,
          }}
        >
          • Provide accurate and complete information during registration{'\n'}
          • Maintain the security of your account credentials{'\n'}
          • Be present at the delivery address during the scheduled delivery time{'\n'}
          • Report any issues with orders within 24 hours{'\n'}
          • Not misuse our voucher or subscription systems
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          4. Orders and Payments
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          All orders are subject to availability and confirmation. Prices are subject to change without notice. Payment must be made through our approved payment methods. Subscription plans are billed according to the selected frequency.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          5. Cancellation and Refunds
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          Orders can be cancelled before the cutoff time specified for each meal window. Refunds will be processed according to our refund policy. Subscription cancellations must be requested at least 24 hours before the next billing cycle.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          6. Vouchers and Promotions
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          Vouchers are non-transferable and must be used within the validity period. Vouchers can only be applied to eligible orders and cannot be combined with other promotions unless specified.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          7. Delivery
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          We strive to deliver within the estimated time frame, but delivery times are not guaranteed. Delays may occur due to unforeseen circumstances. Please ensure someone is available at the delivery address to receive the order.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          8. Limitation of Liability
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          Tiffsy shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our service. Our total liability shall not exceed the amount paid for the specific order in question.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          9. Changes to Terms
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          We reserve the right to modify these terms at any time. Users will be notified of significant changes via email or in-app notification. Continued use of the service after changes constitutes acceptance of the new terms.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          10. Contact Information
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 40,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          If you have any questions about these Terms of Service, please contact us at:{'\n\n'}
          Email: support@tiffsy.com{'\n'}
          Phone: +91 XXXXXXXXXX{'\n'}
          Address: [Your Company Address]
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TermsOfServiceScreen;
