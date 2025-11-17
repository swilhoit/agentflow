# ElevenLabs Conversational AI Integration

## Overview

AgentFlow now uses **ElevenLabs Conversational AI** instead of OpenAI Realtime API for voice interactions. ElevenLabs provides:

- 🗣️ **High-Quality Voice Synthesis** - Over 5,000 voices in 31 languages
- ⚡ **Low-Latency Responses** - Sub-second voice interaction
- 🎯 **Natural Turn-Taking** - Intelligent conversation flow management
- 🛠️ **Function Calling** - Seamless integration with tools and commands

## Setup Instructions

### 1. Create an ElevenLabs Account

1. Sign up at [ElevenLabs](https://elevenlabs.io/)
2. Navigate to your profile settings
3. Generate your API key

### 2. Create a Conversational AI Agent

1. Go to the [ElevenLabs Dashboard](https://elevenlabs.io/app/conversational-ai)
2. Click **"Create New Agent"**
3. Configure your agent:
   - **Name**: AgentFlow Assistant (or your choice)
   - **Voice**: Select from available voices
   - **Language Model**: Choose OpenAI GPT-4, Anthropic Claude, or Google Gemini
   - **System Prompt**: Use the default or customize as needed
4. Save the agent and copy the **Agent ID**

### 3. Configure Environment Variables

Add the following to your `.env` file:

```env
# ElevenLabs Configuration
ELEVENLABS_API_KEY=sk_92a408675e5533f7135783363f78b74b15f11a94b7eb340d
ELEVENLABS_AGENT_ID=your_agent_id_here

# Other required variables
DISCORD_TOKEN=your_discord_token
DISCORD_CLIENT_ID=your_client_id
ANTHROPIC_API_KEY=your_anthropic_key
ORCHESTRATOR_URL=http://localhost:3000
ORCHESTRATOR_API_KEY=your_orchestrator_key

# Optional
ALLOWED_USER_IDS=comma,separated,user,ids
TTS_SPEED=1.0
SYSTEM_NOTIFICATION_CHANNEL_ID=your_channel_id
```

### 4. Install Dependencies

```bash
npm install
```

The `@elevenlabs/elevenlabs-js` SDK is already included in the dependencies.

### 5. Build and Run

```bash
npm run build
npm start
```

## How It Works

### Architecture

```
Discord Voice → RealtimeVoiceReceiver → ElevenLabsVoiceService → Conversational AI API
                          ↓
                 Audio Processing
                 - 48kHz Opus (Discord) → 24kHz PCM → 16kHz PCM (ElevenLabs)
                 - 16kHz PCM (ElevenLabs) → 48kHz PCM → Opus (Discord)
```

### Key Components

1. **ElevenLabsVoiceService** (`src/utils/elevenLabsVoice.ts`)
   - Manages WebSocket connection to ElevenLabs
   - Handles audio streaming and transcription
   - Implements function calling for tool integration

2. **RealtimeVoiceReceiver** (`src/bot/realtimeVoiceReceiver.ts`)
   - Bridges Discord voice with ElevenLabs
   - Handles audio resampling and format conversion
   - Manages conversation flow and interruptions

3. **DiscordBotRealtime** (`src/bot/discordBotRealtime.ts`)
   - Main bot interface
   - Handles Discord commands and events
   - Integrates with orchestrator for task execution

## Audio Processing Details

### Input Pipeline (User → ElevenLabs)

1. **Discord** → 48kHz Opus Stereo
2. **Decode** → 48kHz PCM Stereo
3. **Downsample & Convert** → 24kHz PCM Mono
4. **Downsample** → 16kHz PCM Mono (ElevenLabs)

### Output Pipeline (ElevenLabs → Discord)

1. **ElevenLabs** → 16kHz PCM Mono
2. **Upsample** → 48kHz PCM Stereo (3x + channel duplication)
3. **Encode** → 48kHz Opus Stereo
4. **Discord** → Playback

## Features

### Natural Interruptions

ElevenLabs Conversational AI automatically handles:
- Voice Activity Detection (VAD)
- Turn-taking management
- Conversation flow

Users can interrupt the bot naturally by speaking, and the system will handle it gracefully.

### Function Calling

The integration supports calling functions/tools during conversations:

```typescript
// Functions are registered automatically
receiver.onFunctionCall(async (name: string, args: any) => {
  // Handle execute_task, deploy_to_cloud_run, etc.
  return await handleFunctionCall(name, args);
});
```

### Hybrid Action Detection

The system detects action commands (create, update, list, deploy, etc.) and automatically routes them to the orchestrator while maintaining natural conversation for everything else.

## Pricing

ElevenLabs Conversational AI pricing (as of 2024):

- **Free**: 15 minutes/month
- **Starter**: $5/month for 50 minutes
- **Creator**: $22/month for 250 minutes
- **Pro**: $99/month for 1,100 minutes
- **Scale**: $330/month for 3,600 minutes
- **Business**: $1,320/month for 13,750 minutes

Note: Extended silence periods are billed at 5% of the usual rate.

## Troubleshooting

### Connection Issues

**Error: "Agent ID is required"**
- Make sure `ELEVENLABS_AGENT_ID` is set in your `.env` file
- Verify the agent exists in your ElevenLabs dashboard

**Error: "Could not connect to ElevenLabs"**
- Check your API key is valid
- Ensure you have available credits/minutes
- Verify network connectivity

### Audio Issues

**No audio output**
- Check Discord bot permissions (Connect, Speak, Use Voice Activity)
- Verify audio device settings
- Check console logs for encoding/decoding errors

**Poor audio quality**
- ElevenLabs provides 16kHz audio - quality depends on voice model selected
- Check network latency
- Try different voice models in the ElevenLabs dashboard

### Function Calling Issues

**Functions not being called**
- Check that tools are properly registered with the agent in ElevenLabs dashboard
- Verify function handler is registered: `receiver.onFunctionCall(handler)`
- Check console logs for function call events

## Comparison with OpenAI Realtime API

| Feature | ElevenLabs | OpenAI Realtime API |
|---------|-----------|---------------------|
| Voice Quality | ⭐⭐⭐⭐⭐ (5000+ voices) | ⭐⭐⭐⭐ (6 voices) |
| Languages | 31 languages | English-focused |
| Latency | Sub-second | Sub-second |
| Function Calling | ✅ Yes | ✅ Yes |
| Turn-Taking | ✅ Automatic | ✅ Automatic |
| Price | $0.08/min (varies by tier) | Varies |
| Setup Complexity | Dashboard + API | API only |

## Advanced Configuration

### Voice Selection

Change the voice by editing your agent settings in the ElevenLabs dashboard. Available options include:
- Pre-made voices (browse library)
- Cloned voices (if you have access)
- Custom voices (Enterprise)

### LLM Selection

ElevenLabs supports multiple language models:
- **GPT-4** - Most capable, higher latency
- **GPT-3.5 Turbo** - Fast, good quality
- **Claude** - Anthropic's model
- **Gemini** - Google's model

Configure this in your agent settings.

### System Prompts

Customize the agent's behavior by editing the system prompt in your agent configuration. The current implementation includes:
- Task execution capabilities
- Discord integration context
- Function calling instructions

## Support

For issues specific to:
- **ElevenLabs API**: [ElevenLabs Support](https://elevenlabs.io/docs)
- **AgentFlow Integration**: Check the console logs and this documentation
- **Discord Bot Issues**: Verify permissions and configuration

## Migration from OpenAI

If you're migrating from a previous OpenAI Realtime API implementation:

1. ✅ No changes needed to function definitions
2. ✅ Audio quality is maintained or improved
3. ✅ All existing features work the same
4. ⚠️ Agent configuration now done in ElevenLabs dashboard instead of code
5. ⚠️ Requires `ELEVENLABS_AGENT_ID` environment variable

## Next Steps

- Experiment with different voices in the ElevenLabs dashboard
- Customize your agent's system prompt for your use case
- Monitor usage in the ElevenLabs dashboard to track minutes consumed
- Set up usage alerts to avoid unexpected charges

