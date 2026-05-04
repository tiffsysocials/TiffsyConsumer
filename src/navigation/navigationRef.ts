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
