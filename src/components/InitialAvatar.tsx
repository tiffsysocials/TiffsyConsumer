import React from 'react';
import { View, Text } from 'react-native';

interface InitialAvatarProps {
  /** Display name; the avatar shows its first letter (fallback "G" for guests). */
  name?: string | null;
  /** Diameter of the circle in px. */
  size: number;
}

/**
 * Letter avatar shown wherever the user has no profile photo: an orange
 * circle with the first letter of the name (e.g. "B" for Bhavya).
 */
const InitialAvatar: React.FC<InitialAvatarProps> = ({ name, size }) => {
  const letter = (name || 'Guest').trim().charAt(0).toUpperCase() || 'G';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FE8733',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: size * 0.42,
          fontWeight: '700',
          includeFontPadding: false,
        }}
      >
        {letter}
      </Text>
    </View>
  );
};

export default InitialAvatar;
