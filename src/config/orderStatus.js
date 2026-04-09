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

// Admin workflow statuses (3 simple steps)
export const ADMIN_WORKFLOW_STATUS = [
  'processing',
  'out_for_delivery',
  'delivered'
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

// Status validation helper - handles undefined, null, and non-string values
export const isValidOrderStatus = (status) => {
  // Handle undefined, null, and non-string cases
  if (status === undefined || status === null || typeof status !== 'string') {
    return false;
  }
  
  // Normalize and check
  const normalized = status.trim().toLowerCase();
  
  // Check for literal 'undefined' or 'null' strings
  if (normalized === 'undefined' || normalized === 'null' || normalized === '') {
    return false;
  }
  
  return ORDER_STATUS.includes(normalized);
};

export const isValidPaymentStatus = (status) => {
  if (status === undefined || status === null || typeof status !== 'string') {
    return false;
  }
  return PAYMENT_STATUS.includes(status.trim().toLowerCase());
};

export default ORDER_STATUS;
