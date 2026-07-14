import { Controller, Post, Get, Param, UseInterceptors, UploadedFile, UseGuards, Req, Res, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Roles('ADMIN')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    dest: './uploads',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  }))
  async uploadFile(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv' && ext !== '.xlsx' && ext !== '.xls') {
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}
      throw new BadRequestException('Only CSV or Excel files (.xlsx, .xls) are allowed');
    }

    return this.importsService.queueImport(file.path, file.originalname, req.user.id);
  }

  @Roles('ADMIN')
  @Get('status/:jobId')
  getStatus(@Param('jobId') jobId: string) {
    return this.importsService.getStatus(jobId);
  }

  @Roles('ADMIN')
  @Get('template')
  downloadTemplate(@Res() res: any) {
    const csv = this.importsService.getTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.csv"');
    return res.send(csv);
  }
}
