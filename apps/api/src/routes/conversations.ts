import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ConversationService } from '@/services/ConversationService';
import { authMiddleware, tenantMiddleware } from '@/middleware/auth';
import { asyncWrapper } from '@/utils/asyncWrapper';

const router = Router();
const conversationService = new ConversationService();

// Validation schemas
const assignSchema = z.object({
  assignedToId: z.string().uuid('Invalid user ID'),
});

const tagSchema = z.object({
  tag: z.string().min(1, 'Tag is required'),
});

// GET /conversations - List conversations with filters
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const options = {
      status: req.query.status as any,
      assignedToId: req.query.assignedToId as string,
      hasAssignee: req.query.hasAssignee === 'true' ? true : req.query.hasAssignee === 'false' ? false : undefined,
    };
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await conversationService.listConversations(businessId, options, limit, offset);
    res.json(result);
  })
);

// GET /conversations/:id - Get conversation details and history
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const history = await conversationService.getConversationHistory(businessId, req.params.id);
    res.json(history);
  })
);

// POST /conversations/:id/assign - Assign conversation to an agent
router.post(
  '/:id/assign',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const data = assignSchema.parse(req.body);
    const conversation = await conversationService.assignConversation(businessId, req.params.id, data.assignedToId);
    res.json(conversation);
  })
);

// POST /conversations/:id/unassign - Remove agent from conversation
router.post(
  '/:id/unassign',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const conversation = await conversationService.unassignConversation(businessId, req.params.id);
    res.json(conversation);
  })
);

// POST /conversations/:id/resolve - Mark as resolved
router.post(
  '/:id/resolve',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const conversation = await conversationService.resolveConversation(businessId, req.params.id);
    res.json(conversation);
  })
);

// POST /conversations/:id/archive - Archive conversation
router.post(
  '/:id/archive',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const conversation = await conversationService.archiveConversation(businessId, req.params.id);
    res.json(conversation);
  })
);

// POST /conversations/:id/tags/add - Add tag to conversation
router.post(
  '/:id/tags/add',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const data = tagSchema.parse(req.body);
    const conversation = await conversationService.addTag(businessId, req.params.id, data.tag);
    res.json(conversation);
  })
);

// DELETE /conversations/:id/tags/:tag - Remove tag from conversation
router.delete(
  '/:id/tags/:tag',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const conversation = await conversationService.removeTag(businessId, req.params.id, req.params.tag);
    res.json(conversation);
  })
);

// GET /conversations/stats - Get conversation analytics
router.get(
  '/stats',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const stats = await conversationService.getStats(businessId);
    res.json(stats);
  })
);

export default router;
