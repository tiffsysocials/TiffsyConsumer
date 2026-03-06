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
}

const MealWindowModal: React.FC<MealWindowModalProps> = ({
  visible,
  nextMealWindow,
  nextMealWindowTime,
  onClose,
  onSchedule,
}) => {
  const getMealName = () => nextMealWindow === 'lunch' ? 'Lunch' : 'Dinner';

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
              backgroundColor: 'rgba(255, 136, 0, 0.1)',
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
            Ordering Window Closed
          </Text>

          {/* Description */}
          <Text
            style={{
              fontSize: 15,
              color: '#6B7280',
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 8,
            }}
          >
            The current meal ordering window has ended.
          </Text>

          {/* Next Window Info */}
          <View
            style={{
              backgroundColor: 'rgba(255, 136, 0, 0.08)',
              borderRadius: 12,
              padding: 16,
              width: '100%',
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: '#6B7280',
                textAlign: 'center',
                marginBottom: 4,
              }}
            >
              Next ordering window opens at
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#ff8800',
                textAlign: 'center',
              }}
            >
              {nextMealWindowTime} for {getMealName()}
            </Text>
          </View>

          {/* Schedule for Tomorrow Button */}
          {onSchedule && (
            <TouchableOpacity
              onPress={onSchedule}
              style={{
                backgroundColor: '#ff8800',
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
              backgroundColor: onSchedule ? 'transparent' : '#ff8800',
              borderRadius: 30,
              paddingVertical: 14,
              paddingHorizontal: 40,
              width: '100%',
              borderWidth: onSchedule ? 2 : 0,
              borderColor: '#ff8800',
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                color: onSchedule ? '#ff8800' : 'white',
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
