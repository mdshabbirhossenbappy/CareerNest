const { loginSchema } = require('../../lib/validators');
const { loginUser } = require('../../lib/services/authService');
const {
  applyCors,
  enforceBodyLimit,
  buildAuthCookie,
  getClientIp,
  sendJson,
  handleError,
} = require('../../lib/security');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, false, null, 'Method not allowed');
  }

  try {
    enforceBodyLimit(req);
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendJson(res, 400, false, null, 'Invalid email or password format');
    }

    const { token, user } = await loginUser(parsed.data, getClientIp(req));
    res.setHeader('Set-Cookie', buildAuthCookie(token));
    return sendJson(res, 200, true, { user }, null);
  } catch (err) {
    return handleError(res, err);
  }
};
