import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImportsService {
  constructor(@InjectQueue('csv-import') private readonly csvQueue: Queue) {}

  async queueImport(filePath: string, filename: string, actorId: string) {
    const job = await this.csvQueue.add(
      'process-csv',
      { filePath, filename, actorId },
      { removeOnComplete: true, removeOnFail: false },
    );
    return { jobId: job.id };
  }

  async getStatus(jobId: string) {
    const job = await this.csvQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress,
      result: job.returnvalue || null,
      failedReason: job.failedReason || null,
    };
  }

  getTemplate() {
    const headers = [
      'SL NO.',
      'STUDENT',
      'SCHOOL',
      'COURSE',
      ' 1st Semester ',
      ' RECEIVED ',
      ' DUE ',
      ' 2nd Semester ',
      ' RECEIVED ',
      ' DUE ',
      ' 3rd  Semester ',
      ' RECEIVED ',
      ' DUE ',
      '4th Semester',
      'RECEIVED',
      'DUE',
      ' 5th  Semester ',
      ' RECEIVED ',
      ' DUE ',
      ' 6th  Semester ',
      'RECEIVED',
      ' DUE ',
      '7th  Semester',
      'RECEIVED',
      'DUE',
      '8th  Semester',
      'RECEIVED',
      'DUE',
      ' Adjustment ',
      ' TOTAL DUE ',
      ' Email Id ',
      ' Phone Number',
    ];
    return headers.join(',') + '\n';
  }
}
