/**
 * Auto-Order Utilities
 *
 * Helper functions for auto-ordering features including time calculations,
 * meal skip checks, and display formatting.
 */

// Import types
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface DayMealSchedule {
  lunch: boolean;
  dinner: boolean;
}

type WeeklySchedule = {
  [K in DayOfWeek]?: DayMealSchedule;
} | null;

// Import Subscription type from api.service
// Note: Using a partial type to avoid circular dependencies
interface AutoOrderSubscription {
  autoOrderingEnabled?: boolean;
  weeklySchedule?: WeeklySchedule;
  isPaused?: boolean;
  pausedUntil?: string;
  skippedSlots?: Array<{
    date: string;
    mealWindow: 'LUNCH' | 'DINNER';
    reason?: string;
    skippedAt?: string;
  }>;
}

/**
 * Check if a specific meal slot is skipped
 *
 * @param subscription The subscription with skipped slots
 * @param date ISO date string (YYYY-MM-DD)
 * @param mealWindow LUNCH or DINNER
 * @returns true if the meal is skipped, false otherwise
 */
export const isMealSkipped = (
  subscription: AutoOrderSubscription,
  date: string,
  mealWindow: 'LUNCH' | 'DINNER'
): boolean => {
  if (!subscription.skippedSlots || subscription.skippedSlots.length === 0) {
    return false;
  }

  // Normalize date to YYYY-MM-DD format for comparison
  const normalizedDate = date.split('T')[0];

  return subscription.skippedSlots.some(
    slot => {
      const slotDate = slot.date.split('T')[0];
      return slotDate === normalizedDate && slot.mealWindow === mealWindow;
    }
  );
};

/**
 * Get count of skipped meals for the current month
 *
 * @param subscription The subscription with skipped slots
 * @returns Number of meals skipped this month
 */
export const getMonthlySkippedCount = (subscription: AutoOrderSubscription): number => {
  if (!subscription.skippedSlots || subscription.skippedSlots.length === 0) {
    return 0;
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return subscription.skippedSlots.filter(slot => {
    const slotDate = new Date(slot.date);
    return slotDate.getMonth() === currentMonth && slotDate.getFullYear() === currentYear;
  }).length;
};

/**
 * Get a human-readable description of auto-order status
 *
 * @param subscription The subscription with auto-order settings
 * @returns Status string like "Active - Both meals" or "Paused until Jan 25"
 */
export const getAutoOrderStatusText = (subscription: AutoOrderSubscription): string => {
  if (!subscription.autoOrderingEnabled) {
    return 'Disabled';
  }

  if (subscription.isPaused) {
    if (subscription.pausedUntil) {
      const pauseDate = new Date(subscription.pausedUntil);
      const dateStr = pauseDate.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      });
      return `Paused until ${dateStr}`;
    }
    return 'Paused';
  }

  // Active status with meal count
  const mealCountPerWeek = (() => {
    let count = 0;
    if (subscription.weeklySchedule) {
      Object.values(subscription.weeklySchedule).forEach(day => {
        if (day?.lunch) count++;
        if (day?.dinner) count++;
      });
    }
    return count;
  })();

  return `Active - ${mealCountPerWeek} meals/week`;
};

/**
 * Format a date string to user-friendly format
 *
 * @param dateString ISO date string
 * @returns Formatted date like "Jan 25, 2025"
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a date string to short format
 *
 * @param dateString ISO date string
 * @returns Formatted date like "Jan 25"
 */
export const formatShortDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Get the meal type emoji
 *
 * @param mealWindow LUNCH or DINNER
 * @returns Emoji representing the meal
 */
export const getMealEmoji = (mealWindow: 'LUNCH' | 'DINNER'): string => {
  return mealWindow === 'LUNCH' ? '🌞' : '🌙';
};

/**
 * Check if a date is in the past
 *
 * @param dateString ISO date string
 * @returns true if date is before today, false otherwise
 */
export const isPastDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
};

/**
 * Validate if auto-ordering can be enabled
 *
 * @param hasAddress Whether user has a default address
 * @param hasMealType Whether a meal type is selected
 * @param hasKitchen Whether a default kitchen is set
 * @returns Object with isValid and error message
 */
export const validateAutoOrderEnable = (
  hasAddress: boolean,
  hasMealType: boolean,
  hasKitchen: boolean = true
): { isValid: boolean; error?: string } => {
  if (!hasKitchen) {
    return {
      isValid: false,
      error: 'A default kitchen is required to enable auto-ordering. Please set up your delivery address so a kitchen can be assigned.',
    };
  }

  if (!hasAddress) {
    return {
      isValid: false,
      error: 'Please add a delivery address before enabling auto-ordering.',
    };
  }

  if (!hasMealType) {
    return {
      isValid: false,
      error: 'Please select at least one meal type (Lunch or Dinner).',
    };
  }

  return { isValid: true };
};

// ============================================
// PER-ADDRESS CONFIG UTILITIES
// ============================================

/**
 * Get the total meals per week from a weekly schedule
 */
export const getConfigMealCount = (weeklySchedule: WeeklySchedule): number => {
  let count = 0;
  if (weeklySchedule) {
    Object.values(weeklySchedule).forEach(day => {
      if (day?.lunch) count++;
      if (day?.dinner) count++;
    });
  }
  return count;
};

/**
 * Get a human-readable status text for an address config
 */
export const getConfigStatusText = (config: {
  enabled: boolean;
  isPaused: boolean;
  pausedUntil?: string | null;
  weeklySchedule: WeeklySchedule;
}): string => {
  if (!config.enabled) return 'Disabled';
  if (config.isPaused) {
    if (config.pausedUntil) {
      const d = new Date(config.pausedUntil);
      return `Paused until ${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
    }
    return 'Paused';
  }
  const count = getConfigMealCount(config.weeklySchedule);
  return `Active - ${count} meals/week`;
};

/**
 * Get a short schedule summary for a config card
 * e.g. "Mon-Fri, Both" or "All Days, Lunch" or "Custom"
 */
export const getScheduleSummary = (weeklySchedule: WeeklySchedule): string => {
  if (!weeklySchedule) return 'No schedule';

  const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const weekdays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  const activeDays = allDays.filter(day => weeklySchedule[day]?.lunch || weeklySchedule[day]?.dinner);
  if (activeDays.length === 0) return 'No meals scheduled';

  const hasLunch = activeDays.some(day => weeklySchedule[day]?.lunch);
  const hasDinner = activeDays.some(day => weeklySchedule[day]?.dinner);
  const mealLabel = hasLunch && hasDinner ? 'Both meals' : hasLunch ? 'Lunch only' : 'Dinner only';

  const isAllDays = activeDays.length === 7;
  const isWeekdays = activeDays.length === 5 && weekdays.every(d => activeDays.includes(d));

  if (isAllDays) return `All days, ${mealLabel}`;
  if (isWeekdays) return `Mon-Fri, ${mealLabel}`;
  return `${activeDays.length} days, ${mealLabel}`;
};
