import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AppDataSource } from '@/database/data-source';
import { Contact } from '@/database/entities';
import { authMiddleware, tenantMiddleware } from '@/middleware/auth';
import { asyncWrapper } from '@/utils/asyncWrapper';

const router = Router();

const contactSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  name: z.string().optional(),
  email: z.string().email().optional(),
  tags: z.array(z.string()).optional(),
});

router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const contacts = await AppDataSource.getRepository(Contact).find({
      where: { businessId },
    });
    res.json(contacts);
  })
);

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const data = contactSchema.parse(req.body);
    const contact = AppDataSource.getRepository(Contact).create({
      ...data,
      businessId,
    });
    await AppDataSource.getRepository(Contact).save(contact);
    res.status(201).json(contact);
  })
);

router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const contact = await AppDataSource.getRepository(Contact).findOne({
      where: { id: req.params.id, businessId },
    });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    res.json(contact);
  })
);

router.put(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const data = contactSchema.partial().parse(req.body);
    const contact = await AppDataSource.getRepository(Contact).findOne({
      where: { id: req.params.id, businessId },
    });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    
    Object.assign(contact, data);
    await AppDataSource.getRepository(Contact).save(contact);
    res.json(contact);
  })
);

router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const contact = await AppDataSource.getRepository(Contact).findOne({
      where: { id: req.params.id, businessId },
    });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    
    await AppDataSource.getRepository(Contact).remove(contact);
    res.status(204).send();
  })
);

export default router;
