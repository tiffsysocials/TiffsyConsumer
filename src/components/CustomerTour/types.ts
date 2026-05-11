export type TourStepId =
  | 'welcome'
  | 'location'
  | 'vouchers'
  | 'planAhead'
  | 'autoOrders'
  | 'addToCart'
  | 'navOrders'
  | 'navOnDemand'
  | 'navProfile';

export interface TourTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TourStep {
  id: TourStepId;
  title: string;
  body: string;
  /** When false, the step dims the whole screen with no cutout (intro/outro stops). */
  hasTarget: boolean;
  /** Tooltip placement preference. Provider may override based on screen edges. */
  placement?: 'auto' | 'above' | 'below';
}
