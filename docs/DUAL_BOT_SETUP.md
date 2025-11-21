# Running Both Bots Simultaneously 🤖🌏

AgentFlow now has **two separate Discord bots** working together:

## Bot Architecture

```
┌─────────────────────────────────────────────────────────┐
│            INTELLIGENCE UNLEASHED Server                │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                   ┌─────────▼─────────┐
│   Main Bot     │                   │   Atlas Bot       │
│ (agents#4032)  │                   │ (global markets   │
│                │                   │  intelligence)    │
└───────┬────────┘                   └─────────┬─────────┘
        │                                      │
        │ All non-market channels              │ Market channels only
        │ - #general                           │ - #crypto
        │ - #agent-chat                        │ - #finance
        │ - #goals                             │ - #global-ai
        │ - #waterwise                         │
        │ - etc.                               │
        │                                      │
        ▼                                      ▼
┌───────────────────┐              ┌─────────────────────┐
│ General Assistant │              │ Market Intelligence │
│ - Voice AI        │              │ - Perplexity        │
│ - Coding tasks    │              │ - Yahoo Finance     │
│ - Orchestration   │              │ - Finnhub           │
│ - Cloud deploy    │              │ - Portfolio tracking│
└───────────────────┘              └─────────────────────┘
```

## Main Bot (General Assistant)

**Token**: `DISCORD_TOKEN`
**User**: `agents#4032`
**Purpose**: General-purpose assistant for non-market tasks

**Capabilities**:
- ✅ Voice conversations (OpenAI Realtime API)
- ✅ Autonomous coding agents (Claude Code)
- ✅ Task orchestration
- ✅ Cloud deployments
- ✅ Engineering tasks
- ❌ **Does NOT respond in market channels**

**Active Channels**: All channels EXCEPT #crypto, #finance, #global-ai

## Atlas Bot (Market Intelligence)

**Token**: `ATLAS_DISCORD_TOKEN`
**User**: `global markets intelligence#5310`
**Purpose**: Market intelligence specialist

**Capabilities**:
- ✅ Real-time crypto/FX prices
- ✅ Portfolio tracking (AI Manhattan Project)
- ✅ Perplexity-powered news & analysis
- ✅ Sector analysis
- ✅ Geopolitical analysis
- ✅ Earnings analysis
- ✅ Market sentiment tracking
- ❌ **Only responds in market channels**

**Active Channels**: #crypto, #finance, #global-ai

## Starting Both Bots

### Option 1: Production (Simple)

```bash
# Start both bots in one command
npm run start:all
```

This runs both bots in the same terminal. Press `Ctrl+C` to stop both.

### Option 2: Development (Hot Reload)

```bash
# Terminal 1: Main bot with hot reload
npm run dev

# Terminal 2: Atlas bot with hot reload
npm run atlas:dev
```

### Option 3: Production (Separate Terminals)

```bash
# Terminal 1: Main bot
npm start

# Terminal 2: Atlas bot
npm run atlas
```

## How Channel Separation Works

The main bot checks each incoming message:

```typescript
// In src/bot/discordBotRealtime.ts:150
if (config.globalMarketsChannels.includes(message.channelId)) {
  logger.info(`⏭️  Ignoring message in Atlas channel ${channelId}`);
  return; // Don't respond - let Atlas handle it
}
```

Atlas only monitors channels in `GLOBAL_MARKETS_CHANNELS`:

```typescript
// In src/atlas/atlasBot.ts:189
if (!this.monitoredChannels.has(message.channelId)) return;
```

## Configuration

Both bots use the same `.env` file:

