const BaseRepository = require('../../lib/baseRepository');
const { loginSchema } = require('../../lib/validators');
const {
  MAX_FAILED_LOGINS,
  LOCKOUT_DURATION_MS,
  hashPassword,
  verifyPassword,
  signJwt,
  buildAuthCookie,
  getClientIp,
  sendJson,
} = require('../../lib/security');

const DUMMY_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, false, null, 'Method not allowed');
  }

  try {
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendJson(res, 400, false, null, 'Invalid email or password format');
    }

    const { email, password } = parsed.data;
    const usersRepo = new BaseRepository('Users');
    const auditRepo = new BaseRepository('AuditLog');

    let matchingUsers = await usersRepo.findWhere({ email }, { useCache: false });

    const seedEmail = (process.env.ADMIN_SEED_EMAIL || 'shbappy564@gmail.com')
      .trim()
      .toLowerCase();
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
      return sendJson(res, 401, false, null, 'Invalid email or password');
    }

    if (user.lockedUntil) {
      const lockExpiry = new Date(user.lockedUntil).getTime();
      if (!Number.isNaN(lockExpiry) && lockExpiry > Date.now()) {
        return sendJson(res, 423, false, null, 'Account is temporarily locked. Try again later.');
      }
    }

    if (user.status !== 'ACTIVE') {
      return sendJson(res, 403, false, null, 'Account is not active');
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
          ip: getClientIp(req),
        }),
      ]);

      return sendJson(res, 401, false, null, 'Invalid email or password');
    }

    const token = signJwt({ userId: user.id, role: user.role });
    res.setHeader('Set-Cookie', buildAuthCookie(token));

    const postLoginOps = [
      auditRepo.create({
        actorId: user.id,
        action: 'AUTH_LOGIN_SUCCESS',
        entity: 'Users',
        entityId: user.id,
        ip: getClientIp(req),
      }),
    ];

    if (user.failedLoginCount !== '0' || user.lockedUntil !== '') {
      postLoginOps.push(
        usersRepo.update(user.id, {
          failedLoginCount: '0',
          lockedUntil: '',
        })
      );
    }

    await Promise.all(postLoginOps);

    return sendJson(
      res,
      200,
      true,
      {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
      null
    );
  } catch (err) {
    return sendJson(res, 500, false, null, err.message || 'Authentication service unavailable');
  }
};
