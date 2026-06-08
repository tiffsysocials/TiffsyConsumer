// src/components/MealWindowModal.tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
} from 'react-native';

type MealType = 'lunch' | 'dinner';

interface MealWindowModalProps {
  visible: boolean;
  nextMealWindow: MealType;
  nextMealWindowTime: string;
  onClose: () => void;
  onSchedule?: () => void;
  mode?: 'next-window' | 'all-closed';
}

const MealWindowModal: React.FC<MealWindowModalProps> = ({
  visible,
  nextMealWindow,
  nextMealWindowTime,
  onClose,
  onSchedule,
  mode = 'next-window',
}) => {
  const getMealName = () => nextMealWindow === 'lunch' ? 'Lunch' : 'Dinner';
  const isAllClosed = mode === 'all-closed';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 24,
            padding: 24,
            width: '100%',
            maxWidth: 340,
            alignItems: 'center',
          }}
        >
          {/* Clock Icon */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(254, 135, 51, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 40 }}>⏰</Text>
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 22,
              fontWeight: 'bold',
              color: '#1F2937',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            {isAllClosed ? "Today's Orders Are Closed" : 'Ordering Window Closed'}
          </Text>

          {/* Description */}
          <Text
            style={{
              fontSize: 15,
              color: '#6B7280',
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 24,
            }}
          >
            {isAllClosed
              ? 'Schedule a meal for tomorrow’s lunch or dinner.'
              : 'The current meal ordering window has ended.'}
          </Text>

          {/* Schedule for Tomorrow Button */}
          {onSchedule && (
            <TouchableOpacity
              onPress={onSchedule}
              style={{
                backgroundColor: '#FE8733',
                borderRadius: 30,
                paddingVertical: 14,
                paddingHorizontal: 40,
                width: '100%',
                marginBottom: 12,
              }}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  color: 'white',
                  fontSize: 16,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                Schedule for Tomorrow
              </Text>
            </TouchableOpacity>
          )}

          {/* View Menu Button */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              backgroundColor: onSchedule ? 'transparent' : '#FE8733',
              borderRadius: 30,
              paddingVertical: 14,
              paddingHorizontal: 40,
              width: '100%',
              borderWidth: onSchedule ? 2 : 0,
              borderColor: '#FE8733',
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                color: onSchedule ? '#FE8733' : 'white',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              View {getMealName()} Menu
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default MealWindowModal;
