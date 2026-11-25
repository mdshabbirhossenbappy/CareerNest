const { registerSchema } = require('../../lib/validators');
const { registerUser } = require('../../lib/services/authService');
const {
  applyCors,
  enforceBodyLimit,
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
    const parsed = registerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendJson(
        res,
        400,
        false,
        null,
        parsed.error.issues[0]?.message || 'Invalid registration input'
      );
    }

    const user = await registerUser(parsed.data, getClientIp(req));
    return sendJson(res, 201, true, { user }, null);
  } catch (err) {
    return handleError(res, err);
  }
};
