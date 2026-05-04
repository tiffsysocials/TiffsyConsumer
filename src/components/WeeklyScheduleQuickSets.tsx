import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { WeeklySchedule, DayOfWeek } from '../services/api.service';
import { SPACING } from '../constants/spacing';
import { FONT_SIZES } from '../constants/typography';

interface WeeklyScheduleQuickSetsProps {
  onSelectPattern: (schedule: WeeklySchedule) => void;
  disabled?: boolean;
}

const ALL_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEKDAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

const WeeklyScheduleQuickSets: React.FC<WeeklyScheduleQuickSetsProps> = ({
  onSelectPattern,
  disabled = false,
}) => {
  const createPattern = (days: DayOfWeek[], lunch: boolean, dinner: boolean): WeeklySchedule => {
    const schedule: WeeklySchedule = {};

    // IMPORTANT: Always create a complete 7-day schedule
    // Set selected days to the pattern, and non-selected days to false
    ALL_DAYS.forEach(day => {
      if (days.includes(day)) {
        schedule[day] = { lunch, dinner };
      } else {
        schedule[day] = { lunch: false, dinner: false };
      }
    });

    return schedule;
  };

  const quickSets = [
    {
      label: 'Weekdays Only',
      icon: 'briefcase-outline',
      color: '#3B82F6',
      schedule: () => createPattern(WEEKDAYS, true, true),
      description: 'Mon-Fri, both meals',
    },
    {
      label: 'All Days',
      icon: 'calendar-range',
      color: '#10B981',
      schedule: () => createPattern(ALL_DAYS, true, true),
      description: 'Every day, both meals',
    },
    {
      label: 'Lunch Only',
      icon: 'white-balance-sunny',
      color: '#FE8733',
      schedule: () => createPattern(ALL_DAYS, true, false),
      description: 'Every day, lunch',
    },
    {
      label: 'Dinner Only',
      icon: 'moon-waning-crescent',
      color: '#8B5CF6',
      schedule: () => createPattern(ALL_DAYS, false, true),
      description: 'Every day, dinner',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="lightning-bolt" size={16} color="#6B7280" />
        <Text style={styles.headerText}>Quick Set</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {quickSets.map((quickSet, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => onSelectPattern(quickSet.schedule())}
            disabled={disabled}
            activeOpacity={0.7}
            style={[
              styles.quickSetButton,
              disabled && styles.quickSetButtonDisabled,
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${quickSet.color}15` },
              ]}
            >
              <MaterialCommunityIcons
                name={quickSet.icon as any}
                size={24}
                color={quickSet.color}
              />
            </View>
            <Text style={styles.quickSetLabel}>{quickSet.label}</Text>
            <Text style={styles.quickSetDescription}>{quickSet.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  headerText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: SPACING.xs,
  },
  scrollContainer: {
    paddingHorizontal: SPACING.xs,
    gap: SPACING.sm,
  },
  quickSetButton: {
    backgroundColor: 'white',
    borderRadius: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickSetButtonDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  quickSetLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  quickSetDescription: {
    fontSize: FONT_SIZES.xs,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default WeeklyScheduleQuickSets;
