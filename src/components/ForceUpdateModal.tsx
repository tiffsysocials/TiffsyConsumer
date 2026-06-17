// src/components/ForceUpdateModal.tsx
//
// Update gate modal. Two modes:
//   'required'  -> blocking, non-dismissible (no backdrop / back-button close,
//                  no "Later" button). User must tap "Update Now".
//   'available' -> dismissible soft prompt with an extra "Later" button.
//
// Styling mirrors CustomAlert.tsx for visual consistency.

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export interface ForceUpdateModalProps {
  visible: boolean;
  mode: 'required' | 'available';
  message: string;
  storeUrl: string;
  onDismiss?: () => void; // only used in 'available' mode
}

const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({
  visible,
  mode,
  message,
  storeUrl,
  onDismiss,
}) => {
  const isRequired = mode === 'required';

  const handleUpdate = () => {
    if (storeUrl) {
      Linking.openURL(storeUrl).catch((err) =>
        console.warn('[ForceUpdateModal] Failed to open store URL:', err?.message),
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Non-dismissible in 'required' mode: omit the close handler so the
      // hardware back button cannot dismiss it.
      onRequestClose={isRequired ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="rocket-outline" size={32} color="#FE8733" />
          </View>

          <Text style={styles.title}>
            {isRequired ? 'Update Required' : 'Update Available'}
          </Text>

          <Text style={styles.message}>
            {message ||
              (isRequired
                ? 'A new version is required to continue using the app.'
                : 'A new version of the app is available.')}
          </Text>

          <View style={styles.buttonsContainer}>
            {!isRequired && (
              <TouchableOpacity
                style={[styles.button, styles.laterButton]}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, styles.laterButtonText]}>Later</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, isRequired && styles.singleButton]}
              onPress={handleUpdate}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FE873315',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#FE8733',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleButton: {
    flex: 1,
  },
  laterButton: {
    backgroundColor: '#F3F4F6',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  laterButtonText: {
    color: '#6B7280',
  },
});

export default ForceUpdateModal;
