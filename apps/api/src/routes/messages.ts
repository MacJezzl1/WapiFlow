import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { MessageService } from '@/services/MessageService';
import { authMiddleware, tenantMiddleware } from '@/middleware/auth';
import { asyncWrapper } from '@/utils/asyncWrapper';
import { MessageDirection, MessageStatus, MessageType } from '@/database/entities';

const router = Router();
const messageService = new MessageService();

// Validation schemas
const sendMessageSchema = z.object({
  contactId: z.string().uuid('Invalid contact ID'),
  content: z.string().min(1, 'Message content is required'),
  type: z.nativeEnum(MessageType).optional(),
  metadata: z.record(z.any()).optional(),
});

const messageFilterSchema = z.object({
  contactId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  direction: z.nativeEnum(MessageDirection).optional(),
  status: z.nativeEnum(MessageStatus).optional(),
  type: z.nativeEnum(MessageType).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(MessageStatus),
});

// POST /messages - Send a message to a contact
router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const data = sendMessageSchema.parse(req.body);
    const message = await messageService.sendMessage(businessId, data);
    res.status(201).json(message);
  })
);

// GET /messages - List messages with filters
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const filters = messageFilterSchema.parse(req.query);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await messageService.listMessages(businessId, filters, limit, offset);
    res.json(result);
  })
);

// GET /messages/:id - Get a specific message
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const message = await messageService.getMessage(businessId, req.params.id);
    res.json(message);
  })
);

// PATCH /messages/:id/status - Update message status (e.g., READ, DELIVERED)
router.patch(
  '/:id/status',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const data = updateStatusSchema.parse(req.body);
    const message = await messageService.updateMessageStatus(businessId, req.params.id, data.status);
    res.json(message);
  })
);

// DELETE /messages/:id - Delete a message
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    await messageService.deleteMessage(businessId, req.params.id);
    res.status(204).send();
  })
);

// GET /messages/search - Search messages by content
router.get(
  '/search',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const query = z.string().min(1).parse(req.query.q);
    const messages = await messageService.searchMessages(businessId, query);
    res.json(messages);
  })
);

// GET /messages/stats - Get messaging statistics
router.get(
  '/stats',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const stats = await messageService.getStats(businessId);
    res.json(stats);
  })
);

export default router;
