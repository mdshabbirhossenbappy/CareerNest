const { applyCors, sendJson } = require('../lib/security');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, false, null, 'Method not allowed');
  }
  return sendJson(res, 200, true, { status: 'ok', service: 'CareerNest' }, null);
};
