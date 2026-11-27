const BaseRepository = require('../lib/baseRepository');
const { updateTabRow, invalidateCache } = require('../lib/sheetsClient');
const { requireAuth } = require('../lib/authMiddleware');
const { departmentSchema } = require('../lib/validators');
const {
  applyCors,
  enforceBodyLimit,
  getClientIp,
  sendJson,
  handleError,
} = require('../lib/security');

const ISU_DEPARTMENTS = [
  { name: 'Department of Computer Science & Engineering', code: 'CSE' },
  { name: 'Department of Business Administration', code: 'BBA' },
  { name: 'Department of Textile Engineering', code: 'TEXTILE' },
  { name: 'Department of English', code: 'ENGLISH' },
  { name: 'Department of Law', code: 'LAW' },
  { name: 'Department of Apparel Merchandising & Management', code: 'AMM' },
  { name: 'Department of AI & Data Science', code: 'AI&DS' },
  { name: 'Master of Arts in English (MA in English)', code: 'MA-ENGLISH' },
  { name: 'Master of Business Administration (MBA)', code: 'MBA' },
];

const CODE_ORDER = new Map(ISU_DEPARTMENTS.map((d, idx) => [d.code, idx]));

function sortDepartments(list) {
  return [...list].sort((a, b) => {
    const idxA = CODE_ORDER.has(a.code) ? CODE_ORDER.get(a.code) : 999;
    const idxB = CODE_ORDER.has(b.code) ? CODE_ORDER.get(b.code) : 999;
    return idxA - idxB;
  });
}

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
        for (const dept of ISU_DEPARTMENTS) {
          created.push(await repo.create(dept));
        }
        departments = created;
      } else {
        const hasLegacy = departments.some((d) => d.code === 'EEE' || d.code === 'TE');
        const missingDefaults = ISU_DEPARTMENTS.filter(
          (isu) => !departments.some((d) => d.code === isu.code)
        );

        if (hasLegacy || missingDefaults.length > 0) {
          const legacyPool = departments.filter((d) => d.code === 'EEE' || d.code === 'TE');

          for (const isu of ISU_DEPARTMENTS) {
            const existing = departments.find((d) => d.code === isu.code);
            if (existing) {
              if (existing.name !== isu.name) {
                await updateTabRow('Departments', existing._rowNumber, [
                  existing.id,
                  isu.name,
                  isu.code,
                ]);
              }
            } else if (legacyPool.length > 0) {
              const slot = legacyPool.shift();
              await updateTabRow('Departments', slot._rowNumber, [slot.id, isu.name, isu.code]);
            } else {
              await repo.create(isu);
            }
          }

          invalidateCache('Departments');
          departments = await repo.findAll(false, { useCache: false });
        }
      }

      return sendJson(res, 200, true, { departments: sortDepartments(departments) }, null);
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
