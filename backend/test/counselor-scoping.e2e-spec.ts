import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Counselor Isolation Scoping (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let counselorAToken: string;
  let counselorBToken: string;
  let counselorAId: string;
  let counselorBId: string;

  let studentAId: string;
  let studentBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);

    // Setup schools and courses
    const school = await prisma.client.school.upsert({
      where: { name: 'SOC' },
      update: {},
      create: { name: 'SOC' },
    });

    const course = await prisma.client.course.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'Animation' } },
      update: {},
      create: { schoolId: school.id, name: 'Animation' },
    });

    // Create unique counselor emails
    const emailA = `counselor_a_${Date.now()}@test.com`;
    const emailB = `counselor_b_${Date.now()}@test.com`;
    const hash = await bcrypt.hash('password123', 10);

    const userA = await prisma.client.user.create({
      data: {
        name: 'Counselor A',
        email: emailA,
        passwordHash: hash,
        role: 'COUNSELOR',
      },
    });
    counselorAId = userA.id;

    const userB = await prisma.client.user.create({
      data: {
        name: 'Counselor B',
        email: emailB,
        passwordHash: hash,
        role: 'COUNSELOR',
      },
    });
    counselorBId = userB.id;

    // Log in as Counselor A
    const loginARes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: emailA, password: 'password123' })
      .expect(200);
    counselorAToken = loginARes.body.accessToken;

    // Log in as Counselor B
    const loginBRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: emailB, password: 'password123' })
      .expect(200);
    counselorBToken = loginBRes.body.accessToken;

    // Create Student assigned to A
    const studentA = await prisma.client.student.create({
      data: {
        name: 'Student of A',
        schoolId: school.id,
        courseId: course.id,
        phonePrimary: '1111111111',
        counselorId: counselorAId,
      },
    });
    studentAId = studentA.id;

    // Create Student assigned to B
    const studentB = await prisma.client.student.create({
      data: {
        name: 'Student of B',
        schoolId: school.id,
        courseId: course.id,
        phonePrimary: '2222222222',
        counselorId: counselorBId,
      },
    });
    studentBId = studentB.id;
  });

  afterAll(async () => {
    // Clean up test data safely
    const studentIds = [studentAId, studentBId].filter(Boolean);
    if (studentIds.length > 0) {
      await prisma.client.student.deleteMany({
        where: { id: { in: studentIds } },
      });
    }

    const counselorIds = [counselorAId, counselorBId].filter(Boolean);
    if (counselorIds.length > 0) {
      await prisma.client.user.deleteMany({
        where: { id: { in: counselorIds } },
      });
    }
    await app.close();
  });

  it('Counselor A should view only their assigned student in the list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/students')
      .set('Authorization', `Bearer ${counselorAToken}`)
      .expect(200);

    const students = res.body;
    expect(Array.isArray(students)).toBe(true);

    const hasStudentA = students.some((s: any) => s.id === studentAId);
    const hasStudentB = students.some((s: any) => s.id === studentBId);

    expect(hasStudentA).toBe(true);
    expect(hasStudentB).toBe(false); // Counselor A cannot see Counselor B's student!
  });

  it('Counselor A should fail to retrieve Counselor B student by ID', async () => {
    await request(app.getHttpServer())
      .get(`/api/students/${studentBId}`)
      .set('Authorization', `Bearer ${counselorAToken}`)
      .expect(404); // Should return NotFoundException/404 due to context mapping
  });

  it('Counselor A should successfully retrieve their own student by ID', async () => {
    await request(app.getHttpServer())
      .get(`/api/students/${studentAId}`)
      .set('Authorization', `Bearer ${counselorAToken}`)
      .expect(200);
  });
});
