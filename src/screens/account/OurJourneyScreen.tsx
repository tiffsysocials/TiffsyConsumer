// src/screens/account/OurJourneyScreen.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import Svg, { Path } from 'react-native-svg';
import { MainTabParamList } from '../../types/navigation';
import { useResponsive } from '../../hooks/useResponsive';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'OurJourney'>;

const OurJourneyScreen: React.FC<Props> = ({ navigation }) => {
  const { isSmallDevice } = useResponsive();

  const handleSocialMedia = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View className="bg-white px-5 py-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: SPACING.iconXl,
            height: SPACING.iconXl,
            borderRadius: SPACING.iconXl / 2,
            backgroundColor: '#FE8733',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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

        <Text className="font-bold text-gray-900" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>Our Journey</Text>

        <View style={{ minWidth: TOUCH_TARGETS.minimum, minHeight: TOUCH_TARGETS.minimum }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Tiffin Dabba Section */}
        <View className="px-5 mt-6">
          <Text className="text-rgba(0, 0, 0, 1) mb-1" style={{ fontSize: FONT_SIZES['2xl'], fontWeight: '500' }}>Tiffin Dabba</Text>
          <Text className="leading-6 mb-6" style={{ fontSize: FONT_SIZES.sm, lineHeight: FONT_SIZES.sm * 1.5, color: 'rgba(145, 145, 145, 1)' }}>
            Bringing the warmth of homecooked meals to your doorstep, one tiffin at a time.
          </Text>
        </View>

        {/* The Beginnings Section */}
        <View className="px-5 mt-30">
          <Text className="text-rgba(0, 0, 0, 1) mb-2" style={{ fontSize: FONT_SIZES.h3, fontWeight: '500' }}>The Beginnings</Text>
          <Text className="leading-6 mb-4" style={{ fontSize: FONT_SIZES.sm, lineHeight: FONT_SIZES.sm * 1.5, color: 'rgba(145, 145, 145, 1)', fontFamily: 'Inter', fontWeight: '400' }}>
            Lorem ipsum dolor sit amet consectetur. Quisque libero eget id consectetur gravida vulputate dignissim rutrum. Nulla mauris tincidunt et sed aliquam nullam quis tristique. Laoreet sit sollicitudin interdum dolor. Et dignissim fermentum eu sem. Enim vitae eu vehicula duis aenean orci ligula diam a. Arcu phasellus nunc ac euismod nunc. Aliquam tellus odio nunc nisl quis aliquam.
          </Text>

          {/* Images */}
          <View className="flex-row justify-between mb-5" style={{ alignItems: 'flex-end' }}>
            <Image
              source={require('../../assets/images/journey/journey4.png')}
              style={{ width: '48%', height: 159 }}
              resizeMode="cover"
            />
            <Image
              source={require('../../assets/images/journey/journey5.png')}
              style={{ width: '48%', height: 223 }}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Later Journey Section */}
        <View className="px-5 mt-4">
          <Text className="text-rgba(0, 0, 0, 1) mb-2" style={{ fontSize: FONT_SIZES.h3, fontWeight: '400', lineHeight: FONT_SIZES.h3 * 1.5 }}>Later Journey</Text>
          <Text className="leading-6 mb-6" style={{ fontSize: FONT_SIZES.sm, lineHeight: FONT_SIZES.sm * 1.5, color: 'rgba(145, 145, 145, 1)', fontFamily: 'Inter', fontWeight: '400' }}>
            Lorem ipsum dolor sit amet consectetur. Quisque libero eget id consectetur gravida vulputate dignissim rutrum. Nulla mauris tincidunt et sed aliquam nullam quis tristique. Laoreet sit sollicitudin interdum dolor. Et dignissim fermentum eu sem. Enim vitae eu vehicula duis aenean orci ligula diam a. Arcu phasellus nunc ac euismod nunc. Aliquam tellus odio nunc nisl quis aliquam.
          </Text>
        </View>

        {/* Statistics Cards */}
        <View className="px-5">
          <View className="flex-row justify-between mb-4">
            {/* Happy Customers */}
            <View
              className="bg-white rounded-2xl p-4 flex-row items-start justify-between"
              style={{
                width: '48%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View>
                <Text className="mb-1" style={{ fontSize: 15, fontWeight: '700', fontFamily: 'DM Sans', lineHeight: 19.5, color: 'rgba(94, 94, 94, 1)' }}>Happy{'\n'}Customers</Text>
                <Text className="text-2xl font-bold text-orange-400">5000+</Text>
              </View>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                  stroke="#FE8733"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>

            {/* Daily Deliveries */}
            <View
              className="bg-white rounded-2xl p-4 flex-row items-start justify-between"
              style={{
                width: '48%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View>
                <Text className="text-sm mb-1" style={{ fontSize: 15, fontWeight: '700', fontFamily: 'DM Sans', lineHeight: 19.5, color: 'rgba(94, 94, 94, 1)' }}>Daily{'\n'}Deliveries</Text>
                <Text className="text-2xl font-bold text-orange-400">800+</Text>
              </View>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                  stroke="#FE8733"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>

          <View className="flex-row justify-between mb-6">
            {/* Average Rating */}
            <View
              className="bg-white rounded-2xl p-4 flex-row items-start justify-between"
              style={{
                width: '48%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View>
                <Text className="mb-2" style={{ fontSize: 15, fontWeight: '700', fontFamily: 'DM Sans', lineHeight: 19.5, color: 'rgba(94, 94, 94, 1)' }}>Average{'\n'}Rating</Text>
                <Text className="text-2xl font-bold text-orange-400">4.7/5</Text>
              </View>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                  stroke="#FE8733"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>

            {/* Customer Satisfaction */}
            <View
              className="bg-white rounded-2xl p-4 flex-row items-start"
              style={{
                width: '48%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View className="flex-1">
                <Text className="mb-1" style={{ fontSize: 15, fontWeight: '700', fontFamily: 'DM Sans', lineHeight: 19.5, color: 'rgba(94, 94, 94, 1)' }}>Customer Satisfaction</Text>
                <Text className="text-2xl font-bold text-orange-400">100%</Text>
              </View>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 8 }}>
                <Path
                  d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
                  stroke="#FE8733"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>
        </View>

        {/* Follow Us Section */}
        <View className="px-5 mb-6">
          <Text className="font-bold text-gray-900 mb-4" style={{ fontSize: isSmallDevice ? FONT_SIZES.h4 : FONT_SIZES.h3 }}>Follow Us at</Text>

          {/* Facebook */}
          <TouchableOpacity
            className="flex-row items-center mb-4"
            style={{
              minHeight: TOUCH_TARGETS.minimum,
            }}
            onPress={() => handleSocialMedia('https://facebook.com')}
          >
            <Image
              source={require('../../assets/icons/facebook2.png')}
              style={{ width: SPACING.iconXl, height: SPACING.iconXl, marginRight: SPACING.md }}
              resizeMode="contain"
            />
            <Text className="font-medium text-gray-900" style={{ fontSize: FONT_SIZES.base }}>Facebook</Text>
          </TouchableOpacity>

          {/* Twitter */}
          <TouchableOpacity
            className="flex-row items-center mb-4"
            style={{
              minHeight: TOUCH_TARGETS.minimum,
            }}
            onPress={() => handleSocialMedia('https://twitter.com')}
          >
            <Image
              source={require('../../assets/icons/twitter2.png')}
              style={{ width: SPACING.iconXl, height: SPACING.iconXl, marginRight: SPACING.md }}
              resizeMode="contain"
            />
            <Text className="font-medium text-gray-900" style={{ fontSize: FONT_SIZES.base }}>Twitter</Text>
          </TouchableOpacity>

          {/* Instagram */}
          <TouchableOpacity
            className="flex-row items-center mb-4"
            style={{
              minHeight: TOUCH_TARGETS.minimum,
            }}
            onPress={() => handleSocialMedia('https://instagram.com')}
          >
            <Image
              source={require('../../assets/icons/insta2.png')}
              style={{ width: SPACING.iconXl, height: SPACING.iconXl, marginRight: SPACING.md }}
              resizeMode="contain"
            />
            <Text className="font-medium text-gray-900" style={{ fontSize: FONT_SIZES.base }}>Instagram</Text>
          </TouchableOpacity>
        </View>

        {/* Opening Hours */}
        <View className="px-5 mb-8 flex-row items-center" style={{ backgroundColor: 'rgba(255, 245, 242, 1)', width: 320, minHeight: TOUCH_TARGETS.comfortable, borderRadius: 42, alignSelf: 'center' }}>
          <Svg width={SPACING.iconSize} height={SPACING.iconSize} viewBox="0 0 24 24" fill="none" style={{ marginRight: SPACING.sm }}>
            <Path
              d="M12 6v6l4 2M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"
              stroke="#FE8733"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text className="text-orange-400 font-medium" style={{ fontSize: FONT_SIZES.sm }}>
            Mon-Sat: 9 AM - 9 PM | Sun: 10 AM - 6 PM
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default OurJourneyScreen;


