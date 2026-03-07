// src/components/RateOrderModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';

interface RateOrderModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (stars: number, comment?: string) => Promise<void>;
  onSkip?: () => void;
  orderNumber?: string;
  isLoading?: boolean;
}

const RateOrderModal: React.FC<RateOrderModalProps> = ({
  visible,
  onClose,
  onSubmit,
  onSkip,
  orderNumber,
  isLoading = false,
}) => {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStars(0);
      setComment('');
      setError(null);
    }
  }, [visible]);

  const handleSubmit = async () => {
    // Validate stars
    if (stars < 1) {
      setError('Please select a rating');
      return;
    }

    // Validate comment length if provided
    if (comment.length > 500) {
      setError('Comment must be 500 characters or less');
      return;
    }

    setError(null);
    console.log('[RateOrderModal] Submitting rating - Stars:', stars, 'Comment:', comment || 'None');
    await onSubmit(stars, comment.trim() || undefined);
  };

  const handleSkip = () => {
    console.log('[RateOrderModal] Skipping rating');
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  // Render star button
  const renderStar = (index: number) => {
    const isFilled = index <= stars;
    return (
      <TouchableOpacity
        key={index}
        onPress={() => {
          setStars(index);
          if (error) setError(null);
        }}
        className="mx-1"
      >
        <Image
          source={require('../assets/icons/star.png')}
          style={{
            width: 40,
            height: 40,
            tintColor: isFilled ? '#F59E0B' : '#D1D5DB',
          }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xl font-bold text-gray-900">Rate your order</Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Text className="text-2xl text-gray-400">×</Text>
            </TouchableOpacity>
          </View>

          {/* Order Number */}
          {orderNumber && (
            <Text className="text-sm text-gray-500 mb-4">
              Order #{orderNumber}
            </Text>
          )}

          {/* Rating Description */}
          <Text className="text-center text-gray-600 mb-4">
            How was your experience with this order?
          </Text>

          {/* Star Rating */}
          <View className="flex-row justify-center items-center mb-6">
            {[1, 2, 3, 4, 5].map(renderStar)}
          </View>

          {/* Rating Label */}
          {stars > 0 && (
            <Text className="text-center font-semibold text-lg mb-4" style={{ color: '#F59E0B' }}>
              {stars === 1 && 'Poor'}
              {stars === 2 && 'Fair'}
              {stars === 3 && 'Good'}
              {stars === 4 && 'Very Good'}
              {stars === 5 && 'Excellent!'}
            </Text>
          )}

          {/* Comment Input */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Add a comment (optional)
          </Text>
          <TextInput
            placeholder="Tell us about your experience..."
            placeholderTextColor="#9CA3AF"
            value={comment}
            onChangeText={(text) => {
              if (text.length <= 500) {
                setComment(text);
                if (error) setError(null);
              }
            }}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="bg-gray-100 rounded-xl p-4 text-gray-900 mb-1"
            style={{ minHeight: 80 }}
          />
          <Text className="text-xs text-gray-400 mb-2 text-right">
            {comment.length}/500
          </Text>

          {error && (
            <Text className="text-red-500 text-sm mb-4">{error}</Text>
          )}

          {/* Buttons */}
          <View className="flex-row mt-4">
            <TouchableOpacity
              onPress={handleSkip}
              disabled={isLoading}
              className="flex-1 py-4 rounded-full items-center mr-2"
              style={{ borderWidth: 2, borderColor: '#E5E7EB' }}
            >
              <Text className="font-bold text-base text-gray-500">
                Skip
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading || stars < 1}
              className="flex-1 py-4 rounded-full items-center ml-2"
              style={{
                backgroundColor: isLoading || stars < 1 ? '#FED7AA' : '#FE8733',
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Submit Rating</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default RateOrderModal;
