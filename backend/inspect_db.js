const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const studentCount = await prisma.student.count();
  const planCount = await prisma.semesterPlan.count();
  const paymentCount = await prisma.payment.count();

  console.log('Seeded Database Counts:');
  console.log('- Users:', userCount);
  console.log('- Students:', studentCount);
  console.log('- Semester Plans:', planCount);
  console.log('- Payments:', paymentCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
