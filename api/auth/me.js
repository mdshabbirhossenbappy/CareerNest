const BaseRepository = require('../../lib/baseRepository');
const { COOKIE_NAME, parseCookies, verifyJwt, sendJson } = require('../../lib/security');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, false, null, 'Method not allowed');
  }

  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[COOKIE_NAME];

    if (!token) {
      return sendJson(res, 401, false, null, 'Not authenticated');
    }

    const decoded = verifyJwt(token);
    const usersRepo = new BaseRepository('Users');
    const user = await usersRepo.findById(decoded.userId);

    if (!user || user.status !== 'ACTIVE') {
      return sendJson(res, 401, false, null, 'Session invalid or expired');
    }

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
    return sendJson(res, 401, false, null, 'Invalid or expired authentication token');
  }
};
