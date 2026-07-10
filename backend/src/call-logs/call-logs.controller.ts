import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CallLogsService } from './call-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('call-logs')
export class CallLogsController {
  constructor(private readonly callLogsService: CallLogsService) {}

  @Post()
  create(
    @Body() body: {
      studentId: string;
      notes: string;
      outcome: string;
      scheduledFollowUp?: string;
    },
    @Req() req: any,
  ) {
    return this.callLogsService.create({
      ...body,
      counselorId: req.user.id,
      scheduledFollowUp: body.scheduledFollowUp ? new Date(body.scheduledFollowUp) : undefined,
    });
  }

  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string) {
    return this.callLogsService.findByStudent(studentId);
  }

  @Get('upcoming')
  getUpcomingFollowUps(@Req() req: any) {
    return this.callLogsService.getUpcomingFollowUps(req.user.id);
  }
}
