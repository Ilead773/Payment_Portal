import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  // Helper to format student fee records
  private formatStudentFees(student: any, isCounselor: boolean = false) {
    let totalDue = 0;
    let totalExpected = 0;
    let totalCollected = 0;

    const semesters = Array.from({ length: 8 }, (_, i) => {
      const semNum = i + 1;
      const plan = student.semesterPlans?.find((p: any) => p.semesterNumber === semNum);
      if (!plan) {
        return {
          semesterNumber: semNum,
          feeAmount: null,
          adjustmentAmount: null,
          receivedAmount: null,
          due: null,
          status: 'NOT_STARTED',
        };
      }

      const receivedAmount = plan.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
      const due = plan.feeAmount - receivedAmount - plan.adjustmentAmount;
      
      totalExpected += plan.feeAmount - plan.adjustmentAmount;
      totalCollected += receivedAmount;
      totalDue += due;

      return {
        id: plan.id,
        semesterNumber: semNum,
        feeAmount: plan.feeAmount,
        adjustmentAmount: plan.adjustmentAmount,
        receivedAmount,
        due,
        status: plan.status,
        dueDate: plan.dueDate,
        lastReminderSentAt: plan.lastReminderSentAt,
      };
    });

    const formatted = {
      id: student.id,
      name: student.name,
      schoolId: student.schoolId,
      courseId: student.courseId,
      school: student.school,
      course: student.course,
      email: student.email,
      phonePrimary: student.phonePrimary,
      phoneSecondary: student.phoneSecondary,
      counselorId: student.counselorId,
      counselor: student.counselor ? { id: student.counselor.id, name: student.counselor.name, email: student.counselor.email } : null,
      status: student.status,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      semesters,
      totalExpected,
      totalCollected,
      totalDue,
      examCellRemarks: isCounselor ? undefined : student.examCellRemarks,
      callLogs: student.callLogs || [],
    };

    return formatted;
  }

  async create(data: {
    name: string;
    schoolId: string;
    courseId: string;
    email?: string;
    phonePrimary: string;
    phoneSecondary?: string;
    counselorId?: string;
    examCellRemarks?: string;
    initialSemesterFee?: number; // Fee for semester 1
  }) {
    // Verify school & course exist
    const school = await this.prisma.client.school.findUnique({ where: { id: data.schoolId } });
    if (!school || school.deletedAt) throw new NotFoundException('School not found');

    const course = await this.prisma.client.course.findUnique({ where: { id: data.courseId } });
    if (!course || course.deletedAt) throw new NotFoundException('Course not found');

    // Create student
    const student = await this.prisma.client.student.create({
      data: {
        name: data.name,
        schoolId: data.schoolId,
        courseId: data.courseId,
        email: data.email,
        phonePrimary: data.phonePrimary,
        phoneSecondary: data.phoneSecondary,
        counselorId: data.counselorId || null,
        examCellRemarks: data.examCellRemarks,
      },
    });

    // Create 1st semester plan by default if fee is provided
    if (data.initialSemesterFee !== undefined) {
      await this.prisma.client.semesterPlan.create({
        data: {
          studentId: student.id,
          semesterNumber: 1,
          feeAmount: data.initialSemesterFee,
          status: 'ACTIVE',
        },
      });
    }

    // Log action
    await this.prisma.client.activityLog.create({
      data: {
        action: 'CREATE_STUDENT',
        entityType: 'Student',
        entityId: student.id,
        after: JSON.stringify(student),
      },
    });

    return this.findOne(student.id);
  }

  async createBulk(
    students: Array<{
      name: string;
      schoolId: string;
      courseId: string;
      email?: string;
      phonePrimary: string;
      phoneSecondary?: string;
      counselorId?: string;
      examCellRemarks?: string;
      semesters?: Array<{
        semesterNumber: number;
        feeAmount: number;
        receivedAmount?: number;
        dueDate?: string | null;
      }>;
    }>,
    userContext: { userId: string }
  ) {
    const results = {
      successCount: 0,
      failedCount: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < students.length; i++) {
      const data = students[i];
      try {
        if (!data.name || !data.schoolId || !data.courseId || !data.phonePrimary) {
          throw new BadRequestException('Missing mandatory fields (Name, School, Course, or Primary Phone)');
        }

        await this.prisma.client.$transaction(async (tx) => {
          // Verify school & course exist
          const school = await tx.school.findUnique({ where: { id: data.schoolId } });
          if (!school || school.deletedAt) throw new NotFoundException('School not found');

          const course = await tx.course.findUnique({ where: { id: data.courseId } });
          if (!course || course.deletedAt) throw new NotFoundException('Course not found');

          if (data.counselorId) {
            const counselor = await tx.user.findFirst({
              where: { id: data.counselorId, role: 'COUNSELOR', deletedAt: null },
            });
            if (!counselor) throw new NotFoundException('Counselor not found');
          }

          // Create student
          const student = await tx.student.create({
            data: {
              name: data.name,
              schoolId: data.schoolId,
              courseId: data.courseId,
              email: data.email || null,
              phonePrimary: data.phonePrimary,
              phoneSecondary: data.phoneSecondary || null,
              counselorId: data.counselorId || null,
              examCellRemarks: data.examCellRemarks || null,
            },
          });

          // Create semester plans & payments
          if (data.semesters && data.semesters.length > 0) {
            for (const sem of data.semesters) {
              if (sem.feeAmount !== undefined && sem.feeAmount !== null) {
                const plan = await tx.semesterPlan.create({
                  data: {
                    studentId: student.id,
                    semesterNumber: sem.semesterNumber,
                    feeAmount: sem.feeAmount,
                    dueDate: sem.dueDate ? new Date(sem.dueDate) : null,
                    status: 'ACTIVE',
                  },
                });

                if (sem.receivedAmount && sem.receivedAmount > 0) {
                  await tx.payment.create({
                    data: {
                      studentId: student.id,
                      semesterPlanId: plan.id,
                      amount: sem.receivedAmount,
                      idempotencyKey: `manual_bulk_${plan.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      recordedById: userContext.userId,
                      paymentDate: new Date(),
                    },
                  });
                }
              }
            }
          }

          // Log action
          await tx.activityLog.create({
            data: {
              actorId: userContext.userId,
              action: 'CREATE_STUDENT_BULK',
              entityType: 'Student',
              entityId: student.id,
              after: JSON.stringify(student),
            },
          });
        });
        results.successCount++;
      } catch (err: any) {
        results.failedCount++;
        results.errors.push(`Row ${i + 1} (${data.name || 'Unknown'}): ${err.message}`);
      }
    }

    return results;
  }


  async findAll(userContext?: { role: string }) {
    const isCounselor = userContext?.role === 'COUNSELOR';

    const students = await this.prisma.client.student.findMany({
      where: { deletedAt: null },
      include: {
        school: true,
        course: true,
        counselor: true,
        semesterPlans: {
          include: {
            payments: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return students.map((s) => this.formatStudentFees(s, isCounselor));
  }

  async findOne(id: string, userContext?: { role: string }) {
    const isCounselor = userContext?.role === 'COUNSELOR';

    const student = await this.prisma.client.student.findFirst({
      where: { id, deletedAt: null },
      include: {
        school: true,
        course: true,
        counselor: true,
        semesterPlans: {
          include: {
            payments: true,
            adjustments: true,
          },
        },
        callLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return this.formatStudentFees(student, isCounselor);
  }

  async update(id: string, data: {
    name?: string;
    schoolId?: string;
    courseId?: string;
    email?: string;
    phonePrimary?: string;
    phoneSecondary?: string;
    counselorId?: string;
    status?: string;
    examCellRemarks?: string;
  }, userContext?: { role: string; userId: string }) {
    const student = await this.prisma.client.student.findFirst({
      where: { id, deletedAt: null },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Capture state before change
    const beforeState = JSON.stringify(student);

    // Validate counselor update
    if (data.counselorId) {
      const counselor = await this.prisma.client.user.findFirst({
        where: { id: data.counselorId, role: 'COUNSELOR', deletedAt: null },
      });
      if (!counselor) throw new BadRequestException('Valid Counselor not found');
    }

    // Freeze checks if status changes to dropped out
    if (data.status === 'DROPPED_OUT' && student.status !== 'DROPPED_OUT') {
      // Freezing logic: future semesters are not started, current stays.
      // Handled by preventing creation of new semester plans. We don't delete existing plans.
    }

    const updated = await this.prisma.client.student.update({
      where: { id },
      data: {
        name: data.name,
        schoolId: data.schoolId,
        courseId: data.courseId,
        email: data.email,
        phonePrimary: data.phonePrimary,
        phoneSecondary: data.phoneSecondary,
        counselorId: data.counselorId !== undefined ? data.counselorId : undefined,
        status: data.status,
        examCellRemarks: data.examCellRemarks,
      },
    });

    // Log action
    await this.prisma.client.activityLog.create({
      data: {
        actorId: userContext?.userId,
        action: 'UPDATE_STUDENT',
        entityType: 'Student',
        entityId: id,
        before: beforeState,
        after: JSON.stringify(updated),
      },
    });

    return this.findOne(id, userContext);
  }

  async remove(id: string, actorId?: string) {
    const student = await this.prisma.client.student.findFirst({
      where: { id, deletedAt: null },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const deleted = await this.prisma.client.student.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.client.activityLog.create({
      data: {
        actorId,
        action: 'DELETE_STUDENT',
        entityType: 'Student',
        entityId: id,
        before: JSON.stringify(student),
        after: JSON.stringify(deleted),
      },
    });

    return { success: true };
  }

  // Manage Semester Plans
  async setSemesterFee(
    studentId: string,
    semesterNumber: number,
    data: { feeAmount?: number; dueDate?: string | Date | null },
    userContext?: { userId: string }
  ) {
    const student = await this.prisma.client.student.findFirst({
      where: { id: studentId, deletedAt: null },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // If student is dropped out, prevent generating new semester plans
    if (student.status === 'DROPPED_OUT') {
      // Find if the plan already exists. If it exists, we can edit it (corrections).
      // If it doesn't exist, we prevent creating it because future semesters are frozen.
      const plan = await this.prisma.client.semesterPlan.findUnique({
        where: { studentId_semesterNumber: { studentId, semesterNumber } },
      });
      if (!plan) {
        throw new BadRequestException('Cannot generate new semester plans for dropped out students');
      }
    }

    const updateData: any = {};
    if (data.feeAmount !== undefined) updateData.feeAmount = data.feeAmount;
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    const createData: any = {
      studentId,
      semesterNumber,
      feeAmount: data.feeAmount ?? 0,
      status: 'ACTIVE',
    };
    if (data.dueDate !== undefined && data.dueDate !== null) {
      createData.dueDate = new Date(data.dueDate);
    }

    const plan = await this.prisma.client.semesterPlan.upsert({
      where: {
        studentId_semesterNumber: { studentId, semesterNumber },
      },
      update: updateData,
      create: createData,
    });

    await this.prisma.client.activityLog.create({
      data: {
        actorId: userContext?.userId,
        action: 'SET_SEMESTER_FEE',
        entityType: 'SemesterPlan',
        entityId: plan.id,
        after: JSON.stringify(plan),
      },
    });

    return plan;
  }

  // Advance Semester (Admin only triggers this to progress a student)
  async advanceSemester(studentId: string, feeAmount: number, dueDate?: string | Date | null, userContext?: { userId: string }) {
    const student = await this.prisma.client.student.findFirst({
      where: { id: studentId, deletedAt: null },
      include: { semesterPlans: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (student.status === 'DROPPED_OUT') {
      throw new BadRequestException('Cannot advance a dropped out student');
    }

    // Find the next semester number
    const activeSemesters = student.semesterPlans.map((sp) => sp.semesterNumber);
    const nextSem = activeSemesters.length > 0 ? Math.max(...activeSemesters) + 1 : 1;

    if (nextSem > 8) {
      throw new BadRequestException('Student has already reached the maximum 8th semester');
    }

    const plan = await this.prisma.client.semesterPlan.create({
      data: {
        studentId,
        semesterNumber: nextSem,
        feeAmount,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'ACTIVE',
      },
    });

    await this.prisma.client.activityLog.create({
      data: {
        actorId: userContext?.userId,
        action: 'ADVANCE_SEMESTER',
        entityType: 'SemesterPlan',
        entityId: plan.id,
        after: JSON.stringify(plan),
      },
    });

    return this.findOne(studentId);
  }

  // Bulk assign counselor to multiple students
  async bulkAssign(studentIds: string[], counselorId: string | null, userContext: { userId: string }) {
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      throw new BadRequestException('No student IDs provided');
    }

    if (counselorId) {
      const counselor = await this.prisma.client.user.findFirst({
        where: { id: counselorId, role: 'COUNSELOR', deletedAt: null },
      });
      if (!counselor) {
        throw new BadRequestException('Selected counselor does not exist or is inactive');
      }
    }

    const results = await this.prisma.client.$transaction(async (tx) => {
      const updatedStudents = [];
      for (const id of studentIds) {
        const student = await tx.student.findFirst({
          where: { id, deletedAt: null },
        });
        if (!student) continue;

        const beforeState = JSON.stringify(student);

        const updated = await tx.student.update({
          where: { id },
          data: { counselorId },
        });

        await tx.activityLog.create({
          data: {
            actorId: userContext.userId,
            action: 'UPDATE_STUDENT_COUNSELOR_BULK',
            entityType: 'Student',
            entityId: id,
            before: beforeState,
            after: JSON.stringify(updated),
          },
        });

        updatedStudents.push(updated);
      }
      return updatedStudents;
    });

    return { success: true, count: results.length };
  }
}
