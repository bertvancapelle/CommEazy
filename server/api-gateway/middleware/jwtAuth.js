// ============================================================
// JWT Authentication Middleware — CommEazy API Gateway
//
// Validates JWT access tokens on every request.
// Tokens are issued after successful App Attest / Play Integrity.
//
// Token structure:
//   sub:          user UUID
//   iss:          "commeazy-gateway"
//   platform:     "ios" | "android"
//   app_version:  semver string
//   device_id:    hashed device identifier
// ============================================================

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Express middleware that validates Bearer JWT tokens.
 * Attaches decoded token to req.user on success.
 */
function jwtAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'MISSING_TOKEN',
      message: 'Authorization header with Bearer token required',
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'commeazy-gateway',
      algorithms: ['HS256'],
    });

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'Token has expired, use refresh token to obtain a new one',
      });
    }

    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Token validation failed',
    });
  }
}

/**
 * Generate an access token for a verified device.
 */
function generateAccessToken(payload) {
  return jwt.sign(
    {
      sub: payload.userUuid,
      platform: payload.platform,
      app_version: payload.appVersion,
      device_id: payload.deviceId,
    },
    JWT_SECRET,
    {
      issuer: 'commeazy-gateway',
      expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRY || '24h',
      algorithm: 'HS256',
    },
  );
}

/**
 * Generate a refresh token (longer-lived).
 */
function generateRefreshToken(payload) {
  return jwt.sign(
    {
      sub: payload.userUuid,
      type: 'refresh',
      device_id: payload.deviceId,
    },
    JWT_SECRET,
    {
      issuer: 'commeazy-gateway',
      expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRY || '30d',
      algorithm: 'HS256',
    },
  );
}

module.exports = { jwtAuth, generateAccessToken, generateRefreshToken };
