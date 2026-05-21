import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '@/services/AuthService';
import { authMiddleware } from '@/middleware/auth';
import { asyncWrapper } from '@/utils/asyncWrapper';
import { APIError } from '@/utils/errors';
import { AppDataSource } from '@/database/data-source';
import { User } from '@/database/entities';

const router = Router();
const authService = new AuthService();

// Validation schemas
const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessName: z.string().min(1, 'Business name is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// POST /auth/signup
router.post(
  '/signup',
  asyncWrapper(async (req: Request, res: Response) => {
    const data = signupSchema.parse(req.body);
    const result = await authService.signup(data);
    res.status(201).json(result);
  })
);

// POST /auth/login
router.post(
  '/login',
  asyncWrapper(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    res.json(result);
  })
);

// POST /auth/refresh
router.post(
  '/refresh',
  asyncWrapper(async (req: Request, res: Response) => {
    const data = refreshTokenSchema.parse(req.body);
    const tokens = await authService.refreshToken(data.refreshToken);
    res.json(tokens);
  })
);

// POST /auth/change-password
router.post(
  '/change-password',
  authMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const data = changePasswordSchema.parse(req.body);

    if (!req.user) {
      throw new APIError(401, 'Unauthorized');
    }

    await authService.changePassword(req.user.userId, data.oldPassword, data.newPassword);
    res.json({ message: 'Password changed successfully' });
  })
);

// GET /auth/me
router.get(
  '/me',
  authMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new APIError(401, 'Unauthorized');
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: req.user.userId },
      relations: ['business'],
    });

    if (!user) {
      throw new APIError(404, 'User not found');
    }

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      business: {
        id: user.business.id,
        name: user.business.name,
      },
    });
  })
);

export default router;
