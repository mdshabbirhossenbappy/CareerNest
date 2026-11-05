const BaseRepository = require('../../lib/baseRepository');
const { ensureAllTabs } = require('../../lib/sheetsClient');
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

    await ensureAllTabs();
    const usersRepo = new BaseRepository('Users');
    const auditRepo = new BaseRepository('AuditLog');

    const existing = await usersRepo.findWhere({ email });
    if (existing.length > 0) {
      return sendJson(res, 409, false, null, 'Unable to register with the provided email');
    }

    const passwordHash = await hashPassword(password);
    const createdUser = await usersRepo.create({
      email,
      passwordHash,
      role,
      status: 'ACTIVE',
      failedLoginCount: '0',
      lockedUntil: '',
    });

    if (role === 'STUDENT') {
      const studentRepo = new BaseRepository('StudentProfiles');
      await studentRepo.create({
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
    } else if (role === 'EMPLOYER' || role === 'RECRUITER') {
      const employerRepo = new BaseRepository('EmployerProfiles');
      await employerRepo.create({
        userId: createdUser.id,
        companyName: companyName || fullName || 'Pending Company',
        website: '',
        industry: '',
        description: '',
        verifiedByAdmin: 'false',
      });
    }

    await auditRepo.create({
      actorId: createdUser.id,
      action: 'AUTH_REGISTER',
      entity: 'Users',
      entityId: createdUser.id,
      ip: getClientIp(req),
    });

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
    return sendJson(res, 500, false, null, 'Registration service error. Check Sheet bridge setup.');
  }
};
