import axios from 'axios';
import { AppDataSource } from '@/database/data-source';
import { Business } from '@/database/entities';
import { APIError } from '@/utils/errors';
import { KnowledgeBaseService } from '@/services/KnowledgeBaseService';

export interface KnowledgeBaseEntry {
  id?: string;
  businessId: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
}

export interface AIReplyRequest {
  businessId: string;
  messageContent: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  modelPreference?: 'ollama' | 'openai';
}

export interface AIReplyResponse {
  reply: string;
  confidence: number;
  provider: 'ollama' | 'openai';
  shouldEscalate: boolean;
  modelUsed: string;
}

export class AIReplyService {
  private ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  private openaiKey = process.env.OPENAI_API_KEY;
  private ollamaModel = process.env.OLLAMA_MODEL || 'mistral';
  private openaiModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
  private confidenceThreshold = 0.7;
  private kbService = new KnowledgeBaseService();

  async generateReply(request: AIReplyRequest): Promise<AIReplyResponse> {
    const { businessId, messageContent, conversationHistory, modelPreference } = request;

    // 1. Check Knowledge Base for a direct match first
    const kbReply = await this.findKnowledgeBaseMatch(businessId, messageContent);
    if (kbReply) {
      return {
        reply: kbReply,
        confidence: 1.0,
        provider: 'knowledge_base',
        shouldEscalate: false,
        modelUsed: 'knowledge_base',
      } as any;
    }

    // 2. Determine provider
    const provider = modelPreference || (this.openaiKey ? 'openai' : 'ollama');
    
    try {
      if (provider === 'openai') {
        return await this.generateOpenAIReply(request);
      } else {
        return await this.generateOllamaReply(request);
      }
    } catch (error) {
      console.error(`AI Provider ${provider} failed, falling back to alternative...`);
      if (provider === 'openai') {
        return await this.generateOllamaReply(request);
      } else {
        throw new APIError(502, 'All AI providers failed to generate a response');
      }
    }
  }

  private async generateOllamaReply(request: AIReplyRequest): Promise<AIReplyResponse> {
    const { messageContent, conversationHistory } = request;

    // Construct system prompt for context and quality
    const systemPrompt = `You are a helpful and concise WhatsApp Business assistant. 
    Provide short, friendly, and direct answers. 
    If you are unsure about the answer, be honest and suggest talking to a human.
    Keep responses under 3 sentences.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: messageContent },
    ];

    try {
      const response = await axios.post(`${this.ollamaUrl}/api/chat`, {
        model: this.ollamaModel,
        messages: messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 150,
        },
      }, { timeout: 15000 });

      const reply = response.data.message.content;
      const confidence = this.calculateConfidence(reply, response.data);

      return {
        reply,
        confidence,
        provider: 'ollama',
        shouldEscalate: confidence < this.confidenceThreshold,
        modelUsed: this.ollamaModel,
      };
    } catch (error) {
      throw new Error(`Ollama error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateOpenAIReply(request: AIReplyRequest): Promise<AIReplyResponse> {
    if (!this.openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { messageContent, conversationHistory } = request;

    const systemPrompt = `You are a helpful and concise WhatsApp Business assistant. 
    Provide short, friendly, and direct answers. 
    If you are unsure about the answer, be honest and suggest talking to a human.
    Keep responses under 3 sentences.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: messageContent },
    ];

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: this.openaiModel,
        messages: messages,
        temperature: 0.7,
        max_tokens: 150,
      }, {
        headers: { Authorization: `Bearer ${this.openaiKey}` },
        timeout: 15000,
      });

      const reply = response.data.choices[0].message.content;
      const confidence = this.calculateConfidence(reply, response.data);

      return {
        reply,
        confidence,
        provider: 'openai',
        shouldEscalate: confidence < this.confidenceThreshold,
        modelUsed: this.openaiModel,
      };
    } catch (error) {
      throw new Error(`OpenAI error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private calculateConfidence(reply: string, apiResponse: any): number {
    let score = 0.8; // Base confidence

    // Reduce confidence if response is too short or too long
    if (reply.length < 5) score -= 0.2;
    if (reply.length > 500) score -= 0.2;

    // Reduce confidence for uncertainty markers
    const uncertaintyMarkers = [
      'I am not sure',
      'I believe',
      'possibly',
      'maybe',
      'I think',
      'could be',
      'not certain',
    ];

    uncertaintyMarkers.forEach(marker => {
      if (reply.toLowerCase().includes(marker.toLowerCase())) {
        score -= 0.15;
      }
    });

    // If API provides a finish_reason that isn't 'stop', reduce confidence
    const finishReason = apiResponse.done || apiResponse.choices?.[0]?.finish_reason;
    if (finishReason && finishReason !== 'stop') {
      score -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, score));
  }

  private async findKnowledgeBaseMatch(businessId: string, query: string): Promise<string | null> {
    return this.kbService.findBestMatch(businessId, query);
  }
}
