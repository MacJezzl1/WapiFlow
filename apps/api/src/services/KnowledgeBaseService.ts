import { Repository, ILike } from 'typeorm';
import { AppDataSource } from '@/database/data-source';
import { KnowledgeBase } from '@/database/entities';
import { APIError } from '@/utils/errors';

export interface KBEntryPayload {
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
}

export class KnowledgeBaseService {
  private kbRepo: Repository<KnowledgeBase>;

  constructor() {
    this.kbRepo = AppDataSource.getRepository(KnowledgeBase);
  }

  async createEntry(businessId: string, payload: KBEntryPayload): Promise<KnowledgeBase> {
    const entry = this.kbRepo.create({
      ...payload,
      businessId,
    });
    return this.kbRepo.save(entry);
  }

  async getEntry(businessId: string, id: string): Promise<KnowledgeBase> {
    const entry = await this.kbRepo.findOne({
      where: { id, businessId },
    });
    if (!entry) throw new APIError(404, 'Knowledge base entry not found');
    return entry;
  }

  async listEntries(businessId: string, category?: string): Promise<KnowledgeBase[]> {
    const query = this.kbRepo.createQueryBuilder('kb').where('kb.businessId = :businessId', {
      businessId,
    });

    if (category) {
      query.andWhere('kb.category = :category', { category });
    }

    return query.orderBy('kb.createdAt', 'DESC').getMany();
  }

  async updateEntry(businessId: string, id: string, payload: Partial<KBEntryPayload>): Promise<KnowledgeBase> {
    const entry = await this.getEntry(businessId, id);
    Object.assign(entry, payload);
    return this.kbRepo.save(entry);
  }

  async deleteEntry(businessId: string, id: string): Promise<void> {
    const entry = await this.getEntry(businessId, id);
    await this.kbRepo.remove(entry);
  }

  async findBestMatch(businessId: string, query: string): Promise<string | null> {
    // Simple keyword-based match for now. 
    // In production, this should use pgvector or a semantic search engine.
    const entries = await this.kbRepo.find({
      where: {
        businessId,
        isActive: true,
        question: ILike(`%${query}%`),
      },
    });

    if (entries.length === 0) return null;

    // Return the answer of the most relevant entry (simplified: first match)
    return entries[0].answer;
  }
}
