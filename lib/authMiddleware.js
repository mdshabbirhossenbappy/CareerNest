const BaseRepository = require('./baseRepository');
const { COOKIE_NAME, AppError, parseCookies, verifyJwt } = require('./security');

async function getOptionalUser(req) {
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[COOKIE_NAME];
    if (!token) {
      return null;
    }
    const decoded = verifyJwt(token);
    const usersRepo = new BaseRepository('Users');
    const user = await usersRepo.findById(decoded.userId, { useCache: true });
    if (!user || user.status !== 'ACTIVE') {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  } catch {
    return null;
  }
}

async function requireAuth(req, allowedRoles = []) {
  const user = await getOptionalUser(req);
  if (!user) {
    throw new AppError(401, 'Authentication required');
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw new AppError(403, 'Insufficient permissions for this resource');
  }
  return user;
}

module.exports = {
  getOptionalUser,
  requireAuth,
};
