const BaseRepository = require('../lib/baseRepository');
const { ensureAllTabs } = require('../lib/sheetsClient');
const { hashPassword } = require('../lib/security');

async function seedSheetDatabase() {
  await ensureAllTabs();

  const usersRepo = new BaseRepository('Users');
  const departmentsRepo = new BaseRepository('Departments');

  const adminEmail = (process.env.ADMIN_SEED_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || '';

  if (adminEmail && adminPassword) {
    const existingAdmins = await usersRepo.findWhere({ email: adminEmail });
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
      console.log(`Seeded UNIVERSITY_ADMIN account: ${adminEmail}`);
    } else {
      console.log(`Admin account already exists: ${adminEmail}`);
    }
  }

  const existingDepts = await departmentsRepo.findAll();
  if (existingDepts.length === 0) {
    const defaultDepts = [
      { name: 'Computer Science & Engineering', code: 'CSE' },
      { name: 'Electrical & Electronic Engineering', code: 'EEE' },
      { name: 'Business Administration', code: 'BBA' },
    ];
    for (const dept of defaultDepts) {
      await departmentsRepo.create(dept);
    }
    console.log('Seeded default University Departments.');
  }
}

if (require.main === module) {
  seedSheetDatabase()
    .then(() => {
      console.log('Google Sheets setup completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Setup failed:', err.message);
      process.exit(1);
    });
}

module.exports = { seedSheetDatabase };
