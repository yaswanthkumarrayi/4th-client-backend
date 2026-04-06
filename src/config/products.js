// Hardcoded Product Catalog for Backend
// This mirrors the frontend data but without images

export const CATEGORY_BASE_PRICES = {
  snacks: 550,
  sweets: 799,
  vegPickles: 750,
  podis: 1400,
  chickenPickle: 1999,
  prawnPickle: 2499,
  muttonPickle: 2799,
};

export const calculateWeightPrices = (pricePerKg) => ({
  '250gm': Math.floor(pricePerKg * 0.25),
  '500gm': Math.floor(pricePerKg * 0.5),
  '1kg': pricePerKg,
  '2kg': pricePerKg * 2,
});

const STANDARD_WEIGHTS = ['250gm', '500gm', '1kg', '2kg'];

const createProduct = (id, name, category, pricePerKg) => ({
  id,
  name,
  category,
  price: Math.floor(pricePerKg * 0.25),
  pricePerKg,
  weights: STANDARD_WEIGHTS,
  weightPrices: calculateWeightPrices(pricePerKg),
});

// Complete Product Catalog
export const productCatalog = [
  // Veg Pickles
  createProduct(1, 'Mango Avakaya', 'Veg Pickles', CATEGORY_BASE_PRICES.vegPickles),
  createProduct(2, 'Gongura Pickle', 'Veg Pickles', CATEGORY_BASE_PRICES.vegPickles),
  createProduct(10, 'Ginger Pickle', 'Veg Pickles', CATEGORY_BASE_PRICES.vegPickles),
  createProduct(11, 'Lemon Pickle', 'Veg Pickles', CATEGORY_BASE_PRICES.vegPickles),
  createProduct(12, 'Red Chilli Pickle', 'Veg Pickles', CATEGORY_BASE_PRICES.vegPickles),
  createProduct(13, 'Usirikaya Pickle', 'Veg Pickles', CATEGORY_BASE_PRICES.vegPickles),
  
  // Non Veg Pickles
  createProduct(3, 'Chicken Pickle', 'Non Veg Pickles', CATEGORY_BASE_PRICES.chickenPickle),
  createProduct(4, 'Prawns Pickle', 'Non Veg Pickles', CATEGORY_BASE_PRICES.prawnPickle),
  createProduct(14, 'Mutton Boneless Pickle', 'Non Veg Pickles', CATEGORY_BASE_PRICES.muttonPickle),
  
  // Podis
  createProduct(7, 'Kandi Podi', 'Podis', CATEGORY_BASE_PRICES.podis),
  createProduct(8, 'Karvepaku Podi', 'Podis', CATEGORY_BASE_PRICES.podis),
  createProduct(9, 'Kobbari Podi', 'Podis', CATEGORY_BASE_PRICES.podis),
  
  // Snacks
  createProduct(101, 'Mixture', 'Snacks', CATEGORY_BASE_PRICES.snacks),
  createProduct(102, 'Murukulu', 'Snacks', CATEGORY_BASE_PRICES.snacks),
  createProduct(103, 'Ribbon Pakodi', 'Snacks', CATEGORY_BASE_PRICES.snacks),
  
  // Sweets
  createProduct(201, 'Ariselu', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(202, 'Bandharu Laddu', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(203, 'Boondhi Achu', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(204, 'Boondhi Laddu', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(205, 'Boorelu', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(206, 'Cashew Achu', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(207, 'Kajji Kayalu', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(208, 'Mysore Pak', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(209, 'Nuvvundalu', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(210, 'Palli Undalu', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(211, 'Sanna Boondhi Laddu', 'Sweets', CATEGORY_BASE_PRICES.sweets),
  createProduct(212, 'Sunnunda', 'Sweets', CATEGORY_BASE_PRICES.sweets),
];

// Get product by ID
export const getProductById = (id) => {
  return productCatalog.find(p => p.id === parseInt(id));
};

// Get all products
export const getAllProducts = () => {
  return productCatalog;
};

// Get products by category
export const getProductsByCategory = (category) => {
  return productCatalog.filter(p => p.category === category);
};

export default productCatalog;
