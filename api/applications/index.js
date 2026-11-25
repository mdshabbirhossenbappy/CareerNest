const { requireAuth } = require('../../lib/authMiddleware');
const { applyJobSchema, transitionApplicationSchema } = require('../../lib/validators');
const {
  applyToJob,
  listApplicationsForUser,
  transitionApplication,
} = require('../../lib/services/applicationService');
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
    if (req.method === 'GET') {
      const user = await requireAuth(req, ['STUDENT', 'EMPLOYER', 'RECRUITER', 'UNIVERSITY_ADMIN']);
      const applications = await listApplicationsForUser(user, req.query || {});
      return sendJson(res, 200, true, { applications }, null);
    }

    if (req.method === 'POST') {
      const user = await requireAuth(req, ['STUDENT']);
      enforceBodyLimit(req);
      const parsed = applyJobSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(
          res,
          400,
          false,
          null,
          parsed.error.issues[0]?.message || 'Invalid application'
        );
      }
      const application = await applyToJob(parsed.data, user, getClientIp(req));
      return sendJson(res, 201, true, { application }, null);
    }

    if (req.method === 'PATCH') {
      const user = await requireAuth(req, ['STUDENT', 'EMPLOYER', 'RECRUITER']);
      enforceBodyLimit(req);
      const parsed = transitionApplicationSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(
          res,
          400,
          false,
          null,
          parsed.error.issues[0]?.message || 'Invalid status update'
        );
      }
      const application = await transitionApplication(parsed.data, user, getClientIp(req));
      return sendJson(res, 200, true, { application }, null);
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return sendJson(res, 405, false, null, 'Method not allowed');
  } catch (err) {
    return handleError(res, err);
  }
};
