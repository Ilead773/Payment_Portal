const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();
const filePath = 'c:\\Users\\shahi\\OneDrive\\Documents\\New folder\\MASTER STUDENT DATA.xlsx';

async function main() {
  console.log('Starting batch-limited cohort data backfill...');
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(filePath);
  
  const targetSheets = ['BATCH 2025', 'BATCH 2024', 'BATCH 2023'];
  let totalUpdated = 0;

  for (const sheetName of targetSheets) {
    const cohort = sheetName.replace('BATCH', '').trim();
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.log(`Sheet "${sheetName}" not found, skipping.`);
      continue;
    }

    const records = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (records.length <= 1) {
      console.log(`Sheet "${sheetName}" is empty, skipping.`);
      continue;
    }

    const headers = records[0].map(h => String(h || '').trim().toLowerCase());
    let studentIndex = headers.indexOf('student name');
    if (studentIndex === -1) studentIndex = headers.indexOf('student');
    if (studentIndex === -1) studentIndex = 1;

    console.log(`Preparing updates for "${sheetName}" (cohort "${cohort}")...`);

    const updatePromises = [];
    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      const name = studentIndex < row.length ? String(row[studentIndex] || '').trim() : '';
      if (!name) continue;

      updatePromises.push({ name, cohort });
    }

    // Run updates in parallel batches of 5 (matching DB connection pool limit)
    const batchSize = 5;
    let sheetUpdated = 0;
    for (let j = 0; j < updatePromises.length; j += batchSize) {
      const batch = updatePromises.slice(j, j + batchSize);
      const results = await Promise.all(
        batch.map(item =>
          prisma.student.updateMany({
            where: { name: item.name, deletedAt: null },
            data: { cohort: item.cohort }
          })
        )
      );
      sheetUpdated += results.reduce((sum, res) => sum + res.count, 0);
    }

    console.log(`Updated ${sheetUpdated} student records for ${sheetName}.`);
    totalUpdated += sheetUpdated;
  }

  console.log(`Backfill complete! Total updated records: ${totalUpdated}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
