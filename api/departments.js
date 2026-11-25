const BaseRepository = require('../lib/baseRepository');
const { requireAuth } = require('../lib/authMiddleware');
const { departmentSchema } = require('../lib/validators');
const {
  applyCors,
  enforceBodyLimit,
  getClientIp,
  sendJson,
  handleError,
} = require('../lib/security');

const DEFAULT_DEPARTMENTS = [
  { name: 'Computer Science & Engineering', code: 'CSE' },
  { name: 'Electrical & Electronic Engineering', code: 'EEE' },
  { name: 'Business Administration', code: 'BBA' },
  { name: 'Textile Engineering', code: 'TE' },
];

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const repo = new BaseRepository('Departments');

    if (req.method === 'GET') {
      let departments = await repo.findAll(false, { useCache: true });
      if (departments.length === 0) {
        const created = [];
        for (const dept of DEFAULT_DEPARTMENTS) {
          created.push(await repo.create(dept));
        }
        departments = created;
      }
      return sendJson(res, 200, true, { departments }, null);
    }

    if (req.method === 'POST') {
      const admin = await requireAuth(req, ['UNIVERSITY_ADMIN']);
      enforceBodyLimit(req);
      const parsed = departmentSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(res, 400, false, null, parsed.error.issues[0]?.message || 'Invalid input');
      }
      const existing = await repo.findWhere({ code: parsed.data.code }, { useCache: false });
      if (existing.length > 0) {
        return sendJson(res, 409, false, null, 'Department code already exists');
      }
      const created = await repo.create(parsed.data);
      const auditRepo = new BaseRepository('AuditLog');
      await auditRepo.create({
        actorId: admin.id,
        action: 'DEPARTMENT_CREATED',
        entity: 'Departments',
        entityId: created.id,
        ip: getClientIp(req),
      });
      return sendJson(res, 201, true, { department: created }, null);
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, false, null, 'Method not allowed');
  } catch (err) {
    return handleError(res, err);
  }
};
