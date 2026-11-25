const BaseRepository = require('../baseRepository');
const { batchAppendTabRows } = require('../sheetsClient');
const { AppError } = require('../security');
const { canTransition, getAllowedNextStatuses } = require('../stateMachine');
const { calculateSkillMatch } = require('../skillMatcher');

async function applyToJob(input, currentUser, clientIp) {
  const jobsRepo = new BaseRepository('Jobs');
  const appsRepo = new BaseRepository('Applications');
  const historyRepo = new BaseRepository('ApplicationHistory');
  const notifRepo = new BaseRepository('Notifications');
  const auditRepo = new BaseRepository('AuditLog');

  const job = await jobsRepo.findById(input.jobId, { useCache: false });
  if (!job || job.status !== 'APPROVED') {
    throw new AppError(404, 'This job is not available for applications');
  }

  const deadlineMs = Date.parse(job.deadline);
  if (!Number.isNaN(deadlineMs) && deadlineMs < Date.now()) {
    throw new AppError(400, 'The application deadline for this job has passed');
  }

  const existing = await appsRepo.findWhere(
    { jobId: job.id, studentId: currentUser.id },
    { useCache: false }
  );
  if (existing.length > 0) {
    throw new AppError(409, 'You have already applied to this position');
  }

  const preparedApp = appsRepo.prepareRecord({
    jobId: job.id,
    studentId: currentUser.id,
    status: 'SUBMITTED',
    coverLetter: input.coverLetter,
  });

  const preparedHistory = historyRepo.prepareRecord({
    applicationId: preparedApp.record.id,
    fromStatus: 'NONE',
    toStatus: 'SUBMITTED',
    changedBy: currentUser.id,
    note: 'Application submitted',
  });

  const preparedNotif = notifRepo.prepareRecord({
    userId: job.employerId,
    message: `New application received for "${job.title}"`,
    isRead: 'false',
  });

  const preparedAudit = auditRepo.prepareRecord({
    actorId: currentUser.id,
    action: 'APPLICATION_SUBMITTED',
    entity: 'Applications',
    entityId: preparedApp.record.id,
    ip: clientIp,
  });

  await batchAppendTabRows([
    { tabName: 'Applications', values: preparedApp.values },
    { tabName: 'ApplicationHistory', values: preparedHistory.values },
    { tabName: 'Notifications', values: preparedNotif.values },
    { tabName: 'AuditLog', values: preparedAudit.values },
  ]);

  return preparedApp.record;
}

async function listApplicationsForUser(currentUser, query = {}) {
  const appsRepo = new BaseRepository('Applications');
  const jobsRepo = new BaseRepository('Jobs');
  const historyRepo = new BaseRepository('ApplicationHistory');
  const interviewsRepo = new BaseRepository('Interviews');
  const studentsRepo = new BaseRepository('StudentProfiles');
  const employersRepo = new BaseRepository('EmployerProfiles');

  const [allApps, allJobs, allHistory, allInterviews, allStudents, allEmployers] =
    await Promise.all([
      appsRepo.findAll(false, { useCache: false }),
      jobsRepo.findAll(false, { useCache: true }),
      historyRepo.findAll(false, { useCache: false }),
      interviewsRepo.findAll(false, { useCache: false }),
      studentsRepo.findAll(false, { useCache: true }),
      employersRepo.findAll(false, { useCache: true }),
    ]);

  const jobMap = new Map(allJobs.map((j) => [j.id, j]));
  const studentMap = new Map(allStudents.map((s) => [s.userId, s]));
  const employerMap = new Map(allEmployers.map((e) => [e.userId, e]));

  let visibleApps = [];
  if (currentUser.role === 'STUDENT') {
    visibleApps = allApps.filter((a) => a.studentId === currentUser.id);
  } else if (currentUser.role === 'EMPLOYER' || currentUser.role === 'RECRUITER') {
    const ownedJobIds = new Set(
      allJobs.filter((j) => j.employerId === currentUser.id).map((j) => j.id)
    );
    visibleApps = allApps.filter((a) => ownedJobIds.has(a.jobId));
  } else if (currentUser.role === 'UNIVERSITY_ADMIN') {
    visibleApps = allApps;
  }

  if (query.jobId) {
    visibleApps = visibleApps.filter((a) => a.jobId === query.jobId);
  }
  if (query.status) {
    visibleApps = visibleApps.filter((a) => a.status === query.status);
  }

  visibleApps.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());

  return visibleApps.map((app) => {
    const job = jobMap.get(app.jobId) || {};
    const student = studentMap.get(app.studentId) || {};
    const employer = employerMap.get(job.employerId) || {};
    const history = allHistory
      .filter((h) => h.applicationId === app.id)
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
    const interviews = allInterviews.filter((iv) => iv.applicationId === app.id);
    const skillMatch = calculateSkillMatch(student.skills || '', job.requiredSkills || '');

    return {
      ...app,
      jobTitle: job.title || 'Unknown Role',
      companyName: employer.companyName || 'Company',
      studentName: student.fullName || 'Student',
      studentCgpa: student.cgpa || '',
      studentSkills: student.skills || '',
      studentCvUrl: student.cvUrl || '',
      studentVerified: student.verifiedByAdmin === 'true',
      skillMatch,
      allowedNextStatuses: getAllowedNextStatuses(app.status, currentUser.role),
      history,
      interviews,
    };
  });
}

