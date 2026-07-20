import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';

@Processor('csv-import')
export class ImportsProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // Helper to query row values case-insensitively and format-insensitively
  private getRecordValue(record: any, possibleKeys: string[]): any {
    if (!record) return undefined;
    const normalizedPossibles = possibleKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (const rawKey of Object.keys(record)) {
      const normKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedPossibles.includes(normKey)) {
        return record[rawKey];
      }
    }
    return undefined;
  }

  // Parse phone numbers and split by common delimiters
  private parsePhoneNumbers(phoneStr: string) {
    if (!phoneStr) return { primary: '', secondary: null, warning: false };
    const cleanStr = phoneStr.trim();
    // Split by slash, comma, semicolon, space, or vertical bar
    const parts = cleanStr.split(/[\/,;\s\|]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) {
      return { primary: '', secondary: null, warning: false };
    }
    
    const checkInvalid = (p: string) => {
      const digits = p.replace(/\D/g, '');
      const isPlaceholder = digits.length === 0 || /^[0]+$/.test(digits);
      return !isPlaceholder && digits.length < 7;
    };

    if (parts.length === 1) {
      return { primary: parts[0], secondary: null, warning: checkInvalid(parts[0]) };
    }
    // Return primary and secondary. Aggregate any additional numbers in secondary
    return {
      primary: parts[0],
      secondary: parts.slice(1).join(' / '),
      warning: parts.some(checkInvalid),
    };
  }

  private parseAmount(val: any): number | null {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    if (str === '' || str === '-') return null;
    const num = parseFloat(str.replace(/[^\d\.\-]/g, ''));
    return isNaN(num) ? null : num;
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { filePath, filename, actorId } = job.data;
    const isExcel = filename.endsWith('.xlsx') || filename.endsWith('.xls') || filePath.endsWith('.xlsx') || filePath.endsWith('.xls');

    let totalRows = 0;
    let newCount = 0;
    let updateCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    const rowReports: any[] = [];

    try {
      if (isExcel) {
        let workbook;
        try {
          workbook = XLSX.readFile(filePath);
        } catch (err: any) {
          throw new Error(`Failed to read Excel file: ${err.message}`);
        }

        const validSheets: { name: string; records: any[][] }[] = [];
        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          const records = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
          if (records.length <= 1) continue;

          // Check if sheet contains student header
          const headers = records[0].map(h => String(h || '').trim().toLowerCase().replace(/^\uFEFF/i, ''));
          const hasStudentHeader = headers.some(h => h.includes('student') || h === 'name');
          if (hasStudentHeader) {
            validSheets.push({ name: sheetName, records });
          }
        }

        if (validSheets.length === 0) {
          throw new Error('No sheets with student list columns were found in the Excel workbook.');
        }

        const totalRowsAcrossSheets = validSheets.reduce((sum, s) => sum + (s.records.length - 1), 0);
        totalRows = totalRowsAcrossSheets;

        let globalProcessed = 0;
        for (const sheet of validSheets) {
          const res = await this.processSheetRecords(
            sheet.records,
            job,
            actorId,
            sheet.name,
            globalProcessed,
            totalRowsAcrossSheets
          );
          newCount += res.newCount;
          updateCount += res.updateCount;
          warningCount += res.warningCount;
          errorCount += res.errorCount;
          rowReports.push(...res.rowReports.map(r => ({ ...r, studentName: `[${sheet.name}] ${r.studentName}` })));
          globalProcessed += sheet.records.length - 1;
        }
      } else {
        // Standard CSV processing
        let csvContent = '';
        try {
          csvContent = fs.readFileSync(filePath, 'utf-8');
        } catch (err: any) {
          throw new Error(`Failed to read uploaded file: ${err.message}`);
        }

        let records: any[][] = [];
        try {
          records = parse(csvContent, {
            columns: false,
            skip_empty_lines: true,
            trim: true,
            bom: true,
            relax_column_count: true,
          });
        } catch (err: any) {
          throw new Error(`CSV parsing failed: ${err.message}`);
        }

        if (records.length === 0) {
          throw new Error('CSV file is empty');
        }

        const res = await this.processSheetRecords(
          records,
          job,
          actorId,
          'CSV',
          0,
          records.length - 1
        );
        totalRows = records.length - 1;
        newCount = res.newCount;
        updateCount = res.updateCount;
        warningCount = res.warningCount;
        errorCount = res.errorCount;
        rowReports.push(...res.rowReports);
      }
    } finally {
      // Cleanup local file
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }

    // Save import action in Activity Log
    await this.prisma.client.activityLog.create({
      data: {
        actorId,
        action: 'BULK_IMPORT_CSV',
        entityType: 'ImportJob',
        entityId: job.id as string,
        after: JSON.stringify({
          filename,
          totalRows,
          newCount,
          updateCount,
          warningCount,
          errorCount,
        }),
      },
    });

    return {
      filename,
      totalRows,
      newCount,
      updateCount,
      warningCount,
      errorCount,
      rowReports,
    };
  }

  private async processSheetRecords(
    records: any[][],
    job: Job<any, any, string>,
    actorId: string,
    sheetName: string,
    globalProcessedOffset: number,
    totalRowsAcrossAllSheets: number
  ) {
    const headers = records[0].map(h => String(h || '').trim().toLowerCase().replace(/^\uFEFF/i, ''));

    let studentIndex = -1;
    let schoolIndex = -1;
    let courseIndex = -1;
    let emailIndex = -1;
    let phoneIndex = -1;
    let adjustmentIndex = -1;
    let remarkIndex = -1;
    let examRemarksIndex = -1;
    let counselorIndex = -1;

    const semFeeIndices = new Array(8).fill(-1);
    const semReceivedIndices = new Array(8).fill(-1);
    const semDueIndices = new Array(8).fill(-1);

    const semWords = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      if (h.includes('student') || h === 'name') {
        studentIndex = i;
      } else if (h === 'school') {
        schoolIndex = i;
      } else if (h === 'course' || h === 'stream') {
        courseIndex = i;
      } else if (h.includes('email')) {
        emailIndex = i;
      } else if (h.includes('phone') || h.includes('mobile')) {
        phoneIndex = i;
      } else if (h.includes('adjustment')) {
        adjustmentIndex = i;
      } else if (h === 're_mark' || h === 'remark') {
        remarkIndex = i;
      } else if (h.includes('exam cell remarks') || h.includes('exam_cell_remarks')) {
        examRemarksIndex = i;
      } else if (h === 'counselor') {
        counselorIndex = i;
      } else {
        // Check if it matches any semester
        for (let semIdx = 0; semIdx < 8; semIdx++) {
          const word = semWords[semIdx];
          if (h.includes(word) && h.includes('sem')) {
            semFeeIndices[semIdx] = i;
            // The next column should be received for this semester
            if (i + 1 < headers.length && headers[i + 1].includes('receive')) {
              semReceivedIndices[semIdx] = i + 1;
            }
            // The one after should be due for this semester
            if (i + 2 < headers.length && headers[i + 2].includes('due')) {
              semDueIndices[semIdx] = i + 2;
            }
            break;
          }
        }
      }
    }

    // Robust positional fallbacks if not found dynamically
    if (studentIndex === -1) studentIndex = 1;
    if (schoolIndex === -1) schoolIndex = 2;
    if (courseIndex === -1) courseIndex = 3;

    for (let semIdx = 0; semIdx < 8; semIdx++) {
      if (semFeeIndices[semIdx] === -1) {
        semFeeIndices[semIdx] = 4 + semIdx * 3;
      }
      if (semReceivedIndices[semIdx] === -1) {
        semReceivedIndices[semIdx] = 5 + semIdx * 3;
      }
      if (semDueIndices[semIdx] === -1) {
        semDueIndices[semIdx] = 6 + semIdx * 3;
      }
    }

    if (adjustmentIndex === -1) adjustmentIndex = 28;
    if (emailIndex === -1) emailIndex = 30;
    if (phoneIndex === -1) phoneIndex = 31;

    let newCount = 0;
    let updateCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    const rowReports: Array<{
      rowNumber: number;
      studentName: string;
      status: 'success' | 'warning' | 'error';
      message: string;
      details: string[];
    }> = [];

    // Duplicate detection within the file itself
    const seenKeys = new Map<string, number>(); // key -> rowNumber

    let processed = 0;
    for (let index = 1; index < records.length; index++) {
      const rowNum = index + 1; // row 1 in array is row 2 in Excel
      const record = records[index];
      const name = studentIndex < record.length ? String(record[studentIndex] || '').trim() : '';
      const rawSchool = schoolIndex < record.length ? String(record[schoolIndex] || '').trim() : '';
      const schoolName = rawSchool || 'iLEAD Foundation';
      const courseName = courseIndex < record.length ? String(record[courseIndex] || '').trim() : '';
      const email = emailIndex < record.length ? String(record[emailIndex] || '').trim() : '';
      const phoneRaw = phoneIndex < record.length ? String(record[phoneIndex] || '').trim() : '';

      const details: string[] = [];
      let rowStatus: 'success' | 'warning' | 'error' = 'success';

      // 1. Mandatory validations
      if (!name && !rawSchool) {
        // Skip summary/total rows silently (e.g. at the bottom of the sheets)
        continue;
      }

      if (!name) {
        // If the entire row is empty, skip silently!
        const isRowEmpty = record.every(val => val === undefined || val === null || String(val).trim() === '');
        if (isRowEmpty) {
          continue;
        }
        errorCount++;
        rowReports.push({
          rowNumber: rowNum,
          studentName: 'Unknown',
          status: 'error',
          message: 'Missing mandatory field: Student Name',
          details: ['Row skipped due to missing name'],
        });
        continue;
      }
      if (!schoolName) {
        errorCount++;
        rowReports.push({
          rowNumber: rowNum,
          studentName: name,
          status: 'error',
          message: 'Missing mandatory field: School',
          details: ['Row skipped due to missing school'],
        });
        continue;
      }
      if (!courseName) {
        errorCount++;
        rowReports.push({
          rowNumber: rowNum,
          studentName: name,
          status: 'error',
          message: 'Missing mandatory field: Course',
          details: ['Row skipped due to missing course'],
        });
        continue;
      }

      // Check duplicate within the same sheet
      const fileKey = `${name.toLowerCase().trim()}_${String(phoneRaw || '').toLowerCase().trim()}`;
      if (seenKeys.has(fileKey)) {
        details.push(`Duplicate row detected within the same sheet (previously seen in row ${seenKeys.get(fileKey)})`);
        rowStatus = 'warning';
        warningCount++;
      } else {
        seenKeys.set(fileKey, rowNum);
      }

      try {
        // Run database queries inside a transaction per row for isolation
        await this.prisma.client.$transaction(async (tx) => {
          // 2. Resolve or auto-create School and Course
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

          // 3. Resolve Counselor if specified
          let counselorId: string | null = null;
          const counselorName = counselorIndex !== -1 && counselorIndex < record.length ? String(record[counselorIndex] || '').trim() : '';
          if (counselorName) {
            const counselor = await tx.user.findFirst({
              where: {
                role: 'COUNSELOR',
                deletedAt: null,
                OR: [
                  { name: { equals: counselorName } },
                  { email: { equals: counselorName } },
                ],
              },
            });
            if (counselor) {
              counselorId = counselor.id;
            } else {
              details.push(`Counselor '${counselorName}' not found. Student marked Unassigned.`);
              rowStatus = 'warning';
              warningCount++;
            }
          }

          // 4. Parse phone numbers
          const phoneData = this.parsePhoneNumbers(phoneRaw);
          if (phoneData.warning) {
            details.push(`Phone number field was split or flagged as unusual: '${phoneRaw}'`);
            rowStatus = 'warning';
            warningCount++;
          }

          // 5. Duplicate detection against database (Upsert mapping)
          let student = await tx.student.findFirst({
            where: {
              deletedAt: null,
              OR: [
                email ? { email } : null,
                { name, phonePrimary: phoneData.primary },
              ].filter(Boolean) as any,
            },
          });

          const reMark = remarkIndex !== -1 && remarkIndex < record.length ? String(record[remarkIndex] || '').trim() : '';
          const status = reMark.toLowerCase().includes('drop out') ? 'DROPPED_OUT' : 'ACTIVE';
          const remarks = examRemarksIndex !== -1 && examRemarksIndex < record.length ? String(record[examRemarksIndex] || '').trim() : null;

          const cohort = sheetName.toUpperCase().includes('BATCH')
            ? sheetName.toUpperCase().replace('BATCH', '').trim()
            : null;

          if (student) {
            // Update student
            student = await tx.student.update({
              where: { id: student.id },
              data: {
                schoolId: school.id,
                courseId: course.id,
                counselorId: counselorId || student.counselorId,
                status,
                cohort: cohort || student.cohort,
                examCellRemarks: remarks || student.examCellRemarks,
                phoneSecondary: phoneData.secondary || student.phoneSecondary,
              },
            });
            updateCount++;
          } else {
            // Create student
            student = await tx.student.create({
              data: {
                name,
                schoolId: school.id,
                courseId: course.id,
                email: email || null,
                phonePrimary: phoneData.primary,
                phoneSecondary: phoneData.secondary,
                counselorId,
                status,
                cohort,
                examCellRemarks: remarks,
              },
            });
            newCount++;
          }

          // 6. Process Semesters 1-8 Dues and Payments
          for (let semIndex = 0; semIndex < 8; semIndex++) {
            const semNum = semIndex + 1;
            const feeColIdx = semFeeIndices[semIndex];
            const recColIdx = semReceivedIndices[semIndex];

            const feeAmount = feeColIdx !== -1 && feeColIdx < record.length ? this.parseAmount(record[feeColIdx]) : null;
            const receivedAmount = (recColIdx !== -1 && recColIdx < record.length ? this.parseAmount(record[recColIdx]) : null) || 0;

            if (feeAmount !== null) {
              // Get or create SemesterPlan
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

              // Check if received amount is higher than already logged payments
              const loggedPayments = await tx.payment.findMany({
                where: { semesterPlanId: plan.id },
              });
              const totalLogged = loggedPayments.reduce((sum, p) => sum + p.amount, 0);
              const discrepancy = receivedAmount - totalLogged;

              if (discrepancy > 0) {
                // Record the remaining payment as a new append-only row
                await tx.payment.create({
                  data: {
                    studentId: student.id,
                    semesterPlanId: plan.id,
                    amount: discrepancy,
                    paymentDate: new Date(),
                    recordedById: actorId,
                    idempotencyKey: `import_${job.id}_row_${rowNum}_sem_${semNum}_${randomUUID()}`,
                  },
                });
              } else if (discrepancy < 0) {
                // Overpayment correction needed (negative payment row)
                await tx.payment.create({
                  data: {
                    studentId: student.id,
                    semesterPlanId: plan.id,
                    amount: discrepancy, // Negative payment to offset excess
                    paymentDate: new Date(),
                    recordedById: actorId,
                    idempotencyKey: `import_${job.id}_row_${rowNum}_sem_${semNum}_corr_${randomUUID()}`,
                  },
                });
                details.push(`Semester ${semNum}: Payment correction of ${discrepancy} registered.`);
                rowStatus = 'warning';
                warningCount++;
              }
            } else {
              // If fee is null/dash but received > 0, raise a warning
              if (receivedAmount > 0) {
                details.push(`Semester ${semNum}: Received amount is ₹${receivedAmount} but no Semester Fee is defined. assumed fee of 0.`);
                rowStatus = 'warning';
                warningCount++;

                // Auto create plan with fee 0 to hold payment
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
                    idempotencyKey: `import_${job.id}_row_${rowNum}_sem_${semNum}_missingfee_${randomUUID()}`,
                  },
                });
              }
            }
          }

          // 7. Process adjustments
          const adjustmentsVal = adjustmentIndex !== -1 && adjustmentIndex < record.length ? this.parseAmount(record[adjustmentIndex]) : null;
          if (adjustmentsVal !== null && adjustmentsVal > 0) {
            const adjReason = 'CSV Import Adjustment';
            // Apply to the first active semester plan
            const activePlans = await tx.semesterPlan.findMany({
              where: { studentId: student.id },
              orderBy: { semesterNumber: 'asc' },
            });
            if (activePlans.length > 0) {
              const targetPlan = activePlans[0];

              // Check if adjustment already registered
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
            } else {
              details.push(`Failed to apply adjustments of ₹${adjustmentsVal} - no active semesters generated.`);
              rowStatus = 'warning';
              warningCount++;
            }
          }
        });

        // Row succeeded
        rowReports.push({
          rowNumber: rowNum,
          studentName: name,
          status: rowStatus,
          message: rowStatus === 'success' ? 'Imported successfully' : 'Imported with warnings',
          details,
        });
      } catch (err: any) {
        // Row failed, but do not fail the job (Row-level error reporting)
        errorCount++;
        rowReports.push({
          rowNumber: rowNum,
          studentName: name,
          status: 'error',
          message: `Failed to import: ${err.message}`,
          details: [err.stack || ''],
        });
      }

      // Update progress across all sheets
      processed++;
      const currentProcessedGlobal = globalProcessedOffset + processed;
      const progressPercent = Math.round((currentProcessedGlobal / totalRowsAcrossAllSheets) * 100);
      await job.updateProgress(Math.min(progressPercent, 99));
    }

    return {
      newCount,
      updateCount,
      warningCount,
      errorCount,
      rowReports,
    };
  }
}
