/**
 * Order Status Constants
 * Single source of truth for order status values
 * MUST be kept in sync with frontend
 */

export const ORDER_STATUS = [
  'pending',
  'confirmed', 
  'processing',
  'out_for_delivery',
  'delivered',
  'cancelled'
];

export const PAYMENT_STATUS = [
  'pending',
  'paid',
  'failed',
  'refunded'
];

// Human-readable labels
export const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

// Status validation helper
export const isValidOrderStatus = (status) => ORDER_STATUS.includes(status);
export const isValidPaymentStatus = (status) => PAYMENT_STATUS.includes(status);

export default ORDER_STATUS;
