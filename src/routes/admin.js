import express from 'express';
import { adminLogin, verifyAdminToken } from '../middleware/adminAuth.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import Product from '../models/Product.js';
import { ORDER_STATUS, isValidOrderStatus } from '../config/orderStatus.js';

const router = express.Router();

// Initial product data for seeding
const INITIAL_PRODUCTS = [
  // Veg Pickles
  { productId: 1, name: 'Mango Avakaya', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 2, name: 'Gongura Pickle', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 10, name: 'Ginger Pickle', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 11, name: 'Lemon Pickle', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 12, name: 'Red Chilli Pickle', category: 'Veg Pickles', pricePerKg: 750 },
  { productId: 13, name: 'Usirikaya Pickle', category: 'Veg Pickles', pricePerKg: 750 },
  // Non Veg Pickles
  { productId: 3, name: 'Chicken Pickle', category: 'Non Veg Pickles', pricePerKg: 1999 },
  { productId: 4, name: 'Prawns Pickle', category: 'Non Veg Pickles', pricePerKg: 2499 },
  { productId: 14, name: 'Mutton Boneless Pickle', category: 'Non Veg Pickles', pricePerKg: 2799 },
  // Podis
  { productId: 7, name: 'Kandi Podi', category: 'Podis', pricePerKg: 1400 },
  { productId: 8, name: 'Karvepaku Podi', category: 'Podis', pricePerKg: 1400 },
  { productId: 9, name: 'Kobbari Podi', category: 'Podis', pricePerKg: 1400 },
  // Snacks
  { productId: 101, name: 'Mixture', category: 'Snacks', pricePerKg: 550 },
  { productId: 102, name: 'Murukulu', category: 'Snacks', pricePerKg: 550 },
  { productId: 103, name: 'Ribbon Pakodi', category: 'Snacks', pricePerKg: 550 },
  // Sweets
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
  isActive: product.isActive,
  updatedAt: product.updatedAt
});

// ============================================
// ADMIN AUTH
// ============================================

