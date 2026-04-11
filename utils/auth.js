/**
 * auth.js — Security Middleware
 * 
 * Validates the X-API-Key header to protect sensitive routes.
 */

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

const API_KEY = process.env.BOARDROOM_API_KEY;

/**
 * Middleware to protect routes with an API key
 */
export function requireAuth(req, res, next) {
  // Always skip auth in local/test if desired, but for this audit we enforce it.
  const providedKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!API_KEY) {
    console.warn('[Security] WARNING: BOARDROOM_API_KEY is not set in .env. API is currently unprotected.');
    return next();
  }

  if (providedKey !== API_KEY) {
    console.warn(`[Security] Unauthorized access attempt from ${req.ip}`);
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'A valid X-API-Key header is required to access this endpoint.' 
    });
  }

  next();
}

export default { requireAuth };