```bash
# Main Bot (General Assistant)
DISCORD_TOKEN=MTQzOTQzMzM5MTcxMDY3MDk1OQ.G1IU38...
DISCORD_CLIENT_ID=1439433391710670959

# Atlas Bot (Market Intelligence)
ATLAS_DISCORD_TOKEN=MTQ0MDA1NzM3NTUyNzY2NTY3NA.GKNTGl...
ATLAS_DISCORD_CLIENT_ID=1440057375527665674

# Shared APIs
ANTHROPIC_API_KEY=sk-ant-api03-hYATlf27K1CbsPIr...
OPENAI_API_KEY=sk-proj-GbmSQDeHvMU1SMIsm...
PERPLEXITY_API_KEY=pplx-ZnyPhBBuOHEZRYoIW5r...

# Channel Configuration
GLOBAL_MARKETS_CHANNELS=1339709679537750036,1439869363502055474,1439887464524283924
# Maps to: #crypto, #finance, #global-ai
```

## Testing Both Bots

### Test Main Bot (in #general or #agent-chat):

```
!help
what's the weather?
!agents
```

**Expected**: Main bot responds

### Test Atlas (in #crypto, #finance, or #global-ai):

```
btc price?
show me the portfolio
china economic outlook
```

**Expected**: Atlas responds (not main bot)

### Test Separation (in #crypto):

```
!help
```

**Expected**: No response (neither bot responds to commands in wrong channels)

## Monitoring

### Main Bot Logs:
```
✅ Bot logged in as agents#4032
📝 Main bot will ignore 3 Atlas-monitored channels
⏭️  Ignoring message in Atlas channel 1339709679537750036
```

### Atlas Logs:
```
✅ Atlas bot logged in as global markets intelligence#5310
📡 Monitoring 3 channels
🌏 Atlas responded in channel 1339709679537750036
```

## Troubleshooting

### Both bots responding in same channel?
- Restart main bot - it needs to load updated channel config
- Check `.env` has `GLOBAL_MARKETS_CHANNELS` set correctly

### Neither bot responding?
- Ensure Atlas bot is invited to server (use invite link in `ATLAS_CHANNEL_INTEGRATION.md`)
- Check both bots are online in Discord server members list
- Verify channel IDs in `GLOBAL_MARKETS_CHANNELS` are correct

### Main bot responding in market channels?
- Restart main bot to reload configuration
- Check logs for "Ignoring message in Atlas channel" messages
- Verify `src/bot/discordBotRealtime.ts:150` has the channel check

### Atlas not responding?
- Verify Atlas is invited and has permissions
- Check message contains trigger keywords or @Atlas mention
- Rate limit: 5 seconds between responses per user

## Cost Considerations

Running both bots simultaneously:

**Main Bot**:
- OpenAI Realtime API: ~$0.06/min (voice only)
- Claude API: Pay-per-use (coding tasks)

**Atlas Bot**:
- Perplexity API: ~$0.04-0.20/day
- Yahoo Finance: Free
- Finnhub: Free tier

**Total**: ~$1.50-9/month for market intelligence + usage-based for general tasks

## Production Deployment

For production, deploy both bots:

```bash
# Build both
npm run build

# Deploy main bot to Cloud Run
gcloud run deploy agentflow-bot \
  --source . \
  --region us-central1

# Deploy Atlas bot separately
gcloud run deploy agentflow-atlas \
  --source . \
  --command "node dist/atlas/index.js" \
  --region us-central1
```

Or run on a VPS:

```bash
# Using PM2
pm2 start npm --name "agentflow-main" -- start
pm2 start npm --name "agentflow-atlas" -- run atlas

pm2 logs  # View both logs
pm2 status  # Check status
```

## Summary

✅ **Main Bot**: General assistant for all non-market channels
✅ **Atlas Bot**: Market intelligence specialist for #crypto, #finance, #global-ai
✅ **Clean Separation**: Main bot ignores Atlas channels, Atlas only responds in its channels
✅ **Easy Startup**: `npm run start:all` to run both
✅ **Hot Reload**: Use `npm run dev` + `npm run atlas:dev` for development

Both bots work together seamlessly - main bot handles general tasks, Atlas handles market intelligence!
