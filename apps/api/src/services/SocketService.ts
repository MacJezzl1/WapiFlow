import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '@/middleware/auth';
import { APIError } from '@/utils/errors';

export class SocketService {
  private io: Server;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupHandlers();
  }

  private setupMiddleware() {
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: Token missing'));
        }

        const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
        const decoded = jwt.verify(token, secret) as AuthPayload;

        // Attach auth data to socket
        (socket as any).user = decoded;
        (socket as any).businessId = decoded.businessId;

        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupHandlers() {
    this.io.on('connection', (socket) => {
      const user = (socket as any).user;
      const businessId = (socket as any).businessId;

      console.info(`[Socket] User ${user.email} connected to business ${businessId}`);

      // Join business-specific room for broadcast
      socket.join(`business:${businessId}`);
      // Join user-specific room for private notifications
      socket.join(`user:${user.userId}`);

      socket.on('disconnect', () => {
        console.info(`[Socket] User ${user.email} disconnected`);
      });
    });
  }

  // Emit to all users in a specific business
  emitToBusiness(businessId: string, event: string, data: any) {
    this.io.to(`business:${businessId}`).emit(event, data);
  }

  // Emit to a specific user
  emitToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  // Emit to everyone except the sender
  emitToBusinessExcept(businessId: string, socketId: string, event: string, data: any) {
    this.io.to(`business:${businessId}`).emit(event, data);
    // Note: Socket.io broadcast to room excludes sender by default if using socket.to().emit()
  }

  getIO() {
    return this.io;
  }
}

export const socketService = {
  instance: null as SocketService | null,
  init(httpServer: HttpServer) {
    this.instance = new SocketService(httpServer);
    return this.instance;
  },
  emitToBusiness(businessId: string, event: string, data: any) {
    this.instance?.emitToBusiness(businessId, event, data);
  },
  emitToUser(userId: string, event: string, data: any) {
    this.instance?.emitToUser(userId, event, data);
  },
};
