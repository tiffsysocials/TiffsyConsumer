import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Share,
  TextInput,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MainTabParamList } from '../../types/navigation';
import { useAlert } from '../../context/AlertContext';
import apiService from '../../services/api.service';
import { ReferralStats, ReferralEntry } from '../../types/referral';
import { SPACING, TOUCH_TARGETS } from '../../constants/spacing';
import { FONT_SIZES } from '../../constants/typography';

type Props = StackScreenProps<MainTabParamList, 'ReferAndEarn'>;

const ReferAndEarnScreen: React.FC<Props> = ({ navigation }) => {
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [shareMessage, setShareMessage] = useState('');

  // Apply code state (for users who missed onboarding — hidden if already referred)
  const [showApplySection, setShowApplySection] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [codeRes, statsRes, shareRes] = await Promise.all([
        apiService.getMyReferralCode(),
        apiService.getMyReferralStats(),
        apiService.getShareContent(),
      ]);

      if (codeRes.success && codeRes.data) {
        setReferralCode(codeRes.data.code);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
        // Only show "Apply Code" section if user hasn't been referred yet
        setShowApplySection(!statsRes.data.isReferred);
      }
      if (shareRes.success && shareRes.data) {
        setShareMessage(shareRes.data.message);
      }
    } catch (error) {
      console.error('[ReferAndEarn] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleCopyCode = () => {
    if (referralCode) {
      Clipboard.setString(referralCode);
      showAlert('Copied!', 'Referral code copied to clipboard', undefined, 'success');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: shareMessage || `Join Tiffsy with my referral code: ${referralCode}`,
      });
    } catch (error) {
      console.error('[ReferAndEarn] Share error:', error);
    }
  };

  const handleApplyCode = async () => {
    const cleaned = applyCode.trim().toUpperCase();
    if (!cleaned || cleaned.length < 6) {
      showAlert('Invalid Code', 'Please enter a valid referral code', undefined, 'error');
      return;
    }
    setApplyLoading(true);
    try {
      const res = await apiService.applyReferralCode(cleaned);
      if (res.success) {
        showAlert('Success!', 'Referral code applied successfully', undefined, 'success');
        setApplyCode('');
        setShowApplySection(false);
        fetchData();
      } else {
        showAlert('Failed', res.message || 'Could not apply referral code', undefined, 'error');
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Something went wrong', undefined, 'error');
    } finally {
      setApplyLoading(false);
    }
  };

  const getStatusBadge = (status: ReferralEntry['status']) => {
    switch (status) {
      case 'CONVERTED':
        return { label: 'Converted', bg: '#DCFCE7', color: '#16A34A' };
      case 'PENDING':
        return { label: 'Pending', bg: '#FEF3C7', color: '#D97706' };
      case 'EXPIRED':
        return { label: 'Expired', bg: '#FEE2E2', color: '#DC2626' };
      case 'CANCELLED':
        return { label: 'Cancelled', bg: '#F3F4F6', color: '#6B7280' };
      default:
        return { label: status, bg: '#F3F4F6', color: '#6B7280' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  };

  const renderReferralItem = ({ item }: { item: ReferralEntry }) => {
    const badge = getStatusBadge(item.status);
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: SPACING.md,
          paddingHorizontal: SPACING.md,
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '600', color: '#111827' }}>
            {item.refereeName || 'User'}
          </Text>
          <Text style={{ fontSize: FONT_SIZES.xs, color: '#9CA3AF', marginTop: 2 }}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {item.referrerReward && item.status === 'CONVERTED' && (
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#16A34A', fontWeight: '600' }}>
              +{item.referrerReward.voucherCount} meals
            </Text>
          )}
          <View style={{ backgroundColor: badge.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: FONT_SIZES.xs, fontWeight: '600', color: badge.color }}>
              {badge.label}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Referral Code Card */}
      <View
        style={{
          backgroundColor: '#FFF7ED',
          borderRadius: 20,
          padding: SPACING.xl,
          marginHorizontal: SPACING.lg,
          marginTop: SPACING.lg,
          borderWidth: 2,
          borderColor: '#ff8800',
        }}
      >
        <Text style={{ fontSize: FONT_SIZES.sm, color: '#6B7280', textAlign: 'center', marginBottom: SPACING.xs }}>
          Your Referral Code
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.h1,
            fontWeight: 'bold',
            color: '#ff8800',
            textAlign: 'center',
            letterSpacing: 3,
            marginBottom: SPACING.md,
          }}
        >
          {referralCode || '------'}
        </Text>
        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <TouchableOpacity
            onPress={handleCopyCode}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'white',
              borderRadius: 14,
              paddingVertical: SPACING.md,
              borderWidth: 1.5,
              borderColor: '#ff8800',
            }}
          >
            <MaterialCommunityIcons name="content-copy" size={18} color="#ff8800" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#ff8800' }}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ff8800',
              borderRadius: 14,
              paddingVertical: SPACING.md,
            }}
          >
            <MaterialCommunityIcons name="share-variant" size={18} color="white" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: 'white' }}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards */}
      {stats && (
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: SPACING.lg,
            marginTop: SPACING.lg,
            gap: SPACING.sm,
          }}
        >
          <View style={{ flex: 1, backgroundColor: '#EFF6FF', borderRadius: 16, padding: SPACING.md, alignItems: 'center' }}>
            <Text style={{ fontSize: FONT_SIZES.h2, fontWeight: 'bold', color: '#2563EB' }}>
              {stats.totalReferred}
            </Text>
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>Invited</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#ECFDF5', borderRadius: 16, padding: SPACING.md, alignItems: 'center' }}>
            <Text style={{ fontSize: FONT_SIZES.h2, fontWeight: 'bold', color: '#16A34A' }}>
              {stats.totalConverted}
            </Text>
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>Joined</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#FEF3C7', borderRadius: 16, padding: SPACING.md, alignItems: 'center' }}>
            <Text style={{ fontSize: FONT_SIZES.h2, fontWeight: 'bold', color: '#D97706' }}>
              {stats.totalVouchersEarned}
            </Text>
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 2 }}>Meals Earned</Text>
          </View>
        </View>
      )}

      {/* Milestone Progress */}
      {stats?.nextMilestone && (
        <View
          style={{
            marginHorizontal: SPACING.lg,
            marginTop: SPACING.lg,
            backgroundColor: '#F9FAFB',
            borderRadius: 16,
            padding: SPACING.lg,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
            <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#111827' }}>
              Next: {stats.nextMilestone.name}
            </Text>
            <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280' }}>
              {stats.nextMilestone.remaining} more to go
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                backgroundColor: '#ff8800',
                borderRadius: 4,
                width: `${Math.min(
                  ((stats.totalConverted / stats.nextMilestone.referralCount) * 100),
                  100
                )}%`,
              }}
            />
          </View>
          {stats.currentMilestone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm }}>
              <MaterialCommunityIcons name="trophy" size={16} color="#D97706" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#D97706', fontWeight: '600' }}>
                Current: {stats.currentMilestone.name}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Apply Code Section */}
      {showApplySection && (
        <View
          style={{
            marginHorizontal: SPACING.lg,
            marginTop: SPACING.lg,
            backgroundColor: '#F0FDF4',
            borderRadius: 16,
            padding: SPACING.lg,
          }}
        >
          <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#111827', marginBottom: SPACING.sm }}>
            Got a referral code?
          </Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: 'white',
                borderRadius: 12,
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
                fontSize: FONT_SIZES.sm,
                borderWidth: 1,
                borderColor: '#D1D5DB',
              }}
              placeholder="Enter code"
              placeholderTextColor="#9CA3AF"
              value={applyCode}
              onChangeText={(t) => setApplyCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              autoCapitalize="characters"
              maxLength={20}
            />
            <TouchableOpacity
              onPress={handleApplyCode}
              disabled={applyLoading}
              style={{
                backgroundColor: '#ff8800',
                borderRadius: 12,
                paddingHorizontal: SPACING.lg,
                justifyContent: 'center',
                opacity: applyLoading ? 0.6 : 1,
              }}
            >
              {applyLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: 'white' }}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* How It Works */}
      <View
        style={{
          marginHorizontal: SPACING.lg,
          marginTop: SPACING.xl,
          marginBottom: SPACING.md,
        }}
      >
        <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827', marginBottom: SPACING.md }}>
          How It Works
        </Text>
        {[
          { icon: 'share-variant', title: 'Share Your Code', desc: 'Send your unique referral code to friends & family' },
          { icon: 'account-plus', title: 'Friend Subscribes', desc: 'Your friend signs up and buys their first meal plan' },
          { icon: 'gift', title: 'Both Get Meals!', desc: 'You and your friend both receive free meal vouchers' },
        ].map((step, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#FFF7ED',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: SPACING.md,
              }}
            >
              <MaterialCommunityIcons name={step.icon} size={22} color="#ff8800" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '600', color: '#111827' }}>{step.title}</Text>
              <Text style={{ fontSize: FONT_SIZES.xs, color: '#6B7280', marginTop: 1 }}>{step.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Referral History Header */}
      {stats && stats.referrals && stats.referrals.length > 0 && (
        <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.sm }}>
          <Text style={{ fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: '#111827' }}>
            Your Referrals
          </Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={{ alignItems: 'center', paddingVertical: SPACING.xl * 2, paddingHorizontal: SPACING.lg }}>
        <MaterialCommunityIcons name="account-group-outline" size={64} color="#D1D5DB" />
        <Text style={{ fontSize: FONT_SIZES.base, fontWeight: '600', color: '#6B7280', marginTop: SPACING.md, textAlign: 'center' }}>
          No referrals yet
        </Text>
        <Text style={{ fontSize: FONT_SIZES.sm, color: '#9CA3AF', marginTop: SPACING.xs, textAlign: 'center' }}>
          Share your code with friends to start earning free meals!
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
        <SafeAreaView style={{ backgroundColor: '#ff8800' }} edges={['top']} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#ff8800" />
          <Text style={{ marginTop: SPACING.md, color: '#6B7280' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="light-content" backgroundColor="#ff8800" />
      <SafeAreaView style={{ backgroundColor: '#ff8800' }} edges={['top']} />

      {/* Header */}
      <View
        style={{
          backgroundColor: '#ff8800',
          paddingBottom: SPACING.xl,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: TOUCH_TARGETS.minimum,
              height: TOUCH_TARGETS.minimum,
              borderRadius: TOUCH_TARGETS.minimum / 2,
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons name="arrow-left" size={SPACING.iconSize} color="white" />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: FONT_SIZES.h4, fontWeight: 'bold', color: 'white' }}>
            Refer & Earn
          </Text>
          <View style={{ width: TOUCH_TARGETS.minimum }} />
        </View>
      </View>

      <FlatList
        data={stats?.referrals || []}
        renderItem={renderReferralItem}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ff8800']} />
        }
      />
    </View>
  );
};

export default ReferAndEarnScreen;
