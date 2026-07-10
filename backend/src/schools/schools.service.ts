import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  // School operations
  async createSchool(name: string) {
    const existing = await this.prisma.client.school.findUnique({
      where: { name },
    });
    if (existing) {
      if (existing.deletedAt) {
        // Restore deleted school
        return this.prisma.client.school.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        });
      }
      throw new BadRequestException('School already exists');
    }
    return this.prisma.client.school.create({
      data: { name },
    });
  }

  async findAllSchools() {
    return this.prisma.client.school.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { courses: true, students: true },
        },
      },
    });
  }

  async removeSchool(id: string) {
    const school = await this.prisma.client.school.findUnique({ where: { id } });
    if (!school || school.deletedAt) throw new NotFoundException('School not found');

    return this.prisma.client.school.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Course operations
  async createCourse(schoolId: string, name: string) {
    const school = await this.prisma.client.school.findUnique({ where: { id: schoolId } });
    if (!school || school.deletedAt) throw new NotFoundException('School not found');

    const existing = await this.prisma.client.course.findUnique({
      where: { schoolId_name: { schoolId, name } },
    });
    if (existing) {
      if (existing.deletedAt) {
        return this.prisma.client.course.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        });
      }
      throw new BadRequestException('Course already exists in this school');
    }

    return this.prisma.client.course.create({
      data: { schoolId, name },
    });
  }

  async findAllCourses() {
    return this.prisma.client.course.findMany({
      where: { deletedAt: null },
      include: {
        school: true,
      },
    });
  }

  async findCoursesBySchool(schoolId: string) {
    return this.prisma.client.course.findMany({
      where: { schoolId, deletedAt: null },
    });
  }

  async removeCourse(id: string) {
    const course = await this.prisma.client.course.findUnique({ where: { id } });
    if (!course || course.deletedAt) throw new NotFoundException('Course not found');

    return this.prisma.client.course.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
