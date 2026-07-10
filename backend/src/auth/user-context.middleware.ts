import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { userContextStorage } from '../prisma/prisma.service';

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          if (payload && payload.sub && payload.role) {
            userContextStorage.run({ userId: payload.sub, role: payload.role }, () => {
              next();
            });
            return;
          }
        }
      } catch (err) {
        // Suppress decode errors, let JWT Guard reject requests
      }
    }

    userContextStorage.run(undefined as any, () => {
      next();
    });
  }
}
