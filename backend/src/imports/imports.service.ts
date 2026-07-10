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
      'Student Name',
      'School',
      'Course',
      '1st Semester Fee',
      '1st Semester Received',
      '2nd Semester Fee',
      '2nd Semester Received',
      '3rd Semester Fee',
      '3rd Semester Received',
      '4th Semester Fee',
      '4th Semester Received',
      '5th Semester Fee',
      '5th Semester Received',
      '6th Semester Fee',
      '6th Semester Received',
      '7th Semester Fee',
      '7th Semester Received',
      '8th Semester Fee',
      '8th Semester Received',
      'Adjustments',
      'Adjustments Reason',
      'Email ID',
      'Phone Number',
      'Re_Mark',
      'Exam Cell Remarks',
      'Counselor',
    ];
    return headers.join(',') + '\n';
  }
}
