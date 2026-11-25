const BaseRepository = require('../baseRepository');
const { createIfUnique } = require('../sheetsClient');
const {
  MAX_FAILED_LOGINS,
  LOCKOUT_DURATION_MS,
  AppError,
  hashPassword,
  verifyPassword,
  signJwt,
} = require('../security');

const DUMMY_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

async function registerUser(input, clientIp) {
  const { email, password, role, fullName, companyName, departmentId } = input;
  const usersRepo = new BaseRepository('Users');
  const auditRepo = new BaseRepository('AuditLog');

  const passwordHash = await hashPassword(password);

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
      departmentId: departmentId || '',
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
    ip: clientIp,
  });
  batchEntries.push({ tabName: 'AuditLog', values: preparedAudit.values });

  try {
    await createIfUnique('Users', 1, email, batchEntries);
  } catch (err) {
    if (err.message && err.message.includes('DUPLICATE_RECORD')) {
      throw new AppError(409, 'Unable to register with the provided email');
    }
    throw err;
  }

  return {
    id: createdUser.id,
    email: createdUser.email,
    role: createdUser.role,
    status: createdUser.status,
  };
}

async function loginUser(input, clientIp) {
  const { email, password } = input;
  const usersRepo = new BaseRepository('Users');
  const auditRepo = new BaseRepository('AuditLog');

  let matchingUsers = await usersRepo.findWhere({ email }, { useCache: false });

  const seedEmail = (process.env.ADMIN_SEED_EMAIL || 'shbappy564@gmail.com').trim().toLowerCase();
  const seedPassword = process.env.ADMIN_SEED_PASSWORD || 'SH-Bappy_CareerNest1';

  if (matchingUsers.length === 0 && email === seedEmail) {
    const seedHash = await hashPassword(seedPassword);
    const seededAdmin = await usersRepo.create({
      email: seedEmail,
      passwordHash: seedHash,
      role: 'UNIVERSITY_ADMIN',
      status: 'ACTIVE',
      failedLoginCount: '0',
      lockedUntil: '',
    });
    matchingUsers = [seededAdmin];
  }

  const user = matchingUsers[0] || null;
  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    throw new AppError(401, 'Invalid email or password');
  }

  if (user.lockedUntil) {
    const lockExpiry = new Date(user.lockedUntil).getTime();
    if (!Number.isNaN(lockExpiry) && lockExpiry > Date.now()) {
      throw new AppError(423, 'Account is temporarily locked. Please try again in 15 minutes.');
    }
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(403, 'Account is not active');
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    const nextCount = Number(user.failedLoginCount || '0') + 1;
    const shouldLock = nextCount >= MAX_FAILED_LOGINS;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
      : '';

    await Promise.all([
      usersRepo.update(user.id, {
        failedLoginCount: String(nextCount),
        lockedUntil,
      }),
      auditRepo.create({
        actorId: user.id,
        action: shouldLock ? 'AUTH_LOCKOUT' : 'AUTH_LOGIN_FAILURE',
        entity: 'Users',
        entityId: user.id,
        ip: clientIp,
      }),
    ]);

    throw new AppError(401, 'Invalid email or password');
  }

  const token = signJwt({ userId: user.id, role: user.role });

  const postOps = [
    auditRepo.create({
      actorId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entity: 'Users',
      entityId: user.id,
      ip: clientIp,
    }),
  ];

  if (user.failedLoginCount !== '0' || user.lockedUntil !== '') {
    postOps.push(
      usersRepo.update(user.id, {
        failedLoginCount: '0',
        lockedUntil: '',
      })
    );
  }

  await Promise.all(postOps);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  };
}

module.exports = {
  registerUser,
  loginUser,
};
