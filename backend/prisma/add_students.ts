import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Fetch counselor
  const counselor = await prisma.user.findFirst({
    where: { role: 'COUNSELOR' },
  });
  if (!counselor) {
    throw new Error('Counselor not found. Please seed the database first.');
  }

  // Fetch school and course
  const school = await prisma.school.findFirst({
    where: { name: 'SOC' },
  });
  if (!school) {
    throw new Error('School SOC not found. Please seed the database first.');
  }

  const course = await prisma.course.findFirst({
    where: { schoolId: school.id, name: 'BCA' },
  });
  if (!course) {
    throw new Error('Course BCA not found. Please seed the database first.');
  }

  const dummyStudents = [
    { name: 'Alice Smith', email: 'alice.smith@example.com', phonePrimary: '9876543210' },
    { name: 'Bob Johnson', email: 'bob.johnson@example.com', phonePrimary: '9876543211' },
    { name: 'Charlie Brown', email: 'charlie.brown@example.com', phonePrimary: '9876543212' },
    { name: 'Diana Prince', email: 'diana.prince@example.com', phonePrimary: '9876543213' },
    { name: 'Ethan Hunt', email: 'ethan.hunt@example.com', phonePrimary: '9876543214' },
  ];

  console.log('Adding 5 students to the database...');

  for (const dummy of dummyStudents) {
    const student = await prisma.student.create({
      data: {
        name: dummy.name,
        email: dummy.email,
        phonePrimary: dummy.phonePrimary,
        schoolId: school.id,
        courseId: course.id,
        counselorId: counselor.id,
        status: 'ACTIVE',
      },
    });
    console.log(`Created Student: ${student.name} (ID: ${student.id})`);
  }

  console.log('Successfully added 5 students!');
}

main()
  .catch((e) => {
    console.error('Error adding students:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
