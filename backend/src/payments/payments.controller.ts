import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles('ADMIN')
  @Post()
  recordPayment(
    @Body() body: {
      studentId: string;
      semesterPlanId: string;
      amount: number;
      paymentDate?: string;
      idempotencyKey: string;
    },
    @Req() req: any,
  ) {
    return this.paymentsService.recordPayment({
      ...body,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : undefined,
      recordedById: req.user.id,
    });
  }

  @Roles('ADMIN')
  @Post('adjustments')
  applyAdjustment(
    @Body() body: {
      semesterPlanId: string;
      amount: number;
      reason: string;
    },
    @Req() req: any,
  ) {
    return this.paymentsService.applyAdjustment({
      ...body,
      recordedById: req.user.id,
    });
  }

  @Get('student/:studentId')
  getPaymentsByStudent(@Param('studentId') studentId: string) {
    return this.paymentsService.getPaymentsByStudent(studentId);
  }

  @Get('adjustments/student/:studentId')
  getAdjustmentsByStudent(@Param('studentId') studentId: string) {
    return this.paymentsService.getAdjustmentsByStudent(studentId);
  }
}
