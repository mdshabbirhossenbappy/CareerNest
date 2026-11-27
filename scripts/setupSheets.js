const BaseRepository = require('../lib/baseRepository');
const { ensureAllTabs } = require('../lib/sheetsClient');
const { hashPassword } = require('../lib/security');

async function seedSheetDatabase() {
  await ensureAllTabs(true);

  const usersRepo = new BaseRepository('Users');
  const departmentsRepo = new BaseRepository('Departments');

  const adminEmail = (process.env.ADMIN_SEED_EMAIL || 'shbappy564@gmail.com').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'SH-Bappy_CareerNest1';

  const existingAdmins = await usersRepo.findWhere({ email: adminEmail }, { useCache: false });
  if (existingAdmins.length === 0) {
    const passwordHash = await hashPassword(adminPassword);
    await usersRepo.create({
      email: adminEmail,
      passwordHash,
      role: 'UNIVERSITY_ADMIN',
      status: 'ACTIVE',
      failedLoginCount: '0',
      lockedUntil: '',
    });
  }

  const existingDepts = await departmentsRepo.findAll(false, { useCache: false });
  if (existingDepts.length === 0) {
    const defaults = [
      { name: 'Department of Computer Science & Engineering', code: 'CSE' },
      { name: 'Department of Business Administration', code: 'BBA' },
      { name: 'Department of Textile Engineering', code: 'TEXTILE' },
      { name: 'Department of English', code: 'ENGLISH' },
      { name: 'Department of Law', code: 'LAW' },
      { name: 'Department of Apparel Merchandising & Management', code: 'AMM' },
      { name: 'Department of AI & Data Science', code: 'AI&DS' },
      { name: 'Master of Arts in English', code: 'MA-ENGLISH' },
      { name: 'Master of Business Administration', code: 'MBA' },
    ];
    for (const dept of defaults) {
      await departmentsRepo.create(dept);
    }
  }
}

if (require.main === module) {
  seedSheetDatabase()
    .then(() => {
      console.log('CareerNest Google Sheets setup completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Setup failed:', err.message);
      process.exit(1);
    });
}

module.exports = { seedSheetDatabase };
