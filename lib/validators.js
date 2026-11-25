const { z } = require('zod');

const safeUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (val) => val === '' || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(val),
    'Must be a valid http or https URL'
  );

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('Please enter a valid email address')
      .transform((val) => val.toLowerCase()),
    password: passwordSchema,
    role: z.enum(['STUDENT', 'EMPLOYER', 'RECRUITER'], {
      errorMap: () => ({ message: 'Role must be STUDENT, EMPLOYER, or RECRUITER' }),
    }),
    fullName: z.string().trim().min(2, 'Name is required').max(100).optional(),
    companyName: z.string().trim().min(2, 'Company name is required').max(120).optional(),
    departmentId: z.string().trim().max(80).optional(),
  })
  .strict();

const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('Invalid email format')
      .transform((val) => val.toLowerCase()),
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict();

const studentProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required').max(100),
    studentIdNo: z.string().trim().max(40).default(''),
    departmentId: z.string().trim().max(80).default(''),
    cgpa: z
      .string()
      .trim()
      .refine(
        (val) => val === '' || (!Number.isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 4),
        'CGPA must be between 0.00 and 4.00'
      )
      .default(''),
    skills: z.string().trim().max(500).default(''),
    education: z.string().trim().max(500).default(''),
    projects: z.string().trim().max(1000).default(''),
    cvUrl: safeUrlSchema.default(''),
    graduationYear: z.string().trim().max(10).default(''),
  })
  .strict();

const employerProfileSchema = z
  .object({
    companyName: z.string().trim().min(2, 'Company name is required').max(120),
    website: safeUrlSchema.default(''),
    industry: z.string().trim().max(100).default(''),
    description: z.string().trim().max(1500).default(''),
  })
  .strict();

const createJobSchema = z
  .object({
    title: z.string().trim().min(3, 'Job title is required').max(120),
    description: z.string().trim().min(10, 'Description must be at least 10 characters').max(3000),
    type: z.enum(['INTERNSHIP', 'FULL_TIME', 'PART_TIME', 'CONTRACT']),
    location: z.string().trim().min(2, 'Location is required').max(120),
    salaryMin: z.coerce.number().min(0).max(10000000),
    salaryMax: z.coerce.number().min(0).max(10000000),
    departmentId: z.string().trim().max(80).default(''),
    requiredSkills: z.string().trim().min(2, 'Required skills are needed').max(500),
    deadline: z
      .string()
      .trim()
      .refine((val) => !Number.isNaN(Date.parse(val)), 'Valid deadline date is required'),
  })
  .strict()
  .refine((data) => data.salaryMax >= data.salaryMin, {
    message: 'Maximum salary must be greater than or equal to minimum salary',
  });

const updateJobSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().min(10).max(3000).optional(),
    location: z.string().trim().min(2).max(120).optional(),
    requiredSkills: z.string().trim().min(2).max(500).optional(),
    deadline: z.string().trim().optional(),
    status: z.enum(['CLOSED']).optional(),
  })
  .strict();

const applyJobSchema = z
  .object({
    jobId: z.string().trim().min(1, 'Job ID is required'),
    coverLetter: z.string().trim().min(10, 'Cover letter must be at least 10 characters').max(2000),
  })
  .strict();

const transitionApplicationSchema = z
  .object({
    applicationId: z.string().trim().min(1),
    toStatus: z.enum([
      'UNDER_REVIEW',
      'SHORTLISTED',
      'INTERVIEW_SCHEDULED',
      'SELECTED',
      'REJECTED',
      'OFFER_ACCEPTED',
      'WITHDRAWN',
    ]),
    note: z.string().trim().max(500).default(''),
    interview: z
      .object({
        scheduledAt: z.string().trim().min(4),
        mode: z.enum(['ONLINE', 'ONSITE', 'PHONE']),
        link: safeUrlSchema.default(''),
      })
      .strict()
      .optional(),
  })
  .strict();

const departmentSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().min(2).max(20).transform((v) => v.toUpperCase()),
  })
  .strict();

const savedJobSchema = z
  .object({
    jobId: z.string().trim().min(1),
  })
  .strict();

const reportSchema = z
  .object({
    targetType: z.enum(['JOB', 'EMPLOYER', 'STUDENT']),
    targetId: z.string().trim().min(1),
    reason: z.string().trim().min(5, 'Please provide a reason').max(500),
  })
  .strict();

const markNotificationSchema = z
  .object({
    notificationId: z.string().trim().min(1),
  })
  .strict();

const adminActionSchema = z
  .object({
    action: z.enum([
      'VERIFY_STUDENT',
      'VERIFY_EMPLOYER',
      'APPROVE_JOB',
      'REJECT_JOB',
      'RESOLVE_REPORT',
      'DISMISS_REPORT',
    ]),
    targetId: z.string().trim().min(1),
  })
  .strict();

module.exports = {
  safeUrlSchema,
  passwordSchema,
  registerSchema,
  loginSchema,
  studentProfileSchema,
  employerProfileSchema,
  createJobSchema,
  updateJobSchema,
  applyJobSchema,
  transitionApplicationSchema,
  departmentSchema,
  savedJobSchema,
  reportSchema,
  markNotificationSchema,
  adminActionSchema,
};
