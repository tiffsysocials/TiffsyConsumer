import { TourStep } from './types';

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Tiffsy',
    body: "Let's take a quick tour so you know your way around.",
    hasTarget: false,
  },
  {
    id: 'location',
    title: 'Set your delivery location',
    body: 'Tap here anytime to change where your meals get delivered.',
    hasTarget: true,
    placement: 'below',
  },
  {
    id: 'vouchers',
    title: 'Your vouchers',
    body: 'Track your meal vouchers right here.',
    hasTarget: true,
    placement: 'below',
  },
  {
    id: 'planAhead',
    title: 'Plan meals ahead',
    body: 'Schedule meals in advance when you want your week sorted early.',
    hasTarget: true,
    placement: 'below',
  },
  {
    id: 'autoOrders',
    title: 'Set it and forget it',
    body: 'Turn on Auto Orders to have your favourite meals delivered on the days you choose — no need to reorder every time.',
    hasTarget: true,
    placement: 'below',
  },
  {
    id: 'addToCart',
    title: 'Order in one tap',
    body: 'Tap Add to Cart to start your order. You can also schedule meals for later.',
    hasTarget: true,
    placement: 'above',
  },
  {
    id: 'navOrders',
    title: 'Your orders',
    body: 'Track your live orders and revisit past ones from here.',
    hasTarget: true,
    placement: 'above',
  },
  {
    id: 'navOnDemand',
    title: 'On-Demand meals',
    body: "Quick-order meals anytime, perfect when you're in a hurry.",
    hasTarget: true,
    placement: 'above',
  },
  {
    id: 'navProfile',
    title: 'Your profile',
    body: 'Edit your details, dietary preferences, and saved addresses here.',
    hasTarget: true,
    placement: 'above',
  },
];
