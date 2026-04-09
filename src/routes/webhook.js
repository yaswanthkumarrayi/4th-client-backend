/**
 * Razorpay Webhook Handler
 * 
 * CRITICAL: This route MUST be mounted BEFORE express.json() middleware
 * because it needs access to the raw body for signature verification.
 * 
 * Route: POST /api/webhook/razorpay
 * 
 * Events handled:
 * - payment.captured - Payment successful
 * - payment.failed - Payment failed
 * - order.paid - Order payment completed
 */

import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import { sendPaymentConfirmationEmail } from '../services/emailService.js';

const router = express.Router();

/**
 * Verify Razorpay webhook signature
 * @param {Buffer} rawBody - Raw request body
 * @param {string} signature - X-Razorpay-Signature header
 * @param {string} secret - Webhook secret
 * @returns {boolean}
 */
const verifyWebhookSignature = (rawBody, signature, secret) => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(signature, 'hex')
  );
};

/**
 * POST /api/webhook/razorpay
 * 
 * Note: express.raw() middleware is applied in index.js BEFORE this route
 */
router.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!signature) {
      console.warn('⚠️ Webhook received without signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Verify signature
    const rawBody = req.body;
    
    // If body is already parsed as JSON, it means the middleware order is wrong
    if (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody)) {
      console.error('❌ Webhook body is not raw - check middleware order');
      
      // Try to work with parsed body anyway (less secure)
      const bodyString = JSON.stringify(rawBody);
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyString)
        .digest('hex');
      
      if (expectedSig !== signature) {
        console.error('❌ Webhook signature mismatch');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    } else {
      // Proper raw body verification
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
      
      if (!isValid) {
        console.error('❌ Webhook signature verification failed');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    // Parse the body
    const payload = typeof rawBody === 'string' || Buffer.isBuffer(rawBody) 
      ? JSON.parse(rawBody.toString())
      : rawBody;

    const event = payload.event;
    const entity = payload.payload?.payment?.entity || payload.payload?.order?.entity;

    console.log(`📩 Webhook received: ${event}`);

    // Handle different events
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(entity);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(entity);
        break;
      
      case 'order.paid':
        await handleOrderPaid(payload.payload.order.entity, payload.payload.payment.entity);
        break;
      
      default:
        console.log(`ℹ️ Unhandled webhook event: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    // Still return 200 to prevent retries for parsing errors
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * Handle payment.captured event
 * This is the most reliable way to confirm payment
 */
async function handlePaymentCaptured(payment) {
  try {
    const razorpayOrderId = payment.order_id;
    const razorpayPaymentId = payment.id;

    const order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });

    if (!order) {
      console.warn(`⚠️ Order not found for Razorpay order: ${razorpayOrderId}`);
      return;
    }

    // Idempotent check - skip if already processed
    if (order.payment.status === 'paid') {
      console.log(`ℹ️ Order ${order.orderId} already marked as paid (idempotent)`);
      return;
    }

    // Update order
    order.payment.razorpayPaymentId = razorpayPaymentId;
    order.payment.status = 'paid';
    order.payment.paidAt = new Date();
    order.orderStatus = 'confirmed';
    order.addStatusHistory('confirmed', 'Payment captured via webhook');

    await order.save();

    console.log(`✅ Webhook: Payment captured for order ${order.orderId}`);

    // Send confirmation email if not sent
    if (!order.emailsSent.paymentConfirmation) {
      sendPaymentConfirmationEmail(order)
        .then(async (result) => {
          if (result.success) {
            order.emailsSent.paymentConfirmation = true;
            await order.save();
            console.log(`📧 Webhook: Confirmation email sent for ${order.orderId}`);
          }
        })
        .catch(err => console.error(`📧 Webhook email error:`, err.message));
    }

  } catch (error) {
    console.error('❌ handlePaymentCaptured error:', error);
  }
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(payment) {
  try {
    const razorpayOrderId = payment.order_id;

    const order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });

    if (!order) {
      console.warn(`⚠️ Order not found for failed payment: ${razorpayOrderId}`);
      return;
    }

    // Don't overwrite if already paid (edge case)
    if (order.payment.status === 'paid') {
      console.log(`ℹ️ Order ${order.orderId} is paid, ignoring failed event`);
      return;
    }

    // Update order
    order.payment.status = 'failed';
    order.addStatusHistory('payment_failed', `Payment failed: ${payment.error_description || 'Unknown error'}`);

    await order.save();

    console.log(`⚠️ Webhook: Payment failed for order ${order.orderId}`);

  } catch (error) {
    console.error('❌ handlePaymentFailed error:', error);
  }
}

/**
 * Handle order.paid event
 */
async function handleOrderPaid(orderEntity, paymentEntity) {
  try {
    const razorpayOrderId = orderEntity.id;

    const order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });

    if (!order) {
      console.warn(`⚠️ Order not found for order.paid: ${razorpayOrderId}`);
      return;
    }

    // Idempotent check
    if (order.payment.status === 'paid') {
      console.log(`ℹ️ Order ${order.orderId} already paid (order.paid event)`);
      return;
    }

    // Update order
    order.payment.razorpayPaymentId = paymentEntity?.id;
    order.payment.status = 'paid';
    order.payment.paidAt = new Date();
    order.orderStatus = 'confirmed';
    order.addStatusHistory('confirmed', 'Payment confirmed via order.paid webhook');

    await order.save();

    console.log(`✅ Webhook: Order paid - ${order.orderId}`);

    // Send email
    if (!order.emailsSent.paymentConfirmation) {
      sendPaymentConfirmationEmail(order)
        .then(async (result) => {
          if (result.success) {
            order.emailsSent.paymentConfirmation = true;
            await order.save();
          }
        })
        .catch(err => console.error(`📧 Webhook email error:`, err.message));
    }

  } catch (error) {
    console.error('❌ handleOrderPaid error:', error);
  }
}

export default router;
