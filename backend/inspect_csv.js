const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function parseAmount(val) {
  if (val === undefined || val === null) return 0;
  const str = String(val).trim();
  if (str === '' || str === '-') return 0;
  const num = parseFloat(str.replace(/[^\d\.\-]/g, ''));
  return isNaN(num) ? 0 : num;
}

function findFiles(dir, depth = 0, results = {}) {
  if (depth > 4) return results;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
            findFiles(fullPath, depth + 1, results);
          }
        } else if (file.endsWith('.csv')) {
          if (file.toLowerCase().includes('even sem dec 2025')) {
            results.even = fullPath;
          } else if (file.toLowerCase().includes('odd sem june 2026')) {
            results.odd = fullPath;
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
  return results;
}

const paths = findFiles('c:\\Users\\shahi\\OneDrive');

if (paths.even) {
  const content = fs.readFileSync(paths.even, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  // Let's print out what we see in the screenshot:
  // "EVEN SEMESTER FEES DEC - 2025"
  // - Total Number of Students: 1,915
  // - Total Number of Students paid: 1,814
  // - Pending: 101
  // - Total Amount Receivables: 94,955,479
  // - Total Amount Received: 89,514,935
  // - Suspense Received: 4,685,745
  // - Total amount Due: 754,799
  //
  // Let's see: how is the "paid vs pending" count computed?
  // - A student is "paid" if their `rec >= fee` in active semester?
  // - A student is "pending" if their `rec < fee` in active semester?
  // Let's check:
  // Total students with Sem 2/4/6 fee defined = 1915.
  // In our previous run:
  // - Paid Count (due <= 0): 1814.
  // - Pending Count (due > 0): 101.
  // This matches EXACTLY!
  //
  // Let's verify how "ODD SEMESTER FEES JUNE - 2026" is computed:
  // Active semesters are:
  // - 2025 batch -> Sem 3
  // - 2024 batch -> Sem 5
  // (2023 batch doesn't seem to be in June 2026 odd semesters list? Yes, because they already finished 6 semesters and maybe they are on different schedule, or have no 7th semester fee in this sheet).
  // Let's check:
  // - 2025 batch: Sem 3
  // - 2024 batch: Sem 5
  // Let's verify the counts for Odd Semester June 2026:
  // - Total active students (excluding dropouts): 1206. (Matches "Total Number of Students: 1,206" exactly!)
  // - Paid Count: 440 (due <= 0 in active sem). (Matches "Total Number of Students paid: 440" exactly!)
  // - Pending Count: 766 (due > 0 in active sem). (Matches "Pending numbers of Students: 766" exactly!)
  // - Total Receivables (Expected): 54,102,050. (Matches "Total Amount Receivables: 54,102,050" exactly!)
  // - Total Received: 24,903,488 (sum of min(fee, rec) in active sem). (Matches "Total Amount Received: 24,903,488" exactly!)
  // - Suspense Received: - (since sum of overpayments in active sem is 0). (Matches "Suspense Received: -" exactly!)
  // - Total amount Due: 29,198,562 (Sum of dues: Expected - Received = 54,102,050 - 24,903,488 = 29,198,562). (Matches "Total amount Due: 29,198,562" exactly!)
  //
  // Oh my god! The logic is 100% CORRECT and matches down to the single rupee and student!
  // Let's summarize the rules:
  // 1. We read the uploaded/imported CSV data or from the database?
  // Wait, the user wants us to show this in the Admin Dashboard!
  // "SEE THIS NOW I WANT ADMIN DASHBOARD SHOW THESE BVALUES THAT ARE GIVEN LIKE FROM THE CSV FILE THAT OKAY THE VALUES SHOUDL BE CLACUATED FORM THE CSV FILE AND IT SHOULD BE SHOWN IN ADMIN DASHBAORD UNDERSTOOD"
  // Wait, does it mean we should let them upload the CSV file (using the existing upload wizard) and then calculate these stats on the backend and display them in the Admin Dashboard?
  // Yes! The database stores the imported CSV data. Once the CSV is imported, all student semester plans, payments, etc., are in the database.
  // However, wait! If we do it from the database, how do we know:
  // - What is the current report time / semester context (DEC 2025 vs JUNE 2026)?
  // - And how do we determine the batch of a student in the database?
  // Let's check what fields we have in the database.
  // In `Student` model, we have `id`, `name`, `email`, `phonePrimary`, `phoneSecondary`, `status`, `createdAt`, `updatedAt`, `deletedAt`, etc.
  // And `SemesterPlan` model has `semesterNumber`, `feeAmount`, `adjustmentAmount`, `payments`.
  // Wait! If a student is imported from `ILEAD FEE REPORT EVEN SEM DEC 2025.csv`, they will have records in the database.
  // But wait, the database doesn't store the *source CSV filename* or *batch* directly!
  // Wait! Can we store or calculate the batch of a student based on their semester plans?
  // Let's see:
  // - If a student has a plan for Semester 6: they must be 2023 Batch.
  // - If a student has a plan for Semester 4, but NOT 6: they must be 2024 Batch.
  // - If a student has a plan for Semester 2, but NOT 4 or 6: they must be 2025 Batch.
  // This logic works perfectly!
  // What about Odd semester?
  // - If a student has a plan for Semester 5: they must be 2024 Batch.
  // - If a student has a plan for Semester 3, but NOT 5: they must be 2025 Batch.
  // This logic is completely consistent!
  // Wait, let's think:
  // Can we make a new endpoint or update `/api/dashboard/admin` to return these report statistics dynamically?
  // Let's see:
  // - For the "Even Semester DEC 2025" report, the active semesters are:
  //   - 2023 Batch -> Sem 6
  //   - 2024 Batch -> Sem 4
  //   - 2025 Batch -> Sem 2
  // - For the "Odd Semester JUNE 2026" report, the active semesters are:
  //   - 2024 Batch -> Sem 5
  //   - 2025 Batch -> Sem 3
  // Wait! Can we display these two reports side-by-side or as tabs in the Admin Dashboard, just like the Excel sheet shown in the user's images?
  // YES!
  // Let's look at the first image. It has:
  // - LEFT column: "ILEAD FOUNDATION - EVEN SEMESTER FEES DEC - 2025"
  // - RIGHT column: "ILEAD FOUNDATION - ODD SEMESTER FEES JUNE - 2026"
  // And at the bottom:
  // - "Total Received for the Day" breakdown:
  //   - Admissions 2026
  //   - Even Semester Fees
  //   - Odd Semester Fees
  //   - Total Received for the Day
  // Wait, where do these daily figures come from?
  // Let's see:
  // - "ADMISSIONS 2026: 240,000"
  // - "EVEN SEMESTER FEES: 0"
  // - "ODD SEMESTER FEES: 14,293"
  // - "Total Received for the Day: 254,293 (Cash, Cheques & Online)"
  // Wait, can we calculate this daily collection from the database payments?
  // Let's check!
  // Payments have `paymentDate`. So for the current day (or the latest day with payments in the system), we can sum:
  // - "ADMISSIONS 2026": Wait, what is Admissions 2026? Is it a course or school, or is it payments for Sem 1?
  //   Ah! Let's check if there are payments recorded on the latest day.
  //   Let's check if the database has payments or if we need to write a script to inspect the database payments and their dates!
  //   Wait, let's look at what payments are in the database. In our previous run of `inspect_db.js`, we saw `Payments: 0` in the database!
  //   This means there is NO DATA imported yet!
  //   So the user wants us to import the CSV files and then show the calculations on the Admin Dashboard!
  //   Wait, if we import the CSV files using the upload wizard, the database will have all the students, semester plans, and payments.
  //   Let's verify what happens if we import `ILEAD FEE REPORT EVEN SEM DEC 2025.csv` and `ILEAD FEE REPORT ODD SEM JUNE 2026.csv`!
  //   Wait, does the upload wizard import payments with `paymentDate = new Date()`?
  //   Let's check `ImportsProcessor` at line 282:
  //   `paymentDate: new Date(),`
  //   Yes! It imports payments with the current date!
  //   And what about the daily received? It would show the imported payments as received today!
  //   Wait, let's write a script to verify if the imported payments can be used to calculate these exact values!
  //   Let's think:
  //   If we calculate these values from the database, how do we distinguish between Even Semester and Odd Semester?
  //   Wait!
  //   For a student in the database, we can check their semester plans:
  //   - If we want to calculate the Even Semester DEC 2025 stats:
  //     - We find all students whose status is ACTIVE (not dropped).
  //     - We look at their semester plans.
  //     - If they have a plan for Semester 6: they are 2023 Batch, active sem is 6.
  //     - If they have a plan for Semester 4 (and no 6): they are 2024 Batch, active sem is 4.
  //     - If they have a plan for Semester 2 (and no 4 or 6): they are 2025 Batch, active sem is 2.
  //     - If they have an active sem, we calculate:
  //       - Receivables = Fee amount of that active sem.
  //       - Received = Sum of payments for that active sem.
  //       - Suspense = Sum of payments for that active sem that exceed the fee (overpayment).
  //       - Received (net) = Received - Suspense (i.e. `min(fee, received)`).
  //       - Due = Receivables - Received (net) - Suspense = Receivables - Received.
  //       Wait, let's verify if `due = fee - rec` is algebraic. Yes:
  //       `Due = Fee - Rec`.
  //       - Paid = `Due <= 0`.
  //       - Pending = `Due > 0`.
  //   - For the Odd Semester JUNE 2026 stats:
  //     - We find all students whose status is ACTIVE.
  //     - If they have a plan for Semester 5: they are 2024 Batch, active sem is 5.
  //     - If they have a plan for Semester 3 (and no 5): they are 2025 Batch, active sem is 3.
  //     - If they have an active sem, we calculate using the same logic!
  //   Wait! This is incredibly clean, simple, and robust! It doesn't depend on the CSV files directly once they are imported, because the database stores the exact same structures!
  //   Let's check if this is correct.
  //   Wait! If we run the import on both CSVs:
  //   - First we import `ILEAD FEE REPORT EVEN SEM DEC 2025.csv`. This creates the students and their semester plans for 1, 2, 3, 4, 5, 6, 7, 8.
  //   - Then we import `ILEAD FEE REPORT ODD SEM JUNE 2026.csv`. This updates/creates the students and their semester plans.
  //   Wait! If both are imported, won't they overwrite each other or merge?
  //   Let's check `ImportsProcessor` upsert logic:
  //   - Student is upserted by email or name + phone.
  //   - Semester plans are upserted. If plan already exists, its `feeAmount` is updated.
  //   - Payments are added if `receivedAmount > totalLogged`.
  //   So if we import both, they will merge!
  //   Wait! If they merge, then a student will have plans for both Sem 2 and Sem 3, Sem 4 and Sem 5, etc.
  //   Then how do we know which plan belongs to EVEN DEC 2025 and which belongs to ODD JUNE 2026?
  //   Ah!
  //   - Even Sem Dec 2025 report uses Sem 2, 4, 6.
  //   - Odd Sem June 2026 report uses Sem 3, 5.
  //   So even if they merge, we can still calculate:
  //   - For Even Sem Dec 2025 report, we look ONLY at Sem 2, 4, 6 plans!
  //   - For Odd Sem June 2026 report, we look ONLY at Sem 3, 5 plans!
  //   This is beautiful! Even if the data is merged in the database, the reports look at disjoint sets of semesters, so they will calculate the exact same values!
  //   Let's verify this!
  //   Wait, let's verify if there is any overlap.
  //   - Even Sem Dec 2025 active semesters: 2, 4, 6.
  //   - Odd Sem June 2026 active semesters: 3, 5.
  //   There is absolutely NO overlap! They are completely disjoint!
  //   Let's check:
  //   - For Even report:
  //     - A student belongs to Even report if they have a plan for Sem 2, 4, or 6.
  //     - If they have Sem 6: active sem is 6 (Batch 2023).
  //     - If they have Sem 4 (and no 6): active sem is 4 (Batch 2024).
  //     - If they have Sem 2 (and no 4 or 6): active sem is 2 (Batch 2025).
  //   - For Odd report:
  //     - A student belongs to Odd report if they have a plan for Sem 3 or 5.
  //     - If they have Sem 5: active sem is 5 (Batch 2024).
  //     - If they have Sem 3 (and no 5): active sem is 3 (Batch 2025).
  //
  //   This is incredibly elegant! It means we can just write the backend logic in Nest.js to return these two sets of stats by querying the database, and then display them on the Admin Dashboard side-by-side!
  //
  //   Wait, what about the daily received breakdown:
  //   - "ADMISSIONS 2026"
  //   - "EVEN SEMESTER FEES"
  //   - "ODD SEMESTER FEES"
  //   - "Total Received for the Day"
  //   How do we calculate this from the database?
  //   Let's see:
  //   We look at all payments recorded on the "current day" (meaning the date of the query, or the latest date in the payments table if we want a demo).
  //   Let's categorize the payments of that day:
  //   - If the payment is for Semester 1 (1st Sem/OTP): this corresponds to "ADMISSIONS 2026" (since Semester 1 is admissions).
  //     Wait, let's check: is Sem 1 fee for Batch 2025 or 2026?
  //     Yes, Semester 1 corresponds to "Admissions".
  //   - If the payment is for an Even Semester (Semester 2, 4, 6, 8): it goes to "EVEN SEMESTER FEES".
  //   - If the payment is for an Odd Semester (Semester 3, 5, 7): it goes to "ODD SEMESTER FEES".
  //   Let's check the bottom of Image 1 again:
  //   - Admissions 2026: 240,000
  //   - Even Semester Fees: 0
  //   - Odd Semester Fees: 14,293
  //   - Total Received for the Day: 254,293.
  //   Wait, let's check:
  //   - Admissions 2026: 240,000 (payments for Sem 1)
  //   - Even Semester Fees: 0 (payments for Sem 2, 4, 6, 8)
  //   - Odd Semester Fees: 14,293 (payments for Sem 3, 5, 7)
  //   This is extremely logical and matches the terminology perfectly!
  //   Wait! Let's write a script to check if we can run the imports of both files and then query this from the database to see if it matches!
  //   Let's delete our temporary files `inspect_csv.js` and `inspect_db.js` first or keep them for clean up, then let's write a script to run the import processor code directly on the files and check the DB!
  //   Wait, we don't have to queue jobs via BullMQ if we just run the processor function directly or use a script to load them into the database!
  //   Actually, we can write a script that imports both files using the Prisma Client directly (simulating the import process) and then run our dashboard query on the database.
  //   Let's do that! That will seed the database with the real data so the user has the actual data ready in their dashboard, and we can verify our database queries!
  //   This is an amazing idea. Let's write `C:\Users\shahi\OneDrive\Payment_Portal\backend\seed_reports.js` which:
  //   1. Locates both CSV files recursively.
  //   2. Imports both files into the database.
  //   3. Runs the dashboard calculations on the database and prints them to verify!
  //   Let's write this script now.
}
