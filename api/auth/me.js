const { getOptionalUser } = require('../../lib/authMiddleware');
const { applyCors, sendJson } = require('../../lib/security');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, false, null, 'Method not allowed');
  }

  const user = await getOptionalUser(req);
  if (!user) {
    return sendJson(res, 401, false, null, 'Not authenticated');
  }
  return sendJson(res, 200, true, { user }, null);
};
