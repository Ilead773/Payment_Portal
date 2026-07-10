const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
const { crypto, randomUUID } = require('crypto');

const prisma = new PrismaClient();

function parseAmount(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (str === '' || str === '-') return null;
  const num = parseFloat(str.replace(/[^\d\.\-]/g, ''));
  return isNaN(num) ? null : num;
}

function parsePhoneNumbers(phoneStr) {
  if (!phoneStr) return { primary: '', secondary: null, warning: false };
  const cleanStr = phoneStr.trim();
  const parts = cleanStr.split(/[\/,;\s\|]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { primary: '', secondary: null, warning: true };
  }
  if (parts.length === 1) {
    return { primary: parts[0], secondary: null, warning: false };
  }
  return {
    primary: parts[0],
    secondary: parts[1],
    warning: parts.length > 2 || parts.some(p => p.length < 7),
  };
}

async function importCsv(filePath, actorId) {
  console.log(`Importing ${filePath}...`);
  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  console.log(`Found ${records.length} records.`);
  
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const name = record['Student Name'] || record['student_name'];
    const schoolName = record['School'] || record['school'];
    const courseName = record['Course'] || record['course'];
    const email = record['Email ID'] || record['email'];
    const phoneRaw = record['Phone Number'] || record['phone'];

    if (!name || !schoolName || !courseName) continue;

    await prisma.$transaction(async (tx) => {
      const school = await tx.school.upsert({
        where: { name: schoolName },
        update: { deletedAt: null },
        create: { name: schoolName },
      });

      const course = await tx.course.upsert({
        where: { schoolId_name: { schoolId: school.id, name: courseName } },
        update: { deletedAt: null },
        create: { schoolId: school.id, name: courseName },
      });

      const phoneData = parsePhoneNumbers(phoneRaw);
      
      let student = await tx.student.findFirst({
        where: {
          deletedAt: null,
          OR: [
            email ? { email } : null,
            { name, phonePrimary: phoneData.primary },
          ].filter(Boolean),
        },
      });

      const reMark = record['Re_Mark'] || record['re_mark'] || '';
      const status = reMark.toLowerCase().includes('drop out') ? 'DROPPED_OUT' : 'ACTIVE';
      const remarks = record['Exam Cell Remarks'] || record['exam_cell_remarks'] || null;

      if (student) {
        student = await tx.student.update({
          where: { id: student.id },
          data: {
            schoolId: school.id,
            courseId: course.id,
            status,
            examCellRemarks: remarks || student.examCellRemarks,
            phoneSecondary: phoneData.secondary || student.phoneSecondary,
          },
        });
      } else {
        student = await tx.student.create({
          data: {
            name,
            schoolId: school.id,
            courseId: course.id,
            email: email || null,
            phonePrimary: phoneData.primary,
            phoneSecondary: phoneData.secondary,
            status,
            examCellRemarks: remarks,
          },
        });
      }

      // Process semesters 1-8
      const semWords = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
      for (let semIndex = 0; semIndex < 8; semIndex++) {
        const semNum = semIndex + 1;
        const word = semWords[semIndex];
        const feeCol = `${word} Semester Fee`;
        const recCol = `${word} Semester Received`;

        const feeAmount = parseAmount(record[feeCol]);
        const receivedAmount = parseAmount(record[recCol]) || 0;

        if (feeAmount !== null) {
          let plan = await tx.semesterPlan.findUnique({
            where: { studentId_semesterNumber: { studentId: student.id, semesterNumber: semNum } },
          });

          if (plan) {
            plan = await tx.semesterPlan.update({
              where: { id: plan.id },
              data: { feeAmount },
            });
          } else {
            plan = await tx.semesterPlan.create({
              data: {
                studentId: student.id,
                semesterNumber: semNum,
                feeAmount,
                status: 'ACTIVE',
              },
            });
          }

          const loggedPayments = await tx.payment.findMany({
            where: { semesterPlanId: plan.id },
          });
          const totalLogged = loggedPayments.reduce((sum, p) => sum + p.amount, 0);
          const discrepancy = receivedAmount - totalLogged;

          if (discrepancy > 0) {
            await tx.payment.create({
              data: {
                studentId: student.id,
                semesterPlanId: plan.id,
                amount: discrepancy,
                paymentDate: new Date(),
                recordedById: actorId,
                idempotencyKey: `import_seed_${index}_sem_${semNum}_${randomUUID()}`,
              },
            });
          } else if (discrepancy < 0) {
            await tx.payment.create({
              data: {
                studentId: student.id,
                semesterPlanId: plan.id,
                amount: discrepancy,
                paymentDate: new Date(),
                recordedById: actorId,
                idempotencyKey: `import_seed_${index}_sem_${semNum}_corr_${randomUUID()}`,
              },
            });
          }
        } else {
          if (receivedAmount > 0) {
            const plan = await tx.semesterPlan.upsert({
              where: { studentId_semesterNumber: { studentId: student.id, semesterNumber: semNum } },
              update: {},
              create: {
                studentId: student.id,
                semesterNumber: semNum,
                feeAmount: 0,
                status: 'ACTIVE',
              },
            });

            await tx.payment.create({
              data: {
                studentId: student.id,
                semesterPlanId: plan.id,
                amount: receivedAmount,
                paymentDate: new Date(),
                recordedById: actorId,
                idempotencyKey: `import_seed_${index}_sem_${semNum}_missingfee_${randomUUID()}`,
              },
            });
          }
        }
      }

      // Adjustments
      const adjustmentsVal = parseAmount(record['Adjustments']);
      if (adjustmentsVal !== null && adjustmentsVal > 0) {
        const adjReason = record['Adjustments Reason'] || 'CSV Import Adjustment';
        const activePlans = await tx.semesterPlan.findMany({
          where: { studentId: student.id },
          orderBy: { semesterNumber: 'asc' },
        });
        if (activePlans.length > 0) {
          const targetPlan = activePlans[0];
          const loggedAdjs = await tx.adjustment.findMany({
            where: { semesterPlanId: targetPlan.id },
          });
          const totalLoggedAdj = loggedAdjs.reduce((sum, a) => sum + a.amount, 0);
          const adjDiscrepancy = adjustmentsVal - totalLoggedAdj;

          if (adjDiscrepancy !== 0) {
            await tx.adjustment.create({
              data: {
                semesterPlanId: targetPlan.id,
                amount: adjDiscrepancy,
                reason: adjReason,
                recordedById: actorId,
              },
            });

            await tx.semesterPlan.update({
              where: { id: targetPlan.id },
              data: {
                adjustmentAmount: { increment: adjDiscrepancy },
              },
            });
          }
        }
      }
    });
  }
  console.log(`Finished importing ${filePath}.`);
}

async function main() {
  const users = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  if (users.length === 0) {
    console.error('No admin user found to attribute seed. Run seed.ts first.');
    return;
  }
  const adminId = users[0].id;

  const evenPath = 'C:\\Users\\shahi\\OneDrive\\ILEAD FEE REPORT EVEN SEM DEC 2025.csv';
  const oddPath = 'C:\\Users\\shahi\\OneDrive\\ILEAD FEE REPORT ODD SEM JUNE 2026.csv';

  console.log('Seeding from hardcoded paths...');
  await importCsv(evenPath, adminId);
  await importCsv(oddPath, adminId);

  console.log('Seeding completed successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
