import { Repository } from 'typeorm';
import { AppDataSource } from '@/database/data-source';
import { Flow, FlowExecution, ExecutionStatus, NodeType, Contact } from '@/database/entities';
import { APIError } from '@/utils/errors';
import { AIReplyService, AIReplyRequest } from '@/services/AIReplyService';

export interface NodeExecutionContext {
  flow: Flow;
  execution: FlowExecution;
  contact: Contact;
  nodeIndex: number;
}

export interface NodeExecutionContext {
  flow: Flow;
  execution: FlowExecution;
  contact: Contact;
  nodeIndex: number;
}

export interface NodeExecutionResult {
  success: boolean;
  nextNodeIndex?: number;
  variables?: Record<string, unknown>;
  error?: string;
}

export class FlowExecutionEngine {
  private flowRepo: Repository<Flow>;
  private executionRepo: Repository<FlowExecution>;
  private contactRepo: Repository<Contact>;
  private aiReplyService: AIReplyService;
  private maxSteps = 100; // Prevent infinite loops

  constructor() {
    this.flowRepo = AppDataSource.getRepository(Flow);
    this.executionRepo = AppDataSource.getRepository(FlowExecution);
    this.contactRepo = AppDataSource.getRepository(Contact);
    this.aiReplyService = new AIReplyService();
  }

  async executeFlow(execution: FlowExecution): Promise<void> {
    try {
      // Mark execution as running
      execution.status = ExecutionStatus.RUNNING;
      execution.startedAt = new Date();
      await this.executionRepo.save(execution);

      // Load full flow and contact data
      const flow = await this.flowRepo.findOne({ where: { id: execution.flowId } });
      const contact = await this.contactRepo.findOne({ where: { id: execution.contactId } });

      if (!flow || !contact) {
        throw new Error('Flow or contact not found');
      }

      // Execute nodes
      let currentNodeIndex = 0;
      let steps = 0;

      while (steps < this.maxSteps) {
        const node = flow.nodes[currentNodeIndex];

        if (!node) {
          throw new Error(`Node at index ${currentNodeIndex} not found`);
        }

        console.info(`[Flow ${flow.id}] Executing node: ${node.type} (${node.id})`);

        const context: NodeExecutionContext = {
          flow,
          execution,
          contact,
          nodeIndex: currentNodeIndex,
        };

        const result = await this.executeNode(context, node);

        if (!result.success) {
          throw new Error(result.error || 'Node execution failed');
        }

        // Update execution variables
        if (result.variables) {
          execution.variables = {
            ...execution.variables,
            ...result.variables,
          };
        }

        // Check if flow ended
        if (node.type === NodeType.END || node.type === NodeType.HUMAN_HANDOFF) {
          break;
        }

        // Move to next node
        if (result.nextNodeIndex !== undefined) {
          currentNodeIndex = result.nextNodeIndex;
        } else {
          // Find connected node via edges
          const edge = flow.edges.find((e) => e.source === node.id);
          if (!edge) {
            break;
          }

          const nextNode = flow.nodes.find((n) => n.id === edge.target);
          if (!nextNode) {
            break;
          }

          currentNodeIndex = flow.nodes.indexOf(nextNode);
        }

        steps++;
      }

      if (steps >= this.maxSteps) {
        throw new Error(`Flow execution exceeded maximum steps (${this.maxSteps})`);
      }

      // Mark as completed
      execution.status = ExecutionStatus.COMPLETED;
      execution.completedAt = new Date();
      await this.executionRepo.save(execution);

      // Update flow statistics
      const flow_stats = await this.executionRepo.count({ where: { flowId: flow.id } });
      flow.executionCount = flow_stats;
      flow.successCount++;
      await this.flowRepo.save(flow);

      console.info(`[Flow ${flow.id}] Execution completed successfully`);
    } catch (error) {
      // Mark as failed
      execution.status = ExecutionStatus.FAILED;
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
      await this.executionRepo.save(execution);

      // Update flow statistics
      const flow = await this.flowRepo.findOne({ where: { id: execution.flowId } });
      if (flow) {
        flow.failureCount++;
        await this.flowRepo.save(flow);
      }

      console.error(`[Flow ${execution.flowId}] Execution failed:`, error);
    }
  }

  private async executeNode(
    context: NodeExecutionContext,
    node: (typeof context.flow.nodes)[0]
  ): Promise<NodeExecutionResult> {
    const { execution } = context;

    switch (node.type) {
      case NodeType.START:
        return this.executeStartNode(context, node);

      case NodeType.SEND_MESSAGE:
        return this.executeSendMessageNode(context, node);

      case NodeType.WAIT:
        return this.executeWaitNode(context, node);

      case NodeType.CONDITION:
        return this.executeConditionNode(context, node);

      case NodeType.AI_REPLY:
        return this.executeAIReplyNode(context, node);

      case NodeType.TAG_CONTACT:
        return this.executeTagContactNode(context, node);

      case NodeType.HUMAN_HANDOFF:
        return this.executeHumanHandoffNode(context, node);

      case NodeType.END:
        return { success: true };

      default:
        return { success: false, error: `Unknown node type: ${node.type}` };
    }
  }

  private async executeStartNode(
    context: NodeExecutionContext,
    node: (typeof context.flow.nodes)[0]
  ): Promise<NodeExecutionResult> {
    console.debug('[START Node] Initializing flow execution');
    return { success: true };
  }

