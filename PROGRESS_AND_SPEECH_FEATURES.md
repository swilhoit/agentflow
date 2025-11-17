# Progress Updates & Speech Speed Control

## Overview

Two new features have been added to AgentFlow to improve user experience:

1. **Progress Updates** - The bot now provides status updates and you can ask about what it's working on
2. **Speech Speed Control** - Adjust how fast the bot speaks (0.25x to 4.0x speed)

---

## 🚀 Progress Updates

### Automatic Status Messages

The bot now automatically:
- Logs when it starts working on a task (🚀 emoji)
- Logs when a task completes successfully (✅ emoji)
- Logs when a task fails (❌ emoji)
- Informs you when it begins complex operations

### Checking Progress

You can now **ask the bot** about its current work:

**Voice Commands:**
- "What are you working on?"
- "What's the progress?"
- "Are you still working on that?"
- "What tasks are running?"

The bot will tell you:
- How many tasks are currently running
- The status of each task
- Task IDs for reference

**Example Response:**
> "I'm currently working on 2 tasks:
> - Task abc123: running
> - Task def456: completed"

Or if idle:
> "I'm not currently working on any tasks. Everything is idle!"

### How It Works

The bot uses a new `check_task_progress` function that:
1. Queries the orchestrator's `/agents` endpoint
2. Retrieves active task information
3. Provides a natural language summary

---

## 🗣️ Speech Speed Control

### Configuration

Control speech speed using the `TTS_SPEED` environment variable:

```env
TTS_SPEED=1.5  # 50% faster than normal
```

**Valid Range:** `0.25` (very slow) to `4.0` (very fast)
**Default:** `1.0` (normal speed)

### Speed Guidelines

| Speed | Description | Best For |
|-------|-------------|----------|
| 0.25 - 0.75 | Slow | Learning, transcription |
| 0.75 - 1.0 | Slightly slow | Careful listening |
| 1.0 | Normal | Default, natural pace |
| 1.25 - 1.5 | Fast | Quick updates, efficiency |
| 1.5 - 2.0 | Very fast | Experienced users |
| 2.0 - 4.0 | Extremely fast | Maximum efficiency |

### Recommended Settings

**For productivity:** `TTS_SPEED=1.5`
- 50% faster than normal
- Still clear and understandable
- Saves significant time

**For accessibility:** `TTS_SPEED=0.75`
- Slower, clearer speech
- Better for non-native speakers
- Easier to follow complex instructions

### Setting Up

1. **Open your `.env` file:**
   ```bash
   nano .env
   ```

2. **Add or update the TTS_SPEED line:**
   ```env
   TTS_SPEED=1.5
   ```

3. **Restart the bot:**
   ```bash
   npm restart
   ```

### Dynamic Speed Adjustment

The TTS service also supports runtime speed changes:
```typescript
ttsService.setSpeed(1.5);  // Set to 1.5x speed
const currentSpeed = ttsService.getSpeed();  // Check current speed
```

---

## 📝 Updated Configuration

### Environment Variables

Your `.env` file now supports:

```env
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# AI Service API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Orchestrator Configuration
ORCHESTRATOR_URL=http://localhost:3001
ORCHESTRATOR_API_KEY=your_secure_api_key_here

# Optional: User Access Control
ALLOWED_USER_IDS=discord_user_id1,discord_user_id2

# Optional: Agent Configuration
MAX_CONCURRENT_AGENTS=5

# Optional: Voice Settings
USE_REALTIME_API=true
TTS_SPEED=1.5              # <-- NEW: Speech speed control

# Optional: Logging
LOG_LEVEL=INFO
```

### Example Configuration for Fast Operation

```env
# Efficient setup for power users
TTS_SPEED=1.75
MAX_CONCURRENT_AGENTS=10
USE_REALTIME_API=true
LOG_LEVEL=INFO
```

---

## 🎯 Usage Examples

### Example 1: Starting a Task

**You:** "Deploy the application to Cloud Run"

**Bot:** "I'm working on that now. Let me deploy the application for you."
- Bot starts the deployment
- Logs show: `🚀 Starting task: Deploy the application to Cloud Run`
- When complete: `✅ Task completed: Deploy the application to Cloud Run`

### Example 2: Checking Progress During Long Task

**You:** "Hey, what's the status?"

**Bot:** "I'm currently working on 1 task: deploying to Cloud Run. It's still in progress."

### Example 3: Multiple Tasks

**You:** "What are you working on?"

**Bot:** "I'm currently working on 3 tasks:
- Analyzing the codebase
- Running tests
- Building Docker image"

---

## 🔧 Technical Details

### Files Modified

1. **`src/utils/tts.ts`**
   - Added `speed` parameter to constructor
   - Added `setSpeed()` and `getSpeed()` methods
   - Updated `generateSpeech()` to use speed setting

2. **`src/types/index.ts`**
   - Added `ttsSpeed?: number` to `BotConfig` interface

3. **`src/utils/config.ts`**
   - Added TTS_SPEED environment variable parsing
   - Added validation (0.25 - 4.0 range)

4. **`src/bot/discordBot.ts`**
   - Updated TTS service initialization with speed parameter

5. **`src/bot/realtimeVoiceReceiver.ts`**
   - Added `check_task_progress` function definition
   - Updated system instructions to mention progress features

6. **`src/bot/discordBotRealtime.ts`**
   - Implemented `check_task_progress` handler
   - Added status logging for task execution

### API Integration

The progress checking feature uses the orchestrator's existing `/agents` endpoint:

```typescript
GET /agents
Headers: { 'X-API-Key': 'your-api-key' }

Response: {
  agents: [
    { taskId: 'abc123', status: 'running', ... },
    { taskId: 'def456', status: 'completed', ... }
  ]
}
```

---

## 🎨 System Instructions Update

The AI assistant now knows to:
1. Proactively inform users when starting complex tasks
2. Use the `check_task_progress` function when users ask about progress
3. Provide clear, concise status updates

**Example prompting:**
> "When you start working on a complex task, let the user know you're working on it. For example: 'I'm working on that now. Let me deploy the application for you.'"

---

## 🐛 Troubleshooting

### Speech is too fast/slow

1. Check your `TTS_SPEED` value in `.env`
2. Valid range is 0.25 to 4.0
3. Restart the bot after changing the value

### Progress check not working

1. Ensure orchestrator is running on the configured URL
2. Verify `ORCHESTRATOR_API_KEY` is correct
3. Check that the `/agents` endpoint is accessible

### Bot doesn't announce when starting tasks

1. This feature works with the Realtime API mode (`USE_REALTIME_API=true`)
2. Check logs for status messages (they're logged even if not spoken)
3. Verify the bot is using `execute_task` function for complex operations

---

## 🚀 Quick Start

To enable these features right now:

1. **Add to your `.env` file:**
   ```env
   TTS_SPEED=1.5
   ```

2. **Restart the bot:**
   ```bash
   npm restart
   ```

3. **Test it out:**
   - Ask: "What are you working on?"
   - Give a command: "Deploy this app"
   - Listen for the faster speech!

---

## 📚 References

- **OpenAI TTS API:** https://platform.openai.com/docs/guides/text-to-speech
- **Speech Speed Parameter:** Official range is 0.25 to 4.0
- **Realtime API:** Used for voice conversation features

---

**Need Help?** Check the main README.md or create an issue on GitHub.

