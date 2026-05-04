// src/screens/account/HelpSupportScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { StackScreenProps } from '@react-navigation/stack';
import { MainTabParamList } from '../../types/navigation';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'HelpSupport'>;

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const HelpSupportScreen: React.FC<Props> = ({ navigation }) => {
  const { isSmallDevice } = useResponsive();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Account', 'Delivery', 'Quality', 'Queries'];

  const faqs: FAQ[] = [
    {
      id: '1',
      question: 'What if my order is delayed?',
      answer: 'If your order is delayed, you can track its real-time status in "My Orders". You\'ll also receive push notifications at every step. If the delay is significant, please contact our support team at +91 98765-43210 and we\'ll resolve it for you immediately.',
      category: 'Delivery',
    },
    {
      id: '2',
      question: 'Can I pause or cancel my meal plan?',
      answer: 'Yes! You can pause auto-ordering anytime from "Auto-Order Settings" in the Account menu. Select a date until when you want to pause, and it will automatically resume after that. To cancel your subscription entirely, go to Meal Plans and use the cancel option. Unused vouchers remain valid until their expiry date.',
      category: 'Account',
    },
    {
      id: '3',
      question: 'What if I want to skip a day?',
      answer: 'You can skip specific meals using the "Skip Meal Calendar". Go to Auto-Order Settings and tap "Skip Next Meal", or access the calendar directly. Select the date and meal window (Lunch or Dinner) you want to skip. Your voucher won\'t be used for skipped slots, and you can unskip anytime before the order cutoff time.',
      category: 'Delivery',
    },
    {
      id: '4',
      question: 'How do I change my delivery address?',
      answer: 'Go to "Saved Addresses" from the Account menu. You can add a new address, edit existing ones, or set a different default address. For auto-ordering, make sure to update the default address in "Auto-Order Settings" as well. Your address must be in a serviceable pincode area.',
      category: 'Delivery',
    },
    {
      id: '5',
      question: 'What payment options are available?',
      answer: 'Tiffsy supports UPI (Google Pay, PhonePe, etc.), credit/debit cards, wallets, and net banking via Razorpay. If you have meal vouchers from a subscription plan, you can also use "Voucher Only" payment where no additional money is charged. If a payment fails, you can retry it from the order details screen.',
      category: 'Account',
    },
    {
      id: '6',
      question: 'Where is my delivery?',
      answer: 'You can track your order in real-time by going to "My Orders" and tapping on your active order. You\'ll see a detailed timeline showing each status: Placed, Accepted, Preparing, Ready, Picked Up, Out for Delivery, and Delivered. Push notifications are also sent at each stage so you stay updated.',
      category: 'Delivery',
    },
    {
      id: '7',
      question: 'Can I edit or cancel my order?',
      answer: 'You can cancel an order within 1 minute of placing it. A cancel button with a countdown timer will appear on the order confirmation screen. Once the 1-minute window expires, cancellation is no longer possible. If vouchers were used, they will be restored upon successful cancellation. Editing an order after placement is not supported — you\'ll need to cancel and place a new one.',
      category: 'Account',
    },
    {
      id: '8',
      question: 'How do vouchers work?',
      answer: 'Vouchers are meal credits included with your subscription plan. Each voucher covers one meal. When you place an order, available vouchers are automatically applied to reduce or eliminate payment. You can view all your vouchers (Available, Redeemed, Expired, Restored) in "My Vouchers" from the Account menu. Vouchers have an expiry date, so make sure to use them before they expire!',
      category: 'Account',
    },
    {
      id: '9',
      question: 'How does auto-ordering work?',
      answer: 'Auto-ordering automatically places meal orders based on your weekly schedule. Set it up in "Auto-Order Settings": enable it, choose your default kitchen and address, then select Lunch and/or Dinner for each day of the week. Orders are placed automatically using your vouchers. You can pause, resume, or skip meals anytime.',
      category: 'Queries',
    },
    {
      id: '10',
      question: 'What if my auto-order fails?',
      answer: 'Auto-orders can fail if you have no available vouchers, no default address set, your address is outside the delivery zone, no kitchen is available, or the menu hasn\'t been published yet. You\'ll receive a notification with the failure reason. Check "Auto-Order Settings" to fix the issue and ensure your next auto-order goes through.',
      category: 'Queries',
    },
    {
      id: '11',
      question: 'Do you deliver to my area?',
      answer: 'Tiffsy delivers to specific zones based on pincode. To check if your area is serviceable, go to "Saved Addresses" and try adding your address — the app will verify your pincode. We\'re constantly expanding to new areas, so if your location isn\'t covered yet, check back soon!',
      category: 'Delivery',
    },
    {
      id: '12',
      question: 'How do I get a refund?',
      answer: 'For cancelled orders, vouchers are restored immediately. If you paid via UPI/card, monetary refunds are processed within 5-7 business days. For failed payments where the amount was deducted, it\'s auto-refunded within 5-7 business days. For subscription-related refunds, eligibility depends on your plan terms. Contact support for specific refund queries.',
      category: 'Queries',
    },
    {
      id: '13',
      question: 'Is my food vegetarian or non-vegetarian?',
      answer: 'Each menu item is clearly labeled as Veg, Non-Veg, or Vegan. You can also set your dietary preference (Vegetarian, Non-Vegetarian, or Vegan) in your profile under "Edit Profile". The app will show menus tailored to your preference. You can change this setting anytime.',
      category: 'Quality',
    },
    {
      id: '14',
      question: 'How is the food quality ensured?',
      answer: 'Tiffsy partners with trusted local kitchens that prepare fresh, homestyle meals daily. Menus are updated each day to ensure freshness. You can rate your orders after delivery, and your feedback directly helps us maintain and improve food quality across all partner kitchens.',
      category: 'Quality',
    },
    {
      id: '15',
      question: 'How do I delete my account?',
      answer: 'Go to the Account tab, scroll down, and tap "Delete Account". Your account will be scheduled for deletion with a 10-day grace period. During this time, you can contact support to cancel the deletion. After 10 days, all your data will be permanently removed.',
      category: 'Account',
    },
  ];

  const handleCall = () => {
    Linking.openURL('tel:+919876543210');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:info@tiffsy.in');
  };

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const filteredFAQs = faqs.filter((faq) => {
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View className="bg-white px-5 py-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="items-center justify-center"
          style={{
            width: SPACING.iconXl,
            height: SPACING.iconXl,
            borderRadius: SPACING.iconXl / 2,
            backgroundColor: '#FE8733',
          }}
        >
          {/* Chevron-left icon (Heroicons outline) */}
          <Svg width={SPACING.iconSize - 2} height={SPACING.iconSize - 2} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15.75 19.5 8.25 12l7.5-7.5"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        <Text className="font-bold text-gray-900" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>Help & Support</Text>

        <View style={{ minWidth: TOUCH_TARGETS.minimum, minHeight: TOUCH_TARGETS.minimum }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View className="px-5 py-4 bg-white">
          <View
            className="flex-row items-center bg-gray-50 rounded-full border border-gray-200"
            style={{
              paddingHorizontal: SPACING.lg,
              minHeight: TOUCH_TARGETS.comfortable,
            }}
          >
            <Image
              source={require('../../assets/icons/search2.png')}
              style={{ width: SPACING.iconSize, height: SPACING.iconSize, tintColor: '#FE8733' }}
              resizeMode="contain"
            />
            <TextInput
              placeholder="Search"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 text-gray-900"
              style={{ marginLeft: SPACING.md, fontSize: FONT_SIZES.base }}
            />
          </View>
        </View>

        {/* Chat With Us Banner */}
        <TouchableOpacity
          onPress={() => navigation.navigate('ChatSupport')}
          style={{
            marginHorizontal: 20,
            marginTop: 16,
            backgroundColor: '#FE8733',
            borderRadius: 16,
            padding: 18,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#FE8733',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="white"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: FONT_SIZES.lg, fontWeight: 'bold' }}>
              Chat with us
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: FONT_SIZES.sm, marginTop: 2 }}>
              Get instant answers to your questions
            </Text>
          </View>
          <Text style={{ color: 'white', fontSize: 22 }}>{'\u203A'}</Text>
        </TouchableOpacity>

        {/* Contact Us Section */}
        <View className="px-5 py-4 bg-white" style={{ marginTop: 8 }}>
          <Text className="font-bold text-gray-900 mb-4" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>Contact Us</Text>

          <View className="flex-row justify-between">
            {/* Call Us Card */}
            <TouchableOpacity
              onPress={handleCall}
              className="flex-1 bg-white rounded-2xl mr-2 items-center"
              style={{
                padding: SPACING.lg,
                minHeight: TOUCH_TARGETS.large,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <View
                className="rounded-full bg-orange-50 items-center justify-center"
                style={{
                  width: SPACING.iconXl * 1.4,
                  height: SPACING.iconXl * 1.4,
                  marginBottom: SPACING.md,
                }}
              >
                <Image
                  source={require('../../assets/icons/call3.png')}
                  style={{ width: SPACING.iconXl, height: SPACING.iconXl }}
                  resizeMode="contain"
                />
              </View>
              <Text className="font-bold text-gray-900 mb-1" style={{ fontSize: FONT_SIZES.base }}>Call us</Text>
              <Text className="font-semibold text-gray-900 mb-1" style={{ fontSize: FONT_SIZES.sm }}>+91 98765-43210</Text>
              <Text className="text-gray-500" style={{ fontSize: FONT_SIZES.xs }}>Mon-Fri • 9-10</Text>
            </TouchableOpacity>

            {/* Email Us Card */}
            <TouchableOpacity
              onPress={handleEmail}
              className="flex-1 bg-white rounded-2xl ml-2 items-center"
              style={{
                padding: SPACING.lg,
                minHeight: TOUCH_TARGETS.large,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <View
                className="rounded-full bg-orange-50 items-center justify-center"
                style={{
                  width: SPACING.iconXl * 1.4,
                  height: SPACING.iconXl * 1.4,
                  marginBottom: SPACING.md,
                }}
              >
                <Image
                  source={require('../../assets/icons/mail3.png')}
                  style={{ width: SPACING.iconXl, height: SPACING.iconXl }}
                  resizeMode="contain"
                />
              </View>
              <Text className="font-bold text-gray-900 mb-1" style={{ fontSize: FONT_SIZES.base }}>Email Us</Text>
              <Text className="font-semibold text-gray-900 mb-1" style={{ fontSize: FONT_SIZES.sm }}>info@tiffsy.in</Text>
              <Text className="text-gray-500" style={{ fontSize: FONT_SIZES.xs }}>Mon-Fri • 9-10</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ Section */}
        <View className="px-5 py-4 bg-white mt-2">
          <Text className="font-bold text-gray-900 mb-4" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>
            Frequently Asked Questions
          </Text>

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedCategory(category)}
                className="mr-2 rounded-full"
                style={{
                  paddingHorizontal: SPACING.lg,
                  paddingVertical: SPACING.sm,
                  minHeight: TOUCH_TARGETS.minimum,
                  backgroundColor: selectedCategory === category ? '#FE8733' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  className="font-medium"
                  style={{
                    fontSize: FONT_SIZES.sm,
                    color: selectedCategory === category ? '#FFFFFF' : '#4B5563',
                  }}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* FAQ List */}
          <View>
            {filteredFAQs.map((faq, index) => (
              <TouchableOpacity
                key={faq.id}
                onPress={() => toggleFAQ(faq.id)}
                className="bg-white rounded-2xl"
                style={{
                  padding: SPACING.lg,
                  minHeight: TOUCH_TARGETS.large,
                  marginBottom: index < filteredFAQs.length - 1 ? SPACING.sm : 0,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  elevation: 4,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className="flex-1 font-semibold text-gray-900"
                    style={{
                      fontSize: FONT_SIZES.base,
                      marginRight: SPACING.md,
                    }}
                  >
                    {faq.question}
                  </Text>
                  <Image
                    source={require('../../assets/icons/downarrow.png')}
                    style={{
                      width: SPACING.iconSize,
                      height: SPACING.iconSize,
                      transform: [{ rotate: expandedFAQ === faq.id ? '180deg' : '0deg' }],
                    }}
                    resizeMode="contain"
                  />
                </View>

                {expandedFAQ === faq.id && (
                  <Text
                    className="text-gray-600"
                    style={{
                      fontSize: FONT_SIZES.sm,
                      lineHeight: FONT_SIZES.sm * 1.5,
                      marginTop: SPACING.md,
                    }}
                  >
                    {faq.answer}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default HelpSupportScreen;
