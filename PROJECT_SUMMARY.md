# AgentFlow - Project Summary

## Overview

AgentFlow is a sophisticated voice-driven Discord bot that combines multiple AI technologies to execute complex tasks through natural voice commands. The system uses Whisper for transcription, Claude AI for intelligent orchestration, and can spawn sub-agents for parallel task execution.

## Key Features Implemented

### 1. Discord Voice Integration
- **Voice Channel Management**: Bot can join/leave voice channels via commands
- **Real-time Audio Capture**: Captures audio streams from Discord voice channels
- **Automatic Cleanup**: Leaves channel when alone, cleans up temp files

### 2. Speech-to-Text with Whisper
- **OpenAI Whisper Integration**: High-quality transcription of voice commands
- **Audio Processing**: Converts Discord audio streams to WAV format
- **Temporary File Management**: Automatic cleanup of audio files

### 3. Claude AI Orchestrator
- **Intelligent Command Interpretation**: Uses Claude 3.5 Sonnet to understand commands
- **Execution Planning**: Breaks down complex tasks into executable steps
- **Conversation Memory**: Maintains context across multiple commands per user
- **Bash Command Extraction**: Can extract and execute terminal commands

### 4. Sub-Agent System
- **Dynamic Agent Spawning**: Creates specialized agents for complex tasks
- **Task Types**: Terminal execution, API calls, analysis, deployment
- **Concurrent Execution**: Configurable number of parallel agents
- **Status Tracking**: Monitor progress of all active agents

### 5. RESTful API
- **Command Processing**: POST endpoint for voice command execution
- **Task Monitoring**: GET endpoints for status checking
- **Agent Management**: Terminate agents, clear history
- **Health Checks**: Monitor system health and active agents

### 6. Security Features
- **API Key Authentication**: All orchestrator calls require authentication
- **User Whitelist**: Optional restriction to specific Discord users
- **Environment Variables**: Secure credential storage
- **Rate Limiting**: Configurable max concurrent agents

### 7. Cloud Deployment
- **Docker Support**: Production-ready Dockerfile and docker-compose
- **Multi-Cloud Scripts**: Deployment scripts for AWS ECS, GCP Cloud Run, Digital Ocean
- **Health Checks**: Docker health monitoring
- **Volume Management**: Persistent storage for logs and audio

### 8. Trello Integration
- **Project Management**: Full CRUD operations for Trello cards, lists, and boards
- **Discord Commands**: Text-based commands for managing Trello directly from Discord
- **Voice Commands**: Natural language Trello operations via voice
- **Search & Filter**: Find cards across all boards with keyword search
- **Automation Ready**: Programmatic API for workflow automation

## Architecture

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  Discord Voice Channel (User speaks)            │
│                                                  │
└────────────────┬─────────────────────────────────┘
                 │
                 │ Audio Stream
                 ▼
┌──────────────────────────────────────────────────┐
│  Discord Bot (src/bot/)                          │
│  ┌─────────────────┐  ┌──────────────────┐     │
│  │  discordBot.ts  │  │ voiceReceiver.ts  │     │
│  └─────────────────┘  └──────────────────┘     │
│                                                  │
│  ┌────────────────────────────────────┐         │
│  │  Whisper Service (utils/whisper)   │         │
│  └────────────────────────────────────┘         │
└────────────────┬─────────────────────────────────┘
                 │
                 │ Transcribed Text
                 ▼
┌──────────────────────────────────────────────────┐
│  Orchestrator Server (src/orchestrator/)         │
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │  Claude Client (claudeClient.ts)     │       │
│  │  - Command interpretation             │       │
│  │  - Execution planning                 │       │
│  │  - Conversation memory                │       │
│  └──────────────────────────────────────┘       │
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │  Express Server                       │       │
│  │  - REST API endpoints                 │       │
│  │  - Authentication                     │       │
│  └──────────────────────────────────────┘       │
└────────────────┬─────────────────────────────────┘
                 │
                 │ Task Delegation
                 ▼
