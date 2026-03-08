// ============================================================
// Rate Limiting Middleware — CommEazy API Gateway
//
// 60 requests per minute per IP (configurable via env).
// Protects against brute-force attacks on invitation codes
// and general API abuse.
// ============================================================

const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const max = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);

const apiRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMITED',
    message: `Too many requests. Maximum ${max} requests per ${windowMs / 1000} seconds.`,
  },
});

module.exports = { apiRateLimiter };
