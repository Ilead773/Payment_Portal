import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@erp.com';
  const counselorEmail = 'counselor@erp.com';

  // Seed Admin
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        name: 'System Admin',
        email: adminEmail,
        passwordHash: adminHash,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`Seeded Admin: ${admin.email}`);
  } else {
    console.log(`Admin already exists: ${existingAdmin.email}`);
  }

  // Seed Counselor
  const existingCounselor = await prisma.user.findUnique({
    where: { email: counselorEmail },
  });

  if (!existingCounselor) {
    const counselorHash = await bcrypt.hash('counselor123', 10);
    const counselor = await prisma.user.create({
      data: {
        name: 'Counselor One',
        email: counselorEmail,
        passwordHash: counselorHash,
        role: 'COUNSELOR',
        isActive: true,
      },
    });
    console.log(`Seeded Counselor: ${counselor.email}`);
  } else {
    console.log(`Counselor already exists: ${existingCounselor.email}`);
  }

  // Seed some initial Schools & Courses
  const schools = ['SOC', 'SOE', 'SOM'];
  for (const sName of schools) {
    const school = await prisma.school.upsert({
      where: { name: sName },
      update: {},
      create: { name: sName },
    });

    if (sName === 'SOC') {
      await prisma.course.upsert({
        where: { schoolId_name: { schoolId: school.id, name: 'Animation' } },
        update: {},
        create: { schoolId: school.id, name: 'Animation' },
      });
      await prisma.course.upsert({
        where: { schoolId_name: { schoolId: school.id, name: 'BCA' } },
        update: {},
        create: { schoolId: school.id, name: 'BCA' },
      });
    }
  }
  console.log('Seeded initial schools and courses.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
