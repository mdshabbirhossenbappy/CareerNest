const { requireAuth } = require('../../lib/authMiddleware');
const { adminActionSchema } = require('../../lib/validators');
const { getAdminOverview, performAdminAction } = require('../../lib/services/adminService');
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

  try {
    const admin = await requireAuth(req, ['UNIVERSITY_ADMIN']);

    if (req.method === 'GET') {
      const overview = await getAdminOverview();
      return sendJson(res, 200, true, overview, null);
    }

    if (req.method === 'PATCH') {
      enforceBodyLimit(req);
      const parsed = adminActionSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(res, 400, false, null, parsed.error.issues[0]?.message || 'Invalid action');
      }
      const result = await performAdminAction(parsed.data, admin, getClientIp(req));
      return sendJson(res, 200, true, { updated: result }, null);
    }

    res.setHeader('Allow', 'GET, PATCH');
    return sendJson(res, 405, false, null, 'Method not allowed');
  } catch (err) {
    return handleError(res, err);
  }
};
