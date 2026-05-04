# Tab Selection Debugging Guide

## Problem
The Lunch and Dinner tabs on the home screen are not automatically selecting according to the kitchen's operating hours as expected.

## What Was Added

### 1. Enhanced Console Logging

Added detailed console logs throughout the tab selection logic to help diagnose the issue:

**Files Modified:**
- [HomeScreen.tsx:119-131](src/screens/home/HomeScreen.tsx#L119-L131) - Operating hours calculation logs
- [HomeScreen.tsx:142-171](src/screens/home/HomeScreen.tsx#L142-L171) - Tab initialization logs
- [timeUtils.ts:62-90](src/utils/timeUtils.ts#L62-L90) - Time window checking logs
- [timeUtils.ts:109-145](src/utils/timeUtils.ts#L109-L145) - Active meal detection logs

### 2. Visual Debug Component

Created a real-time debug panel that shows:
- Current time (updates every second)
- Kitchen name
- Operating hours (lunch and dinner times)
- Active meal window
- Whether window is open
- Next meal window
- Currently selected tab
- Logic explanation

**Files Created:**
- [MealTimingDebug.tsx](src/components/MealTimingDebug.tsx) - Debug component
- [HomeScreen.tsx:589-593](src/screens/home/HomeScreen.tsx#L589-L593) - Debug component integrated

## How to Use the Debug Tools

### Step 1: Check Console Logs

When you open the Home screen, look for these logs in your console:

```
==================================================
[HomeScreen] TAB SELECTION INITIALIZATION
==================================================
[HomeScreen] Current time: 1/17/2026, 2:30:45 PM
[HomeScreen] Current hour: 14 minute: 30
[HomeScreen] Kitchen: Kitchen Name
[HomeScreen] Has operating hours: true/false
[HomeScreen] Meal window info: {...}
[HomeScreen] Selected meal will be: lunch/dinner
==================================================
```

### Step 2: Use the Visual Debug Panel

1. On the Home screen, look for a small blue "DEBUG" button in the top-right corner
2. Tap it to expand the debug panel
3. The panel shows:
   - **Current Time**: Real-time clock
   - **Kitchen**: Which kitchen is selected
   - **Operating Hours**: The actual hours from backend
   - **Active Meal**: Which meal the system thinks should be active
   - **Window Open**: Whether you're within operating hours
   - **Next Meal**: What comes next
   - **Selected Tab**: The actual tab that's selected
   - **Logic Explanation**: Why that tab was selected

### Step 3: Diagnose the Issue

Compare the values in the debug panel:

#### If Operating Hours Show "Not set (using fallback)":
**Problem**: The backend is not returning operating hours for the kitchen.

**Solution**: Check the backend kitchen data. Operating hours should be in this format:
```json
{
  "operatingHours": {
    "lunch": {
      "startTime": "11:00",
      "endTime": "14:00"
    },
    "dinner": {
      "startTime": "18:00",
      "endTime": "21:00"
    }
  }
}
```

**Fallback Logic** (when no operating hours):
- Before 11:00 AM → Lunch tab
- 11:00 AM - 9:00 PM → Dinner tab
- After 9:00 PM → Lunch tab (for tomorrow)

#### If Operating Hours Are Set But Tab Selection Is Wrong:
**Problem**: The time calculation logic might be incorrect.

**Check**:
1. Is "Current Time" in the debug panel correct?
2. Compare "Current Time" with "Operating Hours"
3. Does "Active Meal" match what you expect based on the time?
4. Does "Selected Tab" match "Active Meal"?

**Common Issues**:
- **Time zone mismatch**: Server time vs device time
- **Operating hours in wrong format**: Should be "HH:mm" (24-hour format)
- **Invalid time ranges**: End time before start time

#### If Times Are Correct But Logic Is Wrong:
**Problem**: The `isWithinTimeWindow()` function logic issue.

Check the console logs for:
```
[isWithinTimeWindow] Window: 11:00 - 14:00
[isWithinTimeWindow] Current minutes: 870 Start: 660 End: 840
[isWithinTimeWindow] Regular window, result: true/false
```

The calculation:
- Current time: 14:30 = 14*60 + 30 = 870 minutes
- Start time: 11:00 = 11*60 + 0 = 660 minutes
- End time: 14:00 = 14*60 + 0 = 840 minutes
- Is 870 >= 660 AND 870 < 840? → FALSE (past lunch window)

## Current Tab Selection Logic

### Flow:
1. **Check if kitchen has operating hours**
   - YES → Use dynamic calculation
   - NO → Use fallback times

2. **Calculate active meal window**
   - Check if current time is within lunch hours → Select "lunch"
   - Check if current time is within dinner hours → Select "dinner"
   - If outside all windows → Select next upcoming meal

3. **Set the tab**
   - Set `selectedMeal` state to the calculated meal
   - If outside all windows, show modal with next meal time

### Files Involved:
- [HomeScreen.tsx:82-132](src/screens/home/HomeScreen.tsx#L82-L132) - Main logic
- [timeUtils.ts:62-208](src/utils/timeUtils.ts#L62-L208) - Time calculations
- [MealWindowModal.tsx](src/components/MealWindowModal.tsx) - Outside window modal

## Expected Behavior

| Current Time | Lunch Hours | Dinner Hours | Expected Tab |
|-------------|-------------|--------------|--------------|
| 10:00 AM | 11:00-14:00 | 18:00-21:00 | Lunch (next meal) |
| 12:00 PM | 11:00-14:00 | 18:00-21:00 | Lunch (active) |
| 15:00 PM | 11:00-14:00 | 18:00-21:00 | Dinner (next meal) |
| 19:00 PM | 11:00-14:00 | 18:00-21:00 | Dinner (active) |
| 22:00 PM | 11:00-14:00 | 18:00-21:00 | Lunch (next day) + modal |

## Next Steps to Fix

### Option 1: Check Backend Data
1. Make an API call to `/api/kitchens/zone/{zoneId}`
2. Check the response for `operatingHours` field
3. Verify the format is correct (24-hour "HH:mm" format)
4. If missing, update kitchen data in the backend database

### Option 2: Adjust Frontend Logic
If the operating hours are correct but selection is wrong:

1. Check the console logs for the calculation steps
2. Identify where the logic fails
3. Adjust the time comparison in [timeUtils.ts:62-90](src/utils/timeUtils.ts#L62-L90)

### Option 3: Verify Time Zone
If there's a mismatch between device time and expectations:

1. Check if backend returns times in specific timezone
2. Verify device timezone settings
3. May need to convert times to local timezone

## Removing Debug Code

Once the issue is fixed, remove the debug code:

1. **Remove debug component** from [HomeScreen.tsx:588-593](src/screens/home/HomeScreen.tsx#L588-L593):
```typescript
{/* Debug Component - Remove this after debugging */}
<MealTimingDebug
  currentKitchen={currentKitchen}
  mealWindowInfo={mealWindowInfo}
  selectedMeal={selectedMeal}
/>
```

2. **Remove or reduce console logs** from:
   - [HomeScreen.tsx:119-131](src/screens/home/HomeScreen.tsx#L119-L131)
   - [HomeScreen.tsx:142-171](src/screens/home/HomeScreen.tsx#L142-L171)
   - [timeUtils.ts:77-89](src/utils/timeUtils.ts#L77-L89)
   - [timeUtils.ts:113-143](src/utils/timeUtils.ts#L113-L143)

3. **Delete debug component file**:
   - [MealTimingDebug.tsx](src/components/MealTimingDebug.tsx)

## Contact for Further Debugging

If the issue persists after checking all above:
1. Share screenshots of the debug panel
2. Share console logs from app startup
3. Share the API response for kitchen operating hours
4. Share your device's current time and timezone

---

**Created:** January 17, 2026
**Last Updated:** January 17, 2026
