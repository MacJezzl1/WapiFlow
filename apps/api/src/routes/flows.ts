import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { FlowService } from '@/services/FlowService';
import { authMiddleware, tenantMiddleware } from '@/middleware/auth';
import { asyncWrapper } from '@/utils/asyncWrapper';
import { APIError } from '@/utils/errors';

const router = Router();
const flowService = new FlowService();

// Validation schemas
const createFlowSchema = z.object({
  name: z.string().min(1, 'Flow name is required'),
  description: z.string().optional(),
});

const updateFlowSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
    data: z.record(z.any()),
  })).optional(),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
  })).optional(),
});

const executeFlowSchema = z.object({
  contactId: z.string().uuid('Invalid contact ID'),
  variables: z.record(z.any()).optional(),
});

// GET /flows - List all flows for business
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const status = req.query.status as any;
    const flows = await flowService.listFlows(businessId, status);
    res.json(flows);
  })
);

// POST /flows - Create a new flow
router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const data = createFlowSchema.parse(req.body);
    const flow = await flowService.createFlow(businessId, data);
    res.status(201).json(flow);
  })
);

// GET /flows/:id - Get specific flow
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const flow = await flowService.getFlow(businessId, req.params.id);
    res.json(flow);
  })
);

// PUT /flows/:id - Update flow (nodes/edges/metadata)
router.put(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const data = updateFlowSchema.parse(req.body);
    const flow = await flowService.updateFlow(businessId, req.params.id, data);
    res.json(flow);
  })
);

// DELETE /flows/:id - Delete a flow
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    await flowService.deleteFlow(businessId, req.params.id);
    res.status(204).send();
  })
);

// POST /flows/:id/publish - Publish flow for execution
router.post(
  '/:id/publish',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const flow = await flowService.publishFlow(businessId, req.params.id);
    res.json(flow);
  })
);

// POST /flows/:id/unpublish - Set flow back to draft
router.post(
  '/:id/unpublish',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const flow = await flowService.unpublishFlow(businessId, req.params.id);
    res.json(flow);
  })
);

// POST /flows/:id/archive - Archive a flow
router.post(
  '/:id/archive',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const flow = await flowService.archiveFlow(businessId, req.params.id);
    res.json(flow);
  })
);

// POST /flows/:id/duplicate - Duplicate a flow
router.post(
  '/:id/duplicate',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const { newName } = z.object({ newName: z.string() }).parse(req.body);
    const flow = await flowService.duplicateFlow(businessId, req.params.id, newName);
    res.status(201).json(flow);
  })
);

// GET /flows/:id/stats - Get execution statistics
router.get(
  '/:id/stats',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const stats = await flowService.getFlowStats(businessId, req.params.id);
    res.json(stats);
  })
);

// POST /flows/:id/execute - Manually trigger a flow execution
router.post(
  '/:id/execute',
  authMiddleware,
  tenantMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    const businessId = req.businessId!;
    const data = executeFlowSchema.parse(req.body);
    const execution = await flowService.startExecution(
      businessId,
      req.params.id,
      data.contactId,
      data.variables
    );
    res.status(201).json(execution);
  })
);

export default router;
