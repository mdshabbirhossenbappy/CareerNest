const { buildClearCookie, sendJson } = require('../../lib/security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, false, null, 'Method not allowed');
  }

  res.setHeader('Set-Cookie', buildClearCookie());
  return sendJson(res, 200, true, { message: 'Logged out successfully' }, null);
};
