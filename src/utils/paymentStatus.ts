import { Order } from '../services/api.service';

const REPAY_WINDOW_MINUTES = 30;

export function isPaymentPending(
  order: Pick<Order, 'paymentStatus' | 'status'>,
): boolean {
  if (order.paymentStatus !== 'PENDING') return false;
  return order.status !== 'CANCELLED' && order.status !== 'REJECTED';
}

export function getPaymentDeadline(order: Pick<Order, 'placedAt'>): Date {
  return new Date(
    new Date(order.placedAt).getTime() + REPAY_WINDOW_MINUTES * 60_000,
  );
}

export function getPaymentDeadlineSeconds(order: Pick<Order, 'placedAt'>): number {
  return Math.max(
    0,
    Math.ceil((getPaymentDeadline(order).getTime() - Date.now()) / 1000),
  );
}

export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
