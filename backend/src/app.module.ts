import './load-env';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SchoolsModule } from './schools/schools.module';
import { StudentsModule } from './students/students.module';
import { PaymentsModule } from './payments/payments.module';
import { CallLogsModule } from './call-logs/call-logs.module';
import { ImportsModule } from './imports/imports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UserContextMiddleware } from './auth/user-context.middleware';
import { EmailModule } from './email/email.module';

const imports = [
  ConfigModule.forRoot({
    isGlobal: true,
  }),
  ScheduleModule.forRoot(),
  PrismaModule,
  AuthModule,
  UsersModule,
  SchoolsModule,
  StudentsModule,
  PaymentsModule,
  CallLogsModule,
  DashboardModule,
  ImportsModule,
  EmailModule,
];

if (process.env.NODE_ENV !== 'test' && process.env.REDIS_ENABLED !== 'false') {
  imports.push(
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        lazyConnect: true,
        maxRetriesPerRequest: null,
        retryStrategy: () => null,
      },
    }) as any,
  );
}

@Module({
  imports,
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UserContextMiddleware)
      .forRoutes('*');
  }
}
