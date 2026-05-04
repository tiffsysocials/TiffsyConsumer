import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SPACING, TOUCH_TARGETS } from '../constants/spacing';
import { FONT_SIZES } from '../constants/typography';

interface PickerSheetProps<T> {
  visible: boolean;
  title: string;
  options: T[];
  selectedValue?: string;
  searchPlaceholder?: string;
  // How to render each option's display text
  getLabel: (item: T) => string;
  // Optional secondary line under the label (e.g., state under city)
  getSubtitle?: (item: T) => string | undefined;
  // What value to compare against `selectedValue`
  getValue: (item: T) => string;
  onSelect: (item: T) => void;
  onClose: () => void;
}

function PickerSheet<T>({
  visible,
  title,
  options,
  selectedValue,
  searchPlaceholder = 'Search...',
  getLabel,
  getSubtitle,
  getValue,
  onSelect,
  onClose,
}: PickerSheetProps<T>) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(item => {
      const label = getLabel(item).toLowerCase();
      const sub = getSubtitle ? (getSubtitle(item) || '').toLowerCase() : '';
      return label.includes(q) || sub.includes(q);
    });
  }, [query, options, getLabel, getSubtitle]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          {/* Drag handle + header */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeIcon}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
              <Path
                d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"
                stroke="#9CA3AF"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearIcon}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Options list */}
          <FlatList
            data={filtered}
            keyExtractor={(item, index) => `${getValue(item)}-${index}`}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No results for "{query}"</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = selectedValue === getValue(item);
              const subtitle = getSubtitle ? getSubtitle(item) : undefined;
              return (
                <TouchableOpacity
                  onPress={() => {
                    onSelect(item);
                    setQuery('');
                  }}
                  style={[styles.row, isSelected && styles.rowSelected]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>
                      {getLabel(item)}
                    </Text>
                    {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
                  </View>
                  {isSelected && (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M5 13l4 4L19 7"
                        stroke="#FE8733"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: SPACING.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#111827',
  },
  closeIcon: {
    fontSize: 28,
    color: '#6B7280',
    lineHeight: 28,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    height: TOUCH_TARGETS.minimum,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.base,
    color: '#111827',
    padding: 0,
  },
  clearIcon: {
    fontSize: 22,
    color: '#9CA3AF',
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: TOUCH_TARGETS.comfortable,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowSelected: {
    backgroundColor: '#FFF7ED',
  },
  rowLabel: {
    fontSize: FONT_SIZES.base,
    color: '#111827',
    fontWeight: '500',
  },
  rowLabelSelected: {
    color: '#FE8733',
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: '#9CA3AF',
  },
});

export default PickerSheet;
