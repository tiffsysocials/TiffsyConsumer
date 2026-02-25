import React, { useState, useCallback } from 'react';
import { View } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/home/HomeScreen';
import AddressScreen from '../screens/address/AddressScreen';
import CartScreen from '../screens/cart/CartScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
import AccountScreen from '../screens/account/AccountScreen';
import EditProfileScreen from '../screens/account/EditProfileScreen';
import HelpSupportScreen from '../screens/account/HelpSupportScreen';
import AboutScreen from '../screens/account/AboutScreen';
import OurJourneyScreen from '../screens/account/OurJourneyScreen';
import YourOrdersScreen from '../screens/orders/YourOrdersScreen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import OrderTrackingScreen from '../screens/orders/OrderTrackingScreen';
import MealPlansScreen from '../screens/account/MealPlansScreen';
import BulkOrdersScreen from '../screens/account/BulkOrdersScreen';
import VouchersScreen from '../screens/account/VouchersScreen';
import OnDemandScreen from '../screens/ondemand/OnDemandScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import AutoOrderSettingsScreen from '../screens/subscription/AutoOrderSettingsScreen';
import AutoOrderConfigScreen from '../screens/subscription/AutoOrderConfigScreen';
import ScheduledMealPricingScreen from '../screens/scheduled-meals/ScheduledMealPricingScreen';
import MyScheduledMealsScreen from '../screens/scheduled-meals/MyScheduledMealsScreen';
import ChatSupportScreen from '../screens/account/ChatSupportScreen';
import MealCalendarScreen from '../screens/scheduled-meals/MealCalendarScreen';
import BulkSchedulePricingScreen from '../screens/scheduled-meals/BulkSchedulePricingScreen';
import AutoOrderAddonScreen from '../screens/scheduled-meals/AutoOrderAddonScreen';
import BottomNavBar from '../components/BottomNavBar';
import { MainTabParamList } from '../types/navigation';

const Stack = createStackNavigator<MainTabParamList>();

// Screens that should show nav bar
const MAIN_SCREENS = ['Home', 'YourOrders', 'OnDemand', 'Account'];

const getActiveTab = (routeName: string): 'home' | 'orders' | 'meals' | 'profile' => {
  switch (routeName) {
    case 'Home': return 'home';
    case 'YourOrders': return 'orders';
    case 'OnDemand': return 'meals';
    case 'Account': return 'profile';
    default: return 'home';
  }
};

const MainNavigatorContent = () => {
  const [currentRoute, setCurrentRoute] = useState('Home');

  const handleStateChange = useCallback((state: any) => {
    if (state) {
      const route = state.routes[state.index];
      setCurrentRoute(route.name);
    }
  }, []);

  const activeTab = getActiveTab(currentRoute);
  const showNavBar = MAIN_SCREENS.includes(currentRoute);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
        screenListeners={{
          state: (e) => handleStateChange(e.data.state),
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="YourOrders" component={YourOrdersScreen} />
        <Stack.Screen name="OnDemand" component={OnDemandScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
        <Stack.Screen name="Address" component={AddressScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="OurJourney" component={OurJourneyScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        <Stack.Screen name="MealPlans" component={MealPlansScreen} />
        <Stack.Screen name="BulkOrders" component={BulkOrdersScreen} />
        <Stack.Screen name="Vouchers" component={VouchersScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="AutoOrderSettings" component={AutoOrderSettingsScreen} />
        <Stack.Screen name="AutoOrderConfig" component={AutoOrderConfigScreen} />
        <Stack.Screen name="ScheduledMealPricing" component={ScheduledMealPricingScreen} />
        <Stack.Screen name="MyScheduledMeals" component={MyScheduledMealsScreen} />
        <Stack.Screen name="ChatSupport" component={ChatSupportScreen} />
        <Stack.Screen name="MealCalendar" component={MealCalendarScreen} />
        <Stack.Screen name="BulkSchedulePricing" component={BulkSchedulePricingScreen} />
        <Stack.Screen name="AutoOrderAddons" component={AutoOrderAddonScreen} />
      </Stack.Navigator>
      {showNavBar && <BottomNavBar activeTab={activeTab} />}
    </View>
  );
};

const MainNavigator = () => {
  return <MainNavigatorContent />;
};

export default MainNavigator;
