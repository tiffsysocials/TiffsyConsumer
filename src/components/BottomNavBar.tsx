import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Image, Text, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING } from '../constants/spacing';
import { FONT_SIZES } from '../constants/typography';
import { navigateToMainScreen } from '../navigation/navigationRef';

interface BottomNavBarProps {
  activeTab: 'home' | 'orders' | 'meals' | 'profile';
}

interface NavItemProps {
  label: string;
  icon?: any;
  iconName?: string;
  isActive: boolean;
  onPress: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ label, icon, iconName, isActive, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: isActive ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isActive, scaleAnim]);

  const labelScale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const labelOpacity = scaleAnim;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.navItem}
    >
      <View style={[styles.navItemInner, isActive && styles.navItemActive]}>
        {iconName ? (
          <MaterialCommunityIcons
            name={iconName}
            size={SPACING.iconSize}
            color={isActive ? '#FE8733' : '#9CA3AF'}
          />
        ) : (
          <Image
            source={icon}
            style={[
              styles.icon,
              { tintColor: isActive ? '#FE8733' : '#9CA3AF' },
            ]}
            resizeMode="contain"
          />
        )}
        {isActive && (
          <Animated.Text
            style={[
              styles.label,
              {
                opacity: labelOpacity,
                transform: [{ scale: labelScale }],
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab }) => {
  const insets = useSafeAreaInsets();

  const handleNavigation = (tab: 'home' | 'orders' | 'meals' | 'profile') => {
    if (activeTab === tab) return; // Don't navigate if already on the tab

    switch (tab) {
      case 'home':
        navigateToMainScreen('Home');
        break;
      case 'orders':
        navigateToMainScreen('YourOrders');
        break;
      case 'meals':
        navigateToMainScreen('OnDemand');
        break;
      case 'profile':
        navigateToMainScreen('Account');
        break;
    }
  };

  return (
    <View
      style={[
        styles.container,
        { bottom: Math.max(10, insets.bottom) + 8 },
      ]}
    >
      <NavItem
        label="Home"
        icon={require('../assets/icons/house.png')}
        isActive={activeTab === 'home'}
        onPress={() => handleNavigation('home')}
      />
      <NavItem
        label="Orders"
        icon={require('../assets/icons/kitchen.png')}
        isActive={activeTab === 'orders'}
        onPress={() => handleNavigation('orders')}
      />
      <NavItem
        label="On-Demand"
        iconName="food"
        isActive={activeTab === 'meals'}
        onPress={() => handleNavigation('meals')}
      />
      <NavItem
        label="Profile"
        icon={require('../assets/icons/profile2.png')}
        isActive={activeTab === 'profile'}
        onPress={() => handleNavigation('profile')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.lg + 4,
    right: SPACING.lg + 4,
    backgroundColor: 'white',
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  navItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    height: 44,
  },
  navItemActive: {
    backgroundColor: 'rgba(254, 243, 240, 1)',
    borderRadius: 22,
    overflow: 'hidden',
  },
  icon: {
    width: SPACING.iconSize,
    height: SPACING.iconSize,
  },
  label: {
    color: '#FE8733',
    fontSize: FONT_SIZES.base - 1,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default BottomNavBar;
