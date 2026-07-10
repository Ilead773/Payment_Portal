import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('email')
export class EmailController {
  constructor(
    private readonly reminderSchedulerService: ReminderSchedulerService,
    private readonly emailService: EmailService,
  ) {}

  @Roles('ADMIN')
  @Post('trigger-reminders')
  async triggerReminders() {
    const result = await this.reminderSchedulerService.sendFeeReminders();
    return {
      success: true,
      message: `Manual fee reminders process executed successfully. Sent ${result.sentCount} reminders.`,
      sentCount: result.sentCount,
    };
  }

  @Roles('ADMIN')
  @Post('send-custom')
  async sendCustom(
    @Body() body: { studentIds: string[]; subject: string; message: string },
  ) {
    const result = await this.emailService.sendCustomEmails(body.studentIds, body.subject, body.message);
    return {
      success: true,
      message: `Successfully processed bulk email send. Sent: ${result.successCount}, Failed: ${result.failedCount}`,
      ...result,
    };
  }
}
