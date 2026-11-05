const { z } = require('zod');

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

module.exports = {
  passwordSchema,
  registerSchema,
  loginSchema,
};
