const BaseRepository = require('../../lib/baseRepository');
const { requireAuth } = require('../../lib/authMiddleware');
const { markNotificationSchema, reportSchema } = require('../../lib/validators');
const {
  applyCors,
  enforceBodyLimit,
  getClientIp,
  sendJson,
  handleError,
} = require('../../lib/security');

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const user = await requireAuth(req, ['STUDENT', 'EMPLOYER', 'RECRUITER', 'UNIVERSITY_ADMIN']);
    const resource = req.query?.resource || 'notifications';

    if (resource === 'reports') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, false, null, 'Method not allowed');
      }
      enforceBodyLimit(req);
      const parsed = reportSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(res, 400, false, null, parsed.error.issues[0]?.message || 'Invalid report');
      }
      const reportsRepo = new BaseRepository('Reports');
      const report = await reportsRepo.create({
        reporterId: user.id,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        reason: parsed.data.reason,
        status: 'OPEN',
      });
      await new BaseRepository('AuditLog').create({
        actorId: user.id,
        action: 'REPORT_CREATED',
        entity: 'Reports',
        entityId: report.id,
        ip: getClientIp(req),
      });
      return sendJson(res, 201, true, { report }, null);
    }

    const notifRepo = new BaseRepository('Notifications');

    if (req.method === 'GET') {
      const items = await notifRepo.findWhere({ userId: user.id }, { useCache: false });
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return sendJson(res, 200, true, { notifications: items.slice(0, 30) }, null);
    }

    if (req.method === 'PATCH') {
      enforceBodyLimit(req);
      const parsed = markNotificationSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return sendJson(res, 400, false, null, 'notificationId is required');
      }
      const existing = await notifRepo.findById(parsed.data.notificationId, { useCache: false });
      if (!existing || existing.userId !== user.id) {
        return sendJson(res, 404, false, null, 'Notification not found');
      }
      const updated = await notifRepo.update(existing.id, { isRead: 'true' });
      return sendJson(res, 200, true, { notification: updated }, null);
    }

    res.setHeader('Allow', 'GET, PATCH, POST');
    return sendJson(res, 405, false, null, 'Method not allowed');
  } catch (err) {
    return handleError(res, err);
  }
};