  private async executeSendMessageNode(
    context: NodeExecutionContext,
    node: (typeof context.flow.nodes)[0]
  ): Promise<NodeExecutionResult> {
    const { contact, execution } = context;
    const data = node.data as any;

    const message = this.interpolateVariables(data.message || '', execution.variables);

    console.info(`[SEND_MESSAGE Node] Sending to ${contact.phoneNumber}: ${message}`);

    // TODO: Integrate with WhatsApp API to actually send message
    // For now, just log it
    return { success: true };
  }

  private async executeWaitNode(
    context: NodeExecutionContext,
    node: (typeof context.flow.nodes)[0]
  ): Promise<NodeExecutionResult> {
    const data = node.data as any;
    const seconds = parseInt(data.seconds || '5', 10);

    console.debug(`[WAIT Node] Waiting ${seconds} seconds`);

    // In production, this would use setTimeout or job queue
    // await new Promise(resolve => setTimeout(resolve, seconds * 1000));

    return { success: true };
  }

  private async executeConditionNode(
    context: NodeExecutionContext,
    node: (typeof context.flow.nodes)[0]
  ): Promise<NodeExecutionResult> {
    const { flow, execution } = context;
    const data = node.data as any;

    const variable = data.variable || '';
    const operator = data.operator || '=';
    const value = data.value || '';

    const variableValue = execution.variables[variable];
    const interpolatedValue = this.interpolateVariables(value, execution.variables);

    const condition = this.evaluateCondition(variableValue, operator, interpolatedValue);

    console.debug(`[CONDITION Node] ${variable} ${operator} ${interpolatedValue} = ${condition}`);

    // Find the connected edge (true/false)
    const edges = flow.edges.filter((e) => e.source === node.id);
    let nextNodeId: string | undefined;

    if (condition) {
      nextNodeId = edges.find((e) => e.label === 'true')?.target || edges[0]?.target;
    } else {
      nextNodeId = edges.find((e) => e.label === 'false')?.target || edges[1]?.target;
    }

    if (!nextNodeId) {
      return { success: false, error: 'No valid condition branch found' };
    }

    const nextNodeIndex = flow.nodes.findIndex((n) => n.id === nextNodeId);
    return { success: true, nextNodeIndex };
  }

  private async executeAIReplyNode(
    context: NodeExecutionContext,
    node: (typeof context.flow.nodes)[0]
  ): Promise<NodeExecutionResult> {
    const { execution, contact, flow } = context;
    const data = node.data as any;

    console.info(`[AI_REPLY Node] Generating reply for ${contact.phoneNumber}`);

    try {
      // Construct history from execution variables or recent messages
      // For now, we use a simple prompt + current input
      const request: AIReplyRequest = {
        businessId: execution.businessId,
        messageContent: execution.variables.lastUserInput || 'Hello',
        conversationHistory: [],
        modelPreference: data.modelPreference, // 'ollama' or 'openai'
      };

      const result = await this.aiReplyService.generateReply(request);

      if (result.shouldEscalate) {
        console.warn(`[AI_REPLY Node] Low confidence (${result.confidence}), escalating to human`);
        // Logic for human handoff
        return {
          success: true,
          nextNodeIndex: flow.nodes.findIndex((n) => n.type === NodeType.HUMAN_HANDOFF),
        };
      }

      console.info(`[AI_REPLY Node] AI generated response: ${result.reply}`);

      // Send the AI response back to the user
      // (In a real system, this would call MessageService.sendMessage)
      
      return {
        success: true,
        variables: {
          lastAIResponse: result.reply,
          aiConfidence: result.confidence,
        },
      };
    } catch (error) {
      console.error(`[AI_REPLY Node] Failed: ${error}`);
      return { success: false, error: 'AI reply generation failed' };
    }
  }

  private async executeTagContactNode(
    context: NodeExecutionContext,
    node: (typeof context.flow.nodes)[0]
  ): Promise<NodeExecutionResult> {
    const { contact } = context;
    const data = node.data as any;
    const tag = data.tag || '';

    if (!contact.tags) {
      contact.tags = [];
    }

    if (!contact.tags.includes(tag)) {
      contact.tags.push(tag);
      await this.contactRepo.save(contact);
      console.info(`[TAG_CONTACT Node] Added tag "${tag}" to contact ${contact.phoneNumber}`);
    }

    return { success: true };
  }

  private async executeHumanHandoffNode(
    context: NodeExecutionContext,
    node: (typeof context.flow.nodes)[0]
  ): Promise<NodeExecutionResult> {
    const { contact } = context;
    console.info(`[HUMAN_HANDOFF Node] Conversation with ${contact.phoneNumber} marked for human review`);
    // TODO: Implement conversation assignment logic
    return { success: true };
  }

  private interpolateVariables(
    text: string,
    variables: Record<string, unknown>
  ): string {
    let result = text;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return result;
  }

  private evaluateCondition(
    leftValue: unknown,
    operator: string,
    rightValue: unknown
  ): boolean {
    switch (operator) {
      case '=':
      case '==':
        return leftValue === rightValue;

      case '!=':
      case '!==':
        return leftValue !== rightValue;

      case '>':
        return Number(leftValue) > Number(rightValue);

      case '<':
        return Number(leftValue) < Number(rightValue);

      case '>=':
        return Number(leftValue) >= Number(rightValue);

      case '<=':
        return Number(leftValue) <= Number(rightValue);

      case 'contains':
        return String(leftValue).includes(String(rightValue));

      case 'startsWith':
        return String(leftValue).startsWith(String(rightValue));

      case 'endsWith':
        return String(leftValue).endsWith(String(rightValue));

      default:
        return false;
    }
  }
}
