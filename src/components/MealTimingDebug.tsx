import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface MealTimingDebugProps {
  currentKitchen: any;
  mealWindowInfo: any;
  selectedMeal: string;
}

export const MealTimingDebug: React.FC<MealTimingDebugProps> = ({
  currentKitchen,
  mealWindowInfo,
  selectedMeal,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isExpanded) {
    return (
      <TouchableOpacity
        onPress={() => setIsExpanded(true)}
        className="absolute top-2 right-2 bg-blue-500 px-3 py-2 rounded-lg z-50"
      >
        <Text className="text-white text-xs font-bold">DEBUG</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View className="absolute top-2 right-2 bg-white rounded-lg shadow-lg p-4 z-50 max-w-xs">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="font-bold text-base">Meal Timing Debug</Text>
        <TouchableOpacity onPress={() => setIsExpanded(false)}>
          <Text className="text-red-500 font-bold">X</Text>
        </TouchableOpacity>
      </View>

      {/* Current Time */}
      <View className="mb-3 border-b border-gray-200 pb-2">
        <Text className="text-xs font-semibold text-gray-700">Current Time:</Text>
        <Text className="text-sm">{currentTime.toLocaleTimeString()}</Text>
        <Text className="text-xs text-gray-600">
          {currentTime.getHours()}:{currentTime.getMinutes().toString().padStart(2, '0')}
        </Text>
      </View>

      {/* Kitchen Info */}
      <View className="mb-3 border-b border-gray-200 pb-2">
        <Text className="text-xs font-semibold text-gray-700">Kitchen:</Text>
        <Text className="text-sm">{currentKitchen?.name || 'None'}</Text>
      </View>

      {/* Operating Hours */}
      <View className="mb-3 border-b border-gray-200 pb-2">
        <Text className="text-xs font-semibold text-gray-700">Operating Hours:</Text>
        {currentKitchen?.operatingHours ? (
          <>
            {currentKitchen.operatingHours.lunch && (
              <Text className="text-xs">
                Lunch: {currentKitchen.operatingHours.lunch.startTime} - {currentKitchen.operatingHours.lunch.endTime}
              </Text>
            )}
            {currentKitchen.operatingHours.dinner && (
              <Text className="text-xs">
                Dinner: {currentKitchen.operatingHours.dinner.startTime} - {currentKitchen.operatingHours.dinner.endTime}
              </Text>
            )}
          </>
        ) : (
          <Text className="text-xs text-red-500">Not set (using fallback)</Text>
        )}
      </View>

      {/* Meal Window Info */}
      <View className="mb-3 border-b border-gray-200 pb-2">
        <Text className="text-xs font-semibold text-gray-700">Active Meal:</Text>
        <Text className="text-sm font-bold text-blue-600">
          {mealWindowInfo?.activeMeal?.toUpperCase() || 'NONE'}
        </Text>
        <Text className="text-xs">
          Window Open: {mealWindowInfo?.isWindowOpen ? '✅ YES' : '❌ NO'}
        </Text>
      </View>

      {/* Next Meal */}
      <View className="mb-3 border-b border-gray-200 pb-2">
        <Text className="text-xs font-semibold text-gray-700">Next Meal:</Text>
        <Text className="text-xs">
          {mealWindowInfo?.nextMealWindow?.toUpperCase()} at {mealWindowInfo?.nextMealWindowTime}
        </Text>
      </View>

      {/* Currently Selected Tab */}
      <View className="mb-2">
        <Text className="text-xs font-semibold text-gray-700">Selected Tab:</Text>
        <Text className="text-sm font-bold text-green-600">
          {selectedMeal?.toUpperCase()}
        </Text>
      </View>

      {/* Logic Explanation */}
      <View className="bg-yellow-50 p-2 rounded mt-2">
        <Text className="text-xs font-semibold text-yellow-800 mb-1">Logic:</Text>
        <Text className="text-xs text-yellow-700">
          {!currentKitchen?.operatingHours
            ? '⚠️ Using fallback times (no hours set)'
            : mealWindowInfo?.isWindowOpen
            ? `✅ In ${mealWindowInfo.activeMeal} window`
            : `❌ Outside all windows, showing ${mealWindowInfo?.nextMealWindow}`}
        </Text>
      </View>
    </View>
  );
};
