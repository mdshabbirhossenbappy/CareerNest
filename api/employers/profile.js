const BaseRepository = require('../../lib/baseRepository');
const { requireAuth } = require('../../lib/authMiddleware');
const { employerProfileSchema } = require('../../lib/validators');
const { applyCors, enforceBodyLimit, sendJson, handleError } = require('../../lib/security');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const user = await requireAuth(req, ['EMPLOYER', 'RECRUITER']);
    const profileRepo = new BaseRepository('EmployerProfiles');
    const matches = await profileRepo.findWhere({ userId: user.id }, { useCache: false });
    let profile = matches[0];

    if (req.method === 'GET') {
      if (!profile) {
        profile = await profileRepo.create({
          userId: user.id,
          companyName: 'Pending Company',
          website: '',
          industry: '',
          description: '',
          verifiedByAdmin: 'false',
        });
      }
      return sendJson(res, 200, true, { profile }, null);
    }

    if (req.method === 'PUT') {
      enforceBodyLimit(req);
      const parsed = employerProfileSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(res, 400, false, null, parsed.error.issues[0]?.message || 'Invalid input');
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
