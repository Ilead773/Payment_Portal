import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles('ADMIN')
  @Get('admin')
  getAdminStats() {
    return this.dashboardService.getAdminStats();
  }

  @Roles('COUNSELOR')
  @Get('counselor')
  getCounselorStats(@Req() req: any) {
    return this.dashboardService.getCounselorStats(req.user.id);
  }
}
