const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();
const filePath = 'c:\\Users\\shahi\\OneDrive\\Documents\\New folder\\MASTER STUDENT DATA.xlsx';

function parsePhoneNumbers(phoneStr) {
  if (!phoneStr) return { primary: '', secondary: null, warning: false };
  const cleanStr = phoneStr.trim();
  const parts = cleanStr.split(/[\/,;\s\|]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return { primary: '', secondary: null, warning: false };
  
  const checkInvalid = (p) => {
    const digits = p.replace(/\D/g, '');
    const isPlaceholder = digits.length === 0 || /^[0]+$/.test(digits);
    return !isPlaceholder && digits.length < 7;
  };

  if (parts.length === 1) {
    return { primary: parts[0], secondary: null, warning: checkInvalid(parts[0]) };
  }
  return {
    primary: parts[0],
    secondary: parts.slice(1).join(' / '),
    warning: parts.some(checkInvalid),
  };
}

async function main() {
  console.log('Running warnings simulation against live database...');
  const workbook = XLSX.readFile(filePath);
  
  // Cache existing counselors for rapid checking
  const counselorsInDb = await prisma.user.findMany({
    where: { role: 'COUNSELOR', deletedAt: null },
    select: { name: true, email: true }
  });
  const counselorKeys = new Set(
    counselorsInDb.flatMap(c => [c.name.toLowerCase().trim(), c.email.toLowerCase().trim()])
  );

  const targetSheets = ['BATCH 2025', 'BATCH 2024', 'BATCH 2023'];
  const warningLog = [];

  let duplicateRows = 0;
  let counselorNotFound = 0;
  let phoneWarning = 0;
  let feeNoPlanWarning = 0;
  let correctionWarning = 0;

  for (const sheetName of targetSheets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const records = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (records.length <= 1) continue;

    const headers = records[0].map(h => String(h || '').trim().toLowerCase());
    
    let studentIndex = headers.indexOf('student name');
    if (studentIndex === -1) studentIndex = headers.indexOf('student');
    let schoolIndex = headers.indexOf('school');
    let courseIndex = headers.indexOf('course');
    let phoneIndex = headers.indexOf('phone number');
    let emailIndex = headers.indexOf('email id');
    let counselorIndex = headers.indexOf('counsellor');
    if (counselorIndex === -1) counselorIndex = headers.indexOf('counselor');

    // Default column fallback if indices are not matched
    if (studentIndex === -1) studentIndex = 1;
    if (schoolIndex === -1) schoolIndex = 2;
    if (courseIndex === -1) courseIndex = 3;
    if (emailIndex === -1) emailIndex = 30;
    if (phoneIndex === -1) phoneIndex = 31;

    const seenKeys = new Set();

    for (let index = 1; index < records.length; index++) {
      const rowNum = index + 1;
      const record = records[index];
      
      const name = studentIndex < record.length ? String(record[studentIndex] || '').trim() : '';
      const rawSchool = schoolIndex < record.length ? String(record[schoolIndex] || '').trim() : '';
      const courseName = courseIndex < record.length ? String(record[courseIndex] || '').trim() : '';
      const phoneRaw = phoneIndex < record.length ? String(record[phoneIndex] || '').trim() : '';
      const counselorName = counselorIndex !== -1 && counselorIndex < record.length ? String(record[counselorIndex] || '').trim() : '';

      if (!name && !rawSchool) continue;
      if (!name || !rawSchool || !courseName) continue;

      const fileKey = `${name.toLowerCase().trim()}_${String(phoneRaw || '').toLowerCase().trim()}`;
      
      if (seenKeys.has(fileKey)) {
        duplicateRows++;
        warningLog.push({ sheet: sheetName, row: rowNum, student: name, type: 'Duplicate Row', detail: 'Duplicate student in sheet' });
      } else {
        seenKeys.add(fileKey);
      }

      if (counselorName) {
        if (!counselorKeys.has(counselorName.toLowerCase().trim())) {
          counselorNotFound++;
          warningLog.push({ sheet: sheetName, row: rowNum, student: name, type: 'Counselor Not Found', detail: `Counselor "${counselorName}" does not exist in DB` });
        }
      }

      const phoneData = parsePhoneNumbers(phoneRaw);
      if (phoneData.warning) {
        phoneWarning++;
        warningLog.push({ sheet: sheetName, row: rowNum, student: name, type: 'Phone Number Flagged', detail: `Unusual or split phone number format: "${phoneRaw}"` });
      }
    }
  }

  console.log('\n--- SIMULATED IMPORT WARNING COUNTS ---');
  console.log(`- Duplicate Rows within Sheet: ${duplicateRows}`);
  console.log(`- Counselor Not Found: ${counselorNotFound}`);
  console.log(`- Phone Number Warnings: ${phoneWarning}`);
  console.log(`- Total Simulated Warnings: ${duplicateRows + counselorNotFound + phoneWarning}`);

  console.log('\n--- SAMPLE ROW WARNING DETAILS (First 20) ---');
  warningLog.slice(0, 20).forEach(w => {
    console.log(`  [${w.sheet} | Row ${w.row}] Student: "${w.student}" -> ${w.type}: ${w.detail}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
