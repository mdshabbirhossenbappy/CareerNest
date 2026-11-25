const BaseRepository = require('../baseRepository');
const { AppError } = require('../security');
const { calculateSkillMatch } = require('../skillMatcher');

async function listJobs(query, currentUser) {
  const jobsRepo = new BaseRepository('Jobs');
  const employersRepo = new BaseRepository('EmployerProfiles');
  const departmentsRepo = new BaseRepository('Departments');

  const [allJobs, allEmployers, allDepartments] = await Promise.all([
    jobsRepo.findAll(false, { useCache: true }),
    employersRepo.findAll(false, { useCache: true }),
    departmentsRepo.findAll(false, { useCache: true }),
  ]);

  const employerMap = new Map(allEmployers.map((e) => [e.userId, e]));
  const deptMap = new Map(allDepartments.map((d) => [d.id, d]));

  let studentSkills = '';
  let savedSet = new Set();

  if (currentUser && currentUser.role === 'STUDENT') {
    const studentRepo = new BaseRepository('StudentProfiles');
    const savedRepo = new BaseRepository('SavedJobs');
    const [profiles, saved] = await Promise.all([
      studentRepo.findWhere({ userId: currentUser.id }, { useCache: true }),
      savedRepo.findWhere({ studentId: currentUser.id }, { useCache: true }),
    ]);
    studentSkills = profiles[0]?.skills || '';
    savedSet = new Set(saved.map((s) => s.jobId));
  }

  let filtered = allJobs;

  if (query.mine === 'true' && currentUser && ['EMPLOYER', 'RECRUITER'].includes(currentUser.role)) {
    filtered = filtered.filter((j) => j.employerId === currentUser.id);
  } else if (query.scope === 'all' && currentUser && currentUser.role === 'UNIVERSITY_ADMIN') {
    filtered = allJobs;
  } else {
    filtered = filtered.filter((j) => j.status === 'APPROVED');
  }

  if (query.q) {
    const q = query.q.trim().toLowerCase();
    filtered = filtered.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.requiredSkills.toLowerCase().includes(q)
    );
  }
  if (query.departmentId) {
    filtered = filtered.filter((j) => j.departmentId === query.departmentId);
  }
  if (query.type) {
    filtered = filtered.filter((j) => j.type === query.type);
  }
  if (query.location) {
    const loc = query.location.trim().toLowerCase();
    filtered = filtered.filter((j) => j.location.toLowerCase().includes(loc));
  }
  if (query.minSalary) {
    const minSal = Number(query.minSalary);
    if (!Number.isNaN(minSal)) {
      filtered = filtered.filter((j) => Number(j.salaryMax || 0) >= minSal);
    }
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(query.limit || 10)));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paged = filtered.slice((page - 1) * limit, page * limit);

  const enriched = paged.map((job) => {
    const employer = employerMap.get(job.employerId);
    const dept = deptMap.get(job.departmentId);
    const match =
      currentUser && currentUser.role === 'STUDENT'
        ? calculateSkillMatch(studentSkills, job.requiredSkills)
        : null;

    return {
      ...job,
      companyName: employer ? employer.companyName : 'Verified Partner',
      departmentName: dept ? `${dept.name} (${dept.code})` : 'All Departments',
      isSaved: savedSet.has(job.id),
      skillMatch: match,
    };
  });

  return {
    jobs: enriched,
    pagination: { page, limit, total, totalPages },
  };
}

async function createJob(input, currentUser, clientIp) {
  const employerRepo = new BaseRepository('EmployerProfiles');
  const profiles = await employerRepo.findWhere({ userId: currentUser.id }, { useCache: false });
  const employer = profiles[0];

  if (!employer || employer.verifiedByAdmin !== 'true') {
    throw new AppError(
      403,
      'Only university-verified employers can post jobs. Please wait for Admin verification.'
    );
  }

  const deadlineTime = Date.parse(input.deadline);
  if (Number.isNaN(deadlineTime) || deadlineTime < Date.now()) {
    throw new AppError(400, 'Application deadline must be a future date');
  }

  const jobsRepo = new BaseRepository('Jobs');
  const auditRepo = new BaseRepository('AuditLog');

  const created = await jobsRepo.create({
    employerId: currentUser.id,
    title: input.title,
    description: input.description,
    type: input.type,
    location: input.location,
    salaryMin: String(input.salaryMin),
    salaryMax: String(input.salaryMax),
    departmentId: input.departmentId || '',
    requiredSkills: input.requiredSkills,
    deadline: input.deadline,
    status: 'PENDING',
  });

  await auditRepo.create({
    actorId: currentUser.id,
    action: 'JOB_CREATED',
    entity: 'Jobs',
    entityId: created.id,
    ip: clientIp,
  });

  return created;
}

async function updateOwnJob(input, currentUser, clientIp) {
  const jobsRepo = new BaseRepository('Jobs');
  const auditRepo = new BaseRepository('AuditLog');
  const job = await jobsRepo.findById(input.id, { useCache: false });

  if (!job) {
    throw new AppError(404, 'Job not found');
  }
  if (job.employerId !== currentUser.id) {
    throw new AppError(403, 'You can only modify your own job postings');
  }

  const { id, ...patch } = input;
  const updated = await jobsRepo.update(id, patch);

  await auditRepo.create({
    actorId: currentUser.id,
    action: 'JOB_UPDATED',
    entity: 'Jobs',
    entityId: id,
    ip: clientIp,
  });

  return updated;
}

module.exports = {
  listJobs,
  createJob,
  updateOwnJob,
};
