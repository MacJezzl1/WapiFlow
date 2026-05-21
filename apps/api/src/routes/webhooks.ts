import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { asyncWrapper } from '@/utils/asyncWrapper';
import { MessageService } from '@/services/MessageService';
import { FlowService } from '@/services/FlowService';
import { FlowExecutionEngine } from '@/services/FlowExecutionEngine';
import { APIError } from '@/utils/errors';

const router = Router();
const messageService = new MessageService();
const flowService = new FlowService();
const flowEngine = new FlowExecutionEngine();

// GET /whatsapp - WhatsApp Webhook Verification
router.get(
  '/whatsapp',
  asyncWrapper(async (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'dev_token';

    if (mode === 'subscribe' && token === verifyToken) {
      console.info('✓ WhatsApp webhook verified');
      return res.status(200).send(challenge);
    }

    throw new APIError(403, 'Webhook verification failed');
  })
);

// POST /whatsapp - Handle incoming WhatsApp messages/events
router.post(
  '/whatsapp',
  asyncWrapper(async (req: Request, res: Response) => {
    const signature = req.headers['x-hub-signature-256'] as string;
    const body = JSON.stringify(req.body);

    // 1. Verify Signature (In production, this is mandatory)
    if (process.env.NODE_ENV === 'production' && !signature) {
      throw new APIError(401, 'Missing signature');
    }
    
    // (Implementation of signature verification would go here using process.env.WHATSAPP_APP_SECRET)

    const payload = req.body;

    // WhatsApp payload structure: { object: 'whatsapp_business_account', entry: [...] }
    if (payload.object !== 'whatsapp_business_account') {
      throw new APIError(400, 'Invalid payload object');
    }

    for (const entry of payload.entry) {
      const changes = entry.changes?.[0]?.value;
      if (!changes) continue;

      // Handle messages
      if (changes.messages) {
        for (const message of changes.messages) {
          const from = message.from; // Phone number
          const messageId = message.id;
          const type = message.type;

          let content = '';
          let metadata: Record<string, any> = {};

          if (type === 'text') {
            content = message.text.body;
          } else if (type === 'image') {
            content = `[Image] ${message.image.caption || ''}`;
            metadata.imageId = message.image.id;
          } else if (type === 'document') {
            content = `[Document] ${message.document.caption || ''}`;
            metadata.documentId = message.document.id;
          } else {
            content = `[${type.toUpperCase()}]`;
          }

          // We need to find the Business that owns the phone number receiving the message
          // In a real multi-tenant system, you'd look up which business uses the WABA ID in the payload
          const wabaId = payload.entry[0].id; // Simplified
          
          // FOR DEMO: We use a dummy businessId or look it up
          const businessId = await findBusinessByWabaId(wabaId);

          if (!businessId) {
            console.warn(`No business found for WABA ID: ${wabaId}`);
            continue;
          }

          // 2. Save the incoming message
          const savedMsg = await messageService.receiveMessage(
            businessId,
            from,
            content,
            messageId,
            mapWhatsAppTypeToInternal(type),
            metadata
          );

          // 3. Check for any published flow that should be triggered
          const flows = await flowService.listFlows(businessId, 'PUBLISHED');
          if (flows.length > 0) {
            // Trigger the first published flow for this contact (simplified logic)
            const flow = flows[0];
            const execution = await flowService.startExecution(
              businessId,
              flow.id,
              savedMsg.contactId,
              { lastUserInput: content }
            );

            // Run the flow execution asynchronously
            flowEngine.executeFlow(execution).catch(err => 
              console.error(`Flow execution failed for ${execution.id}:`, err)
            );
          }
        }
      }

      // Handle status updates (sent, delivered, read)
      if (changes.statuses) {
        for (const status of changes.statuses) {
          const messageId = status.id;
          const statusValue = status.status;

          // Look up message and update status
          // Note: This requires a global message lookup by externalId
          await updateMessageStatusByExternalId(messageId, statusValue);
        }
      }
    }

    res.status(200).json({ status: 'success' });
  })
);

// Helper to map WhatsApp types to our internal enum
function mapWhatsAppTypeToInternal(type: string): any {
  const mapping: Record<string, any> = {
    text: 'TEXT',
    image: 'IMAGE',
    video: 'VIDEO',
    audio: 'AUDIO',
    document: 'DOCUMENT',
    location: 'LOCATION',
  };
  return mapping[type] || 'TEXT';
}

// Helper to find business by WABA ID (Simplified)
async function findBusinessByWabaId(wabaId: string): Promise<string | null> {
  // Real implementation would query the Business table for the WABA ID
  // For now, return a dummy ID for testing
  return '00000000-0000-0000-0000-000000000000'; 
}

// Helper to update status by externalId
async function updateMessageStatusByExternalId(externalId: string, status: string) {
  // Real implementation: find message by externalId and update its status
}

export default router;
