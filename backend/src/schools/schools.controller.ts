import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Roles('ADMIN')
  @Post()
  createSchool(@Body('name') name: string) {
    return this.schoolsService.createSchool(name);
  }

  @Get()
  findAllSchools() {
    return this.schoolsService.findAllSchools();
  }

  @Roles('ADMIN')
  @Delete(':id')
  removeSchool(@Param('id') id: string) {
    return this.schoolsService.removeSchool(id);
  }

  @Roles('ADMIN')
  @Post(':schoolId/courses')
  createCourse(@Param('schoolId') schoolId: string, @Body('name') name: string) {
    return this.schoolsService.createCourse(schoolId, name);
  }

  @Get('courses')
  findAllCourses() {
    return this.schoolsService.findAllCourses();
  }

  @Get(':schoolId/courses')
  findCoursesBySchool(@Param('schoolId') schoolId: string) {
    return this.schoolsService.findCoursesBySchool(schoolId);
  }

  @Roles('ADMIN')
  @Delete('courses/:id')
  removeCourse(@Param('id') id: string) {
    return this.schoolsService.removeCourse(id);
  }
}
