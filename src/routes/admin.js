import express from 'express';
import { adminLogin, verifyAdminToken } from '../middleware/adminAuth.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import ProductOverride from '../models/ProductOverride.js';
import { productCatalog, calculateWeightPrices } from '../config/products.js';

const router = express.Router();

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
    
    const validStatuses = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const order = await Order.findOne({ orderId: req.params.orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    order.addStatusHistory(status, note || '');
    await order.save();
    
    res.json({
      success: true,
      message: 'Order status updated',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
});

// ============================================
// PRODUCTS MANAGEMENT (Overrides)
// ============================================

// Get all products with overrides merged
router.get('/products', verifyAdminToken, async (req, res) => {
  try {
    console.log('\n📋 ===== FETCHING PRODUCTS =====');
    
    // Fetch all overrides from database
    const overrides = await ProductOverride.find();
    console.log(`💾 Found ${overrides.length} product overrides in database`);
    
    const overrideMap = new Map(overrides.map(o => [o.productId, o]));
    
    const products = productCatalog.map(product => {
      const override = overrideMap.get(product.id);
      
      if (override) {
        const pricePerKg = override.pricePerKg || product.pricePerKg;
        console.log(`  ✏️  ${product.name} - Has override (Price: ${pricePerKg}, Stock: ${override.inStock})`);
        return {
          ...product,
          pricePerKg,
          price: Math.floor(pricePerKg * 0.25),
          weightPrices: calculateWeightPrices(pricePerKg),
          inStock: override.inStock !== undefined ? override.inStock : true,
          isActive: override.isActive !== undefined ? override.isActive : true,
          hasOverride: true,
          lastUpdated: override.updatedAt
        };
      }
      
      return {
        ...product,
        inStock: true,
        isActive: true,
        hasOverride: false
      };
    });
    
    console.log(`📦 Returning ${products.length} products total`);
    console.log('================================\n');
    
    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// Update product override
router.put('/products/:productId', verifyAdminToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const { pricePerKg, inStock, isActive } = req.body;
    
    // 🔍 DEBUG: Log incoming request
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       🔄 PRODUCT UPDATE REQUEST                  ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('📦 Product ID:', productId);
    console.log('📝 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('👤 Admin:', req.admin?.mobile || 'Unknown');
    
    // Validate productId
    if (isNaN(productId)) {
      console.log('❌ Invalid product ID');
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }
    
    // Check if product exists in catalog
    const baseProduct = productCatalog.find(p => p.id === productId);
    if (!baseProduct) {
      console.log('❌ Product not found in catalog');
      return res.status(404).json({
        success: false,
        message: 'Product not found in catalog'
      });
    }
    
    console.log('✅ Base product found:', baseProduct.name);
    
    // First, get existing override (if any)
    const existingOverride = await ProductOverride.findOne({ productId });
    console.log('📋 Existing override:', existingOverride ? 'Found' : 'None');
    
    // Build the update - preserve existing values if not provided in request
    const updateFields = {
      productId,
      updatedAt: new Date()
    };
    
    // Handle pricePerKg - use new value, existing value, or null
    if (pricePerKg !== undefined && pricePerKg !== null) {
      updateFields.pricePerKg = parseInt(pricePerKg);
      console.log('💰 Setting price to:', updateFields.pricePerKg);
    } else if (existingOverride?.pricePerKg) {
      updateFields.pricePerKg = existingOverride.pricePerKg;
      console.log('💰 Keeping existing price:', updateFields.pricePerKg);
    }
    
    // Handle inStock - IMPORTANT: false is valid, only skip if undefined
    if (inStock !== undefined) {
      updateFields.inStock = inStock === true || inStock === 'true';
      console.log('📊 Setting stock to:', updateFields.inStock);
    } else if (existingOverride && existingOverride.inStock !== undefined) {
      updateFields.inStock = existingOverride.inStock;
      console.log('📊 Keeping existing stock:', updateFields.inStock);
    } else {
      updateFields.inStock = true; // Default to in stock
      console.log('📊 Defaulting stock to: true');
    }
    
    // Handle isActive
    if (isActive !== undefined) {
      updateFields.isActive = isActive === true || isActive === 'true';
      console.log('🔘 Setting active to:', updateFields.isActive);
    } else if (existingOverride && existingOverride.isActive !== undefined) {
      updateFields.isActive = existingOverride.isActive;
    } else {
      updateFields.isActive = true;
    }
    
    console.log('\n📤 SAVING TO DATABASE:');
    console.log(JSON.stringify(updateFields, null, 2));
    
    // Use updateOne with upsert for reliability
    const updateResult = await ProductOverride.updateOne(
      { productId },
      { $set: updateFields },
      { upsert: true }
    );
    
    console.log('\n📊 MongoDB Update Result:');
    console.log('   - Matched:', updateResult.matchedCount);
    console.log('   - Modified:', updateResult.modifiedCount);
    console.log('   - Upserted:', updateResult.upsertedCount);
    
    // Verify the update by reading it back
    const savedOverride = await ProductOverride.findOne({ productId });
    
    if (!savedOverride) {
      console.log('❌ CRITICAL: Override not found after save!');
      return res.status(500).json({
        success: false,
        message: 'Database update verification failed'
      });
    }
    
    console.log('\n✅ DATABASE VERIFIED:');
    console.log('   _id:', savedOverride._id);
    console.log('   productId:', savedOverride.productId);
    console.log('   pricePerKg:', savedOverride.pricePerKg);
    console.log('   inStock:', savedOverride.inStock);
    console.log('   isActive:', savedOverride.isActive);
    console.log('   updatedAt:', savedOverride.updatedAt);
    
    // Build response with merged product data
    const finalPricePerKg = savedOverride.pricePerKg || baseProduct.pricePerKg;
    const responseProduct = {
      ...baseProduct,
      pricePerKg: finalPricePerKg,
      price: Math.floor(finalPricePerKg * 0.25),
      weightPrices: calculateWeightPrices(finalPricePerKg),
      inStock: savedOverride.inStock,
      isActive: savedOverride.isActive,
      hasOverride: true,
      lastUpdated: savedOverride.updatedAt
    };
    
    console.log('\n📦 RESPONSE PRODUCT:');
    console.log('   Name:', responseProduct.name);
    console.log('   Price/kg:', responseProduct.pricePerKg);
    console.log('   In Stock:', responseProduct.inStock);
    console.log('   Active:', responseProduct.isActive);
    console.log('══════════════════════════════════════════════════\n');
    
    return res.json({
      success: true,
      message: 'Product updated successfully',
      product: responseProduct
    });
    
  } catch (error) {
    console.log('\n❌ ═══════ UPDATE ERROR ═══════');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.log('════════════════════════════════\n');
    
    return res.status(500).json({
      success: false,
      message: 'Failed to update product: ' + error.message
    });
  }
});

// Reset product to base values
router.delete('/products/:productId/override', verifyAdminToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    await ProductOverride.findOneAndDelete({ productId });
    
    const baseProduct = productCatalog.find(p => p.id === productId);
    
    res.json({
      success: true,
      message: 'Product reset to default',
      product: {
        ...baseProduct,
        inStock: true,
        isActive: true,
        hasOverride: false
      }
    });
  } catch (error) {
    console.error('Reset product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset product'
    });
  }
});

// ============================================
// DEBUG: Test database connection and updates
// ============================================

router.get('/debug/db', verifyAdminToken, async (req, res) => {
  try {
    const mongoose = (await import('mongoose')).default;
    
    console.log('\n🔍 ===== DATABASE DEBUG =====');
    
    // Check connection state
    const connectionState = mongoose.connection.readyState;
    const stateNames = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    
    console.log('Connection State:', stateNames[connectionState]);
    console.log('Host:', mongoose.connection.host);
    console.log('Database:', mongoose.connection.name);
    
    // Get all overrides
    const overrides = await ProductOverride.find();
    console.log('Product Overrides Count:', overrides.length);
    
    // Try a test write
    const testResult = await ProductOverride.updateOne(
      { productId: 9999 },
      { $set: { productId: 9999, pricePerKg: 1, inStock: true, updatedAt: new Date() } },
      { upsert: true }
    );
    
    // Read it back
    const testDoc = await ProductOverride.findOne({ productId: 9999 });
    
    // Delete test doc
    await ProductOverride.deleteOne({ productId: 9999 });
    
    console.log('Test Write Result:', testResult);
    console.log('Test Read:', testDoc ? 'Success' : 'Failed');
    console.log('==============================\n');
    
    res.json({
      success: true,
      database: {
        state: stateNames[connectionState],
        connected: connectionState === 1,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      overrides: {
        count: overrides.length,
        data: overrides.map(o => ({
          productId: o.productId,
          pricePerKg: o.pricePerKg,
          inStock: o.inStock,
          updatedAt: o.updatedAt
        }))
      },
      writeTest: {
        matched: testResult.matchedCount,
        modified: testResult.modifiedCount,
        upserted: testResult.upsertedCount,
        readBack: !!testDoc
      }
    });
  } catch (error) {
    console.error('Debug DB Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
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
