# AgentFlow

> **Voice-Driven Autonomous AI Coding Platform**
> Control AI coding agents through natural conversation, orchestrate complex tasks across multiple agents, and automate your entire development workflow.

[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue)](.github/workflows/deploy-cloud-run.yml)
[![Platform](https://img.shields.io/badge/Platform-Discord-5865F2)](https://discord.com)
[![AI](https://img.shields.io/badge/AI-Claude%20Sonnet%203.5-orange)](https://anthropic.com)
[![Voice](https://img.shields.io/badge/Voice-ElevenLabs-purple)](https://elevenlabs.io)

---

## 🎯 Mission

AgentFlow transforms how developers interact with AI coding assistants. Instead of copy-pasting between tools, **talk to your AI agents** and watch them:
- Write and refactor code autonomously
- Deploy to production via voice command
- Manage projects in Trello
- Run terminal commands and analyze output
- Work on multiple tasks concurrently across different Discord channels

**It's like having a team of AI engineers in your Discord server, each running Claude Sonnet 3.5 with full autonomy.**

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+**
- **Discord Bot** ([Create one](https://discord.com/developers/applications))
- **Anthropic API Key** ([Get it](https://console.anthropic.com))
- **ElevenLabs API Key** ([Get it](https://elevenlabs.io))

### 5-Minute Setup

```bash
# 1. Clone and install
git clone https://github.com/yourusername/agentflow.git
cd agentflow
npm install

# 2. Configure environment
cp .env.example .env
nano .env  # Add your API keys

# 3. Build and run
npm run build
npm start
```

### Invite Bot to Discord

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application → OAuth2 → URL Generator
3. Scopes: `bot`, `applications.commands`
4. Permissions: `Send Messages`, `Connect`, `Speak`, `Use Voice Activity`
5. Copy URL and invite bot to your server

### First Voice Command

```
1. Join a voice channel in Discord
2. Type: !join
3. Say: "Hey, list my GitHub repositories"
4. Watch the magic happen ✨
```

---

## 🏗️ Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Discord                                │
│  👤 Users → 🎙️ Voice Chat + 💬 Text Commands               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Discord Bot (Node.js)                       │
│  • ElevenLabs Conversational AI (voice)                     │
│  • Text command processor                                   │
│  • Multi-channel awareness                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           OrchestratorServer (Express REST API)             │
│  • Port 3001                                                │
│  • API key authentication                                   │
│  • Task routing & coordination                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   TaskManager                               │
│  • Creates isolated ToolBasedAgent per task                 │
│  • Manages up to 10 concurrent agents                       │
│  • Channel-specific notifications                           │
│  • Task lifecycle management                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┼───────────┬──────────────┐
          ▼            ▼           ▼              ▼
     ┌────────┐   ┌────────┐  ┌────────┐    ┌────────┐
     │Agent 1 │   │Agent 2 │  │Agent 3 │    │Agent N │
     │Claude  │   │Claude  │  │Claude  │ .. │Claude  │
     │Sonnet  │   │Sonnet  │  │Sonnet  │    │Sonnet  │
     └────┬───┘   └────┬───┘  └────┬───┘    └────┬───┘
          │            │           │              │
          └────────────┴───────────┴──────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │      Tool Execution              │
        ├──────────────────────────────────┤
        │ • Bash commands (terminal)       │
        │ • Trello API (project mgmt)      │
        │ • GitHub CLI (repos, PRs, etc.)  │
        │ • GCloud CLI (deployments)       │
        │ • File operations                │
        └──────────────────────────────────┘
```

### Key Design Principles

1. **Full Task Isolation**: Each task gets its own dedicated Claude Sonnet 3.5 agent
2. **Native Tool Use**: Direct Anthropic Tool Use API (same as Claude Code/Cursor)
3. **Channel-Aware**: Notifications always go to the correct Discord channel
4. **Concurrent Execution**: Run up to 10 agents simultaneously
5. **Autonomous Operation**: Agents iterate, test, and debug independently

---

## ✨ Features

### 🎙️ Voice Control (ElevenLabs Conversational AI)

- **Natural Conversations**: Talk naturally, no wake words needed
- **Automatic Turn-Taking**: AI knows when you're speaking
- **Instant Interruption**: Just start talking to interrupt
- **Client-Side Tools**: Functions registered directly with ElevenLabs

**Example Commands:**
- *"Create a Next.js app with TypeScript"*
- *"Deploy the latest changes to Hetzner"*
- *"Show me my Trello boards"*
- *"Analyze the authentication module and suggest improvements"*

### 🤖 Multi-Agent Orchestration

- **Concurrent Tasks**: Run multiple agents in different channels
- **Task Isolation**: Agents never interfere with each other
- **Smart Routing**: Each channel sees only its own tasks
- **Status Tracking**: Check any task from any channel

**Discord Commands:**
```bash
!agents              # List tasks in current channel
!agents --all        # List all tasks across channels
!task-status <id>    # Get detailed task status
!cancel-task <id>    # Cancel a running task
```

### 🛠️ Tool-Based Agents (Claude Sonnet 3.5)

Agents have access to:

- **Terminal Execution**: Run any bash command
- **Trello Integration**: Create cards, lists, search, update
- **GitHub Integration**: Manage repos, PRs, issues
- **Hetzner Cloud**: Deploy containers to VPS, manage services
- **File Operations**: Read, write, edit files
- **Task Decomposition**: Break complex tasks into steps

### 🚀 CI/CD Automation

- **GitHub Actions**: Auto-deploy on every push to `master`
- **Docker**: Multi-stage builds for production
- **Hetzner VPS**: Docker Compose deployment, always-on
- **Zero-Downtime**: Rolling deployments, health checks
- **Secrets Management**: All credentials encrypted in GitHub Secrets

**Setup:**
```bash
./scripts/setup-github-actions.sh  # One-time setup
git push origin master             # Deploys automatically!
```

See: [`GITHUB_ACTIONS_SETUP.md`](GITHUB_ACTIONS_SETUP.md)

### 📊 Trello Project Management

Full Trello integration via REST API:

```typescript
// Voice: "Create a card on my backlog called 'Fix bug in auth'"
// Bot executes:
trello_create_card({
  boardName: "AgentFlow",
  listName: "Backlog",
  cardName: "Fix bug in auth"
})
```

**Capabilities:**
- List all boards
- Get board details
- Create lists and cards
- Search across all cards
- Update card details
- Move cards between lists

See: [`TRELLO_INTEGRATION.md`](TRELLO_INTEGRATION.md)

### ⚡ Groq Fast Inference (Optional)

Ultra-fast inference for simple tasks (10-20x faster than Claude):

```env
GROQ_API_KEY=your_groq_key_here
```

AgentFlow automatically uses Groq for:
- Simple terminal commands
- Quick analysis tasks
- Preliminary task planning

Claude Sonnet is used for:
- Complex coding tasks
- Multi-step operations
- High-quality outputs

---

## 📋 Environment Configuration

### Required Variables

```env
# Discord Bot
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id

# AI Services
ANTHROPIC_API_KEY=sk-ant-...                 # Claude Sonnet 3.5
ELEVENLABS_API_KEY=sk_...                    # Voice AI
ELEVENLABS_AGENT_ID=agent_...                # Conversational AI agent

# Orchestrator
ORCHESTRATOR_URL=http://localhost:3001
ORCHESTRATOR_API_KEY=your_secure_random_key  # Generate: openssl rand -hex 32

# Security
ALLOWED_USER_IDS=user1,user2                 # Optional: whitelist users
MAX_CONCURRENT_AGENTS=10                     # Max parallel tasks
```

### Optional Integrations

```env
# Trello
TRELLO_API_KEY=your_trello_key
TRELLO_API_TOKEN=your_trello_token

# GitHub (auto-detected from gh CLI or set manually)
GITHUB_TOKEN=ghp_...

# Google Cloud
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1

# Fast Inference (10-20x speedup for simple tasks)
GROQ_API_KEY=gsk_...

# Notifications
SYSTEM_NOTIFICATION_CHANNEL_ID=channel_id    # Dedicated notifications channel

# Logging
LOG_LEVEL=INFO                               # DEBUG, INFO, WARN, ERROR
```

### Getting API Keys

| Service | Get Key Here | Purpose |
|---------|-------------|---------|
| **Discord** | [Developer Portal](https://discord.com/developers/applications) | Bot token + client ID |
| **Anthropic** | [Console](https://console.anthropic.com) | Claude Sonnet 3.5 |
| **ElevenLabs** | [Dashboard](https://elevenlabs.io) | Voice AI |
| **Trello** | [Power-Ups](https://trello.com/power-ups/admin) | Project management |
| **Groq** | [Console](https://console.groq.com) | Fast inference |

---

## 🎮 Usage Examples

### Text Commands

```bash
# Agent Management
!join                          # Join voice channel
!leave                         # Leave voice channel
!agents                        # List current channel's tasks
!agents --all                  # List all tasks
!task-status task_123         # Get task details
!cancel-task task_123         # Stop a task
!help                          # Show all commands

# Trello Integration
!trello-boards                 # List all boards
!trello-lists AgentFlow       # Show lists on board
!trello-cards Backlog         # Show cards in list
!trello-search "bug"          # Search for cards
!trello-create                # Create new card (interactive)

# System
!health                        # Check bot status
!cleanup                       # Clean old tasks (admin)
```

### Voice Commands

Just talk naturally after joining voice:

**Simple Tasks:**
- *"List all files in the project"*
- *"Check the system uptime"*
- *"What's my current Git branch?"*

**Coding Tasks:**
- *"Create a TypeScript function that validates email addresses"*
- *"Refactor the authentication module to use async/await"*
- *"Add error handling to the API endpoints"*

**Deployment:**
- *"Deploy the bot to Hetzner"*
- *"Check the status of my containers"*
- *"Show logs for agentflow-bot"*

**Project Management:**
- *"Show my Trello boards"*
- *"Create a card on my backlog called 'Implement dark mode'"*
- *"Move the 'Fix navigation' card to In Progress"*

**Complex Multi-Step:**
- *"Go through my GitHub repos and create Trello cards for the 5 most recent projects with next steps"*
- *"Analyze all TypeScript files for potential bugs and create a summary report"*
- *"Set up a new Next.js project with authentication and deploy it to Vercel"*

---

## 🔧 Development

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev

# Build TypeScript
npm run build

# Start production build
npm start

# Clean build artifacts
npm run clean
```

### Project Structure

```
agentflow/
├── src/
│   ├── bot/                      # Discord bot implementation
│   │   ├── discordBotRealtime.ts # Main bot (ElevenLabs voice)
│   │   ├── realtimeVoiceReceiver.ts # Voice chat handler
│   │   └── ...
│   ├── orchestrator/             # Task orchestration
│   │   ├── orchestratorServer.ts # Express API server
│   │   ├── taskManager.ts        # Multi-agent coordinator
│   │   └── claudeClient.ts       # Anthropic API client
│   ├── agents/                   # AI agent implementations
│   │   ├── toolBasedAgent.ts     # Main agent (Tool Use API)
│   │   └── subAgentManager.ts    # Legacy agent manager
│   ├── services/                 # External integrations
│   │   ├── trello.ts             # Trello REST API
│   │   ├── cloudDeployment.ts    # GCloud deployment
│   │   ├── database.ts           # SQLite storage
│   │   └── ...
│   ├── utils/                    # Utilities
│   │   ├── logger.ts             # Structured logging
│   │   ├── config.ts             # Environment config
│   │   ├── elevenLabsVoice.ts    # ElevenLabs SDK wrapper
│   │   └── ...
│   └── index.ts                  # Main entry point
├── .github/
│   └── workflows/
│       └── deploy-cloud-run.yml  # CI/CD pipeline
├── scripts/                      # Setup & deployment scripts
│   └── setup-github-actions.sh
├── Dockerfile                    # Production container
├── docker-compose.yml            # Local Docker setup
└── package.json
```

### Adding New Tools

Agents can call any tool you define. Here's how to add one:

**1. Define the tool in `toolBasedAgent.ts`:**

```typescript
{
  name: 'search_documentation',
  description: 'Search project documentation for a keyword',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      }
    },
    required: ['query']
  }
}
```

**2. Implement the handler:**

```typescript
if (toolName === 'search_documentation') {
  const { query } = toolInput;
  const results = await searchDocs(query);
  return { results };
}
```

**3. Agents can now call it:**

```
Agent: Let me search the documentation for authentication...
[CALLS search_documentation with query: "authentication"]
```

---

## 🌐 Deployment

### Docker (Local)

```bash
# Build image
docker build -t agentflow .

# Run container
docker run -p 3001:3001 --env-file .env agentflow

# Or use Docker Compose
docker-compose up -d
```

### Hetzner VPS (Production)

**Deploy All Bots:**

```bash
# Deploy all 3 bots to Hetzner VPS
./deploy-all-bots.sh

# Or restart existing containers
./finish-setup.sh

# Check status
./verify-bots.sh
```

**Manual Deployment:**

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1

# Build and deploy
gcloud builds submit --tag gcr.io/$GCP_PROJECT_ID/agentflow
gcloud run deploy agentflow \
  --image gcr.io/$GCP_PROJECT_ID/agentflow \
  --platform managed \
  --region $GCP_REGION \
  --allow-unauthenticated \
  --set-env-vars DISCORD_TOKEN=$DISCORD_TOKEN,...
```

See: [`GITHUB_ACTIONS_SETUP.md`](GITHUB_ACTIONS_SETUP.md) for full details.

---

## 🔒 Security

### Best Practices Implemented

- ✅ **API Key Authentication**: All orchestrator endpoints require `X-API-Key` header
- ✅ **User Whitelist**: Optional `ALLOWED_USER_IDS` to restrict bot access
- ✅ **Environment Isolation**: All secrets in `.env` (never committed)
- ✅ **GitHub Secrets**: Encrypted secret storage for CI/CD
- ✅ **Least-Privilege IAM**: GCP service account with minimal required roles
- ✅ **No Hardcoded Credentials**: All keys loaded from environment
- ✅ **Process Locking**: Prevents multiple bot instances from conflicting

### Security Checklist

- [ ] Generate strong `ORCHESTRATOR_API_KEY`: `openssl rand -hex 32`
- [ ] Set `ALLOWED_USER_IDS` to trusted Discord users only
- [ ] Never commit `.env` file to Git
- [ ] Rotate API keys every 90 days
- [ ] Use GitHub Secrets for all credentials
- [ ] Enable 2FA on all integrated services
- [ ] Review GCP IAM roles periodically

---

## 📊 API Reference

### Orchestrator REST API

**Base URL**: `http://localhost:3001`
**Authentication**: `X-API-Key` header required

#### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 12345,
  "activeAgents": 2,
  "taskManager": {
    "totalTasks": 10,
    "runningTasks": 2,
    "completedTasks": 7,
    "failedTasks": 1
  }
}
```

#### `POST /command`

Start a new task (creates isolated agent).

**Request:**
```json
{
  "command": "list all GitHub repositories",
  "context": {
    "userId": "123456789",
    "guildId": "987654321",
    "channelId": "555555555",
    "timestamp": "2025-11-16T12:00:00Z"
  },
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Agent started for task: list all GitHub repositories",
  "taskId": "task_1234567890",
  "agentIds": ["task_1234567890"]
}
```

#### `GET /tasks?channelId=X&status=running`

List all tasks (with optional filters).

**Query Params:**
- `channelId` - Filter by Discord channel
- `guildId` - Filter by Discord server
- `userId` - Filter by user
- `status` - Filter by status (pending, running, completed, failed, cancelled)

**Response:**
```json
{
  "tasks": [
    {
      "taskId": "task_123",
      "status": "running",
      "description": "list all GitHub repositories",
      "channelId": "555555555",
      "startedAt": "2025-11-16T12:00:00Z",
      "duration": 5000
    }
  ],
  "stats": {
    "total": 10,
    "running": 2,
    "completed": 7,
    "failed": 1
  },
  "total": 1
}
```

#### `GET /task/:taskId`

Get detailed task status.

**Response:**
```json
{
  "taskId": "task_123",
  "status": "completed",
  "description": "list all GitHub repositories",
  "channelId": "555555555",
  "startedAt": "2025-11-16T12:00:00Z",
  "completedAt": "2025-11-16T12:00:15Z",
  "duration": 15000,
  "result": {
    "success": true,
    "message": "Found 23 repositories",
    "iterations": 3,
    "toolCalls": 5
  }
}
```

#### `POST /task/:taskId/cancel`

Cancel a running task.

**Response:**
```json
{
  "success": true,
  "message": "Task task_123 cancelled successfully"
}
```

---

## 🐛 Troubleshooting

### Bot Won't Start

**Symptom**: Bot crashes on startup

**Solutions:**
1. Check `.env` file exists and has all required variables
2. Verify API keys are valid (test at provider dashboards)
3. Ensure port 3001 is not already in use: `lsof -i :3001`
4. Check logs: `tail -f logs/combined.log`

### Voice Chat Not Responding

**Symptom**: Bot joins voice but doesn't respond to commands

**Solutions:**
1. Verify `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` are set
2. Check ElevenLabs dashboard for agent status
3. Ensure Discord bot has "Use Voice Activity" permission
4. Look for tool registration logs: `grep "Tools" logs/combined.log`

### Agents Go Silent

**Symptom**: Task starts but no progress updates

**Solutions:**
1. Set `SYSTEM_NOTIFICATION_CHANNEL_ID` in `.env`
2. Check notification handler is set: Look for "sendTextMessage" in logs
3. Verify channel permissions (bot can send messages)
4. **Fallback**: Notifications will go to command channel if notification channel not set

### Deployment Fails

**Symptom**: GitHub Actions workflow fails

**Solutions:**
1. Check all GitHub Secrets are set correctly
2. Verify GCP service account has required IAM roles
3. Ensure `GCP_PROJECT_ID` matches actual project
4. Review workflow logs in GitHub Actions tab
5. Test locally: `docker build -t test .`

### Can't Access Tools (Trello, GitHub, etc.)

**Symptom**: Agent says "I don't have access to..."

**Solutions:**
1. Verify credentials in `.env`: `TRELLO_API_KEY`, `GITHUB_TOKEN`
2. Check agent tools are registered: Look for "[Tools] Registered" in logs
3. For GitHub: Try `gh auth status` to verify gh CLI is authenticated
4. For Trello: Test API key at https://trello.com/app-key

### Multiple Bot Instances

**Symptom**: "Another instance is already running"

**Solutions:**
1. Check for running processes: `ps aux | grep "node dist/index.js"`
2. Kill stale processes: `pkill -f "node dist/index.js"`
3. Remove lock file if stale: `rm data/.agentflow.lock`
4. Restart: `npm start`

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Test locally**: `npm run dev`
5. **Commit**: `git commit -m "Add amazing feature"`
6. **Push**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines

- Use TypeScript for all new code
- Follow existing code style
- Add logging for important operations
- Update documentation for new features
- Test with both voice and text commands

---

## 📚 Documentation

- **[ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md)** - Comprehensive architecture analysis
- **[MULTI_AGENT_ARCHITECTURE.md](MULTI_AGENT_ARCHITECTURE.md)** - Multi-agent design details
- **[GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)** - CI/CD setup guide
- **[TRELLO_INTEGRATION.md](TRELLO_INTEGRATION.md)** - Trello API documentation
- **[VOICE_CHAT_TRELLO_FIX.md](VOICE_CHAT_TRELLO_FIX.md)** - Voice integration deep dive

---

## 📝 License

ISC License - See [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [Anthropic Claude](https://anthropic.com) - World-class AI reasoning
- [ElevenLabs](https://elevenlabs.io) - Best-in-class conversational AI
- [Discord.js](https://discord.js.org) - Powerful Discord library
- [Hetzner Cloud](https://hetzner.cloud) - Reliable VPS hosting
- [Groq](https://groq.com) - Ultra-fast AI inference

---

## 🌟 Star History

If you find AgentFlow useful, please consider starring the repository!

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/agentflow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/agentflow/discussions)
- **Discord**: [Join our server](#) (optional: add if you create one)

---

**Built with ❤️ by developers, for developers**

*AgentFlow - Because talking to your AI should be as natural as talking to your team.*
