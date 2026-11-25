const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const BCRYPT_COST = 12;
const COOKIE_NAME = 'careernest_token';
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const MAX_BODY_BYTES = 50 * 1024;
const DEFAULT_JWT_SECRET = 'K8vQ2mX9pL4zR7nT1wB6yH3cF0jD5sA8eG9uN2kM4xP7qL1v';

class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

function signJwt(payload) {
  const secret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  return jwt.sign({ userId: payload.userId, role: payload.role }, secret, {
    expiresIn: '2h',
    algorithm: 'HS256',
  });
}

function verifyJwt(token) {
  const secret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) {
    return cookies;
  }
  cookieHeader.split(';').forEach((pair) => {
    const index = pair.indexOf('=');
    if (index > -1) {
      const key = pair.slice(0, index).trim();
      const val = pair.slice(index + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
}

function buildAuthCookie(token) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'Max-Age=7200',
    'SameSite=Strict',
  ];
  if (isProd) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function buildClearCookie() {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Strict'];
  if (isProd) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return '127.0.0.1';
}

function applyCors(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers.origin;
  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
}

function enforceBodyLimit(req) {
  if (!req.body) {
    return;
  }
  const size = Buffer.byteLength(JSON.stringify(req.body), 'utf8');
  if (size > MAX_BODY_BYTES) {
    throw new AppError(413, 'Request payload too large');
  }
}

function sendJson(res, statusCode, success, data = null, error = null) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(statusCode).json({ success, data, error });
}

function handleError(res, err) {
  if (err && err.isOperational) {
    return sendJson(res, err.statusCode, false, null, err.message);
  }
  if (err && err.message && err.message.includes('Formula injection')) {
    return sendJson(res, 400, false, null, 'Invalid characters detected in input');
  }
  return sendJson(res, 500, false, null, 'Internal server error');
}

module.exports = {
  BCRYPT_COST,
  COOKIE_NAME,
  MAX_FAILED_LOGINS,
  LOCKOUT_DURATION_MS,
  MAX_BODY_BYTES,
  AppError,
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  parseCookies,
  buildAuthCookie,
  buildClearCookie,
  getClientIp,
  applyCors,
  enforceBodyLimit,
  sendJson,
  handleError,
};
