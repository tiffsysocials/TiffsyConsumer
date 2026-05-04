# Tiffin Delivery App - Project Structure

## Folder Structure Overview

```
src/
├── screens/              # Full screen components
│   ├── onboarding/      # Onboarding flow screens
│   ├── auth/            # Authentication screens
│   ├── home/            # Home and search screens
│   ├── menu/            # Menu browsing screens
│   ├── cart/            # Cart and checkout screens
│   ├── orders/          # Order management screens
│   └── profile/         # User profile screens
│
├── components/          # Reusable UI components
│   ├── common/         # Generic components (Button, Input, etc.)
│   ├── menu/           # Menu-specific components
│   ├── cart/           # Cart-specific components
│   └── order/          # Order-specific components
│
├── navigation/         # Navigation configuration
│   ├── AppNavigator.tsx     # Main navigation controller
│   └── OnboardingNavigator.tsx  # Onboarding flow navigation
│
├── assets/             # Static resources
│   ├── images/         # Image files
│   │   ├── onboarding/ # Onboarding images
│   │   └── logo.png    # App logo
│   ├── icons/          # Icon assets
│   └── fonts/          # Custom fonts
│
├── constants/          # App constants
│   └── colors.ts       # Color palette
│
├── types/              # TypeScript definitions
│   └── navigation.ts   # Navigation types
│
├── styles/             # Styling files
│   └── global.css      # Global styles (Tailwind)
│
├── utils/              # Utility functions
├── hooks/              # Custom React hooks
├── services/           # API and external services
└── store/              # State management
```

## File Locations

### Moved Files:
- `HomeScreen.tsx` → `screens/onboarding/OnboardingScreen1.tsx`
- `HomeScreen2.tsx` → `screens/onboarding/OnboardingScreen2.tsx`
- `Home1.png` → `assets/images/onboarding/onboarding1.png`
- `logo.png` → `assets/images/logo.png`
- `global.css` → `styles/global.css`

### New Files Created:
- `navigation/AppNavigator.tsx` - Main navigation controller
- `navigation/OnboardingNavigator.tsx` - Onboarding flow navigation
- `screens/SplashScreen.tsx` - Splash screen component
- `components/common/Button.tsx` - Reusable button component
- `constants/colors.ts` - Color constants
- `types/navigation.ts` - Navigation TypeScript types

## Usage

The app now uses a modular structure where:
1. **App.tsx** simply imports and renders the AppNavigator
2. **AppNavigator** handles the main navigation flow
3. **Screens** are organized by feature/flow
4. **Components** are reusable UI elements
5. **Constants** define app-wide values

## Next Steps

1. Create more screens as needed in their respective folders
2. Build reusable components and move them to the components folder
3. Add API services in the services folder
4. Implement state management in the store folder
5. Add utility functions as needed