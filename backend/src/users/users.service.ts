import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(data: { name: string; email: string; passwordHash: string; role: string }) {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const hashed = await bcrypt.hash(data.passwordHash, 10);

    const user = await this.prisma.client.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: hashed,
        role: data.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Send welcome credentials email asynchronously
    this.emailService.sendWelcomeEmail({ name: user.name, email: user.email }, data.passwordHash)
      .catch(() => {});

    return user;
  }

  async findAll() {
    return this.prisma.client.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }
    const { passwordHash, ...result } = user;
    return result;
  }

  async update(id: string, data: { name?: string; email?: string; password?: string; role?: string; isActive?: boolean }) {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    // Protection for the last administrator
    if (user.role === 'ADMIN') {
      const isDemoting = data.role && data.role !== 'ADMIN';
      const isDeactivating = data.isActive === false;

      if (isDemoting || isDeactivating) {
        const adminCount = await this.prisma.client.user.count({
          where: { role: 'ADMIN', isActive: true, deletedAt: null },
        });

        if (adminCount <= 1 && user.isActive) {
          throw new BadRequestException('Cannot demote or deactivate the last active administrator');
        }
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.client.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    // Protection for the last administrator
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.client.user.count({
        where: { role: 'ADMIN', isActive: true, deletedAt: null },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last active administrator');
      }
    }

    return this.prisma.client.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
