import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Roles('ADMIN')
  @Post()
  create(@Body() body: any) {
    return this.studentsService.create(body);
  }

  @Roles('ADMIN')
  @Post('bulk')
  createBulk(@Body() body: any, @Req() req: any) {
    const userContext = { userId: req.user.id };
    return this.studentsService.createBulk(body.students, userContext);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.studentsService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.studentsService.findOne(id, req.user);
  }

  @Roles('ADMIN')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const userContext = { role: req.user.role, userId: req.user.id };
    return this.studentsService.update(id, body, userContext);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.studentsService.remove(id, req.user.id);
  }

  @Roles('ADMIN')
  @Post(':id/semesters/:semesterNumber')
  setSemesterFee(
    @Param('id') id: string,
    @Param('semesterNumber') semNum: string,
    @Body() body: { feeAmount?: number; dueDate?: string | null },
    @Req() req: any,
  ) {
    return this.studentsService.setSemesterFee(id, parseInt(semNum), body, { userId: req.user.id });
  }

  @Roles('ADMIN')
  @Post(':id/advance')
  advanceSemester(
    @Param('id') id: string,
    @Body() body: { feeAmount: number; dueDate?: string | null },
    @Req() req: any,
  ) {
    return this.studentsService.advanceSemester(id, body.feeAmount, body.dueDate, { userId: req.user.id });
  }

  @Roles('ADMIN')
  @Post('bulk-assign')
  bulkAssign(
    @Body() body: { studentIds: string[]; counselorId: string | null },
    @Req() req: any,
  ) {
    return this.studentsService.bulkAssign(body.studentIds, body.counselorId, { userId: req.user.id });
  }
}
