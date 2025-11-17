# AgentFlow - Voice-Driven Discord Bot with Claude AI

A sophisticated Discord voice bot that transcribes conversations using Whisper and integrates with Claude AI to execute complex tasks through an orchestrator that can spawn sub-agents on the cloud.

## Architecture

```
┌─────────────────┐
│  Discord Voice  │
│    Channel      │
└────────┬────────┘
         │ Audio Stream
         ▼
┌─────────────────┐
│  Discord Bot    │
│  + Whisper AI   │
└────────┬────────┘
         │ Voice Command
         ▼
┌─────────────────┐
│  Orchestrator   │
│  + Claude AI    │
└────────┬────────┘
         │ Task Delegation
         ▼
┌─────────────────┐
│  Sub-Agents     │
│  (Terminal,     │
│   Analysis,     │
│   Deployment)   │
└─────────────────┘
```

## Features

- **Voice Transcription**: Real-time audio capture from Discord voice channels with Whisper AI transcription
- **Claude AI Integration**: Intelligent command interpretation and task planning
- **Sub-Agent Spawning**: Dynamically creates specialized agents for complex tasks
- **Terminal Execution**: Runs bash commands based on voice input
- **Natural Interruptions**: Interrupt the bot at any time by speaking or using `!stop` command
- **Trello Integration**: Full project management capabilities - create, read, update cards via voice or text commands
- **Daily Goals Tracker**: Automated daily reminders to set goals, with database storage and history tracking
- **Cloud-Ready**: Docker support with deployment scripts for AWS, GCP, and Digital Ocean
- **API-First Design**: RESTful orchestrator API for monitoring and control
- **Security**: API key authentication and user whitelist

## Quick Start

### Prerequisites

