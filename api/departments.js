const BaseRepository = require('../lib/baseRepository');
const { updateTabRow, createIfUnique, invalidateCache } = require('../lib/sheetsClient');
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
  { name: 'Master of Arts in English', code: 'MA-ENGLISH' },
  { name: 'Master of Business Administration', code: 'MBA' },
];

const CODE_ORDER = new Map(ISU_DEPARTMENTS.map((d, idx) => [d.code, idx]));

function sortAndDedupeDepartments(list) {
  const seen = new Set();
  const unique = [];
  for (const item of list) {
    const key = String(item.code || '').toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique.sort((a, b) => {
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

      const seenCodes = new Set();
      const duplicates = [];
      for (const dept of departments) {
        const codeKey = String(dept.code || '').toUpperCase();
        if (seenCodes.has(codeKey)) {
          duplicates.push(dept);
        } else {
          seenCodes.add(codeKey);
        }
      }

      const hasLegacy = departments.some((d) => d.code === 'EEE' || d.code === 'TE');
      const missingDefaults = ISU_DEPARTMENTS.filter(
        (isu) => !departments.some((d) => d.code === isu.code)
      );
      const needsNameFix = ISU_DEPARTMENTS.some((isu) => {
        const match = departments.find((d) => d.code === isu.code);
        return match && match.name !== isu.name;
      });

      if (duplicates.length > 0 || hasLegacy || missingDefaults.length > 0 || needsNameFix) {
        for (const dup of duplicates) {
          await repo.softDelete(dup.id);
        }

        const fresh = await repo.findAll(false, { useCache: false });
        const legacyPool = fresh.filter((d) => d.code === 'EEE' || d.code === 'TE');

        for (const isu of ISU_DEPARTMENTS) {
          const existing = fresh.find((d) => d.code === isu.code);
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
            const prepared = repo.prepareRecord(isu);
            try {
              await createIfUnique('Departments', 2, isu.code, [
                { tabName: 'Departments', values: prepared.values },
              ]);
            } catch (err) {
              if (!err.message || !err.message.includes('DUPLICATE_RECORD')) {
                throw err;
              }
            }
          }
        }

        invalidateCache('Departments');
        departments = await repo.findAll(false, { useCache: false });
      }

      return sendJson(res, 200, true, { departments: sortAndDedupeDepartments(departments) }, null);
    }

    if (req.method === 'POST') {
      const admin = await requireAuth(req, ['UNIVERSITY_ADMIN']);
      enforceBodyLimit(req);
      const parsed = departmentSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(res, 400, false, null, parsed.error.issues[0]?.message || 'Invalid input');
      }
      const prepared = repo.prepareRecord(parsed.data);
      try {
        await createIfUnique('Departments', 2, parsed.data.code, [
          { tabName: 'Departments', values: prepared.values },
        ]);
      } catch (err) {
        if (err.message && err.message.includes('DUPLICATE_RECORD')) {
          return sendJson(res, 409, false, null, 'Department code already exists');
        }
        throw err;
      }
      const auditRepo = new BaseRepository('AuditLog');
      await auditRepo.create({
        actorId: admin.id,
        action: 'DEPARTMENT_CREATED',
        entity: 'Departments',
        entityId: prepared.record.id,
        ip: getClientIp(req),
      });
      return sendJson(res, 201, true, { department: prepared.record }, null);
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, false, null, 'Method not allowed');
  } catch (err) {
    return handleError(res, err);
  }
};
