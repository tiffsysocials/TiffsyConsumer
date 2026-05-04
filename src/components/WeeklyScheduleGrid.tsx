import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { DayOfWeek, DayMealSchedule, WeeklySchedule } from '../services/api.service';
import { SPACING } from '../constants/spacing';
import { FONT_SIZES } from '../constants/typography';

interface WeeklyScheduleGridProps {
  schedule: WeeklySchedule;
  onChange: (schedule: WeeklySchedule) => void;
  disabled?: boolean;
}

const DAYS_OF_WEEK: Array<{ key: DayOfWeek; label: string; shortLabel: string }> = [
  { key: 'monday', label: 'Monday', shortLabel: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
  { key: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
  { key: 'friday', label: 'Friday', shortLabel: 'Fri' },
  { key: 'saturday', label: 'Saturday', shortLabel: 'Sat' },
  { key: 'sunday', label: 'Sunday', shortLabel: 'Sun' },
];

const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({
  schedule,
  onChange,
  disabled = false,
}) => {
  const toggleMeal = (day: DayOfWeek, meal: 'lunch' | 'dinner') => {
    if (disabled) return;

    // Check if schedule is null/undefined BEFORE spreading
    if (!schedule) {
      // Initialize schedule if null - BOTH fields are required
      const newSchedule: WeeklySchedule = {};
      newSchedule[day] = {
        lunch: meal === 'lunch',
        dinner: meal === 'dinner'
      };
      onChange(newSchedule);
      return;
    }

    const updatedSchedule: WeeklySchedule = { ...schedule };

    // Get current day values or default to false for both
    const currentDay = updatedSchedule[day] || { lunch: false, dinner: false };
    const newDay: DayMealSchedule = {
      lunch: currentDay.lunch ?? false,
      dinner: currentDay.dinner ?? false,
      [meal]: !currentDay[meal],
    };

    updatedSchedule[day] = newDay;
    onChange(updatedSchedule);
  };

  const isMealEnabled = (day: DayOfWeek, meal: 'lunch' | 'dinner'): boolean => {
    if (!schedule) return false;
    return schedule[day]?.[meal] ?? false;
  };

  // Count total meals scheduled per week
  const getTotalMeals = (): number => {
    if (!schedule) return 0;

    let count = 0;
    DAYS_OF_WEEK.forEach(({ key }) => {
      if (schedule[key]?.lunch) count++;
      if (schedule[key]?.dinner) count++;
    });
    return count;
  };

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summaryContainer}>
        <MaterialCommunityIcons name="calendar-check" size={16} color="#6B7280" />
        <Text style={styles.summaryText}>
          {getTotalMeals()} meals scheduled per week
        </Text>
      </View>

      {/* Table Header */}
      <View style={styles.headerRow}>
        <View style={styles.dayHeaderCell}>
          <Text style={styles.headerText}>Day</Text>
        </View>
        <View style={styles.mealHeaderCell}>
          <MaterialCommunityIcons name="white-balance-sunny" size={18} color="#FE8733" />
          <Text style={[styles.headerText, { marginLeft: 4 }]}>Lunch</Text>
        </View>
        <View style={styles.mealHeaderCell}>
          <MaterialCommunityIcons name="moon-waning-crescent" size={18} color="#8B5CF6" />
          <Text style={[styles.headerText, { marginLeft: 4 }]}>Dinner</Text>
        </View>
      </View>

      {/* Day Rows */}
      {DAYS_OF_WEEK.map(({ key, label, shortLabel }) => {
        const lunchEnabled = isMealEnabled(key, 'lunch');
        const dinnerEnabled = isMealEnabled(key, 'dinner');

        return (
          <View key={key} style={styles.dayRow}>
            {/* Day Name */}
            <View style={styles.dayCell}>
              <Text style={styles.dayText}>{label}</Text>
              <Text style={styles.dayShortText}>{shortLabel}</Text>
            </View>

            {/* Lunch Toggle */}
            <View style={styles.mealCell}>
              <TouchableOpacity
                onPress={() => toggleMeal(key, 'lunch')}
                disabled={disabled}
                activeOpacity={0.7}
                style={[
                  styles.checkboxButton,
                  lunchEnabled && styles.checkboxButtonActive,
                  disabled && styles.checkboxButtonDisabled,
                ]}
              >
                {lunchEnabled && (
                  <MaterialCommunityIcons name="check" size={16} color="white" />
                )}
              </TouchableOpacity>
            </View>

            {/* Dinner Toggle */}
            <View style={styles.mealCell}>
              <TouchableOpacity
                onPress={() => toggleMeal(key, 'dinner')}
                disabled={disabled}
                activeOpacity={0.7}
                style={[
                  styles.checkboxButton,
                  dinnerEnabled && styles.checkboxButtonActive,
                  disabled && styles.checkboxButtonDisabled,
                ]}
              >
                {dinnerEnabled && (
                  <MaterialCommunityIcons name="check" size={16} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Warning if no meals scheduled */}
      {getTotalMeals() === 0 && (
        <View style={styles.warningContainer}>
          <MaterialCommunityIcons name="alert-circle" size={16} color="#F59E0B" />
          <Text style={styles.warningText}>
            No meals scheduled. Auto-ordering is effectively disabled.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: SPACING.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: '#F9FAFB',
    borderRadius: SPACING.md,
  },
  summaryText: {
    fontSize: FONT_SIZES.sm,
    color: '#6B7280',
    marginLeft: SPACING.xs,
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  dayHeaderCell: {
    flex: 2,
    paddingLeft: SPACING.sm,
  },
  mealHeaderCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  headerText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayCell: {
    flex: 2,
    justifyContent: 'center',
    paddingLeft: SPACING.sm,
  },
  dayText: {
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
    color: '#111827',
  },
  dayShortText: {
    fontSize: FONT_SIZES.xs,
    color: '#9CA3AF',
    marginTop: 2,
  },
  mealCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxButtonActive: {
    backgroundColor: '#FE8733',
    borderColor: '#FE8733',
  },
  checkboxButtonDisabled: {
    opacity: 0.5,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: '#FFFBEB',
    borderRadius: SPACING.md,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  warningText: {
    fontSize: FONT_SIZES.xs,
    color: '#92400E',
    marginLeft: SPACING.xs,
    flex: 1,
  },
});

export default WeeklyScheduleGrid;
