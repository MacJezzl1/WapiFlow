import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { APIError } from '@/utils/errors';

export interface AuthPayload {
  userId: string;
  businessId: string;
  email: string;
  role: 'ADMIN' | 'AGENT' | 'VIEWER';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      businessId?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new APIError(401, 'Unauthorized - Missing or invalid token');
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

    const decoded = jwt.verify(token, secret) as AuthPayload;

    req.user = decoded;
    req.businessId = decoded.businessId;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Unauthorized - Invalid token',
      });
    }

    if (error instanceof APIError) {
      return res.status(error.statusCode).json(error.toJSON());
    }

    next(error);
  }
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.businessId) {
    return res.status(401).json({
      statusCode: 401,
      message: 'Unauthorized - No tenant context',
    });
  }

  next();
}

export function roleMiddleware(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Forbidden - Insufficient permissions',
      });
    }

    next();
  };
}
