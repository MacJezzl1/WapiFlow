# WapiFlow - Open-source WhatsApp Business Automation Platform

![WapiFlow](https://img.shields.io/badge/WapiFlow-1.0.0-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)

**WapiFlow** is an open-source WhatsApp Business automation platform featuring a visual flow builder, AI auto-replies with local Ollama support, and a multi-tenant inbox. Built with modern technologies and designed for self-hosting.

## 🚀 Features

- **Visual Flow Builder** - Drag-and-drop interface to create WhatsApp automation flows
- **AI-Powered Auto-Replies** - Support for both OpenAI and free local Ollama LLMs
- **Multi-Tenant Architecture** - Complete business isolation with per-business customization
- **Real-time Inbox** - WebSocket-powered live message synchronization
- **Contact Management** - Tag, organize, and manage WhatsApp contacts
- **Message Templates** - Pre-built templates with variable substitution
- **Conversation Routing** - Automatic agent assignment and escalation
- **Flow Analytics** - Execution metrics and performance tracking
- **RBAC** - Role-based access control (Admin, Agent, Viewer)
- **Webhook Integration** - Complete WhatsApp Business API integration
- **Self-Hostable** - Docker Compose for easy deployment
- **MIT Licensed** - Free for commercial use

## 🏗️ Architecture

```
WapiFlow (Monorepo)
├── apps/
│   ├── api/               # Node.js Express backend
│   ├── dashboard/         # React + Vite admin dashboard
│   └── website/           # Marketing website
├── packages/
│   └── shared/            # Shared types and utilities
└── docker/                # Docker configuration
```

### Tech Stack

- **Backend**: Node.js 18+, Express.js, TypeORM, PostgreSQL
- **Frontend**: React 18, Vite, Zustand, Socket.IO Client
- **Infrastructure**: Docker, Docker Compose, Nginx, Redis, BullMQ
- **AI/ML**: Ollama (free local LLMs), OpenAI API (optional)
- **Auth**: JWT, bcryptjs
- **Validation**: Zod
- **Real-time**: Socket.IO

## 📋 Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 14+ (or use Docker)
- Redis 7+ (or use Docker)
- Ollama (optional, included in Docker setup)
- WhatsApp Business Account (optional, for production)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/capechainnodes/wapiflow.git
cd wapiflow

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 2. Docker Compose (Recommended)

```bash
# Start all services (PostgreSQL, Redis, Ollama, API, Dashboard, Nginx)
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services will be available at:
- **API**: http://localhost:3000/api/v1
- **Dashboard**: http://localhost:5173
- **Ollama**: http://localhost:11434
- **Nginx Proxy**: http://localhost:80

### 3. Manual Setup (Development)

```bash
# Terminal 1: Start API server
cd apps/api
npm run dev

# Terminal 2: Start Dashboard
cd apps/dashboard
npm run dev

# Terminal 3: Start PostgreSQL & Redis
docker-compose up postgres redis ollama

# Terminal 4: Start Nginx
docker-compose up nginx
```

## 🔧 Configuration

Edit `.env` file to configure:

```env
# Database
DATABASE_URL=postgres://wapiflow:password@localhost:5432/wapiflow

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# AI Services
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral
OPENAI_API_KEY=sk-xxx (optional)

# WhatsApp Integration
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_token
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_id

# Server
NODE_ENV=development
PORT=3000
```

## 📚 API Documentation

### Authentication

All API endpoints (except `/health` and `/auth/signup`) require Bearer token authentication:

```
Authorization: Bearer <access_token>
```

### Core Endpoints

```
POST   /api/v1/auth/signup              # Register new business
POST   /api/v1/auth/login               # Login user
POST   /api/v1/auth/refresh             # Refresh access token
POST   /api/v1/auth/change-password     # Change password
GET    /api/v1/auth/me                  # Get current user

GET    /api/v1/flows                    # List flows
POST   /api/v1/flows                    # Create flow
GET    /api/v1/flows/:id                # Get flow
PUT    /api/v1/flows/:id                # Update flow
DELETE /api/v1/flows/:id                # Delete flow
POST   /api/v1/flows/:id/publish        # Publish flow
POST   /api/v1/flows/:id/execute        # Execute flow

GET    /api/v1/messages                 # List messages
POST   /api/v1/messages                 # Send message
GET    /api/v1/messages/:id             # Get message
POST   /api/v1/messages/search          # Search messages

GET    /api/v1/conversations            # List conversations
GET    /api/v1/conversations/:id        # Get conversation
POST   /api/v1/conversations/:id/assign # Assign to agent

GET    /api/v1/contacts                 # List contacts
POST   /api/v1/contacts                 # Create contact
GET    /api/v1/contacts/:id             # Get contact
PUT    /api/v1/contacts/:id             # Update contact

POST   /api/v1/webhooks/whatsapp        # WhatsApp webhook
```

See `docs/API.md` for complete documentation.

## 🤖 AI Configuration

### Ollama (Free, Local LLMs)

Ollama provides free, powerful language models that run locally:

```bash
# Pull a model
ollama pull mistral      # Fast, 7B model
ollama pull neural-chat  # Chat-optimized, 7B model
ollama pull llama2       # Meta Llama 2, 7B model

# Test Ollama
curl http://localhost:11434/api/tags

# Use in WapiFlow
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

**Available Models** (as of 2026):
- `mistral` - Fast, general-purpose, 7B
- `neural-chat` - Optimized for conversations, 7B
- `llama2` - Meta's Llama 2, 7B
- `zephyr` - Fine-tuned Zephyr, 7B
- `orca-mini` - Specialized for instruction following, 3B

### OpenAI (Optional, Paid)

For production, you can use OpenAI's GPT models:

```env
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-3.5-turbo
```

## 📊 Database Schema

### Entities

- **Business** - Multi-tenant isolation root
- **User** - Team members with role-based access
- **Contact** - WhatsApp contacts with metadata
- **Message** - Individual messages with status tracking
- **Conversation** - Grouped messages with agent assignment
- **Flow** - Automation workflows with visual builder
- **FlowExecution** - Execution instances and state
- **Template** - Reusable message templates
- **AuditLog** - Action history for compliance

## 🔐 Security

- **Multi-Tenant Isolation**: Business ID enforced on all queries
- **JWT Authentication**: Secure token-based auth with refresh tokens
- **Password Hashing**: bcryptjs with 10 salt rounds
- **RBAC**: Admin, Agent, Viewer roles
- **Rate Limiting**: Coming in Phase 6
- **Webhook Verification**: SHA-256 signature validation
- **CORS**: Configurable origin validation
- **SQL Injection**: TypeORM parameterized queries

## 📦 Deployment

### Docker Compose (Development & Production)

```bash
# Production deployment
docker-compose -f docker-compose.yml up -d

# With custom environment
docker-compose up -d --env-file .env.production
```

### Environment Profiles

**.env** - Development (insecure, for testing)
```
NODE_ENV=development
JWT_SECRET=dev_secret
DEBUG=true
```

**.env.production** - Production (secure)
```
NODE_ENV=production
JWT_SECRET=long_secure_random_key
DEBUG=false
DATABASE_URL=postgres://...production...
```

### Scaling

- **Horizontal**: Use load balancer (Nginx) with multiple API instances
- **Database**: PostgreSQL connection pooling via PgBouncer
- **Cache**: Redis for session and conversation caching
- **Queue**: BullMQ for async jobs (coming in Phase 6)

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- flows.test.ts

# Watch mode
npm test -- --watch
```

## 📚 Development

```bash
# Lint code
npm run lint

# Format code
npm run format

# Build
npm run build

# Generate migrations
npm run migrate:generate -- -n InitialSchema

# Run migrations
npm run migrate
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Roadmap

- **Phase 1** ✓ Infrastructure & Core Auth
- **Phase 2** - Flow Builder & Execution Engine
- **Phase 3** - WhatsApp Integration & Webhooks
- **Phase 4** - AI Engine (OpenAI + Ollama)
- **Phase 5** - Real-time Inbox & Socket.IO
- **Phase 6** - Advanced Features (Rate Limiting, Analytics, Tests)

## 🐛 Known Issues & TODOs

- Rate limiting not yet implemented
- WebSocket reconnection logic needs improvement
- Comprehensive test suite in progress
- Swagger/OpenAPI documentation coming
- Mobile app planned for Phase 7

## 📝 License

MIT License - Copyright © 2025 CapeChain Labs

Feel free to use, modify, and distribute freely for commercial projects.

## 🆘 Support

- **Documentation**: https://wapiflow.dev/docs
- **Issues**: https://github.com/capechainnodes/wapiflow/issues
- **Discussions**: https://github.com/capechainnodes/wapiflow/discussions
- **Email**: support@capechainlabs.com

## 💡 Credits

Built with ❤️ by CapeChain Labs

---

**WapiFlow** - Making WhatsApp Business automation accessible to everyone 🚀