┌──────────────────────────────────────────────────┐
│  Sub-Agent Manager (src/agents/)                 │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Terminal │  │ Analysis │  │   API    │      │
│  │  Agent   │  │  Agent   │  │  Agent   │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  - Parallel execution                            │
│  - Status tracking                               │
│  - Resource management                           │
└──────────────────────────────────────────────────┘
```

## Technology Stack

### Core Technologies
- **TypeScript**: Type-safe development
- **Node.js 20+**: Runtime environment
- **Discord.js v14**: Discord API integration
- **@discordjs/voice**: Voice channel support

### AI Services
- **OpenAI Whisper**: Speech-to-text transcription
- **Anthropic Claude 3.5 Sonnet**: Command orchestration and sub-agent processing

### Backend
- **Express.js**: REST API server
- **prism-media**: Audio processing

### DevOps
- **Docker**: Containerization
- **Docker Compose**: Local orchestration
- **Cloud Deployment Scripts**: AWS, GCP, Digital Ocean

## File Structure

```
agentflow/
├── src/
│   ├── bot/
│   │   ├── discordBot.ts          # Main Discord bot class
│   │   └── voiceReceiver.ts        # Audio capture and processing
│   ├── orchestrator/
│   │   ├── claudeClient.ts         # Claude AI integration
│   │   └── orchestratorServer.ts   # Express API server
│   ├── agents/
│   │   └── subAgentManager.ts      # Sub-agent lifecycle management
│   ├── services/
│   │   ├── trello.ts               # Trello API integration
│   │   ├── database.ts             # Database service
│   │   └── channelNotifier.ts      # Discord notifications
│   ├── utils/
│   │   ├── config.ts               # Configuration loader
│   │   ├── logger.ts               # Logging utility
│   │   └── whisper.ts              # Whisper transcription service
│   ├── types/
│   │   └── index.ts                # TypeScript type definitions
│   └── index.ts                    # Application entry point
├── deploy/
│   ├── aws-ecs.sh                  # AWS ECS deployment
│   ├── gcp-cloud-run.sh            # GCP Cloud Run deployment
│   └── digital-ocean.sh            # Digital Ocean deployment
├── Dockerfile                      # Production Docker image
├── docker-compose.yml              # Local Docker orchestration
├── tsconfig.json                   # TypeScript configuration
├── package.json                    # Dependencies and scripts
├── .env.example                    # Environment variable template
├── README.md                       # User documentation
├── SETUP_GUIDE.md                  # Detailed setup instructions
└── quick-start.sh                  # Automated setup script
```

## Configuration

### Required Environment Variables

| Variable | Purpose | Source |
|----------|---------|--------|
| `DISCORD_TOKEN` | Discord bot authentication | Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Discord application ID | Discord Developer Portal |
| `OPENAI_API_KEY` | Whisper transcription | OpenAI Platform |
| `ANTHROPIC_API_KEY` | Claude AI orchestration | Anthropic Console |
| `ORCHESTRATOR_URL` | API server URL | Self-configured |
| `ORCHESTRATOR_API_KEY` | API authentication | Self-generated |

### Optional Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `ALLOWED_USER_IDS` | Empty | User access control |
| `MAX_CONCURRENT_AGENTS` | 5 | Resource limiting |
| `TTS_SPEED` | 1.0 | Speech speed (0.25-4.0, higher is faster) |
| `USE_REALTIME_API` | false | Use OpenAI Realtime API for voice |
| `LOG_LEVEL` | INFO | Logging verbosity |
| `TRELLO_API_KEY` | Empty | Trello API key (optional) |
| `TRELLO_API_TOKEN` | Empty | Trello API token (optional) |

## API Endpoints

### Health & Monitoring
- `GET /health` - System health check
- `GET /agents` - List active agents
- `GET /task/:taskId` - Get task status

### Command Processing
- `POST /command` - Process voice command
  - Requires: `X-API-Key` header
  - Body: Command text + context

### Management
- `DELETE /agent/:agentId` - Terminate agent
- `DELETE /history/:guildId/:userId` - Clear conversation history

## Discord Commands

### Voice & Status
- `!join` - Bot joins your voice channel
- `!leave` - Bot leaves voice channel
- `!status` - Check bot connection status

### Trello Integration
- `!trello-help` - Show all Trello commands
- `!trello-boards` - List all your boards
- `!trello-lists <board>` - List all lists on a board
- `!trello-cards <list>` - List all cards on a list
- `!trello-create` - Create a new card
- `!trello-update` - Update an existing card
- `!trello-search <query>` - Search for cards

See [TRELLO_INTEGRATION.md](./TRELLO_INTEGRATION.md) for detailed documentation.

## Voice Command Flow

1. **User speaks** in Discord voice channel
2. **Audio captured** by VoiceReceiver
3. **Audio saved** as temporary file
4. **Whisper transcribes** audio to text
5. **Text sent** to Claude orchestrator
6. **Claude analyzes** and creates execution plan
7. **Sub-agents spawned** if needed
8. **Tasks executed** (terminal commands, analysis, etc.)
9. **Results returned** to orchestrator
10. **Status available** via API

## Development Workflow

### Quick Start
```bash
./quick-start.sh  # Automated setup
npm run dev       # Start with hot-reload
```

### Manual Workflow
```bash
npm install       # Install dependencies
npm run build     # Compile TypeScript
npm start         # Start production server
```

### Build Commands
- `npm run build` - Compile TypeScript
- `npm run clean` - Remove build artifacts
- `npm run rebuild` - Clean + build
- `npm run dev` - Development mode with nodemon

## Deployment Options

### Local Docker
```bash
docker-compose up -d
```

### AWS ECS
```bash
./deploy/aws-ecs.sh
```

### GCP Cloud Run
```bash
export GCP_PROJECT_ID=your-project
./deploy/gcp-cloud-run.sh
```

### Digital Ocean
```bash
./deploy/digital-ocean.sh
```

## Security Considerations

1. **API Keys**: Never commit `.env` files
2. **User Whitelist**: Restrict bot access in production
3. **Rate Limiting**: Configure `MAX_CONCURRENT_AGENTS`
4. **HTTPS**: Use HTTPS for production orchestrator
5. **Regular Updates**: Keep dependencies updated

## Performance Characteristics

### Resource Usage
- **Memory**: ~200-500MB base + ~50MB per active agent
- **CPU**: Low idle, spikes during transcription/AI calls
- **Network**: Voice stream bandwidth + API calls

### Scalability
- Concurrent agents limited by `MAX_CONCURRENT_AGENTS`
- Conversation history limited to last 10 messages per user
- Audio files auto-cleaned after 1 hour

### Costs (Approximate)
- **Whisper**: $0.006/minute of audio
- **Claude API**: Variable by model and usage
- **Cloud Hosting**: Depends on provider and tier

## Future Enhancements

### Planned Features
- [ ] Web dashboard for monitoring
- [ ] Database for persistent conversation history
- [ ] Multi-language transcription support
- [ ] Voice response synthesis (TTS)
- [ ] Advanced task scheduling
- [ ] CI/CD pipeline integration
- [ ] Metrics and analytics

### Technical Improvements
- [ ] Add unit tests
- [ ] Integration tests
- [ ] Performance monitoring
- [ ] Error recovery mechanisms
- [ ] WebSocket support for real-time updates
- [ ] Kubernetes deployment manifests

## Troubleshooting

### Common Issues

1. **Bot doesn't respond to voice**
   - Check Whisper API key
   - Verify audio files in `./audio` directory
   - Check logs for transcription errors

2. **Unauthorized errors**
   - Verify `ORCHESTRATOR_API_KEY` matches
   - Check user is in `ALLOWED_USER_IDS`

3. **Build failures**
   - Ensure Node.js 20+
   - Run `npm install` again
   - Check TypeScript errors

4. **High API costs**
   - Enable user whitelist
   - Reduce `MAX_CONCURRENT_AGENTS`
   - Monitor usage dashboards

## Documentation

- **README.md**: User-facing documentation
- **SETUP_GUIDE.md**: Detailed setup instructions
- **PROJECT_SUMMARY.md**: This file - technical overview
- **Code Comments**: Inline documentation throughout

## Support & Contributing

### Getting Help
1. Check documentation
2. Review logs with `LOG_LEVEL=DEBUG`
3. Search existing issues
4. Create new issue with details

### Contributing
1. Fork repository
2. Create feature branch
3. Make changes
4. Submit pull request

## License

ISC License

## Acknowledgments

- **Discord.js**: Excellent Discord library
- **OpenAI**: Whisper speech-to-text
- **Anthropic**: Claude AI capabilities
- **Community**: Open source contributors

## Version History

- **v1.0.0** (2025-11-15)
  - Initial release
  - Core voice bot functionality
  - Claude AI orchestration
  - Sub-agent system
  - Cloud deployment support
  - Complete documentation

---

**Project Status**: Production Ready
**Last Updated**: 2025-11-15
**Maintainer**: Your Team
