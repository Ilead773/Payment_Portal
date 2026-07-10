import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallLogsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    studentId: string;
    counselorId: string;
    notes: string;
    outcome: string;
    scheduledFollowUp?: Date;
  }) {
    // Verify the student exists and is accessible to this counselor (handled by automatic app RLS)
    const student = await this.prisma.client.student.findUnique({
      where: { id: data.studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found or access denied');
    }

    const log = await this.prisma.client.callLog.create({
      data: {
        studentId: data.studentId,
        counselorId: data.counselorId,
        notes: data.notes,
        outcome: data.outcome,
        scheduledFollowUp: data.scheduledFollowUp || null,
      },
    });

    // Also update activity log
    await this.prisma.client.activityLog.create({
      data: {
        actorId: data.counselorId,
        action: 'LOG_CALL',
        entityType: 'CallLog',
        entityId: log.id,
        after: JSON.stringify(log),
      },
    });

    return log;
  }

  async findByStudent(studentId: string) {
    // Verify student is accessible
    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found or access denied');
    }

    return this.prisma.client.callLog.findMany({
      where: { studentId },
      include: {
        counselor: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUpcomingFollowUps(counselorId: string) {
    return this.prisma.client.callLog.findMany({
      where: {
        counselorId,
        scheduledFollowUp: {
          gte: new Date(),
        },
      },
      include: {
        student: {
          select: { id: true, name: true, phonePrimary: true, status: true },
        },
      },
      orderBy: { scheduledFollowUp: 'asc' },
    });
  }
}