async function transitionApplication(input, currentUser, clientIp) {
  const appsRepo = new BaseRepository('Applications');
  const jobsRepo = new BaseRepository('Jobs');
  const historyRepo = new BaseRepository('ApplicationHistory');
  const interviewsRepo = new BaseRepository('Interviews');
  const notifRepo = new BaseRepository('Notifications');
  const auditRepo = new BaseRepository('AuditLog');

  const app = await appsRepo.findById(input.applicationId, { useCache: false });
  if (!app) {
    throw new AppError(404, 'Application not found');
  }

  const job = await jobsRepo.findById(app.jobId, { useCache: true });
  if (!job) {
    throw new AppError(404, 'Associated job not found');
  }

  if (currentUser.role === 'STUDENT' && app.studentId !== currentUser.id) {
    throw new AppError(403, 'You can only update your own applications');
  }
  if (
    (currentUser.role === 'EMPLOYER' || currentUser.role === 'RECRUITER') &&
    job.employerId !== currentUser.id
  ) {
    throw new AppError(403, 'You can only review applicants for your own jobs');
  }

  if (!canTransition(app.status, input.toStatus, currentUser.role)) {
    throw new AppError(
      400,
      `Invalid status transition from ${app.status} to ${input.toStatus} for role ${currentUser.role}`
    );
  }

  if (input.toStatus === 'INTERVIEW_SCHEDULED' && !input.interview) {
    throw new AppError(400, 'Interview date and mode are required when scheduling an interview');
  }

  const updated = await appsRepo.update(app.id, { status: input.toStatus });

  const batchEntries = [];
  const preparedHistory = historyRepo.prepareRecord({
    applicationId: app.id,
    fromStatus: app.status,
    toStatus: input.toStatus,
    changedBy: currentUser.id,
    note: input.note || `Moved to ${input.toStatus}`,
  });
  batchEntries.push({ tabName: 'ApplicationHistory', values: preparedHistory.values });

  if (input.toStatus === 'INTERVIEW_SCHEDULED' && input.interview) {
    const preparedInterview = interviewsRepo.prepareRecord({
      applicationId: app.id,
      scheduledAt: input.interview.scheduledAt,
      mode: input.interview.mode,
      link: input.interview.link || '',
      status: 'SCHEDULED',
    });
    batchEntries.push({ tabName: 'Interviews', values: preparedInterview.values });
  }

  const notifTarget = currentUser.role === 'STUDENT' ? job.employerId : app.studentId;
  const preparedNotif = notifRepo.prepareRecord({
    userId: notifTarget,
    message: `Application for "${job.title}" changed from ${app.status} to ${input.toStatus}`,
    isRead: 'false',
  });
  batchEntries.push({ tabName: 'Notifications', values: preparedNotif.values });

  const preparedAudit = auditRepo.prepareRecord({
    actorId: currentUser.id,
    action: `APPLICATION_${input.toStatus}`,
    entity: 'Applications',
    entityId: app.id,
    ip: clientIp,
  });
  batchEntries.push({ tabName: 'AuditLog', values: preparedAudit.values });

  await batchAppendTabRows(batchEntries);

  return updated;
}

module.exports = {
  applyToJob,
  listApplicationsForUser,
  transitionApplication,
};
