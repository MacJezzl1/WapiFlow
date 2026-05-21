import { Repository } from 'typeorm';
import { AppDataSource } from '@/database/data-source';
import { Flow, FlowStatus, NodeType, FlowExecution, ExecutionStatus } from '@/database/entities';
import { APIError } from '@/utils/errors';

export interface CreateFlowPayload {
  name: string;
  description?: string;
}

export interface UpdateFlowPayload {
  name?: string;
  description?: string;
  nodes?: Array<{
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
}

export class FlowService {
  private flowRepo: Repository<Flow>;
  private executionRepo: Repository<FlowExecution>;

  constructor() {
    this.flowRepo = AppDataSource.getRepository(Flow);
    this.executionRepo = AppDataSource.getRepository(FlowExecution);
  }

  async createFlow(businessId: string, payload: CreateFlowPayload): Promise<Flow> {
    const flow = this.flowRepo.create({
      name: payload.name,
      description: payload.description,
      businessId,
      nodes: [],
      edges: [],
      status: FlowStatus.DRAFT,
    });

    return this.flowRepo.save(flow);
  }

  async getFlow(businessId: string, flowId: string): Promise<Flow> {
    const flow = await this.flowRepo.findOne({
      where: { id: flowId, businessId },
    });

    if (!flow) {
      throw new APIError(404, 'Flow not found');
    }

    return flow;
  }

  async listFlows(businessId: string, status?: FlowStatus): Promise<Flow[]> {
    const query = this.flowRepo.createQueryBuilder('flow').where('flow.businessId = :businessId', {
      businessId,
    });

    if (status) {
      query.andWhere('flow.status = :status', { status });
    }

    return query.orderBy('flow.updatedAt', 'DESC').getMany();
  }

  async updateFlow(businessId: string, flowId: string, payload: UpdateFlowPayload): Promise<Flow> {
    const flow = await this.getFlow(businessId, flowId);

    if (flow.status === FlowStatus.PUBLISHED) {
      throw new APIError(400, 'Cannot modify published flows. Create a new version instead.');
    }

    Object.assign(flow, payload);
    return this.flowRepo.save(flow);
  }

  async deleteFlow(businessId: string, flowId: string): Promise<void> {
    const flow = await this.getFlow(businessId, flowId);

    if (flow.status === FlowStatus.PUBLISHED) {
      throw new APIError(400, 'Cannot delete published flows. Archive instead.');
    }

    await this.flowRepo.remove(flow);
  }

  async publishFlow(businessId: string, flowId: string): Promise<Flow> {
    const flow = await this.getFlow(businessId, flowId);

    // Validate flow structure
    if (!flow.nodes || flow.nodes.length === 0) {
      throw new APIError(400, 'Flow must have at least one node');
    }

    const hasStart = flow.nodes.some((node) => node.type === NodeType.START);
    const hasEnd = flow.nodes.some((node) => node.type === NodeType.END);

    if (!hasStart) {
      throw new APIError(400, 'Flow must have a START node');
    }

    if (!hasEnd) {
      throw new APIError(400, 'Flow must have an END node');
    }

    flow.status = FlowStatus.PUBLISHED;
    flow.publishedAt = new Date();

    return this.flowRepo.save(flow);
  }

  async unpublishFlow(businessId: string, flowId: string): Promise<Flow> {
    const flow = await this.getFlow(businessId, flowId);

    if (flow.status !== FlowStatus.PUBLISHED) {
      throw new APIError(400, 'Only published flows can be unpublished');
    }

    flow.status = FlowStatus.DRAFT;
    return this.flowRepo.save(flow);
  }

  async archiveFlow(businessId: string, flowId: string): Promise<Flow> {
    const flow = await this.getFlow(businessId, flowId);

    flow.status = FlowStatus.ARCHIVED;
    return this.flowRepo.save(flow);
  }

  async duplicateFlow(businessId: string, flowId: string, newName: string): Promise<Flow> {
    const flow = await this.getFlow(businessId, flowId);

    const newFlow = this.flowRepo.create({
      name: newName,
      description: flow.description,
      businessId,
      nodes: JSON.parse(JSON.stringify(flow.nodes)),
      edges: JSON.parse(JSON.stringify(flow.edges)),
      status: FlowStatus.DRAFT,
    });

    return this.flowRepo.save(newFlow);
  }

  async getFlowStats(businessId: string, flowId: string): Promise<{
    executionCount: number;
    successCount: number;
    failureCount: number;
    successRate: number;
  }> {
    const flow = await this.getFlow(businessId, flowId);

    const successRate =
      flow.executionCount > 0 ? ((flow.successCount / flow.executionCount) * 100).toFixed(2) : '0.00';

    return {
      executionCount: flow.executionCount,
      successCount: flow.successCount,
      failureCount: flow.failureCount,
      successRate: parseFloat(successRate as string),
    };
  }

  async startExecution(
    businessId: string,
    flowId: string,
    contactId: string,
    variables?: Record<string, unknown>
  ): Promise<FlowExecution> {
    const flow = await this.flowRepo.findOne({
      where: { id: flowId, businessId },
    });

    if (!flow) {
      throw new APIError(404, 'Flow not found');
    }

    if (flow.status !== FlowStatus.PUBLISHED) {
      throw new APIError(400, 'Only published flows can be executed');
    }

    const execution = this.executionRepo.create({
      flowId,
      contactId,
      businessId,
      status: ExecutionStatus.PENDING,
      variables: variables || {},
      currentNodeIndex: 0,
    });

    return this.executionRepo.save(execution);
  }

  async getExecution(businessId: string, executionId: string): Promise<FlowExecution> {
    const execution = await this.executionRepo.findOne({
      where: { id: executionId, businessId },
      relations: ['flow', 'contact'],
    });

    if (!execution) {
      throw new APIError(404, 'Execution not found');
    }

    return execution;
  }

  async listExecutions(businessId: string, flowId?: string, status?: ExecutionStatus): Promise<FlowExecution[]> {
    const query = this.executionRepo
      .createQueryBuilder('execution')
      .where('execution.businessId = :businessId', { businessId });

    if (flowId) {
      query.andWhere('execution.flowId = :flowId', { flowId });
    }

    if (status) {
      query.andWhere('execution.status = :status', { status });
    }

    return query.orderBy('execution.createdAt', 'DESC').getMany();
  }
}
