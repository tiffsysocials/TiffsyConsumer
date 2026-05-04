# Kitchen Operating Hours Implementation Guide

## Overview
The frontend has been updated to handle dynamic kitchen operating hours from the backend API. Previously, meal window times were hard-coded. Now they are retrieved from the kitchen data and used to determine meal tab auto-selection and ordering cutoff times.

## Changes Made

### 1. Updated API Types (`src/services/api.service.ts`)

#### Added `operatingHours` to `KitchenInfo` Interface
```typescript
export interface KitchenInfo {
  // ... existing fields
  operatingHours?: {
    lunch?: {
      startTime: string;  // Format: "HH:mm"
      endTime: string;
    };
    dinner?: {
      startTime: string;
      endTime: string;
    };
    onDemand?: {
      startTime: string;
      endTime: string;
      isAlwaysOpen: boolean;
    };
  };
  isTiffsyKitchen?: boolean;
  badges?: string[];
}
```

#### Updated Response Types
- `KitchensForZoneResponse`: Now supports both old (single array) and new (tiffsyKitchens/partnerKitchens) formats
- `AddressKitchensResponse`: Updated to handle new response structure with separate kitchen arrays

#### Added Helper Function
```typescript
extractKitchensFromResponse(response): KitchenInfo[]
```
Extracts kitchens from API responses, handling both old and new formats automatically.

### 2. Created Time Utilities (`src/utils/timeUtils.ts`)

A comprehensive set of utility functions for handling time-based operations:

#### Time Conversion
- `convertTo12HourFormat(time24: string)`: Convert "14:30" → "2:30 PM"
- `parseTime(timeStr: string)`: Parse "HH:mm" to hours and minutes object

#### Meal Window Logic
- `getMealWindowInfo(operatingHours)`: Get active meal window and availability info
- `getActiveMealWindow(operatingHours)`: Determine which meal window is currently active
- `getNextMealWindow(operatingHours)`: Find the next available meal window
- `isWithinTimeWindow(timeWindow)`: Check if current time is within a specific window
- `isMealWindowAvailable(operatingHours, mealType)`: Check if a meal type is offered

#### Cutoff Time Helpers
- `getMealCutoffTime(operatingHours, mealType)`: Get the end time for a meal window
- `isPastMealCutoff(operatingHours, mealType)`: Check if current time is past the cutoff
- `isBeforeTime(timeStr)`: Check if current time is before a specific time

#### Display Helpers
- `formatOperatingHours(operatingHours)`: Format hours for display (e.g., "Lunch: 11:00 AM - 2:00 PM, Dinner: 7:00 PM - 10:00 PM")

### 3. Updated HomeScreen (`src/screens/home/HomeScreen.tsx`)

#### Removed Hard-Coded Times
**Before:**
```typescript
const LUNCH_CUTOFF_HOUR = 11;
const DINNER_CUTOFF_HOUR = 21;
// ... hard-coded logic
```

**After:**
Uses dynamic operating hours from selected kitchen:
```typescript
const mealWindowInfo = useMemo(() => {
  if (!currentKitchen?.operatingHours) {
    // Fallback to defaults if no operating hours
    // ...
  }
  return getWindowInfo(currentKitchen.operatingHours);
}, [currentKitchen]);
```

#### Enhanced Kitchen Selection Logic
The kitchen selection now considers:
1. **Kitchen Type**: Prefers TIFFSY kitchens
2. **Active Meal Window**: Selects kitchens with currently open meal windows
3. **Accepting Orders**: Filters for kitchens accepting orders

```typescript
// Try to find TIFFSY kitchen with active meal window
selectedKitchen = tifsyKitchens.find(k => {
  if (!k.operatingHours) return true;
  const info = getWindowInfo(k.operatingHours, now);
  return info.isWindowOpen;
}) || tifsyKitchens[0];
```

#### Response Format Handling
Uses `extractKitchensFromResponse()` helper to seamlessly handle both API response formats:
```typescript
const allKitchens = extractKitchensFromResponse(kitchensResponse);
```

### 4. Updated CancelOrderModal (`src/components/CancelOrderModal.tsx`)

#### Added `cutoffTime` Prop
```typescript
interface CancelOrderModalProps {
  // ... existing props
  cutoffTime?: string; // Optional "HH:mm" format
}
```

#### Dynamic Cutoff Checking
The modal now accepts an optional `cutoffTime` prop. If provided, it uses that for determining if the order is past cutoff. Otherwise, it falls back to default times.

**Usage Example:**
```typescript
<CancelOrderModal
  visible={showModal}
  onClose={handleClose}
  onConfirm={handleCancel}
  mealWindow="LUNCH"
  cutoffTime={kitchen.operatingHours?.lunch?.endTime}
  // ... other props
/>
```

## API Response Format

