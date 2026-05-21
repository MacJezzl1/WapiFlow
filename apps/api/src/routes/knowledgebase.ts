import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { KnowledgeBaseService } from '@/services/KnowledgeBaseService';
import { authMiddleware, tenantMiddleware } from '@/middleware/auth';
import { asyncWrapper } from '@/utils/asyncWrapper';

const router = Router();
const kbService = new KnowledgeBaseService();

const kbSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const data = kbSchema.parse(req.body);
    const entry = await kbService.createEntry(req.businessId!, data);
    res.status(201).json(entry);
  })
);

router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const category = req.query.category as string;
    const entries = await kbService.listEntries(req.businessId!, category);
    res.json(entries);
  })
);

router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const entry = await kbService.getEntry(req.businessId!, req.params.id);
    res.json(entry);
  })
);

router.put(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const data = kbSchema.partial().parse(req.body);
    const entry = await kbService.updateEntry(req.businessId!, req.params.id, data);
    res.json(entry);
  })
);

router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    await kbService.deleteEntry(req.businessId!, req.params.id);
    res.status(204).send();
  })
);

export default router;
