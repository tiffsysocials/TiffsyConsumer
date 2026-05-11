import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useUser } from '../../context/UserContext';
import { TOUR_STEPS } from './tourSteps';
import { TourStep, TourStepId, TourTargetRect } from './types';
import { hasSeenTour, isTourPending, markTourSeen } from './storage';
import TourOverlay from './TourOverlay';

interface CustomerTourContextValue {
  active: boolean;
  currentStep: TourStep | null;
  registerTarget: (id: TourStepId, rect: TourTargetRect | null) => void;
  next: () => void;
  skip: () => void;
  /** Manually start the tour (for testing or from a "Replay tour" button later). */
  startTour: () => void;
}

const CustomerTourContext = createContext<CustomerTourContextValue | undefined>(undefined);

export const CustomerTourProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useUser();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const targetsRef = useRef<Partial<Record<TourStepId, TourTargetRect>>>({});
  // Re-render when target registry changes so overlay picks up new rects.
  const [, forceTick] = useState(0);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const finish = useCallback(async () => {
    setActive(false);
    await markTourSeen();
  }, []);

  const next = useCallback(() => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      finish();
      return;
    }
    setStepIndex((idx) => idx + 1);
  }, [finish, stepIndex]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const registerTarget = useCallback((id: TourStepId, rect: TourTargetRect | null) => {
    if (rect) {
      targetsRef.current[id] = rect;
    } else {
      delete targetsRef.current[id];
    }
    forceTick((n) => n + 1);
  }, []);

  // Auto-start after profile onboarding, only once per user/device.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const seen = await hasSeenTour();
      const pending = await isTourPending();
      if (cancelled || seen || (!pending && !user?.isNewUser)) return;
      // Delay so the home screen content settles before the overlay appears.
      setTimeout(() => {
        if (!cancelled) startTour();
      }, 800);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.isNewUser, startTour]);

  const currentStep = active ? TOUR_STEPS[stepIndex] ?? null : null;
  const currentTarget =
    currentStep?.hasTarget ? targetsRef.current[currentStep.id] ?? null : null;

  // If a step's target is conditionally rendered and currently absent (e.g.,
  // voucher button hidden because the meal isn't available, or Add-to-Cart
  // hidden because no meal item is loaded), the spotlight has nothing to
  // anchor to. Wait briefly for late registration; if it still isn't there,
  // skip ahead so the user doesn't see an empty/misaligned highlight box.
  useEffect(() => {
    if (!active || !currentStep || !currentStep.hasTarget) return;
    if (currentTarget) return;
    const timer = setTimeout(() => {
      if (!targetsRef.current[currentStep.id]) {
        if (stepIndex >= TOUR_STEPS.length - 1) {
          finish();
        } else {
          setStepIndex((idx) => idx + 1);
        }
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [active, currentStep, currentTarget, stepIndex, finish]);

  const value = useMemo<CustomerTourContextValue>(
    () => ({ active, currentStep, registerTarget, next, skip, startTour }),
    [active, currentStep, registerTarget, next, skip, startTour],
  );

  // Only render the overlay once we actually have a target rect for steps
  // that need one — prevents a half-second flash of dim-only background while
  // the target finishes registering.
  const shouldRenderOverlay =
    active && !!currentStep && (!currentStep.hasTarget || !!currentTarget);

  return (
    <CustomerTourContext.Provider value={value}>
      {children}
      {shouldRenderOverlay && currentStep && (
        <TourOverlay
          step={currentStep}
          target={currentTarget}
          isLast={stepIndex === TOUR_STEPS.length - 1}
          onNext={next}
          onSkip={skip}
        />
      )}
    </CustomerTourContext.Provider>
  );
};

export const useCustomerTour = (): CustomerTourContextValue => {
  const ctx = useContext(CustomerTourContext);
  if (!ctx) {
    throw new Error('useCustomerTour must be used within CustomerTourProvider');
  }
  return ctx;
};
