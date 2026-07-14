import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigateToMainScreen(screenName: string) {
  if (navigationRef.isReady()) {
    // Navigate to the screen within the Main navigator
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'Main',
        params: {
          screen: screenName,
        },
      })
    );
  }
}

export function getCurrentRouteName(): string | undefined {
  if (navigationRef.isReady()) {
    const state = navigationRef.getState();
    if (!state) return undefined;

    // Get the current route in the root navigator
    const route = state.routes[state.index];

    // If we're on 'Main', get the nested route
    if (route.name === 'Main' && route.state) {
      const mainState = route.state;
      const nestedRoute = mainState.routes[mainState.index];
      return nestedRoute?.name;
    }

    return route.name;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Root-route subscription — lets components outside the NavigationContainer
// (e.g. the global NotificationPopup in App.tsx) know which root screen is
// active ('Onboarding' | 'Auth' | 'UserOnboarding' | 'Main' | undefined while
// the splash is showing, since the container isn't mounted yet).
// ---------------------------------------------------------------------------

type RootRouteListener = (rootRouteName: string | undefined) => void;
const rootRouteListeners = new Set<RootRouteListener>();

function getRootRouteName(): string | undefined {
  if (!navigationRef.isReady()) return undefined;
  const state = navigationRef.getState();
  if (!state) return undefined;
  return state.routes[state.index]?.name;
}

// Fires immediately with the current value, then on every root-route change.
// Returns an unsubscribe function.
export function subscribeToRootRoute(listener: RootRouteListener): () => void {
  rootRouteListeners.add(listener);
  listener(getRootRouteName());
  return () => {
    rootRouteListeners.delete(listener);
  };
}

// Called from NavigationContainer's onReady/onStateChange in AppNavigator.
export function notifyRootRouteChanged() {
  const name = getRootRouteName();
  rootRouteListeners.forEach(listener => listener(name));
}
