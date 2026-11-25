const BaseRepository = require('../baseRepository');
const { AppError } = require('../security');

async function getAdminOverview() {
  const usersRepo = new BaseRepository('Users');
  const studentsRepo = new BaseRepository('StudentProfiles');
  const employersRepo = new BaseRepository('EmployerProfiles');
  const jobsRepo = new BaseRepository('Jobs');
  const appsRepo = new BaseRepository('Applications');
  const deptsRepo = new BaseRepository('Departments');
  const reportsRepo = new BaseRepository('Reports');
  const auditRepo = new BaseRepository('AuditLog');

  const [users, students, employers, jobs, apps, departments, reports, auditLogs] =
    await Promise.all([
      usersRepo.findAll(false, { useCache: false }),
      studentsRepo.findAll(false, { useCache: false }),
      employersRepo.findAll(false, { useCache: false }),
      jobsRepo.findAll(false, { useCache: false }),
      appsRepo.findAll(false, { useCache: false }),
      deptsRepo.findAll(false, { useCache: false }),
      reportsRepo.findAll(false, { useCache: false }),
      auditRepo.findAll(false, { useCache: false }),
    ]);

  const userEmailMap = new Map(users.map((u) => [u.id, u.email]));
  const employerNameMap = new Map(employers.map((e) => [e.userId, e.companyName]));

  const deptStats = departments.map((dept) => {
    const deptStudents = students.filter((s) => s.departmentId === dept.id);
    const deptStudentIds = new Set(deptStudents.map((s) => s.userId));
    const placedStudents = new Set(
      apps
        .filter((a) => a.status === 'OFFER_ACCEPTED' && deptStudentIds.has(a.studentId))
        .map((a) => a.studentId)
    );
    return {
      departmentId: dept.id,
      name: dept.name,
      code: dept.code,
      totalStudents: deptStudents.length,
      placedStudents: placedStudents.size,
      placementRate:
        deptStudents.length > 0 ? Math.round((placedStudents.size / deptStudents.length) * 100) : 0,
    };
  });

  const stats = {
    totalStudents: students.length,
    verifiedStudents: students.filter((s) => s.verifiedByAdmin === 'true').length,
    totalEmployers: employers.length,
    verifiedEmployers: employers.filter((e) => e.verifiedByAdmin === 'true').length,
    pendingJobs: jobs.filter((j) => j.status === 'PENDING').length,
    approvedJobs: jobs.filter((j) => j.status === 'APPROVED').length,
    totalApplications: apps.length,
    offersAccepted: apps.filter((a) => a.status === 'OFFER_ACCEPTED').length,
    openReports: reports.filter((r) => r.status === 'OPEN').length,
  };

  return {
    stats,
    deptStats,
    students: students.map((s) => ({ ...s, email: userEmailMap.get(s.userId) || '' })),
    employers: employers.map((e) => ({ ...e, email: userEmailMap.get(e.userId) || '' })),
    jobs: jobs.map((j) => ({
      ...j,
      companyName: employerNameMap.get(j.employerId) || 'Employer',
    })),
    departments,
    reports,
    auditLogs: auditLogs.slice(-25).reverse(),
  };
}

async function performAdminAction(input, currentUser, clientIp) {
  const { action, targetId } = input;
  const auditRepo = new BaseRepository('AuditLog');
  const notifRepo = new BaseRepository('Notifications');

  if (action === 'VERIFY_STUDENT') {
    const repo = new BaseRepository('StudentProfiles');
    const updated = await repo.update(targetId, { verifiedByAdmin: 'true' });
    if (!updated) throw new AppError(404, 'Student profile not found');
    await Promise.all([
      notifRepo.create({
        userId: updated.userId,
        message: 'Your university student profile has been verified by the Career Office.',
        isRead: 'false',
      }),
      auditRepo.create({
        actorId: currentUser.id,
        action,
        entity: 'StudentProfiles',
        entityId: targetId,
        ip: clientIp,
      }),
    ]);
    return updated;
  }

  if (action === 'VERIFY_EMPLOYER') {
    const repo = new BaseRepository('EmployerProfiles');
    const updated = await repo.update(targetId, { verifiedByAdmin: 'true' });
    if (!updated) throw new AppError(404, 'Employer profile not found');
    await Promise.all([
      notifRepo.create({
        userId: updated.userId,
        message: 'Your company profile has been verified! You can now publish jobs and internships.',
        isRead: 'false',
      }),
      auditRepo.create({
        actorId: currentUser.id,
        action,
        entity: 'EmployerProfiles',
        entityId: targetId,
        ip: clientIp,
      }),
    ]);
    return updated;
  }

  if (action === 'APPROVE_JOB' || action === 'REJECT_JOB') {
    const repo = new BaseRepository('Jobs');
    const nextStatus = action === 'APPROVE_JOB' ? 'APPROVED' : 'REJECTED';
    const updated = await repo.update(targetId, { status: nextStatus });
    if (!updated) throw new AppError(404, 'Job not found');
    await Promise.all([
      notifRepo.create({
        userId: updated.employerId,
        message: `Your job post "${updated.title}" was ${nextStatus} by the University Career Office.`,
        isRead: 'false',
      }),
      auditRepo.create({
        actorId: currentUser.id,
        action,
        entity: 'Jobs',
        entityId: targetId,
        ip: clientIp,
      }),
    ]);
    return updated;
  }

  if (action === 'RESOLVE_REPORT' || action === 'DISMISS_REPORT') {
    const repo = new BaseRepository('Reports');
    const nextStatus = action === 'RESOLVE_REPORT' ? 'RESOLVED' : 'DISMISSED';
    const updated = await repo.update(targetId, { status: nextStatus });
    if (!updated) throw new AppError(404, 'Report not found');
    await auditRepo.create({
      actorId: currentUser.id,
      action,
      entity: 'Reports',
      entityId: targetId,
      ip: clientIp,
    });
    return updated;
  }

  throw new AppError(400, 'Unsupported admin action');
}

module.exports = {
  getAdminOverview,
  performAdminAction,
};