// Admin Login
router.post('/login', (req, res) => {
  try {
    const { mobile, password } = req.body;
    
    if (!mobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mobile and password are required'
      });
    }
    
    const result = adminLogin(mobile, password);
    
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(401).json(result);
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Verify admin session
router.get('/verify', verifyAdminToken, (req, res) => {
  res.json({
    success: true,
    admin: req.admin
  });
});

// ============================================
// DASHBOARD STATS
// ============================================

router.get('/dashboard', verifyAdminToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Get order stats
    const totalOrders = await Order.countDocuments();
    const todayOrders = await Order.countDocuments({ createdAt: { $gte: today } });
    const monthOrders = await Order.countDocuments({ createdAt: { $gte: thisMonth } });
    
    // Revenue stats
    const totalRevenue = await Order.aggregate([
      { $match: { 'payment.status': 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    const todayRevenue = await Order.aggregate([
      { $match: { 'payment.status': 'paid', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    // Pending orders
    const pendingOrders = await Order.countDocuments({
      orderStatus: { $in: ['pending', 'confirmed', 'processing'] }
    });
    
    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderId customer.name totalAmount orderStatus payment.status createdAt');
    
    res.json({
      success: true,
      stats: {
        totalOrders,
        todayOrders,
        monthOrders,
        pendingOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayRevenue: todayRevenue[0]?.total || 0
      },
      recentOrders
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
});

// ============================================
// ORDERS MANAGEMENT
// ============================================

// Get all orders
router.get('/orders', verifyAdminToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.orderStatus = status;
    }
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Order.countDocuments(query);
    
    res.json({
      success: true,
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
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
router.get('/orders/:orderId', verifyAdminToken, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    
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

// Update order status
router.put('/orders/:orderId/status', verifyAdminToken, async (req, res) => {
  try {
    const { status, note } = req.body;
    
    console.log('\n═══════════════════════════════════════════');
    console.log('🔄 ORDER STATUS UPDATE REQUEST');
    console.log('   Order ID:', req.params.orderId);
    console.log('   Raw body:', JSON.stringify(req.body));
    console.log('   Status value:', status);
    console.log('   Status type:', typeof status);
    console.log('   Status === undefined:', status === undefined);
    console.log('   Status === null:', status === null);
    console.log('   Valid Statuses:', ORDER_STATUS);
    console.log('═══════════════════════════════════════════');
    
    // CRITICAL: Check for undefined, null, empty string FIRST
    if (status === undefined) {
      console.log('❌ Status is undefined - frontend did not send status field');
      return res.status(400).json({
        success: false,
        message: `Status is required. The request body did not include a 'status' field. Please ensure the frontend sends: { status: "confirmed" } (or another valid status)`
      });
    }
    
    if (status === null) {
      console.log('❌ Status is null');
      return res.status(400).json({
        success: false,
        message: `Status cannot be null. Valid values: ${ORDER_STATUS.join(', ')}`
      });
    }
    
    if (typeof status !== 'string') {
      console.log('❌ Status is not a string:', typeof status);
      return res.status(400).json({
        success: false,
        message: `Status must be a string, got ${typeof status}. Valid values: ${ORDER_STATUS.join(', ')}`
      });
    }
    
    if (status.trim() === '') {
      console.log('❌ Status is empty string');
      return res.status(400).json({
        success: false,
        message: `Status cannot be empty. Valid values: ${ORDER_STATUS.join(', ')}`
      });
    }
    
    // Normalize status (lowercase, trimmed)
    const normalizedStatus = status.trim().toLowerCase();
    
    // Check for string 'undefined' or 'null' (common frontend bug)
    if (normalizedStatus === 'undefined' || normalizedStatus === 'null') {
      console.log('❌ Status is string "undefined" or "null":', status);
      return res.status(400).json({
        success: false,
        message: `Invalid status: "${status}". Cannot be "undefined" or "null". This usually means a frontend bug where undefined was converted to string. Valid values: ${ORDER_STATUS.join(', ')}`
      });
    }
    
    // Validate status using shared constant
    if (!isValidOrderStatus(normalizedStatus)) {
      console.log('❌ Invalid status rejected:', normalizedStatus);
      return res.status(400).json({
        success: false,
        message: `Invalid status: "${status}". Valid values: ${ORDER_STATUS.join(', ')}`
      });
    }
    
    const order = await Order.findOne({ orderId: req.params.orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Use normalizedStatus for database update
    order.addStatusHistory(normalizedStatus, note || '');
    await order.save();
    
    console.log('✅ Order status updated to:', normalizedStatus);
    
    res.json({
      success: true,
      message: 'Order status updated',
      order
    });
  } catch (error) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
});

// ============================================
// PRODUCTS MANAGEMENT (Single Source of Truth)
// ============================================

// Seed products if collection is empty (run once on first startup)
router.post('/products/seed', verifyAdminToken, async (req, res) => {
  try {
    const existingCount = await Product.countDocuments();
    
    if (existingCount > 0 && !req.query.force) {
      return res.json({
        success: false,
        message: `Database already has ${existingCount} products. Use ?force=true to reseed.`,
        count: existingCount
      });
    }
    
    if (req.query.force) {
      await Product.deleteMany({});
      console.log('🗑️ Deleted existing products for reseed');
    }
    
    // Insert all products
    for (const product of INITIAL_PRODUCTS) {
      await Product.create({
        ...product,
        inStock: true,
        isActive: true
      });
    }
    
    console.log(`✅ Seeded ${INITIAL_PRODUCTS.length} products`);
    
    res.json({
      success: true,
      message: `Seeded ${INITIAL_PRODUCTS.length} products successfully`,
      count: INITIAL_PRODUCTS.length
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed products: ' + error.message
    });
  }
});

// Get all products from database
router.get('/products', verifyAdminToken, async (req, res) => {
  try {
    console.log('\n📋 ===== FETCHING PRODUCTS FROM DATABASE =====');
    
    // Fetch all products from MongoDB
    let products = await Product.find().sort({ category: 1, productId: 1 });
    
    // If no products exist, seed the database automatically
    if (products.length === 0) {
      console.log('⚠️ No products in database. Auto-seeding...');
      for (const product of INITIAL_PRODUCTS) {
        await Product.create({
          ...product,
          inStock: true,
          isActive: true
        });
      }
      products = await Product.find().sort({ category: 1, productId: 1 });
      console.log(`✅ Auto-seeded ${products.length} products`);
    }
    
    // Format products for response
    const formattedProducts = products.map(formatProduct);
    
    console.log(`📦 Returning ${formattedProducts.length} products`);
    console.log('============================================\n');
    
    res.json({
      success: true,
      products: formattedProducts
    });
  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products: ' + error.message
    });
  }
});

// ============================================
// ROBUST PRODUCT UPDATE CONTROLLER
// Handles: boolean false, string numbers, partial updates
// ============================================
router.put('/products/:productId', verifyAdminToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    // ═══════════════════════════════════════════
    // STEP 1: DETAILED REQUEST LOGGING
    // ═══════════════════════════════════════════
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║       🔄 PRODUCT UPDATE REQUEST                        ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('📍 Product ID (param):', req.params.productId);
    console.log('📍 Product ID (parsed):', productId);
    console.log('📦 Raw req.body:', req.body);
    console.log('📦 typeof req.body:', typeof req.body);
    console.log('📦 JSON.stringify(req.body):', JSON.stringify(req.body));
    console.log('📦 Object.keys(req.body):', Object.keys(req.body || {}));
    console.log('📦 req.body.inStock:', req.body?.inStock, '| type:', typeof req.body?.inStock);
    console.log('📦 req.body.pricePerKg:', req.body?.pricePerKg, '| type:', typeof req.body?.pricePerKg);
    console.log('────────────────────────────────────────────────────────');
    
    // ═══════════════════════════════════════════
    // STEP 2: VALIDATE PRODUCT ID
    // ═══════════════════════════════════════════
    if (isNaN(productId) || productId <= 0) {
      console.log('❌ Invalid product ID');
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID: must be a positive number'
      });
    }
    
    // ═══════════════════════════════════════════
    // STEP 3: CHECK IF REQUEST BODY EXISTS
    // Important: Don't reject yet - check for valid fields first
    // ═══════════════════════════════════════════
    const body = req.body || {};
    const bodyKeys = Object.keys(body);
    
    console.log('🔍 Body exists:', !!req.body);
    console.log('🔍 Body is object:', typeof body === 'object' && !Array.isArray(body));
    console.log('🔍 Body keys count:', bodyKeys.length);
    console.log('🔍 Body keys:', bodyKeys);
    
    // ═══════════════════════════════════════════
    // STEP 4: DEFINE ALLOWED FIELDS AND PROCESSORS
    // Each field has its own validation logic
    // ═══════════════════════════════════════════
    const ALLOWED_FIELDS = {
      // pricePerKg: accepts number or string, must be positive
      pricePerKg: (value) => {
        if (value === undefined || value === null || value === '') return undefined;
        const num = Number(value);
        if (isNaN(num) || num <= 0) {
          console.log('   ⚠️ pricePerKg invalid:', value, '→ skipped');
          return undefined;
        }
        console.log('   ✅ pricePerKg:', value, '→', num);
        return num;
      },
      
      // inStock: CRITICAL - must handle false correctly!
      // Uses 'key in object' check, not truthiness
      inStock: (value) => {
        // value can be: true, false, 'true', 'false', 1, 0
        if (value === undefined) return undefined;
        // Convert to boolean - only true, 'true', 1 become true
        const bool = value === true || value === 'true' || value === 1;
        console.log('   ✅ inStock:', value, '(type:', typeof value, ') →', bool);
        return bool;
      },
      
      // isActive: same as inStock
      isActive: (value) => {
        if (value === undefined) return undefined;
        const bool = value === true || value === 'true' || value === 1;
        console.log('   ✅ isActive:', value, '→', bool);
        return bool;
      },
      
      // name: non-empty string
      name: (value) => {
        if (value === undefined || value === null) return undefined;
        const str = String(value).trim();
        if (str === '') return undefined;
        console.log('   ✅ name:', value, '→', str);
        return str;
      },
      
      // category: non-empty string
      category: (value) => {
        if (value === undefined || value === null || value === '') return undefined;
        console.log('   ✅ category:', value);
        return value;
      },
      
      // stockQuantity: number >= 0 or null
      stockQuantity: (value) => {
        if (value === undefined) return undefined;
        if (value === null || value === '') {
          console.log('   ✅ stockQuantity: null (unlimited)');
          return null;
        }
        const num = Number(value);
        if (isNaN(num) || num < 0) return undefined;
        console.log('   ✅ stockQuantity:', value, '→', num);
        return num;
      }
    };
    
    // ═══════════════════════════════════════════
    // STEP 5: BUILD UPDATE OBJECT
    // Only include fields that are present AND valid
    // ═══════════════════════════════════════════
    const updateFields = {};
    
    console.log('\n🔧 Processing fields:');
    
    for (const [fieldName, processor] of Object.entries(ALLOWED_FIELDS)) {
      // CRITICAL: Use 'in' operator to detect field presence
      // This correctly handles false, 0, null, empty string
      if (fieldName in body) {
        const rawValue = body[fieldName];
        const processedValue = processor(rawValue);
        
        // Only add if processor returned a defined value
        // Note: null is valid for stockQuantity, false is valid for booleans
        if (processedValue !== undefined) {
          updateFields[fieldName] = processedValue;
        }
      }
    }
    
    console.log('\n📋 Final updateFields:', JSON.stringify(updateFields));
    console.log('📋 updateFields keys:', Object.keys(updateFields));
    console.log('📋 updateFields count:', Object.keys(updateFields).length);
    
    // ═══════════════════════════════════════════
    // STEP 6: CHECK IF WE HAVE VALID FIELDS
    // ═══════════════════════════════════════════
    if (Object.keys(updateFields).length === 0) {
      console.log('❌ No valid fields to update after processing');
      console.log('   Received body:', JSON.stringify(body));
      console.log('   Allowed fields:', Object.keys(ALLOWED_FIELDS).join(', '));
      
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update',
        hint: `Allowed fields: ${Object.keys(ALLOWED_FIELDS).join(', ')}`,
        receivedFields: bodyKeys,
        debug: {
          bodyReceived: body,
          bodyType: typeof body,
          bodyKeysCount: bodyKeys.length
        }
      });
    }
    
    // ═══════════════════════════════════════════
    // STEP 7: FIND OR CREATE PRODUCT
    // ═══════════════════════════════════════════
    let product = await Product.findOne({ productId });
    console.log('\n📦 Product in DB:', product ? 'FOUND' : 'NOT FOUND');
    
    if (!product) {
      const initialProduct = INITIAL_PRODUCTS.find(p => p.productId === productId);
      if (initialProduct) {
        product = await Product.create({
          ...initialProduct,
          inStock: true,
          isActive: true
        });
        console.log('✨ Created new product in database');
      } else {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
    }
    
    // ═══════════════════════════════════════════
    // STEP 8: PERFORM UPDATE
    // ═══════════════════════════════════════════
    console.log('\n💾 Executing update...');
    console.log('   Query: { productId:', productId, '}');
    console.log('   Update: { $set:', JSON.stringify(updateFields), '}');
    
    const updateResult = await Product.updateOne(
      { productId },
      { $set: updateFields }
    );
    
    console.log('📊 Update result:', {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount
    });
    
    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${productId} not found in database`
      });
    }
    
    // ═══════════════════════════════════════════
    // STEP 9: RETURN UPDATED PRODUCT
    // ═══════════════════════════════════════════
    const updatedProduct = await Product.findOne({ productId });
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║       ✅ PRODUCT UPDATED SUCCESSFULLY                  ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('   Product ID:', updatedProduct.productId);
    console.log('   Name:', updatedProduct.name);
    console.log('   Price/kg:', updatedProduct.pricePerKg);
    console.log('   In Stock:', updatedProduct.inStock);
    console.log('   Is Active:', updatedProduct.isActive);
    console.log('');
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      product: formatProduct(updatedProduct),
      updatedFields: Object.keys(updateFields),
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount
    });
    
  } catch (error) {
    console.error('\n❌ UPDATE ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product: ' + error.message
    });
  }
});

// Reset product to default values
router.delete('/products/:productId/override', verifyAdminToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    // Find the initial product data
    const initialProduct = INITIAL_PRODUCTS.find(p => p.productId === productId);
    
    if (!initialProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Reset to initial values
    const result = await Product.findOneAndUpdate(
      { productId },
      {
        $set: {
          pricePerKg: initialProduct.pricePerKg,
          inStock: true,
          isActive: true
        }
      },
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'Product reset to default',
      product: formatProduct(result)
    });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset product'
    });
  }
});

// Debug: Check database connection
router.get('/debug/db', verifyAdminToken, async (req, res) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const connectionState = mongoose.connection.readyState;
    const stateNames = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    
    const productCount = await Product.countDocuments();
    
    res.json({
      success: true,
      database: {
        state: stateNames[connectionState],
        connected: connectionState === 1,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      products: {
        count: productCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// COUPONS MANAGEMENT
// ============================================

// Get all coupons
router.get('/coupons', verifyAdminToken, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      coupons
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupons'
    });
  }
});

// Create coupon
router.post('/coupons', verifyAdminToken, async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      applicableProducts,
      applicableCategories,
      usageLimit,
      usageLimitPerUser,
      validFrom,
      validUntil
    } = req.body;
    
    if (!code || !discountValue || !validUntil) {
      return res.status(400).json({
        success: false,
        message: 'Code, discount value, and expiry date are required'
      });
    }
    
    // Check if code already exists
    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }
    
    const coupon = new Coupon({
      code: code.toUpperCase(),
      description,
      discountType: discountType || 'percentage',
      discountValue,
      minOrderAmount: minOrderAmount || 0,
      maxDiscountAmount: maxDiscountAmount || null,
      applicableProducts: applicableProducts || [],
      applicableCategories: applicableCategories || [],
      usageLimit: usageLimit || null,
      usageLimitPerUser: usageLimitPerUser || 1,
      validFrom: validFrom || new Date(),
      validUntil: new Date(validUntil)
    });
    
    await coupon.save();
    
    res.status(201).json({
      success: true,
      message: 'Coupon created',
      coupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create coupon'
    });
  }
});

// Update coupon
router.put('/coupons/:id', verifyAdminToken, async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Coupon updated',
      coupon
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update coupon'
    });
  }
});

// Delete coupon
router.delete('/coupons/:id', verifyAdminToken, async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Coupon deleted'
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete coupon'
    });
  }
});

// Toggle coupon active status
router.patch('/coupons/:id/toggle', verifyAdminToken, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }
    
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    
    res.json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`,
      coupon
    });
  } catch (error) {
    console.error('Toggle coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle coupon'
    });
  }
});

export default router;
