/**
 * rate_limiter.js — In-Memory Rate Limiting middleware
 * 
 * Protects APIs from abuse without requiring external dependencies like Redis.
 * Note: Resets on server restart.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // max requests per window

const clients = new Map();

/**
 * Cleanup expired entries every 5 minutes
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of clients.entries()) {
    if (now > data.resetAt) {
      clients.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter middleware
 */
export function rateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();

  if (!clients.has(ip)) {
    clients.set(ip, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return next();
  }

  const data = clients.get(ip);

  // Reset if window has passed
  if (now > data.resetAt) {
    data.count = 1;
    data.resetAt = now + WINDOW_MS;
    return next();
  }

  data.count++;

  if (data.count > MAX_REQUESTS) {
    console.warn(`[Security] Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the request limit. Please try again in 15 minutes.'
    });
  }

  next();
}

export default { rateLimiter };
