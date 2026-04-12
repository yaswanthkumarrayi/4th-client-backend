import { Router } from 'express';
import {
  getBestSellers,
  getProductById,
  getProducts,
  getYouMayAlsoLike,
  searchProducts,
} from '../controllers/productController.js';
import { createResponseCacheMiddleware } from '../middleware/cache.js';

const router = Router();

router.get(
  '/best-sellers',
  createResponseCacheMiddleware({ keyPrefix: 'products:best-sellers', ttlSeconds: 120 }),
  getBestSellers
);

router.get(
  '/you-may-also-like',
  createResponseCacheMiddleware({ keyPrefix: 'products:you-may-also-like', ttlSeconds: 120 }),
  getYouMayAlsoLike
);

router.get(
  '/search',
  createResponseCacheMiddleware({ keyPrefix: 'products:search', ttlSeconds: 45 }),
  searchProducts
);

router.get(
  '/',
  createResponseCacheMiddleware({ keyPrefix: 'products:list', ttlSeconds: 90 }),
  getProducts
);

router.get(
  '/:productId',
  createResponseCacheMiddleware({ keyPrefix: 'products:detail', ttlSeconds: 180 }),
  getProductById
);

export default router;

