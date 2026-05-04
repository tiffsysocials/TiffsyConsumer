// src/screens/legal/PrivacyPolicyScreen.tsx
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

const PrivacyPolicyScreen: React.FC<Props> = ({ navigation }) => {
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
          Privacy Policy
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
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 24,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          At Tiffsy, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, and safeguard your data.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          1. Information We Collect
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 10,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          We collect the following types of information:
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
          • Personal Information: Name, phone number, email address{'\n'}
          • Delivery Information: Delivery addresses, landmark details{'\n'}
          • Payment Information: Payment method details (securely processed){'\n'}
          • Order Information: Order history, preferences, dietary restrictions{'\n'}
          • Device Information: Device type, OS version, app version{'\n'}
          • Usage Data: App interactions, feature usage, performance data
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          2. How We Use Your Information
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 10,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          We use your information to:
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
          • Process and deliver your orders{'\n'}
          • Manage your subscriptions and vouchers{'\n'}
          • Send order updates and notifications{'\n'}
          • Provide customer support{'\n'}
          • Improve our services and user experience{'\n'}
          • Prevent fraud and ensure security{'\n'}
          • Send promotional offers (with your consent)
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          3. Information Sharing
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          We do not sell your personal information. We may share your information with:{'\n\n'}
          • Food providers: To fulfill your orders{'\n'}
          • Delivery partners: To deliver your meals{'\n'}
          • Payment processors: To process transactions securely{'\n'}
          • Service providers: Who help us operate our platform{'\n'}
          • Legal authorities: When required by law or to protect our rights
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          4. Data Security
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          We implement industry-standard security measures to protect your data, including encryption, secure servers, and regular security audits. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          5. Data Retention
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          We retain your personal information for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. You can request deletion of your account and data at any time.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          6. Your Rights
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          You have the right to:{'\n\n'}
          • Access your personal information{'\n'}
          • Correct inaccurate data{'\n'}
          • Request deletion of your data{'\n'}
          • Opt-out of marketing communications{'\n'}
          • Withdraw consent for data processing{'\n'}
          • Export your data in a portable format
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          7. Cookies and Tracking
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          We use cookies and similar technologies to enhance your experience, analyze usage patterns, and personalize content. You can control cookie settings through your device settings.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          8. Children's Privacy
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          Our service is not intended for users under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          9. Changes to Privacy Policy
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 20,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. Please review this policy periodically for updates.
        </Text>

        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 12,
          }}
        >
          10. Contact Us
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.base,
            color: '#374151',
            marginBottom: 40,
            lineHeight: FONT_SIZES.base * LINE_HEIGHTS.relaxed,
          }}
        >
          If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:{'\n\n'}
          Email: privacy@tiffsy.com{'\n'}
          Phone: +91 XXXXXXXXXX{'\n'}
          Address: [Your Company Address]
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PrivacyPolicyScreen;
