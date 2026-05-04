/**
 * Time utility functions for handling operating hours and meal windows
 */

export interface TimeWindow {
  startTime: string; // Format: "HH:mm"
  endTime: string;
}

export interface OperatingHours {
  lunch?: TimeWindow;
  dinner?: TimeWindow;
  onDemand?: TimeWindow & { isAlwaysOpen: boolean };
}

export type MealType = 'lunch' | 'dinner';

/**
 * Convert 24-hour time string to 12-hour format with AM/PM
 * @param time24 - Time in "HH:mm" format (e.g., "14:30")
 * @returns Time in 12-hour format (e.g., "2:30 PM")
 */
export const convertTo12HourFormat = (time24: string): string => {
  if (!time24 || !time24.includes(':')) {
    return time24;
  }

  const [hoursStr, minutesStr] = time24.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (isNaN(hours) || isNaN(minutes)) {
    return time24;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight
  const minutesFormatted = minutes.toString().padStart(2, '0');

  return `${hours12}:${minutesFormatted} ${period}`;
};

/**
 * Parse time string to hours and minutes
 * @param timeStr - Time in "HH:mm" format
 * @returns Object with hours and minutes
 */
export const parseTime = (timeStr: string): { hours: number; minutes: number } => {
  const [hoursStr, minutesStr] = timeStr.split(':');
  return {
    hours: parseInt(hoursStr, 10) || 0,
    minutes: parseInt(minutesStr, 10) || 0,
  };
};

/**
 * Check if current time is within a time window
 * @param timeWindow - Time window with start and end times
 * @param currentTime - Optional current time (defaults to now)
 * @returns true if current time is within the window
 */
export const isWithinTimeWindow = (
  timeWindow: TimeWindow,
  currentTime?: Date
): boolean => {
  const now = currentTime || new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  const start = parseTime(timeWindow.startTime);
  const end = parseTime(timeWindow.endTime);

  const currentTotalMinutes = currentHours * 60 + currentMinutes;
  const startTotalMinutes = start.hours * 60 + start.minutes;
  const endTotalMinutes = end.hours * 60 + end.minutes;

  console.log('[isWithinTimeWindow] Window:', timeWindow.startTime, '-', timeWindow.endTime);
  console.log('[isWithinTimeWindow] Current minutes:', currentTotalMinutes, 'Start:', startTotalMinutes, 'End:', endTotalMinutes);

  // Handle cases where end time is on the next day (e.g., 22:00 to 02:00)
  if (endTotalMinutes < startTotalMinutes) {
    const result = currentTotalMinutes >= startTotalMinutes || currentTotalMinutes < endTotalMinutes;
    console.log('[isWithinTimeWindow] Overnight window, result:', result);
    return result;
  }

  const result = currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
  console.log('[isWithinTimeWindow] Regular window, result:', result);
  return result;
};

/**
 * Check if current time is before a specific time
 * @param timeStr - Time in "HH:mm" format
 * @param currentTime - Optional current time (defaults to now)
 * @returns true if current time is before the specified time
 */
export const isBeforeTime = (timeStr: string, currentTime?: Date): boolean => {
  const now = currentTime || new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  const target = parseTime(timeStr);
  const currentTotalMinutes = currentHours * 60 + currentMinutes;
  const targetTotalMinutes = target.hours * 60 + target.minutes;

  return currentTotalMinutes < targetTotalMinutes;
};

/**
 * Get the active meal window based on operating hours and current time
 * @param operatingHours - Kitchen operating hours
 * @param currentTime - Optional current time (defaults to now)
 * @returns Active meal type or null if no window is active
 */
export const getActiveMealWindow = (
  operatingHours: OperatingHours | undefined,
  currentTime?: Date
): MealType | null => {
  if (!operatingHours) {
    console.log('[getActiveMealWindow] No operating hours provided');
    return null;
  }

  const now = currentTime || new Date();
  console.log('[getActiveMealWindow] Checking active meal window');
  console.log('[getActiveMealWindow] Current time:', now.toLocaleTimeString());
  console.log('[getActiveMealWindow] Current hour:', now.getHours(), 'minute:', now.getMinutes());

  // Check if we're in lunch window
  if (operatingHours.lunch) {
    console.log('[getActiveMealWindow] Checking lunch window:', operatingHours.lunch);
    const isInLunch = isWithinTimeWindow(operatingHours.lunch, now);
    console.log('[getActiveMealWindow] Is in lunch window:', isInLunch);
    if (isInLunch) {
      return 'lunch';
    }
  }

  // Check if we're in dinner window
  if (operatingHours.dinner) {
    console.log('[getActiveMealWindow] Checking dinner window:', operatingHours.dinner);
    const isInDinner = isWithinTimeWindow(operatingHours.dinner, now);
    console.log('[getActiveMealWindow] Is in dinner window:', isInDinner);
    if (isInDinner) {
      return 'dinner';
    }
  }

  console.log('[getActiveMealWindow] Not in any window, returning null');
  return null;
};

/**
 * Get the next available meal window
 * @param operatingHours - Kitchen operating hours
 * @param currentTime - Optional current time (defaults to now)
 * @returns Next meal type and its start time, or null if none available
 */
export const getNextMealWindow = (
  operatingHours: OperatingHours | undefined,
  currentTime?: Date
): { mealType: MealType; startTime: string } | null => {
  if (!operatingHours) {
    return null;
  }

  const now = currentTime || new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  // Check lunch window
  if (operatingHours.lunch) {
    const lunchStart = parseTime(operatingHours.lunch.startTime);
    const lunchStartMinutes = lunchStart.hours * 60 + lunchStart.minutes;

    if (currentTotalMinutes < lunchStartMinutes) {
      return {
        mealType: 'lunch',
        startTime: convertTo12HourFormat(operatingHours.lunch.startTime),
      };
    }
  }

  // Check dinner window
  if (operatingHours.dinner) {
    const dinnerStart = parseTime(operatingHours.dinner.startTime);
    const dinnerStartMinutes = dinnerStart.hours * 60 + dinnerStart.minutes;

    if (currentTotalMinutes < dinnerStartMinutes) {
      return {
        mealType: 'dinner',
        startTime: convertTo12HourFormat(operatingHours.dinner.startTime),
      };
    }
  }

  // If we're past both windows, next is lunch tomorrow
  if (operatingHours.lunch) {
    return {
      mealType: 'lunch',
      startTime: `${convertTo12HourFormat(operatingHours.lunch.startTime)} tomorrow`,
    };
  }

  return null;
};

/**
 * Get meal window info for display and logic
 * @param operatingHours - Kitchen operating hours
 * @param currentTime - Optional current time (defaults to now)
 * @returns Meal window information
 */
export const getMealWindowInfo = (
  operatingHours: OperatingHours | undefined,
  currentTime?: Date
) => {
  const now = currentTime || new Date();
  const activeMeal = getActiveMealWindow(operatingHours, now);
  const nextMeal = getNextMealWindow(operatingHours, now);

  return {
    activeMeal: activeMeal || nextMeal?.mealType || 'lunch',
    isWindowOpen: activeMeal !== null,
    nextMealWindow: nextMeal?.mealType || 'lunch',
    nextMealWindowTime: nextMeal?.startTime || 'Not available',
  };
};

/**
 * Format operating hours for display
 * @param operatingHours - Kitchen operating hours
 * @returns Formatted string (e.g., "Lunch: 11:00 AM - 2:00 PM, Dinner: 7:00 PM - 10:00 PM")
 */
export const formatOperatingHours = (operatingHours: OperatingHours | undefined): string => {
  if (!operatingHours) {
    return 'Hours not available';
  }

  const parts: string[] = [];

  if (operatingHours.lunch) {
    const start = convertTo12HourFormat(operatingHours.lunch.startTime);
    const end = convertTo12HourFormat(operatingHours.lunch.endTime);
    parts.push(`Lunch: ${start} - ${end}`);
  }

  if (operatingHours.dinner) {
    const start = convertTo12HourFormat(operatingHours.dinner.startTime);
    const end = convertTo12HourFormat(operatingHours.dinner.endTime);
    parts.push(`Dinner: ${start} - ${end}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Hours not available';
};

/**
 * Check if a meal window is available for a kitchen
 * @param operatingHours - Kitchen operating hours
 * @param mealType - Meal type to check
 * @returns true if the meal window is available
 */
export const isMealWindowAvailable = (
  operatingHours: OperatingHours | undefined,
  mealType: MealType
): boolean => {
  if (!operatingHours) {
    return false;
  }

  return mealType === 'lunch'
    ? !!operatingHours.lunch
    : !!operatingHours.dinner;
};

/**
 * Get cutoff time for a meal window (start time - when orders must be placed by)
 * @param operatingHours - Kitchen operating hours
 * @param mealType - Meal type
 * @returns Cutoff time in "HH:mm" format or null
 */
export const getMealCutoffTime = (
  operatingHours: OperatingHours | undefined,
  mealType: MealType
): string | null => {
  if (!operatingHours) {
    return null;
  }

  const window = mealType === 'lunch' ? operatingHours.lunch : operatingHours.dinner;
  return window?.startTime || null;
};

/**
 * Check if current time is past the cutoff for a meal window
 * @param operatingHours - Kitchen operating hours
 * @param mealType - Meal type
 * @param currentTime - Optional current time (defaults to now)
 * @returns true if past cutoff
 */
export const isPastMealCutoff = (
  operatingHours: OperatingHours | undefined,
  mealType: MealType,
  currentTime?: Date
): boolean => {
  const cutoffTime = getMealCutoffTime(operatingHours, mealType);
  if (!cutoffTime) {
    return false;
  }

  const now = currentTime || new Date();
  return !isBeforeTime(cutoffTime, now);
};
