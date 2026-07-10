import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Record a payment (Append-only)
  async recordPayment(data: {
    studentId: string;
    semesterPlanId: string;
    amount: number;
    paymentDate?: Date;
    recordedById: string;
    idempotencyKey: string;
  }) {
    if (data.amount <= 0) {
      throw new BadRequestException('Payment amount must be positive');
    }

    // Verify student and plan exist and belong together
    const plan = await this.prisma.client.semesterPlan.findFirst({
      where: { id: data.semesterPlanId, studentId: data.studentId },
    });
    if (!plan) {
      throw new NotFoundException('Semester plan not found for this student');
    }

    // Check for duplicate payment via idempotency key
    const existingPayment = await this.prisma.client.payment.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });
    if (existingPayment) {
      return existingPayment; // Idempotent return
    }

    // Record payment in transaction
    const payment = await this.prisma.client.payment.create({
      data: {
        studentId: data.studentId,
        semesterPlanId: data.semesterPlanId,
        amount: data.amount,
        paymentDate: data.paymentDate || new Date(),
        recordedById: data.recordedById,
        idempotencyKey: data.idempotencyKey,
      },
    });

    // Log in audit log
    await this.prisma.client.activityLog.create({
      data: {
        actorId: data.recordedById,
        action: 'RECORD_PAYMENT',
        entityType: 'Payment',
        entityId: payment.id,
        after: JSON.stringify(payment),
      },
    });

    // Send payment receipt email asynchronously
    this.prisma.client.student.findUnique({
      where: { id: data.studentId },
    }).then((student) => {
      if (student && student.email) {
        this.emailService.sendPaymentReceiptEmail(
          { name: student.name, email: student.email },
          { amount: payment.amount, paymentDate: payment.paymentDate },
          { semesterNumber: plan.semesterNumber, feeAmount: plan.feeAmount }
        ).catch(() => {});
      }
    }).catch(() => {});

    return payment;
  }

  // Apply Adjustment (with mandatory note)
  async applyAdjustment(data: {
    semesterPlanId: string;
    amount: number;
    reason: string;
    recordedById: string;
  }) {
    if (!data.reason || data.reason.trim().length === 0) {
      throw new BadRequestException('Adjustment reason is mandatory');
    }

    // Find plan and student
    const plan = await this.prisma.client.semesterPlan.findUnique({
      where: { id: data.semesterPlanId },
      include: { student: true },
    });
    if (!plan) {
      throw new NotFoundException('Semester plan not found');
    }

    // Adjustments can be positive (discount) or negative (charge adjustment)
    // Run inside transaction to keep cached adjustmentAmount synced on plan
    const adjustment = await this.prisma.client.$transaction(async (tx) => {
      const adj = await tx.adjustment.create({
        data: {
          semesterPlanId: data.semesterPlanId,
          amount: data.amount,
          reason: data.reason,
          recordedById: data.recordedById,
        },
      });

      await tx.semesterPlan.update({
        where: { id: data.semesterPlanId },
        data: {
          adjustmentAmount: { increment: data.amount },
        },
      });

      return adj;
    });

    // Log audit log
    await this.prisma.client.activityLog.create({
      data: {
        actorId: data.recordedById,
        action: 'APPLY_ADJUSTMENT',
        entityType: 'Adjustment',
        entityId: adjustment.id,
        after: JSON.stringify(adjustment),
      },
    });

    return adjustment;
  }

  // Read payments
  async getPaymentsByStudent(studentId: string) {
    return this.prisma.client.payment.findMany({
      where: { studentId },
      include: {
        recordedBy: {
          select: { id: true, name: true, email: true },
        },
        semesterPlan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Read adjustments
  async getAdjustmentsByStudent(studentId: string) {
    return this.prisma.client.adjustment.findMany({
      where: {
        semesterPlan: { studentId },
      },
      include: {
        recordedBy: {
          select: { id: true, name: true, email: true },
        },
        semesterPlan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
