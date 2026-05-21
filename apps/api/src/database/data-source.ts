import { DataSource } from 'typeorm';
import * as path from 'path';
import {
  Business,
  User,
  Contact,
  Message,
  Conversation,
  Flow,
  FlowExecution,
  Template,
  AuditLog,
} from './entities';

const isProduction = process.env.NODE_ENV === 'production';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgres://wapiflow:wapiflow_dev_password@localhost:5432/wapiflow',
  synchronize: !isProduction,
  logging: !isProduction,
  logger: 'advanced-console',
  entities: [Business, User, Contact, Message, Conversation, Flow, FlowExecution, Template, AuditLog],
  migrations: [path.join(__dirname, '/migrations/*.{ts,js}')],
  subscribers: [path.join(__dirname, '/subscribers/*.{ts,js}')],
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export async function initializeDatabase() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.info('✓ Database connection established');

      if (!isProduction && process.env.RUN_MIGRATIONS === 'true') {
        await AppDataSource.runMigrations();
        console.info('✓ Migrations executed');
      }
    }
  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    throw error;
  }
}
