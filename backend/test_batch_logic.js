const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getStudentBatchYearImproved(student) {
  const semNums = student.semesterPlans.map(p => p.semesterNumber);
  const maxSem = semNums.length > 0 ? Math.max(...semNums) : 0;

  if (maxSem >= 6) {
    return 2023;
  } else if (maxSem >= 4) {
    return 2024;
  } else {
    return 2025;
  }
}

async function main() {
  const students = await prisma.student.findMany({
    where: { deletedAt: null },
    include: { semesterPlans: true }
  });

  const counts = { 2023: 0, 2024: 0, 2025: 0 };
  
  students.forEach(s => {
    // Skip the 5 dummy seed students
    if (s.email && s.email.includes('@example.com')) return;

    const batch = getStudentBatchYearImproved(s);
    if (counts[batch] !== undefined) {
      counts[batch]++;
    }
  });

  console.log('--- IMPROVED BATCH CLASSIFICATION COUNTS ---');
  console.log(counts);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
