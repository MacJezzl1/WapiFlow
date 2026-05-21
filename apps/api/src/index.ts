import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { initializeDatabase } from '@/database/data-source';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { authMiddleware, tenantMiddleware } from '@/middleware/auth';
import { asyncWrapper } from '@/utils/asyncWrapper';
import { socketService } from '@/services/SocketService';

// Load environment variables
dotenv.config();

const app: Express = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API v1 routes
const v1Router = express.Router();

// Import routes
import authRoutes from '@/routes/auth';
import flowRoutes from '@/routes/flows';
import messageRoutes from '@/routes/messages';
import conversationRoutes from '@/routes/conversations';
import webhookRoutes from '@/routes/webhooks';
import kbRoutes from '@/routes/knowledgebase';
import contactRoutes from '@/routes/contacts';
import userRoutes from '@/routes/users';

v1Router.use('/auth', authRoutes);
v1Router.use('/flows', authMiddleware, tenantMiddleware, flowRoutes);
v1Router.use('/messages', authMiddleware, tenantMiddleware, messageRoutes);
v1Router.use('/conversations', authMiddleware, tenantMiddleware, conversationRoutes);
v1Router.use('/knowledgebase', authMiddleware, tenantMiddleware, kbRoutes);
v1Router.use('/contacts', authMiddleware, tenantMiddleware, contactRoutes);
v1Router.use('/users', authMiddleware, tenantMiddleware, userRoutes);
v1Router.use('/webhooks', webhookRoutes);

app.use('/api/v1', v1Router);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize Socket.IO
    socketService.init(httpServer);

    // Start listening
    httpServer.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ API available at http://localhost:${PORT}/api/v1`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

startServer();

export default app;