### New Format (Preferred)
```json
{
  "success": true,
  "message": "Kitchens retrieved",
  "data": {
    "tiffsyKitchens": [
      {
        "_id": "...",
        "name": "Kitchen Name",
        "type": "TIFFSY",
        "operatingHours": {
          "lunch": {
            "startTime": "11:00",
            "endTime": "14:00"
          },
          "dinner": {
            "startTime": "19:00",
            "endTime": "22:00"
          }
        },
        // ... other fields
      }
    ],
    "partnerKitchens": [...]
  }
}
```

### Legacy Format (Still Supported)
```json
{
  "success": true,
  "data": {
    "kitchens": [
      {
        "_id": "...",
        "name": "Kitchen Name",
        // ... fields
      }
    ]
  }
}
```

## How It Works

### Meal Tab Auto-Selection Flow

1. **User Opens Home Screen**
   - App fetches kitchens for user's address
   - Selects best kitchen (prefers TIFFSY with active meal window)

2. **Kitchen Operating Hours Retrieved**
   - Operating hours are included in kitchen data
   - `operatingHours.lunch` and `operatingHours.dinner` contain time windows

3. **Active Meal Window Determined**
   - `getMealWindowInfo()` checks current time against operating hours
   - Returns active meal (lunch/dinner) and window status (open/closed)

4. **Meal Tab Auto-Selected**
   - If within lunch window → "Lunch" tab selected
   - If within dinner window → "Dinner" tab selected
   - If outside both windows → Next available meal tab selected, modal shown

5. **Modal Displayed (If Outside Window)**
   - Shows user they're outside ordering window
   - Displays next available meal time
   - Auto-switches to next meal tab on close

### Example Scenarios

#### Scenario 1: Within Lunch Window
- Current Time: 12:30 PM
- Lunch Hours: 11:00 AM - 2:00 PM
- Dinner Hours: 7:00 PM - 10:00 PM
- **Result**: Lunch tab selected, ordering enabled

#### Scenario 2: Between Meal Windows
- Current Time: 3:00 PM
- Lunch Hours: 11:00 AM - 2:00 PM
- Dinner Hours: 7:00 PM - 10:00 PM
- **Result**: Dinner tab selected, modal shown ("Dinner ordering starts at 7:00 PM")

#### Scenario 3: After All Windows
- Current Time: 11:00 PM
- Lunch Hours: 11:00 AM - 2:00 PM
- Dinner Hours: 7:00 PM - 10:00 PM
- **Result**: Lunch tab selected, modal shown ("Lunch ordering starts at 11:00 AM tomorrow")

## Backward Compatibility

The implementation maintains full backward compatibility:

1. **Missing Operating Hours**: Falls back to default times (11 AM lunch, 9 PM dinner cutoff)
2. **Old API Format**: `extractKitchensFromResponse()` handles both formats
3. **Optional Fields**: All operating hours fields are optional, won't break existing flows

## Display Features

### Time Format Display
- Backend provides 24-hour format: "14:00"
- Frontend displays 12-hour format: "2:00 PM"
- Conversion handled by `convertTo12HourFormat()`

### Available Meal Windows
Can display badges/indicators for available meal types:
```typescript
if (isMealWindowAvailable(kitchen.operatingHours, 'lunch')) {
  // Show "Lunch Available" badge
}
```

### Operating Hours Display
Format operating hours for display in kitchen details:
```typescript
const hours = formatOperatingHours(kitchen.operatingHours);
// "Lunch: 11:00 AM - 2:00 PM, Dinner: 7:00 PM - 10:00 PM"
```

## Testing Recommendations

1. **Time-Based Testing**
   - Test at different times of day
   - Test during meal windows
   - Test between meal windows
   - Test after all windows closed

2. **Kitchen Variations**
   - Kitchen with both lunch and dinner
   - Kitchen with only lunch
   - Kitchen with only dinner
   - Kitchen with no operating hours (fallback scenario)

3. **Edge Cases**
   - Midnight/boundary transitions
   - Missing/malformed operating hours data
   - Multiple kitchens with different hours

4. **API Response Testing**
   - Test with new format (tiffsyKitchens/partnerKitchens)
   - Test with old format (single kitchens array)
   - Test with empty kitchen lists

## Migration Notes

### For Developers Adding Kitchen Features

When working with kitchen data, always:
1. Use `extractKitchensFromResponse()` to get kitchen arrays
2. Check `operatingHours` field availability before using
3. Use time utility functions instead of hard-coding times
4. Provide fallback behavior if operating hours are missing

### For Order/Tracking Features

When displaying order details:
1. If kitchen data is available, pass `cutoffTime` to CancelOrderModal
2. Use kitchen's operating hours for order-related time validations
3. Display meal window times from kitchen data when showing order info

## Future Enhancements

Potential improvements:
1. Real-time updates when meal windows change
2. Timezone support for multi-region deployments
3. Special hours for holidays/events
4. Pre-order feature for upcoming meal windows
5. Kitchen availability notifications

## Summary

This implementation makes the app fully dynamic and ready for:
- ✅ Multiple kitchens with different operating hours
- ✅ Easy backend control of meal timing
- ✅ Better user experience with accurate meal window information
- ✅ Flexible ordering cutoff times per kitchen
- ✅ Backward compatibility with existing deployments
