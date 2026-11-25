const { assertSafeValue } = require('../lib/sheetsClient');
const BaseRepository = require('../lib/baseRepository');
const { registerSchema, createJobSchema } = require('../lib/validators');
const { hashPassword, verifyPassword, signJwt, verifyJwt } = require('../lib/security');

describe('Security, Validation & Repository Layer', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test_secret_key_for_jest_unit_tests_1234567890';
  });

  test('blocks spreadsheet formula injection prefixes', () => {
    expect(() => assertSafeValue('=SUM(A1:A10)')).toThrow('Potential formula injection blocked');
    expect(() => assertSafeValue('+cmd|calc')).toThrow('Potential formula injection blocked');
    expect(() => assertSafeValue('-10+5')).toThrow('Potential formula injection blocked');
    expect(() => assertSafeValue('@import')).toThrow('Potential formula injection blocked');
    expect(assertSafeValue('Safe University Value')).toBe('Safe University Value');
  });

  test('blocks public UNIVERSITY_ADMIN signup and unknown fields', () => {
    const adminAttempt = registerSchema.safeParse({
      email: 'attacker@uni.edu',
      password: 'Password1234',
      role: 'UNIVERSITY_ADMIN',
    });
    expect(adminAttempt.success).toBe(false);

    const extraField = registerSchema.safeParse({
      email: 'student@uni.edu',
      password: 'Password1234',
      role: 'STUDENT',
      isAdmin: true,
    });
    expect(extraField.success).toBe(false);
  });

  test('validates salary range in createJobSchema', () => {
    const badRange = createJobSchema.safeParse({
      title: 'Backend Intern',
      description: 'Build serverless Node APIs for university portal.',
      type: 'INTERNSHIP',
      location: 'Dhaka',
      salaryMin: 30000,
      salaryMax: 15000,
      requiredSkills: 'Node.js, SQL',
      deadline: '2027-01-01',
    });
    expect(badRange.success).toBe(false);
  });

  test('hashes passwords with bcrypt and verifies JWT tokens', async () => {
    const hash = await hashPassword('CareerNest123');
    expect(await verifyPassword('CareerNest123', hash)).toBe(true);
    expect(await verifyPassword('WrongPassword1', hash)).toBe(false);

    const token = signJwt({ userId: 'u-100', role: 'STUDENT' });
    const decoded = verifyJwt(token);
    expect(decoded.userId).toBe('u-100');
    expect(decoded.role).toBe('STUDENT');
  });

  test('BaseRepository maps sheet rows and supports softDelete', async () => {
    const rows = [
      ['id', 'name', 'code'],
      ['d-1', 'Computer Science', 'CSE'],
    ];
    const mockClient = {
      ensureAllTabs: jest.fn(),
      getTabRows: jest.fn(async () => rows),
      appendTabRow: jest.fn(async (_tab, vals) => rows.push(vals)),
      updateTabRow: jest.fn(async (_tab, rowNum, vals) => {
        rows[rowNum - 1] = vals;
      }),
    };

    const repo = new BaseRepository('Departments', mockClient);
    expect(await repo.findAll()).toHaveLength(1);
    await repo.create({ name: 'Business Administration', code: 'BBA' });
    expect(rows).toHaveLength(3);
  });
});
