import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Helper: Calculate weight prices
const calculateWeightPrices = (pricePerKg) => ({
  '250gm': Math.floor(pricePerKg * 0.25),
  '500gm': Math.floor(pricePerKg * 0.5),
  '1kg': pricePerKg,
  '2kg': pricePerKg * 2
});

// Helper: Format product for API response
const formatProduct = (product) => ({
  id: product.productId,
  productId: product.productId,
  name: product.name,
  category: product.category,
  pricePerKg: product.pricePerKg,
  price: Math.floor(product.pricePerKg * 0.25),
  weights: ['250gm', '500gm', '1kg', '2kg'],
  weightPrices: calculateWeightPrices(product.pricePerKg),
  inStock: product.inStock,
  stockQuantity: product.stockQuantity,
  isActive: product.isActive
});

// Initial products for auto-seeding
const INITIAL_PRODUCTS = [
  { productId: 1, name: 'Mango Avakaya', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 2, name: 'Gongura Pickle', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 10, name: 'Ginger Pickle', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 11, name: 'Lemon Pickle', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 12, name: 'Red Chilli Pickle', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 13, name: 'Usirikaya Pickle', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 3, name: 'Chicken Pickle', category: 'Non Veg Pickles', pricePerKg: 1999 },
  { productId: 4, name: 'Prawns Pickle', category: 'Non Veg Pickles', pricePerKg: 2499 },
  { productId: 14, name: 'Mutton Boneless Pickle', category: 'Non Veg Pickles', pricePerKg: 2799 },
  { productId: 7, name: 'Kandi Podi', category: 'Podis', pricePerKg: 1400 },
  { productId: 8, name: 'Karvepaku Podi', category: 'Podis', pricePerKg: 1400 },
  { productId: 9, name: 'Kobbari Podi', category: 'Podis', pricePerKg: 1400 },
  { productId: 101, name: 'Mixture', category: 'Snacks', pricePerKg: 550 },
  { productId: 102, name: 'Murukulu', category: 'Snacks', pricePerKg: 550 },
  { productId: 103, name: 'Ribbon Pakodi', category: 'Snacks', pricePerKg: 550 },
  { productId: 201, name: 'Ariselu', category: 'Sweets', pricePerKg: 799 },
  { productId: 202, name: 'Bandharu Laddu', category: 'Sweets', pricePerKg: 799 },
  { productId: 203, name: 'Boondhi Achu', category: 'Sweets', pricePerKg: 799 },
  { productId: 204, name: 'Boondhi Laddu', category: 'Sweets', pricePerKg: 799 },
  { productId: 205, name: 'Boorelu', category: 'Sweets', pricePerKg: 799 },
  { productId: 206, name: 'Cashew Achu', category: 'Sweets', pricePerKg: 799 },
  { productId: 207, name: 'Kajji Kayalu', category: 'Sweets', pricePerKg: 799 },
  { productId: 208, name: 'Mysore Pak', category: 'Sweets', pricePerKg: 799 },
  { productId: 209, name: 'Nuvvundalu', category: 'Sweets', pricePerKg: 799 },
  { productId: 210, name: 'Palli Undalu', category: 'Sweets', pricePerKg: 799 },
  { productId: 211, name: 'Sanna Boondhi Laddu', category: 'Sweets', pricePerKg: 799 },
  { productId: 212, name: 'Sunnunda', category: 'Sweets', pricePerKg: 799 },
];

// Lazy initialization of Razorpay (only when needed)
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

// ============================================
// PUBLIC: Get products from database
// ============================================

router.get('/products', async (req, res) => {
  try {
    console.log('\n📦 ===== GET /api/orders/products =====');
    
    // Fetch products from database
    let products = await Product.find({ isActive: true }).sort({ category: 1, productId: 1 });
    
    // Auto-seed if empty
    if (products.length === 0) {
      console.log('⚠️ No products found. Auto-seeding database...');
      for (const p of INITIAL_PRODUCTS) {
        await Product.create({ ...p, inStock: true, isActive: true });
      }
      products = await Product.find({ isActive: true }).sort({ category: 1, productId: 1 });
      console.log(`✅ Seeded ${products.length} products`);
    }
    
    // Format for API response
    const formattedProducts = products.map(formatProduct);
    
    console.log(`✅ Returning ${formattedProducts.length} products`);
    console.log('=========================================\n');
    
    res.json({
      success: true,
      products: formattedProducts,
      count: formattedProducts.length
    });
  } catch (error) {
    console.error('❌ Get products error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// ============================================
// COUPON: Validate and apply
// ============================================

router.post('/coupon/validate', verifyToken, async (req, res) => {
  try {
    const { code, orderAmount, productIds } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }
    
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }
    
    const validation = coupon.isValid(orderAmount || 0, productIds || []);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }
    
    const discount = coupon.calculateDiscount(orderAmount || 0);
    
    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate coupon'
    });
  }
});

// ============================================
// RAZORPAY: Create order
// ============================================

