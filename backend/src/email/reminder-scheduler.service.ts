import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Daily cron job at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Starting automated fee payment reminder checks...');
    const result = await this.sendFeeReminders();
    this.logger.log(`Reminder checks completed. Sent ${result.sentCount} reminders.`);
  }

  async sendFeeReminders(): Promise<{ sentCount: number }> {
    const currentDate = new Date();
    
    // Find all active semester plans that have a due date set
    const activePlans = await this.prisma.client.semesterPlan.findMany({
      where: {
        status: 'ACTIVE',
        dueDate: {
          not: null,
        },
      },
      include: {
        student: true,
        payments: true,
      },
    });

    let sentCount = 0;

    for (const plan of activePlans) {
      if (!plan.student || plan.student.deletedAt || plan.student.status !== 'ACTIVE') {
        continue;
      }

      if (!plan.student.email) {
        this.logger.warn(`Student ${plan.student.name} has no email configured. Skipping reminder.`);
        continue;
      }

      const receivedAmount = plan.payments.reduce((sum, p) => sum + p.amount, 0);
      const dueAmount = plan.feeAmount - plan.adjustmentAmount - receivedAmount;

      if (dueAmount <= 0) {
        continue; // Already paid in full or adjusted
      }

      const dueDate = plan.dueDate!;
      
      // Calculate date 30 days (approximately 1 month) before due date
      const startReminderDate = new Date(dueDate.getTime());
      startReminderDate.setDate(startReminderDate.getDate() - 30);

      // Check if current date is within the reminder window (from 1 month before due date onwards)
      if (currentDate < startReminderDate) {
        continue; // Too early
      }

      // Check if lastReminderSentAt is null or was more than 7 days ago
      const lastSent = plan.lastReminderSentAt;
      if (lastSent) {
        const diffInMs = currentDate.getTime() - lastSent.getTime();
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
        if (diffInDays < 7) {
          continue; // Already sent a reminder this week
        }
      }

      // Send the reminder
      this.logger.log(`Sending automated fee reminder to ${plan.student.name} (${plan.student.email}) for Semester ${plan.semesterNumber} (Due: ${dueDate.toLocaleDateString()})`);
      
      const success = await this.emailService.sendFeeReminderEmail(
        { name: plan.student.name, email: plan.student.email },
        {
          semesterNumber: plan.semesterNumber,
          feeAmount: plan.feeAmount,
          dueAmount: dueAmount,
          dueDate: dueDate,
        }
      );

      if (success) {
        // Update lastReminderSentAt
        await this.prisma.client.semesterPlan.update({
          where: { id: plan.id },
          data: { lastReminderSentAt: currentDate },
        });
        sentCount++;
      }
    }

    return { sentCount };
  }
}
