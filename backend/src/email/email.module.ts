import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { EmailController } from './email.controller';

@Global()
@Module({
  controllers: [EmailController],
  providers: [EmailService, ReminderSchedulerService],
  exports: [EmailService, ReminderSchedulerService],
})
export class EmailModule {}
