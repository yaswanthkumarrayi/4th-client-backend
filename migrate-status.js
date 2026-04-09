/**
 * Database Migration Script
 * Fixes "shipped" status issue by removing Mongoose schema cache
 * and updating any existing orders with "shipped" to "out_for_delivery"
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const runMigration = async () => {
  try {
    console.log('🔄 Starting migration...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get the orders collection directly (bypass model validation)
    const db = mongoose.connection.db;
    const ordersCollection = db.collection('orders');
    
    // Step 1: Find orders with "shipped" status
    console.log('📋 Checking for orders with "shipped" status...');
    const shippedOrders = await ordersCollection.find({ orderStatus: 'shipped' }).toArray();
    
    if (shippedOrders.length > 0) {
      console.log(`   Found ${shippedOrders.length} orders with "shipped" status`);
      
      // Update all "shipped" to "out_for_delivery"
      const result = await ordersCollection.updateMany(
        { orderStatus: 'shipped' },
        { $set: { orderStatus: 'out_for_delivery' } }
      );
      
      console.log(`   ✅ Updated ${result.modifiedCount} orders from "shipped" to "out_for_delivery"\n`);
    } else {
      console.log('   ✅ No orders with "shipped" status found\n');
    }
    
    // Step 2: Check status history entries
    console.log('📋 Checking status history...');
    const ordersWithShippedHistory = await ordersCollection.find({
      'statusHistory.status': 'shipped'
    }).toArray();
    
    if (ordersWithShippedHistory.length > 0) {
      console.log(`   Found ${ordersWithShippedHistory.length} orders with "shipped" in history`);
      
      // Update status history
      for (const order of ordersWithShippedHistory) {
        const updatedHistory = order.statusHistory.map(entry => ({
          ...entry,
          status: entry.status === 'shipped' ? 'out_for_delivery' : entry.status
        }));
        
        await ordersCollection.updateOne(
          { _id: order._id },
          { $set: { statusHistory: updatedHistory } }
        );
      }
      
      console.log(`   ✅ Updated status history for ${ordersWithShippedHistory.length} orders\n`);
    } else {
      console.log('   ✅ No "shipped" entries in status history\n');
    }
    
    // Step 3: Drop and recreate indexes if needed
    console.log('📋 Refreshing indexes...');
    try {
      await ordersCollection.dropIndexes();
      console.log('   ✅ Dropped old indexes\n');
    } catch (err) {
      console.log('   ℹ️ No indexes to drop\n');
    }
    
    // Step 4: Clear Mongoose model cache
    console.log('📋 Clearing Mongoose cache...');
    delete mongoose.models.Order;
    delete mongoose.modelSchemas.Order;
    console.log('   ✅ Mongoose cache cleared\n');
    
    console.log('🎉 Migration completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('   1. Restart the backend server');
    console.log('   2. Test status update in admin panel');
    console.log('   3. Should now accept: processing, out_for_delivery, delivered\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

runMigration();
