import { useCallback, useEffect, useRef } from 'react';
import { useCustomerTour } from './CustomerTourProvider';
import { TourStepId } from './types';

/**
 * Attach to any View whose layout should drive the tour spotlight for `id`.
 *
 * Usage:
 *   const { ref, onLayout } = useTourTarget('location');
 *   return <View ref={ref} onLayout={onLayout}>...</View>;
 */
export const useTourTarget = (id: TourStepId | null) => {
  const { active, currentStep, registerTarget } = useCustomerTour();
  const ref = useRef<any>(null);

  const measure = useCallback(() => {
    if (!id || !ref.current) return;
    ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
      if (width > 0 && height > 0 && Number.isFinite(x) && Number.isFinite(y)) {
        registerTarget(id, { x, y, width, height });
      }
    });
  }, [id, registerTarget]);

  // Re-measure when this step becomes active. We schedule several staggered
  // attempts because:
  //  - SafeAreaView insets / scroll snaps can settle on a delay
  //  - Conditionally-rendered siblings (banners, error states) can shift this
  //    target after the first measurement
  //  - The Modal animation finishes ~250ms in; measuring after that catches
  //    any layout jitter that happens during the fade-in.
  useEffect(() => {
    if (!id || !active || currentStep?.id !== id) return;
    const timers = [60, 200, 450].map((delay) => setTimeout(measure, delay));
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [active, currentStep?.id, id, measure]);

  // Unregister on unmount to avoid pointing the spotlight at a stale rect.
  useEffect(() => {
    if (!id) return;
    return () => registerTarget(id, null);
  }, [id, registerTarget]);

  return { ref, onLayout: measure };
};
