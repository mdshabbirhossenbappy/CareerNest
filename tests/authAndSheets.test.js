const { assertSafeValue } = require('../lib/sheetsClient');
const BaseRepository = require('../lib/baseRepository');
const { registerSchema } = require('../lib/validators');
const { hashPassword, verifyPassword, signJwt, verifyJwt } = require('../lib/security');

describe('Sheets Security & Auth Unit Tests', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test_secret_key_for_jest_unit_tests_1234567890';
  });

  test('blocks formula injection prefixes (=, +, -, @)', () => {
    expect(() => assertSafeValue('=SUM(A1:A10)')).toThrow('Potential formula injection blocked');
    expect(() => assertSafeValue('+cmd|calc')).toThrow('Potential formula injection blocked');
    expect(() => assertSafeValue('-2+3')).toThrow('Potential formula injection blocked');
    expect(() => assertSafeValue('@import')).toThrow('Potential formula injection blocked');
    expect(assertSafeValue('Safe text 123')).toBe('Safe text 123');
  });

  test('registerSchema rejects UNIVERSITY_ADMIN and weak passwords', () => {
    const adminAttempt = registerSchema.safeParse({
      email: 'hacker@uni.edu',
      password: 'Password1234',
      role: 'UNIVERSITY_ADMIN',
    });
    expect(adminAttempt.success).toBe(false);

    const weakPass = registerSchema.safeParse({
      email: 'student@uni.edu',
      password: 'short1',
      role: 'STUDENT',
    });
    expect(weakPass.success).toBe(false);

    const validStudent = registerSchema.safeParse({
      email: 'Student@Uni.edu',
      password: 'StrongPassword123',
      role: 'STUDENT',
    });
    expect(validStudent.success).toBe(true);
    expect(validStudent.data.email).toBe('student@uni.edu');
  });

  test('hashes password with bcrypt and signs/verifies JWT', async () => {
    const hash = await hashPassword('CareerNest123');
    expect(await verifyPassword('CareerNest123', hash)).toBe(true);
    expect(await verifyPassword('WrongPass123', hash)).toBe(false);

    const token = signJwt({ userId: 'u-1', role: 'STUDENT' });
    const decoded = verifyJwt(token);
    expect(decoded.userId).toBe('u-1');
    expect(decoded.role).toBe('STUDENT');
  });

  test('BaseRepository maps rows and performs CRUD with mock client', async () => {
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
    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].code).toBe('CSE');

    const created = await repo.create({ name: 'Electrical Engineering', code: 'EEE' });
    expect(created.id).toBeDefined();
    expect(rows).toHaveLength(3);
  });
});
