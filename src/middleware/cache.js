import NodeCache from 'node-cache';

const responseCache = new NodeCache({
  stdTTL: 120,
  checkperiod: 60,
  useClones: false,
});

const buildCacheKey = (req, keyPrefix) => `${keyPrefix}:${req.originalUrl}`;

export const createResponseCacheMiddleware = ({
  keyPrefix = 'response',
  ttlSeconds = 120,
  skipCache,
} = {}) => (req, res, next) => {
  if (req.method !== 'GET' || (typeof skipCache === 'function' && skipCache(req))) {
    return next();
  }

  const cacheKey = buildCacheKey(req, keyPrefix);
  const cachedResponse = responseCache.get(cacheKey);

  if (cachedResponse) {
    res.set('X-Cache', 'HIT');
    return res.status(200).json(cachedResponse);
  }

  res.set('X-Cache', 'MISS');
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      responseCache.set(cacheKey, payload, ttlSeconds);
    }
    return originalJson(payload);
  };

  return next();
};

export const clearResponseCacheByPrefix = (prefix = '') => {
  const keys = responseCache.keys();
  const keysToDelete = prefix ? keys.filter((key) => key.startsWith(prefix)) : keys;
  if (keysToDelete.length > 0) {
    responseCache.del(keysToDelete);
  }
  return keysToDelete.length;
};

export const clearAllResponseCache = () => {
  responseCache.flushAll();
};

