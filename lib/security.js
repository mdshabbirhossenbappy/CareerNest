const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const BCRYPT_COST = 12;
const COOKIE_NAME = 'careernest_token';
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

function signJwt(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable');
  }
  return jwt.sign({ userId: payload.userId, role: payload.role }, secret, {
    expiresIn: '2h',
    algorithm: 'HS256',
  });
}

function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable');
  }
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

function sendJson(res, statusCode, success, data = null, error = null) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(statusCode).json({ success, data, error });
}

module.exports = {
  BCRYPT_COST,
  COOKIE_NAME,
  MAX_FAILED_LOGINS,
  LOCKOUT_DURATION_MS,
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  parseCookies,
  buildAuthCookie,
  buildClearCookie,
  getClientIp,
  sendJson,
};
