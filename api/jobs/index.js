const { getOptionalUser, requireAuth } = require('../../lib/authMiddleware');
const { createJobSchema, updateJobSchema } = require('../../lib/validators');
const { listJobs, createJob, updateOwnJob } = require('../../lib/services/jobService');
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
      const currentUser = await getOptionalUser(req);
      const data = await listJobs(req.query || {}, currentUser);
      return sendJson(res, 200, true, data, null);
    }

    if (req.method === 'POST') {
      const user = await requireAuth(req, ['EMPLOYER', 'RECRUITER']);
      enforceBodyLimit(req);
      const parsed = createJobSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(res, 400, false, null, parsed.error.issues[0]?.message || 'Invalid job data');
      }
      const job = await createJob(parsed.data, user, getClientIp(req));
      return sendJson(res, 201, true, { job }, null);
    }

    if (req.method === 'PUT') {
      const user = await requireAuth(req, ['EMPLOYER', 'RECRUITER']);
      enforceBodyLimit(req);
      const parsed = updateJobSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(res, 400, false, null, parsed.error.issues[0]?.message || 'Invalid update');
      }
      const job = await updateOwnJob(parsed.data, user, getClientIp(req));
      return sendJson(res, 200, true, { job }, null);
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    return sendJson(res, 405, false, null, 'Method not allowed');
  } catch (err) {
    return handleError(res, err);
  }
};
