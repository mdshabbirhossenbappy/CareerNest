const BaseRepository = require('../../lib/baseRepository');
const { requireAuth } = require('../../lib/authMiddleware');
const { studentProfileSchema, savedJobSchema } = require('../../lib/validators');
const { applyCors, enforceBodyLimit, sendJson, handleError } = require('../../lib/security');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const user = await requireAuth(req, ['STUDENT']);
    const resource = req.query?.resource || 'profile';

    if (resource === 'saved') {
      const savedRepo = new BaseRepository('SavedJobs');
      if (req.method === 'GET') {
        const [saved, allJobs] = await Promise.all([
          savedRepo.findWhere({ studentId: user.id }, { useCache: false }),
          new BaseRepository('Jobs').findAll(false, { useCache: true }),
        ]);
        const jobMap = new Map(allJobs.map((j) => [j.id, j]));
        const items = saved
          .map((s) => ({ savedId: s.id, job: jobMap.get(s.jobId) }))
          .filter((item) => item.job && item.job.status === 'APPROVED');
        return sendJson(res, 200, true, { savedJobs: items }, null);
      }

      if (req.method === 'POST') {
        enforceBodyLimit(req);
        const parsed = savedJobSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return sendJson(res, 400, false, null, 'Valid jobId is required');
        }
        const existing = await savedRepo.findWhere(
          { studentId: user.id, jobId: parsed.data.jobId },
          { useCache: false }
        );
        if (existing.length > 0) {
          return sendJson(res, 200, true, { saved: existing[0] }, null);
        }
        const saved = await savedRepo.create({
          studentId: user.id,
          jobId: parsed.data.jobId,
        });
        return sendJson(res, 201, true, { saved }, null);
      }

      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, false, null, 'Method not allowed');
    }

    const profileRepo = new BaseRepository('StudentProfiles');
    const matches = await profileRepo.findWhere({ userId: user.id }, { useCache: false });
    let profile = matches[0];

    if (req.method === 'GET') {
      if (!profile) {
        profile = await profileRepo.create({
          userId: user.id,
          fullName: user.email.split('@')[0],
          studentIdNo: '',
          departmentId: '',
          cgpa: '',
          skills: '',
          education: '',
          projects: '',
          cvUrl: '',
          graduationYear: '',
          verifiedByAdmin: 'false',
        });
      }
      return sendJson(res, 200, true, { profile }, null);
    }

    if (req.method === 'PUT') {
      enforceBodyLimit(req);
      const parsed = studentProfileSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(res, 400, false, null, parsed.error.issues[0]?.message || 'Invalid profile');
      }
      if (!profile) {
        profile = await profileRepo.create({
          userId: user.id,
          ...parsed.data,
          verifiedByAdmin: 'false',
        });
      } else {
        profile = await profileRepo.update(profile.id, parsed.data);
      }
      return sendJson(res, 200, true, { profile }, null);
    }

    res.setHeader('Allow', 'GET, PUT');
    return sendJson(res, 405, false, null, 'Method not allowed');
  } catch (err) {
    return handleError(res, err);
  }
};
