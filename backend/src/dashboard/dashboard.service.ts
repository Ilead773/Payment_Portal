import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private calculateStudentSummary(s: any) {
    let due = 0;
    let collected = 0;
    let expected = 0;

    s.semesterPlans.forEach((plan: any) => {
      const received = plan.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      const planDue = plan.feeAmount - received - plan.adjustmentAmount;
      due += planDue;
      collected += received;
      expected += (plan.feeAmount - plan.adjustmentAmount);
    });

    return { due, collected, expected };
  }

  private getStudentBatchYear(student: any): number {
    const activeSemPlans = student.semesterPlans.filter((p: any) => p.feeAmount > 0);
    let highestSem = 0;
    if (activeSemPlans.length > 0) {
      highestSem = Math.max(...activeSemPlans.map((p: any) => p.semesterNumber));
    }
    
    if (highestSem === 0) return 2025; // default fallback
    
    if (highestSem % 2 === 0) {
      return 2025 - Math.floor(highestSem / 2) + 1;
    } else {
      return 2026 - Math.floor((highestSem - 1) / 2);
    }
  }

  async getAdminStats() {
    const students = await this.prisma.client.student.findMany({
      where: { deletedAt: null },
      include: {
        semesterPlans: {
          include: { payments: true },
        },
      },
    });

    let totalStudents = students.length;
    let dropOutCount = 0;
    let activeCount = 0;
    let totalExpected = 0;
    let totalCollected = 0;
    let totalDue = 0;

    students.forEach((s) => {
      if (s.status === 'DROPPED_OUT') dropOutCount++;
      else activeCount++;

      const summary = this.calculateStudentSummary(s);
      totalExpected += summary.expected;
      totalCollected += summary.collected;
      totalDue += summary.due;
    });

    const recentStudents = await this.prisma.client.student.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { school: true, course: true },
    });

    const recentPayments = await this.prisma.client.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        student: { select: { name: true } },
        semesterPlan: { select: { semesterNumber: true } },
      },
    });

    // ----------------------------------------------------
    // EXECUTIVE REPORTS CALCULATIONS
    // ----------------------------------------------------
    const activeStudents = students.filter(s => s.status === 'ACTIVE');

    let evenTotalStudents = 0;
    let evenPaidCount = 0;
    let evenPendingCount = 0;
    let evenReceivables = 0;
    let evenReceived = 0;
    let evenSuspense = 0;
    let evenDue = 0;

    let oddTotalStudents = 0;
    let oddPaidCount = 0;
    let oddPendingCount = 0;
    let oddReceivables = 0;
    let oddReceived = 0;
    let oddSuspense = 0;
    let oddDue = 0;

    activeStudents.forEach((student) => {
      const plansMap = new Map<number, any>();
      student.semesterPlans.forEach(p => plansMap.set(p.semesterNumber, p));

      const batchYear = this.getStudentBatchYear(student);

      // Even Report active semester: e.g., 6 for 2023, 4 for 2024, 2 for 2025
      const expectedEvenSem = 2 * (2025 - batchYear) + 2;

      if (expectedEvenSem > 0 && plansMap.has(expectedEvenSem)) {
        const plan = plansMap.get(expectedEvenSem);
        const fee = plan.feeAmount;
        const rec = plan.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const suspense = rec > fee ? rec - fee : 0;
        const netRec = Math.min(fee, rec);
        const due = fee - rec;

        evenTotalStudents++;
        evenReceivables += fee;
        evenReceived += netRec;
        evenSuspense += suspense;
        evenDue += due;

        if (due <= 0) evenPaidCount++;
        else evenPendingCount++;
      }

      // Odd Report active semester: e.g., 5 for 2024, 3 for 2025
      const expectedOddSem = 2 * (2026 - batchYear) + 1;

      if (expectedOddSem > 0 && plansMap.has(expectedOddSem)) {
        const plan = plansMap.get(expectedOddSem);
        const fee = plan.feeAmount;
        const rec = plan.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const suspense = rec > fee ? rec - fee : 0;
        const netRec = Math.min(fee, rec);
        const due = fee - rec;

        oddTotalStudents++;
        oddReceivables += fee;
        oddReceived += netRec;
        oddSuspense += suspense;
        oddDue += due;

        if (due <= 0) oddPaidCount++;
        else oddPendingCount++;
      }
    });

    // Daily breakdown: query latest day with payments
    let dailyAdmissions = 0;
    let dailyEven = 0;
    let dailyOdd = 0;

    const latestPayment = await this.prisma.client.payment.findFirst({
      orderBy: { paymentDate: 'desc' },
    });

    if (latestPayment) {
      const startOfDay = new Date(latestPayment.paymentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(latestPayment.paymentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const dailyPayments = await this.prisma.client.payment.findMany({
        where: {
          paymentDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          semesterPlan: true,
        },
      });

      dailyPayments.forEach((p) => {
        const sem = p.semesterPlan.semesterNumber;
        if (sem === 1) {
          dailyAdmissions += p.amount;
        } else if (sem % 2 === 0) {
          dailyEven += p.amount;
        } else {
          dailyOdd += p.amount;
        }
      });
    }

    // Default fallbacks to match screenshot exactly if database has no active students in these semesters
    const executiveReports = {
      evenReport: {
        totalStudents: evenTotalStudents,
        paidCount: evenPaidCount,
        pendingCount: evenPendingCount,
        receivables: evenReceivables,
        received: evenReceived,
        suspense: evenSuspense,
        due: evenDue,
      },
      oddReport: {
        totalStudents: oddTotalStudents,
        paidCount: oddPaidCount,
        pendingCount: oddPendingCount,
        receivables: oddReceivables,
        received: oddReceived,
        suspense: oddSuspense,
        due: oddDue,
      },
      dailyBreakdown: {
        admissions: dailyAdmissions,
        evenSemester: dailyEven,
        oddSemester: dailyOdd,
        totalReceived: (dailyAdmissions + dailyEven + dailyOdd),
      }
    };

    // Cohort Ledger Calculations
    const batchesConfig = [
      { name: '2025 BATCH', id: '2025' },
      { name: '2024 BATCH', id: '2024' },
      { name: '2023 BATCH', id: '2023' },
    ];

    const cohortLedger = batchesConfig.map((b) => ({
      name: b.name,
      id: b.id,
      studentCount: 0,
      semesters: Array.from({ length: 8 }, (_, i) => ({
        semesterNumber: i + 1,
        fees: 0,
        received: 0,
        due: 0,
        nosDue: 0,
      })),
      totals: { fees: 0, received: 0, due: 0 },
    }));

    students.forEach((student) => {
      const batchYear = this.getStudentBatchYear(student);
      let batchIndex = 0; // Default to 2025
      if (batchYear === 2023) {
        batchIndex = 2; // 2023 Batch
      } else if (batchYear === 2024) {
        batchIndex = 1; // 2024 Batch
      } else {
        batchIndex = 0; // 2025 Batch
      }

      const cohort = cohortLedger[batchIndex];
      cohort.studentCount++;

      student.semesterPlans.forEach((plan: any) => {
        const semIdx = plan.semesterNumber - 1;
        if (semIdx >= 0 && semIdx < 8) {
          const received = plan.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
          const due = plan.feeAmount - received - plan.adjustmentAmount;

          cohort.semesters[semIdx].fees += plan.feeAmount;
          cohort.semesters[semIdx].received += received;
          cohort.semesters[semIdx].due += due;

          if (due > 0) {
            cohort.semesters[semIdx].nosDue++;
          }
        }
      });
    });

    // Calculate totals for each cohort
    cohortLedger.forEach((cohort) => {
      cohort.semesters.forEach((sem) => {
        cohort.totals.fees += sem.fees;
        cohort.totals.received += sem.received;
        cohort.totals.due += sem.due;
      });
    });

    // Calculate semester total dues across cohorts
    const semesterTotals = Array.from({ length: 8 }, (_, i) => {
      const semNum = i + 1;
      const totalDue = cohortLedger.reduce((sum, b) => sum + b.semesters[i].due, 0);
      return { semesterNumber: semNum, totalDue };
    });

    let grandTotalDue = semesterTotals.reduce((sum, s) => sum + s.totalDue, 0);



    return {
      totalStudents,
      activeCount,
      dropOutCount,
      totalExpected,
      totalCollected,
      totalDue,
      recentStudents,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        studentName: p.student.name,
        semesterNumber: p.semesterPlan.semesterNumber,
        amount: p.amount,
        paymentDate: p.paymentDate,
      })),
      executiveReports,
      cohortLedger: {
        cohorts: cohortLedger,
        semesterTotals,
        grandTotalDue,
      },
    };
  }

  async getCounselorStats(counselorId: string) {
    const students = await this.prisma.client.student.findMany({
      where: { counselorId, deletedAt: null },
      include: {
        semesterPlans: {
          include: { payments: true },
        },
      },
    });

    let totalStudents = students.length;
    let totalPending = 0;
    let dueNowCount = 0;
    let overdueCount = 0;

    students.forEach((s) => {
      const summary = this.calculateStudentSummary(s);
      totalPending += summary.due;

      if (summary.due > 0) {
        overdueCount++;
        // If they owe money on their active semesters
        dueNowCount++; 
      }
    });

    // Fetch upcoming follow-ups
    const upcomingFollowUps = await this.prisma.client.callLog.findMany({
      where: {
        counselorId,
        scheduledFollowUp: {
          gte: new Date(),
        },
      },
      include: {
        student: {
          select: { name: true },
        },
      },
      orderBy: { scheduledFollowUp: 'asc' },
      take: 5,
    });

    return {
      totalStudents,
      totalPending,
      dueNowCount,
      overdueCount,
      upcomingFollowUps: upcomingFollowUps.map((f) => ({
        id: f.id,
        studentName: f.student.name,
        notes: f.notes,
        outcome: f.outcome,
        scheduledFollowUp: f.scheduledFollowUp,
      })),
    };
  }
}
