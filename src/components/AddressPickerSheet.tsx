// src/components/AddressPickerSheet.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export interface AddressPickerAddress {
  id: string;
  label: string;
  addressLine1: string;
  locality: string;
  city: string;
  isMain?: boolean;
}

interface AddressPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  addresses: AddressPickerAddress[];
  currentSelectedId: string;
  onConfirm: (addressId: string) => void;
  onAddNewAddress: () => void;
  onManageAddresses: () => void;
}

const AddressPickerSheet: React.FC<AddressPickerSheetProps> = ({
  visible,
  onClose,
  addresses,
  currentSelectedId,
  onConfirm,
  onAddNewAddress,
  onManageAddresses,
}) => {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const drawerTranslateY = useRef(new Animated.Value(600)).current;

  // Sheet-local pick — only promoted to the parent on "Use this address".
  // Initialised from the current cart selection each time the sheet opens.
  const [pickInSheetId, setPickInSheetId] = useState<string>(currentSelectedId);

  useEffect(() => {
    if (visible) {
      setPickInSheetId(currentSelectedId);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(drawerTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(drawerTranslateY, { toValue: 600, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, currentSelectedId, backdropOpacity, drawerTranslateY]);

  const handleConfirm = () => {
    if (!pickInSheetId) return;
    onConfirm(pickInSheetId);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            opacity: backdropOpacity,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={{
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 12, 24),
            maxHeight: '85%',
            transform: [{ translateY: drawerTranslateY }],
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827' }}>
              Deliver this order to
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {addresses.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <MaterialCommunityIcons name="map-marker-off-outline" size={36} color="#9CA3AF" />
                <Text style={{ marginTop: 8, color: '#6B7280', fontSize: 13 }}>
                  No saved addresses yet
                </Text>
              </View>
            ) : (
              addresses.map(addr => {
                const isPicked = pickInSheetId === addr.id;
                return (
                  <TouchableOpacity
                    key={addr.id}
                    onPress={() => setPickInSheetId(addr.id)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isPicked ? '#FE8733' : '#E5E7EB',
                      backgroundColor: isPicked ? '#FFF7ED' : 'white',
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: isPicked ? '#FE8733' : '#D1D5DB',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      {isPicked && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: '#FE8733',
                          }}
                        />
                      )}
                    </View>

                    <View style={{ width: 32, height: 32, marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
                      <Image
                        source={
                          addr.label.toLowerCase() === 'home'
                            ? require('../assets/icons/house2.png')
                            : require('../assets/icons/office.png')
                        }
                        style={{ width: 28, height: 28 }}
                        resizeMode="contain"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                          {addr.label}
                        </Text>
                        {addr.isMain && (
                          <View
                            style={{
                              marginLeft: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              backgroundColor: '#FEF3C7',
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400E' }}>
                              DEFAULT
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}
                        numberOfLines={2}
                      >
                        {addr.addressLine1}, {addr.locality}, {addr.city}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            <View style={{ marginTop: 4, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={onAddNewAddress}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus" size={20} color="#FE8733" />
                <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#FE8733' }}>
                  Add new address
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onManageAddresses}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="cog-outline" size={20} color="#6B7280" />
                <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#374151' }}>
                  Manage addresses
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={!pickInSheetId || addresses.length === 0}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#FE8733',
                borderRadius: 28,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !pickInSheetId || addresses.length === 0 ? 0.6 : 1,
              }}
            >
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
                Use this address
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default AddressPickerSheet;
