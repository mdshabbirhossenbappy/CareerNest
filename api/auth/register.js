const BaseRepository = require('../../lib/baseRepository');
const { batchAppendTabRows } = require('../../lib/sheetsClient');
const { registerSchema } = require('../../lib/validators');
const { hashPassword, getClientIp, sendJson } = require('../../lib/security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, false, null, 'Method not allowed');
  }

  try {
    const parsed = registerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid registration input';
      return sendJson(res, 400, false, null, message);
    }

    const { email, password, role, fullName, companyName } = parsed.data;
    const usersRepo = new BaseRepository('Users');
    const auditRepo = new BaseRepository('AuditLog');

    const [existing, passwordHash] = await Promise.all([
      usersRepo.findWhere({ email }, { useCache: false }),
      hashPassword(password),
    ]);

    if (existing.length > 0) {
      return sendJson(res, 409, false, null, 'Unable to register with the provided email');
    }

    const preparedUser = usersRepo.prepareRecord({
      email,
      passwordHash,
      role,
      status: 'ACTIVE',
      failedLoginCount: '0',
      lockedUntil: '',
    });

    const createdUser = preparedUser.record;
    const batchEntries = [{ tabName: 'Users', values: preparedUser.values }];

    if (role === 'STUDENT') {
      const studentRepo = new BaseRepository('StudentProfiles');
      const preparedProfile = studentRepo.prepareRecord({
        userId: createdUser.id,
        fullName: fullName || email.split('@')[0],
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
      batchEntries.push({ tabName: 'StudentProfiles', values: preparedProfile.values });
    } else if (role === 'EMPLOYER' || role === 'RECRUITER') {
      const employerRepo = new BaseRepository('EmployerProfiles');
      const preparedProfile = employerRepo.prepareRecord({
        userId: createdUser.id,
        companyName: companyName || fullName || 'Pending Company',
        website: '',
        industry: '',
        description: '',
        verifiedByAdmin: 'false',
      });
      batchEntries.push({ tabName: 'EmployerProfiles', values: preparedProfile.values });
    }

    const preparedAudit = auditRepo.prepareRecord({
      actorId: createdUser.id,
      action: 'AUTH_REGISTER',
      entity: 'Users',
      entityId: createdUser.id,
      ip: getClientIp(req),
    });
    batchEntries.push({ tabName: 'AuditLog', values: preparedAudit.values });

    await batchAppendTabRows(batchEntries);

    return sendJson(
      res,
      201,
      true,
      {
        user: {
          id: createdUser.id,
          email: createdUser.email,
          role: createdUser.role,
          status: createdUser.status,
        },
      },
      null
    );
  } catch (err) {
    return sendJson(res, 500, false, null, err.message || 'Registration error');
  }
};
