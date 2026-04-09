/**
 * Payment Routes - Razorpay Integration
 * 
 * Routes:
 * POST /api/payment/create-order - Create Razorpay order
 * POST /api/payment/verify - Verify payment signature and complete order
 * 
 * Security:
 * - HMAC-SHA256 signature verification
 * - Rate limiting (applied in index.js)
 * - Firebase auth required
 */

import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';
import { sendPaymentConfirmationEmail } from '../services/emailService.js';

const router = express.Router();

// Lazy initialization of Razorpay (env vars loaded after module import)
let razorpay = null;

const getRazorpay = () => {
  if (!razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    }
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpay;
};

/**
 * POST /api/payment/create-order
 * Creates a Razorpay order and a pending order in database
 * 
 * Body: {
 *   items: [{ productId, name, category, image, weight, quantity, price, total }],
 *   customer: { name, email, mobile, address, state, country, pincode },
 *   subtotal: number,
 *   discount: number,
 *   couponCode: string,
 *   deliveryCharge: number,
 *   totalAmount: number
 * }
 */
router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const { 
      items, 
      customer, 
      subtotal, 
      discount = 0, 
      couponCode = null,
      deliveryCharge = 0, 
      totalAmount 
    } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required'
      });
    }

    if (!customer || !customer.name || !customer.email || !customer.mobile || !customer.address || !customer.pincode) {
      return res.status(400).json({
        success: false,
        message: 'Complete customer details are required'
      });
    }

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid total amount'
      });
    }

    // Find or verify user
    const firebaseUid = req.user.uid;
    let user = await User.findOne({ firebaseUid });

    if (!user) {
      // Create user if doesn't exist
      user = new User({
        firebaseUid,
        email: customer.email,
        name: customer.name,
        phone: customer.mobile
      });
      await user.save();
    }

    // Create Razorpay order
    const razorpayOrder = await getRazorpay().orders.create({
      amount: Math.round(totalAmount * 100), // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.mobile
      }
    });

    // Create pending order in database
    const order = new Order({
      userId: user._id,
      firebaseUid,
      customer: {
        name: customer.name,
        email: customer.email,
        mobile: customer.mobile,
        address: customer.address,
        state: customer.state || '',
        country: customer.country || 'India',
        pincode: customer.pincode
      },
      items: items.map(item => ({
        productId: item.productId,
        name: item.name,
        category: item.category || '',
        image: item.image || '',
        weight: item.weight,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      subtotal,
      discount,
      couponCode,
      deliveryCharge,
      totalAmount,
      payment: {
        method: 'razorpay',
        razorpayOrderId: razorpayOrder.id,
        status: 'pending'
      },
      orderStatus: 'pending'
    });

    await order.save();

    console.log(`✅ Payment order created: ${order.orderId} | Razorpay: ${razorpayOrder.id}`);

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        orderId: order.orderId
      },
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('❌ Create payment order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/payment/verify
 * Verifies Razorpay payment signature and completes the order
 * 
 * Body: {
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string
 * }
 */
router.post('/verify', verifyToken, async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = req.body;

    // Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    // Find the order
    const order = await Order.findOne({ 'payment.razorpayOrderId': razorpay_order_id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Prevent duplicate verification
    if (order.payment.status === 'paid') {
      return res.json({
        success: true,
        message: 'Payment already verified',
        order: {
          orderId: order.orderId,
          status: order.orderStatus,
          payment: order.payment.status
        }
      });
    }

    // Verify signature using HMAC-SHA256
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValidSignature = expectedSignature === razorpay_signature;

    if (!isValidSignature) {
      console.error(`❌ Invalid signature for order ${order.orderId}`);
      
      // Update order with failed payment
      order.payment.status = 'failed';
      order.addStatusHistory('payment_failed', 'Payment signature verification failed');
      await order.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed - invalid signature'
      });
    }

    // Update order with successful payment
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.status = 'paid';
    order.payment.paidAt = new Date();
    order.orderStatus = 'confirmed';
    order.addStatusHistory('confirmed', 'Payment verified successfully');

    await order.save();

    console.log(`✅ Payment verified: ${order.orderId} | Payment: ${razorpay_payment_id}`);

    // Send payment confirmation email (async, don't wait)
    if (!order.emailsSent.paymentConfirmation) {
      sendPaymentConfirmationEmail(order)
        .then(async (result) => {
          if (result.success) {
            order.emailsSent.paymentConfirmation = true;
            await order.save();
            console.log(`📧 Payment confirmation email sent for ${order.orderId}`);
          }
        })
        .catch(err => console.error(`📧 Email error for ${order.orderId}:`, err.message));
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      order: {
        orderId: order.orderId,
        status: order.orderStatus,
        payment: order.payment.status,
        totalAmount: order.totalAmount
      }
    });

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/payment/order/:orderId
 * Get order status by orderId (for frontend polling/display)
 */
router.get('/order/:orderId', verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      orderId: req.params.orderId,
      firebaseUid: req.user.uid
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        status: order.orderStatus,
        payment: {
          status: order.payment.status,
          method: order.payment.method,
          paidAt: order.payment.paidAt
        },
        items: order.items,
        totalAmount: order.totalAmount,
        customer: {
          name: order.customer.name,
          address: order.customer.address,
          pincode: order.customer.pincode
        },
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    });
  }
});

export default router;
