// Shared delivery-preference toggles used by Cart, BulkSchedulePricing, ScheduledMealPricing,
// and (in readonly mode) OrderTracking / OrderDetail. The two toggles drive real backend
// behavior — see CLAUDE.md or the order schema:
//   - leaveAtDoor: backend sets requiresOTP=false, rider uploads a photo as proof
//   - doNotContact: rider won't call/SMS; customer confirms in-app

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export interface DeliveryPreferences {
  leaveAtDoor: boolean;
  doNotContact: boolean;
}

interface Props {
  value: DeliveryPreferences;
  onChange?: (next: DeliveryPreferences) => void;
  /**
   * `editable`: tappable checkboxes — used at checkout.
   * `readonly`: green tick badges, no touch — used in OrderTracking / OrderDetail to
   * reflect what the customer chose at order time.
   */
  variant?: 'editable' | 'readonly';
}

const ORANGE = '#FE8733';
const ORANGE_BG = '#FFF7ED';
const GRAY = '#6B7280';
const GRAY_BG = '#F3F4F6';
const BORDER = '#D1D5DB';
const GREEN = '#10B981';
const GREEN_BG = '#ECFDF5';

const DeliveryPreferenceToggles: React.FC<Props> = ({
  value,
  onChange,
  variant = 'editable',
}) => {
  const { leaveAtDoor, doNotContact } = value;
  const readonly = variant === 'readonly';

  const set = (next: Partial<DeliveryPreferences>) => {
    if (readonly || !onChange) return;
    onChange({ ...value, ...next });
  };

  // In readonly mode we hide rows the user didn't select — it's a recap, not a control panel.
  if (readonly && !leaveAtDoor && !doNotContact) return null;

  const renderRow = (
    selected: boolean,
    iconName: string,
    title: string,
    subtitle: string,
    onToggle: () => void,
    isLast: boolean,
  ) => {
    if (readonly && !selected) return null;

    const activeColor = readonly ? GREEN : ORANGE;
    const activeBg = readonly ? GREEN_BG : ORANGE_BG;

    return (
      <TouchableOpacity
        onPress={readonly ? undefined : onToggle}
        activeOpacity={readonly ? 1 : 0.7}
        disabled={readonly}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: '#F3F4F6',
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
            backgroundColor: selected ? activeBg : GRAY_BG,
          }}
        >
          <MaterialCommunityIcons
            name={iconName}
            size={20}
            color={selected ? activeColor : GRAY}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{title}</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{subtitle}</Text>
        </View>
        {readonly ? (
          <MaterialCommunityIcons name="check-circle" size={22} color={GREEN} />
        ) : (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: selected ? ORANGE : BORDER,
              backgroundColor: selected ? ORANGE : 'white',
            }}
          >
            {selected && (
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>✓</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View>
      {renderRow(
        leaveAtDoor,
        'door-open',
        'Leave at Door',
        'OTP not required. Rider will leave it at your door and take a photo as proof.',
        () => set({ leaveAtDoor: !leaveAtDoor }),
        false,
      )}
      {renderRow(
        doNotContact,
        'bell-off-outline',
        'Do Not Contact',
        "No calls or SMS. You'll confirm delivery in-app when the rider arrives.",
        () => set({ doNotContact: !doNotContact }),
        true,
      )}
      {!readonly && leaveAtDoor && (
        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, lineHeight: 16 }}>
          By choosing Leave at Door, Tiffsy can't be held responsible for meals stolen after
          the rider's photo proof has been captured.
        </Text>
      )}
    </View>
  );
};

export default DeliveryPreferenceToggles;
