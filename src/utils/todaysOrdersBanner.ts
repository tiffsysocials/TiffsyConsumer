import { Order, OrderStatus } from '../services/api.service';

const TERMINAL_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'REJECTED', 'FAILED'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getTargetDate(order: Order): Date {
  return new Date(order.scheduledFor || order.placedAt);
}

export function getTodaysActiveBasicOrders(orders: Order[]): Order[] {
  const now = new Date();
  return orders.filter(o => {
    if (o.isAutoOrder || o.orderSource === 'AUTO_ORDER') return false;
    if (TERMINAL_STATUSES.includes(o.status)) return false;
    // Also drop payment-failed orders even if status isn't yet FAILED — they're dead.
    if (o.paymentStatus === 'FAILED') return false;
    return isSameDay(getTargetDate(o), now);
  });
}

export interface ActiveOrderBannerContent {
  title: string;
  subtitle: string;
  orderId: string | null;
}

function statusTitle(status: OrderStatus, meal: 'lunch' | 'dinner'): string {
  switch (status) {
    case 'PICKED_UP':
    case 'OUT_FOR_DELIVERY':
      return `Your ${meal} is on the way!`;
    case 'READY':
      return `Your ${meal} is ready`;
    case 'PREPARING':
      return `Your ${meal} is being prepared`;
    case 'PENDING_KITCHEN_ACCEPTANCE':
      return `Your ${meal} order is being confirmed`;
    case 'SCHEDULED':
      return `Your ${meal} is scheduled for today`;
    default:
      return `Your ${meal} is coming today`;
  }
}

export function getActiveOrderBannerContent(
  orders: Order[],
): ActiveOrderBannerContent | null {
  if (orders.length === 0) return null;

  const lunches = orders.filter(o => o.mealWindow === 'LUNCH');
  const dinners = orders.filter(o => o.mealWindow === 'DINNER');

  if (lunches.length > 0 && dinners.length > 0) {
    return {
      title: 'Your lunch & dinner are coming today',
      subtitle: 'Tap to view your orders',
      orderId: null,
    };
  }

  const single = lunches[0] || dinners[0] || orders[0];
  const meal: 'lunch' | 'dinner' =
    single.mealWindow === 'DINNER' ? 'dinner' : 'lunch';

  return {
    title: statusTitle(single.status, meal),
    subtitle: 'Tap to track your order',
    orderId: single._id,
  };
}
