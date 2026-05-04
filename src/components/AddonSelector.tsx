import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AddonItem } from '../services/api.service';

export interface SelectedAddon {
  addonId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface AddonSelectorProps {
  availableAddons: AddonItem[];
  selectedAddons: SelectedAddon[];
  onAdd: (addon: AddonItem) => void;
  onRemove: (addonId: string) => void;
  onQuantityChange: (addonId: string, quantity: number) => void;
  loading?: boolean;
  title?: string;
}

const AddonSelector: React.FC<AddonSelectorProps> = ({
  availableAddons,
  selectedAddons,
  onAdd,
  onRemove,
  onQuantityChange,
  loading = false,
  title = 'Would you like some add-ons?',
}) => {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <View style={{ paddingVertical: 12, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#FE8733" />
        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Loading add-ons...</Text>
      </View>
    );
  }

  if (availableAddons.length === 0) return null;

  const selectedCount = selectedAddons.length;

  return (
    <>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center justify-between py-2"
        activeOpacity={0.7}
      >
        <Text className="text-base font-bold text-gray-900">{title}</Text>
        <View className="flex-row items-center">
          {selectedCount > 0 && (
            <View
              className="items-center justify-center mr-2"
              style={{
                backgroundColor: '#FE8733',
                borderRadius: 10,
                width: 20,
                height: 20,
              }}
            >
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>
                {selectedCount}
              </Text>
            </View>
          )}
          <Image
            source={require('../assets/icons/down2.png')}
            style={{
              width: 14,
              height: 14,
              tintColor: '#9CA3AF',
              transform: [{ rotate: expanded ? '180deg' : '0deg' }],
            }}
            resizeMode="contain"
          />
        </View>
      </TouchableOpacity>

      {expanded && availableAddons.map((addon) => {
        const selected = selectedAddons.find(a => a.addonId === addon._id);

        return (
          <View
            key={addon._id}
            className="flex-row items-center py-2.5"
            style={selected
              ? { backgroundColor: '#FFFBF5', marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 10, marginVertical: 2 }
              : { marginVertical: 2 }
            }
          >
            <Image
              source={require('../assets/images/homepage/roti.png')}
              className="rounded-full"
              style={{ width: 36, height: 36 }}
              resizeMode="cover"
            />
            <View className="flex-1 ml-3">
              <Text className="text-sm font-semibold text-gray-900">{addon.name}</Text>
              <Text className="text-xs text-gray-500">
                {addon.description || '1 serving'}
                {' · '}
                <Text className="font-semibold text-gray-700">₹{addon.price}</Text>
                {selected && (
                  <Text className="font-semibold" style={{ color: '#FE8733' }}>
                    {' '}· ₹{(addon.price * selected.quantity).toFixed(0)}
                  </Text>
                )}
              </Text>
            </View>

            {selected ? (
              <View
                className="flex-row items-center"
                style={{
                  backgroundColor: '#FFF7ED',
                  borderRadius: 16,
                  paddingVertical: 4,
                  paddingHorizontal: 6,
                  borderWidth: 1,
                  borderColor: '#FE8733',
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (selected.quantity <= 1) {
                      onRemove(addon._id);
                    } else {
                      onQuantityChange(addon._id, selected.quantity - 1);
                    }
                  }}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: 'white',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#FE8733',
                  }}
                >
                  <Text style={{ color: '#FE8733', fontSize: 13, fontWeight: '600' }}>−</Text>
                </TouchableOpacity>
                <Text style={{ color: '#FE8733', fontSize: 13, fontWeight: '700', marginHorizontal: 6 }}>
                  {selected.quantity}
                </Text>
                <TouchableOpacity
                  onPress={() => onQuantityChange(addon._id, selected.quantity + 1)}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: '#FE8733',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>+</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => onAdd(addon)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: '#D1D5DB',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            )}
          </View>
        );
      })}
    </>
  );
};

export default AddonSelector;