- Node.js 20+
- Discord Bot Token ([Create one here](https://discord.com/developers/applications))
- OpenAI API Key (for Whisper)
- Anthropic API Key (for Claude)
- FFmpeg (optional, for better audio processing)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd agentflow
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Edit `.env` with your credentials:
```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
ORCHESTRATOR_URL=http://localhost:3001
ORCHESTRATOR_API_KEY=your_secure_random_key
ALLOWED_USER_IDS=discord_user_id1,discord_user_id2

# Optional: Trello Integration
TRELLO_API_KEY=your_trello_api_key
TRELLO_API_TOKEN=your_trello_api_token
```

5. Build the project:
```bash
npm run build
```

6. Start the bot:
```bash
npm start
```

Or run in development mode:
```bash
npm run dev
```

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent
5. Go to "OAuth2" → "URL Generator"
6. Select scopes: `bot`, `applications.commands`
7. Select bot permissions:
   - Read Messages/View Channels
   - Send Messages
   - Connect
   - Speak
   - Use Voice Activity
8. Copy the generated URL and invite the bot to your server

## Usage

### Discord Commands

Once the bot is in your server and running:

**Voice & Status:**
- `!join` - Bot joins your current voice channel and starts listening
- `!leave` - Bot leaves the voice channel
- `!status` - Check bot connection status
- `!stop` / `!interrupt` - Interrupt the bot's current speech (also happens automatically when you start speaking)

**Trello Integration:**
- `!trello-help` - Show all Trello commands and usage examples
- `!trello-boards` - List all your Trello boards
- `!trello-lists <board-id-or-name>` - List all lists on a board
- `!trello-cards <list-id>` - List all cards on a list
- `!trello-create` - Create a new card (multi-line format)
- `!trello-update` - Update an existing card (multi-line format)
- `!trello-search <query>` - Search for cards across all boards

See [TRELLO_INTEGRATION.md](./TRELLO_INTEGRATION.md) for detailed Trello documentation.

**Daily Goals Tracker:**
- `!goals-setup <channel> <user> [time] [timezone]` - Schedule daily goals reminder (e.g., `!goals-setup this @me`)
- `!goals-test [@user]` - Trigger a test reminder immediately
- `!goals-history [@user] [limit]` - View goals history (default: last 7 days)
- `!goals-cancel <user>` - Cancel scheduled reminder for a user
- `!goals-help` - Show all goals commands and usage examples

See [DAILY_GOALS_GUIDE.md](./DAILY_GOALS_GUIDE.md) for detailed goals tracker documentation.

### Voice Commands

Simply speak in the voice channel where the bot is connected. The bot will:

1. Capture your voice
2. Transcribe it using Whisper
3. Send the transcript to Claude AI orchestrator
4. Execute the requested task
5. Spawn sub-agents if needed for complex operations

### Example Voice Commands

**System Commands:**
- "List all files in the current directory"
- "Check the system uptime and memory usage"
- "Create a new Python script that prints hello world"
- "Deploy the latest changes to production"

**Trello Commands:**
- "Show me my Trello boards"
- "Create a card on my backlog list called 'Fix navigation bug'"
- "Search Trello for authentication issues"
- "What cards are in the In Progress list?"

## API Documentation

The orchestrator exposes a REST API on port 3001:

### Endpoints

#### `GET /health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "uptime": 12345,
  "activeAgents": 2
}
```

#### `POST /command`
Process a voice command

**Headers:**
- `X-API-Key`: Your orchestrator API key

**Request:**
```json
{
  "command": "list all files",
  "context": {
    "userId": "123456789",
    "guildId": "987654321",
    "channelId": "555555555",
    "timestamp": "2025-11-15T12:00:00Z"
  },
  "priority": "normal"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task analysis...",
  "taskId": "task_1234567890_abc123",
  "executionPlan": [
    "Step 1...",
    "Step 2..."
  ],
  "agentIds": ["agent_1234567890_xyz789"]
}
```

#### `GET /task/:taskId`
Get task status

**Response:**
```json
[
  {
    "id": "agent_1234567890_xyz789",
    "type": "terminal",
    "status": "completed",
    "result": "file1.txt\nfile2.txt"
  }
]
```

#### `GET /agents`
List all active agents

#### `DELETE /agent/:agentId`
Terminate a specific agent

#### `DELETE /history/:guildId/:userId`
Clear conversation history for a user

## Cloud Deployment

### Docker

Build and run with Docker:

```bash
docker build -t agentflow .
docker run -p 3001:3001 --env-file .env agentflow
```

Or use Docker Compose:

```bash
docker-compose up -d
```

### AWS ECS

```bash
cd deploy
./aws-ecs.sh
```

### Google Cloud Run

```bash
export GCP_PROJECT_ID=your-project-id
cd deploy
./gcp-cloud-run.sh
```

### Digital Ocean

```bash
cd deploy
./digital-ocean.sh
```

## Project Structure

```
agentflow/
├── src/
│   ├── bot/              # Discord bot implementation
│   │   ├── discordBot.ts
│   │   └── voiceReceiver.ts
│   ├── orchestrator/     # Claude AI orchestrator
│   │   ├── claudeClient.ts
│   │   └── orchestratorServer.ts
│   ├── agents/           # Sub-agent management
│   │   └── subAgentManager.ts
│   ├── utils/            # Utilities
│   │   ├── config.ts
│   │   ├── logger.ts
│   │   └── whisper.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   └── index.ts          # Main entry point
├── deploy/               # Cloud deployment scripts
│   ├── aws-ecs.sh
│   ├── gcp-cloud-run.sh
│   └── digital-ocean.sh
├── Dockerfile
├── docker-compose.yml
├── tsconfig.json
└── package.json
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Discord bot token | Yes |
| `DISCORD_CLIENT_ID` | Discord application client ID | Yes |
| `OPENAI_API_KEY` | OpenAI API key for Whisper | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | Yes |
| `ORCHESTRATOR_URL` | Orchestrator server URL | Yes |
| `ORCHESTRATOR_API_KEY` | API key for orchestrator auth | Yes |
| `ALLOWED_USER_IDS` | Comma-separated Discord user IDs | No |
| `MAX_CONCURRENT_AGENTS` | Max number of concurrent sub-agents (1-20) | No (default: 5) |
| `TTS_SPEED` | Speech speed for text-to-speech (0.25-4.0) | No (default: 1.0) |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARN, ERROR) | No (default: INFO) |
| `TRELLO_API_KEY` | Trello API key for project management | No |
| `TRELLO_API_TOKEN` | Trello API token for authentication | No |

## Security

- **API Key Authentication**: All orchestrator API calls require authentication
- **User Whitelist**: Optionally restrict bot usage to specific Discord users
- **Rate Limiting**: Configure max concurrent agents to prevent resource exhaustion
- **Environment Isolation**: Sensitive credentials stored in environment variables

## Troubleshooting

### Bot doesn't join voice channel

- Ensure bot has proper permissions (Connect, Speak)
- Check that you're in a voice channel when using `!join`
- Verify Discord token is correct

### Audio transcription fails

- Verify OpenAI API key is valid
- Check that audio files are being created in `./audio` directory
- Install FFmpeg for better audio processing

### Commands not executing

- Check orchestrator is running on port 3001
- Verify ORCHESTRATOR_API_KEY matches between bot and server
- Check logs for detailed error messages

### Docker container fails to start

- Ensure all environment variables are set
- Check Docker logs: `docker logs <container-id>`
- Verify port 3001 is not already in use

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Cleaning

```bash
npm run clean
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.

## Roadmap

- [ ] Multi-language support for voice transcription
- [ ] Web dashboard for monitoring agents
- [ ] Persistent conversation history with database
- [ ] Support for more AI models
- [ ] Advanced task scheduling
- [ ] Integration with CI/CD pipelines
- [ ] Voice response synthesis
