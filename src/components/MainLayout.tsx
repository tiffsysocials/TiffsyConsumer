import React from 'react';
import { View } from 'react-native';
import BottomNavBar from './BottomNavBar';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: 'home' | 'orders' | 'meals' | 'profile';
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, activeTab }) => {
  return (
    <View style={{ flex: 1 }}>
      {children}
      <BottomNavBar activeTab={activeTab} />
    </View>
  );
};

export default MainLayout;
