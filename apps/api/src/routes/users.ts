import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AppDataSource } from '@/database/data-source';
import { User, UserRole } from '@/database/entities';
import { authMiddleware, tenantMiddleware } from '@/middleware/auth';
import { asyncWrapper } from '@/utils/asyncWrapper';
import bcrypt from 'bcryptjs';

const router = Router();

const userSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
});

router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const users = await AppDataSource.getRepository(User).find({
      where: { businessId },
      select: ['id', 'firstName', 'lastName', 'email', 'role', 'isActive'],
    });
    res.json(users);
  })
);

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const data = userSchema.parse(req.body);
    
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = AppDataSource.getRepository(User).create({
      ...data,
      passwordHash,
      businessId,
    });
    
    await AppDataSource.getRepository(User).save(user);
    res.status(201).json({ id: user.id, email: user.email });
  })
);

router.patch(
  '/:id/status',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: req.params.id, businessId },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.isActive = isActive;
    await AppDataSource.getRepository(User).save(user);
    res.json(user);
  })
);

export default router;
