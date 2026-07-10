import { Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { ImportsProcessor } from './imports.processor';

const isRedisEnabled = process.env.REDIS_ENABLED !== 'false';

// In-memory store for sync job statuses when Redis is disabled
export const mockJobsStore = new Map<string, {
  state: 'active' | 'completed' | 'failed';
  progress: number;
  returnvalue: any;
  failedReason?: string;
}>();

const imports: any[] = [];
const providers: any[] = [ImportsService, ImportsProcessor];

if (isRedisEnabled) {
  imports.push(
    BullModule.registerQueue({
      name: 'csv-import',
    }),
  );
} else {
  // Register a mock queue provider linked to the synchronous ImportsProcessor
  providers.push({
    provide: getQueueToken('csv-import'),
    useFactory: (processor: ImportsProcessor) => {
      return {
        add: async (name: string, data: any) => {
          const jobId = `sync_job_${Date.now()}`;
          
          mockJobsStore.set(jobId, {
            state: 'active',
            progress: 0,
            returnvalue: null,
          });

          // Run the processor in the background (asynchronous local microtask)
          setTimeout(async () => {
            try {
              const mockJob = {
                id: jobId,
                data,
                progress: 0,
                updateProgress: async (p: number) => {
                  mockJobsStore.set(jobId, {
                    state: 'active',
                    progress: p,
                    returnvalue: null,
                  });
                },
              } as any;

              const result = await processor.process(mockJob);

              mockJobsStore.set(jobId, {
                state: 'completed',
                progress: 100,
                returnvalue: result,
              });
            } catch (err: any) {
              mockJobsStore.set(jobId, {
                state: 'failed',
                progress: 100,
                returnvalue: null,
                failedReason: err.message,
              });
            }
          }, 0);

          return { id: jobId };
        },
        getJob: async (id: string) => {
          const jobData = mockJobsStore.get(id);
          if (!jobData) return null;
          return {
            id,
            getState: async () => jobData.state,
            progress: jobData.progress,
            returnvalue: jobData.returnvalue,
            failedReason: jobData.failedReason,
          };
        },
      };
    },
    inject: [ImportsProcessor],
  });
}

@Module({
  imports,
  controllers: [ImportsController],
  providers,
  exports: [ImportsService],
})
export class ImportsModule {}
