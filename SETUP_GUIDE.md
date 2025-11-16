# AgentFlow Setup Guide

Complete step-by-step guide to get AgentFlow running.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting API Keys](#getting-api-keys)
3. [Discord Bot Setup](#discord-bot-setup)
4. [Local Development Setup](#local-development-setup)
5. [Cloud Deployment](#cloud-deployment)
6. [Testing](#testing)
7. [Common Issues](#common-issues)

## Prerequisites

### Required Software

1. **Node.js 20 or higher**
   ```bash
   node --version  # Should be v20.x.x or higher
   ```
   Download from: https://nodejs.org/

2. **npm** (comes with Node.js)
   ```bash
   npm --version
   ```

3. **Git**
   ```bash
   git --version
   ```

4. **Docker** (optional, for containerized deployment)
   ```bash
   docker --version
   ```

### Optional Software

- **FFmpeg** (for better audio quality)
  - macOS: `brew install ffmpeg`
  - Ubuntu: `sudo apt-get install ffmpeg`
  - Windows: Download from https://ffmpeg.org/

## Getting API Keys

### 1. Discord Bot Token

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Give it a name (e.g., "AgentFlow")
4. Go to the "Bot" tab
5. Click "Add Bot"
6. Under "Token", click "Copy" to copy your bot token
7. **Save this token** - you'll need it for `DISCORD_TOKEN`
8. Get your Client ID from the "General Information" tab
9. **Save the Client ID** - you'll need it for `DISCORD_CLIENT_ID`

**Important Bot Settings:**
- Under "Privileged Gateway Intents", enable:
  - ✅ SERVER MEMBERS INTENT
  - ✅ MESSAGE CONTENT INTENT
  - ✅ PRESENCE INTENT (optional)

### 2. OpenAI API Key (for Whisper)

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Go to https://platform.openai.com/api-keys
4. Click "Create new secret key"
5. Give it a name (e.g., "AgentFlow Whisper")
6. **Copy and save the key** - you'll need it for `OPENAI_API_KEY`

**Pricing Note:** Whisper API costs $0.006/minute of audio

### 3. Anthropic API Key (for Claude)

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to https://console.anthropic.com/settings/keys
4. Click "Create Key"
5. Give it a name (e.g., "AgentFlow")
6. **Copy and save the key** - you'll need it for `ANTHROPIC_API_KEY`

**Pricing Note:** Check current pricing at https://www.anthropic.com/pricing

## Discord Bot Setup

### Step 1: Configure Bot Permissions

1. In Discord Developer Portal, go to your application
2. Go to "Bot" tab
3. Scroll to "Bot Permissions"
4. Select these permissions:
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Connect
   - ✅ Speak
   - ✅ Use Voice Activity

### Step 2: Generate Invite Link

1. Go to "OAuth2" → "URL Generator"
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select bot permissions (same as above)
4. Copy the generated URL at the bottom
5. Open the URL in your browser
6. Select your server and authorize

### Step 3: Get Your Discord User ID

1. In Discord, go to Settings → Advanced
2. Enable "Developer Mode"
3. Right-click your username anywhere
4. Click "Copy ID"
5. **Save this ID** - you'll need it for `ALLOWED_USER_IDS`

## Local Development Setup

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd agentflow

# Install dependencies
npm install
```

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file
nano .env  # or use your preferred editor
```

Fill in the values:

```env
# Discord
DISCORD_TOKEN=your_bot_token_from_step_1
DISCORD_CLIENT_ID=your_client_id_from_step_1

# OpenAI
OPENAI_API_KEY=your_openai_key_from_step_2

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key_from_step_3

# Orchestrator (for local development)
ORCHESTRATOR_URL=http://localhost:3001
ORCHESTRATOR_API_KEY=generate_a_random_secure_string_here

# Security (optional)
ALLOWED_USER_IDS=your_discord_user_id_from_step_3
MAX_CONCURRENT_AGENTS=5

# Logging
LOG_LEVEL=INFO
```

**Generate a secure API key:**
```bash
# On macOS/Linux
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Step 4: Start the Application

**Production mode:**
```bash
npm start
```

**Development mode** (with auto-reload):
```bash
npm run dev
```

You should see output like:
```
[INFO] 2025-11-15T12:00:00.000Z - Starting AgentFlow...
[INFO] 2025-11-15T12:00:00.001Z - Configuration loaded successfully
[INFO] 2025-11-15T12:00:00.002Z - Orchestrator server listening on port 3001
[INFO] 2025-11-15T12:00:00.003Z - Orchestrator server started
[INFO] 2025-11-15T12:00:00.100Z - Bot logged in as AgentFlow#1234
[INFO] 2025-11-15T12:00:00.101Z - Discord bot started successfully
[INFO] 2025-11-15T12:00:00.102Z - AgentFlow started successfully
```

### Step 5: Test the Bot

1. Open Discord
2. Join a voice channel in the server where you invited the bot
3. In any text channel, type: `!join`
4. The bot should join your voice channel
5. Speak: "Hello, what can you do?"
6. Check the console logs to see the transcription and Claude's response

## Cloud Deployment

### AWS ECS Deployment

1. Install AWS CLI: https://aws.amazon.com/cli/
2. Configure AWS credentials:
   ```bash
   aws configure
   ```
3. Set environment variables:
   ```bash
   export AWS_REGION=us-east-1
   ```
4. Run deployment script:
   ```bash
   chmod +x deploy/aws-ecs.sh
   ./deploy/aws-ecs.sh
   ```

### Google Cloud Run Deployment

1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install
2. Authenticate:
   ```bash
   gcloud auth login
   ```
3. Set project:
   ```bash
   export GCP_PROJECT_ID=your-project-id
   gcloud config set project $GCP_PROJECT_ID
   ```
4. Run deployment script:
   ```bash
   chmod +x deploy/gcp-cloud-run.sh
   ./deploy/gcp-cloud-run.sh
   ```

### Digital Ocean Deployment

1. Install doctl: https://docs.digitalocean.com/reference/doctl/how-to/install/
2. Authenticate:
   ```bash
   doctl auth init
   ```
3. Create container registry:
   ```bash
   doctl registry create agentflow-registry
   ```
4. Run deployment script:
   ```bash
   chmod +x deploy/digital-ocean.sh
   ./deploy/digital-ocean.sh
   ```

### Docker Deployment (Any Cloud Provider)

1. Create `.env` file with your production values
2. Build the image:
   ```bash
   docker build -t agentflow .
   ```
3. Run the container:
   ```bash
   docker run -d \
     --name agentflow \
     -p 3001:3001 \
     --env-file .env \
     agentflow
   ```

Or use Docker Compose:
```bash
docker-compose up -d
```

## Testing

### Manual Testing

1. **Health Check:**
   ```bash
   curl http://localhost:3001/health
   ```
   Should return:
   ```json
   {
     "status": "healthy",
     "uptime": 123.45,
     "activeAgents": 0
   }
   ```

2. **API Command Test:**
   ```bash
   curl -X POST http://localhost:3001/command \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your_orchestrator_api_key" \
     -d '{
       "command": "echo hello world",
       "context": {
         "userId": "123",
         "guildId": "456",
         "channelId": "789",
         "timestamp": "2025-11-15T12:00:00Z"
       }
     }'
   ```

3. **Discord Testing:**
   - Join a voice channel
   - Use `!join` command
   - Speak a simple command
   - Use `!status` to check connection
   - Use `!leave` to disconnect

### Voice Command Examples

Start with simple commands:

1. "List files in the current directory"
2. "What is the current date and time"
3. "Echo hello world"

Then try more complex ones:

4. "Check system memory usage"
5. "Show running processes"
6. "Create a backup of the logs directory"

## Common Issues

### Issue: Bot doesn't respond to voice

**Solutions:**
- Check bot has "Use Voice Activity" permission
- Verify OpenAI API key is valid
- Check console logs for transcription errors
- Ensure audio files are being created in `./audio` directory

### Issue: "Unauthorized" error

**Solutions:**
- Verify `ORCHESTRATOR_API_KEY` matches in both bot and server
- Check `ALLOWED_USER_IDS` includes your Discord user ID
- Ensure `.env` file is being loaded

### Issue: Build fails

**Solutions:**
- Run `npm install` to ensure all dependencies are installed
- Check Node.js version: `node --version` (should be 20+)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npx tsc --noEmit`

### Issue: Bot can't join voice channel

**Solutions:**
- Verify bot has "Connect" and "Speak" permissions
- Check you're in a voice channel when using `!join`
- Ensure voice channel isn't full or restricted
- Try a different voice channel

### Issue: High API costs

**Solutions:**
- Reduce transcription frequency by increasing silence detection time
- Use `ALLOWED_USER_IDS` to restrict usage
- Set `MAX_CONCURRENT_AGENTS` to a lower value
- Monitor usage in OpenAI and Anthropic dashboards

### Issue: Docker container exits immediately

**Solutions:**
- Check Docker logs: `docker logs <container-id>`
- Verify all environment variables are set
- Ensure port 3001 is available
- Check `.env` file exists and is properly formatted

## Next Steps

1. Customize the Claude AI system prompt in `src/orchestrator/claudeClient.ts`
2. Add more command handlers in `src/bot/discordBot.ts`
3. Implement custom sub-agent types in `src/agents/subAgentManager.ts`
4. Set up monitoring and logging for production
5. Create automated backups of conversation history

## Support

If you encounter issues not covered here:

1. Check the logs in the console
2. Enable DEBUG logging: `LOG_LEVEL=DEBUG`
3. Search existing GitHub issues
4. Create a new issue with logs and environment details

## Security Best Practices

1. **Never commit `.env` file** - it contains sensitive keys
2. **Rotate API keys regularly**
3. **Use environment-specific keys** (dev, staging, prod)
4. **Enable user whitelist** in production
5. **Monitor API usage** to detect anomalies
6. **Use HTTPS** for orchestrator in production
7. **Implement rate limiting** for the API
8. **Regular security updates**: `npm audit fix`