router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const { items, couponCode, address } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }
    
    if (!address || !address.name || !address.mobile || !address.address || !address.pincode) {
      return res.status(400).json({
        success: false,
        message: 'Complete address is required'
      });
    }
    
    // Calculate totals with backend prices from Product collection
    let subtotal = 0;
    const validatedItems = [];
    
    for (const item of items) {
      // Fetch product from database
      const product = await Product.findOne({ productId: item.productId });
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productId} not found`
        });
      }
      
      // Check stock
      if (!product.inStock) {
        return res.status(400).json({
          success: false,
          message: `${product.name} is out of stock`
        });
      }
      
      // Calculate price
      const weightPrices = calculateWeightPrices(product.pricePerKg);
      const itemPrice = weightPrices[item.weight];
      
      if (!itemPrice) {
        return res.status(400).json({
          success: false,
          message: `Invalid weight for ${product.name}`
        });
      }
      
      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;
      
      validatedItems.push({
        productId: product.productId,
        name: product.name,
        category: product.category,
        image: item.image || '',
        weight: item.weight,
        quantity: item.quantity,
        price: itemPrice,
        total: itemTotal
      });
    }
    
    // Apply coupon if provided
    let discount = 0;
    let appliedCoupon = null;
    
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (coupon) {
        const productIds = validatedItems.map(i => i.productId);
        const validation = coupon.isValid(subtotal, productIds);
        
        if (validation.valid) {
          discount = coupon.calculateDiscount(subtotal);
          appliedCoupon = couponCode.toUpperCase();
        }
      }
    }
    
    // Calculate final amount
    const deliveryCharge = subtotal >= 500 ? 0 : 50;
    const totalAmount = subtotal - discount + deliveryCharge;
    
    // Create Razorpay order
    const razorpayOrder = await getRazorpay().orders.create({
      amount: Math.round(totalAmount * 100), // Amount in paise
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        customerEmail: req.user.email,
        customerName: address.name
      }
    });
    
    // Debug: Log created order
    console.log('[Razorpay] Order created:', {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      totalAmount
    });
    
    // Get or create user
    let user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) {
      user = await User.findOne({ email: req.user.email });
    }
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found. Please complete your profile first.'
      });
    }
    
    // Create order in database (pending payment)
    const order = new Order({
      userId: user._id,
      firebaseUid: req.user.uid,
      customer: {
        name: address.name,
        email: req.user.email,
        mobile: address.mobile,
        address: address.address,
        state: address.state || '',
        country: address.country || 'India',
        pincode: address.pincode
      },
      items: validatedItems,
      subtotal,
      discount,
      couponCode: appliedCoupon,
      deliveryCharge,
      totalAmount,
      payment: {
        method: 'razorpay',
        razorpayOrderId: razorpayOrder.id,
        status: 'pending'
      },
      orderStatus: 'pending'
    });
    
    order.addStatusHistory('pending', 'Order created, awaiting payment');
    await order.save();
    
    res.json({
      success: true,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      },
      order: {
        orderId: order.orderId,
        subtotal,
        discount,
        deliveryCharge,
        totalAmount
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order'
    });
  }
});

// ============================================
// RAZORPAY: Verify payment
// ============================================

router.post('/verify-payment', verifyToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification data is missing'
      });
    }
    
    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      // Update order as failed
      await Order.findOneAndUpdate(
        { 'payment.razorpayOrderId': razorpay_order_id },
        { 
          'payment.status': 'failed',
          orderStatus: 'cancelled'
        }
      );
      
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
    
    // Update order as paid
    const order = await Order.findOneAndUpdate(
      { 'payment.razorpayOrderId': razorpay_order_id },
      {
        'payment.razorpayPaymentId': razorpay_payment_id,
        'payment.razorpaySignature': razorpay_signature,
        'payment.status': 'paid',
        'payment.paidAt': new Date(),
        orderStatus: 'confirmed'
      },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    order.addStatusHistory('confirmed', 'Payment received');
    await order.save();
    
    // Increment coupon usage if used
    if (order.couponCode) {
      await Coupon.findOneAndUpdate(
        { code: order.couponCode },
        { $inc: { usedCount: 1 } }
      );
    }
    
    res.json({
      success: true,
      message: 'Payment verified successfully',
      order: {
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        paymentStatus: order.payment.status,
        orderStatus: order.orderStatus
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed'
    });
  }
});

// ============================================
// USER: Get my orders
// ============================================

router.get('/my-orders', verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ firebaseUid: req.user.uid })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// Get single order
router.get('/my-orders/:orderId', verifyToken, async (req, res) => {
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
      order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    });
  }
});

// Delete order (only for delivered orders)
router.delete('/my-orders/:orderId', verifyToken, async (req, res) => {
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
    
    // Only allow deletion of delivered orders
    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Only delivered orders can be deleted'
      });
    }
    
    await Order.findByIdAndDelete(order._id);
    
    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete order'
    });
  }
});

export default router;
