import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export const userContextStorage = new AsyncLocalStorage<{ userId: string; role: string }>();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Extended client for automatic Counselor isolation (App-level RLS)
  readonly client = this.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = userContextStorage.getStore();

          // Enforce Counselor Scoping
          if (ctx && ctx.role === 'COUNSELOR') {
            const queryArgs = args as any;
            if (queryArgs) {
              queryArgs.where = queryArgs.where || {};

              if (model === 'Student') {
                queryArgs.where.counselorId = ctx.userId;
              } else if (model === 'SemesterPlan') {
                queryArgs.where.student = {
                  ...queryArgs.where.student,
                  counselorId: ctx.userId,
                };
              } else if (model === 'Payment') {
                queryArgs.where.student = {
                  ...queryArgs.where.student,
                  counselorId: ctx.userId,
                };
              } else if (model === 'Adjustment') {
                queryArgs.where.semesterPlan = {
                  ...queryArgs.where.semesterPlan,
                  student: {
                    ...queryArgs.where.semesterPlan?.student,
                    counselorId: ctx.userId,
                  },
                };
              } else if (model === 'CallLog') {
                queryArgs.where.counselorId = ctx.userId;
              }
            }
          }

          return query(args);
        },
      },
    },
  });
}
