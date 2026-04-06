import mongoose from 'mongoose';

// Store price and stock overrides for hardcoded products
const productOverrideSchema = new mongoose.Schema({
  productId: {
    type: Number,
    required: true,
    unique: true
  },
  pricePerKg: {
    type: Number,
    default: null // null means use base price
  },
  inStock: {
    type: Boolean,
    default: true
  },
  stockQuantity: {
    type: Number,
    default: null // null means unlimited
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

productOverrideSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const ProductOverride = mongoose.model('ProductOverride', productOverrideSchema);

export default ProductOverride;
