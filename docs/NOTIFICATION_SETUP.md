# Quick Notification Setup Guide

## Step-by-Step Setup

### 1. Get Your Channel ID

1. Open Discord
2. Go to **User Settings** → **Advanced**
3. Enable **Developer Mode** (toggle ON)
4. Right-click on the channel where you want notifications
5. Click **"Copy Channel ID"**

### 2. Configure Environment Variable

Add this to your `.env` file (create it if it doesn't exist):

```env
SYSTEM_NOTIFICATION_CHANNEL_ID=YOUR_CHANNEL_ID_HERE
```

Replace `YOUR_CHANNEL_ID_HERE` with the ID you copied.

**Example:**
```env
SYSTEM_NOTIFICATION_CHANNEL_ID=1234567890123456789
```

### 3. Rebuild and Restart

```bash
npm run build
npm start
```

### 4. Verify Setup

When the bot starts, look for this log message:

```
SubAgentManager notifications enabled for channel: 1234567890123456789
```

Or if not configured:
```
No systemNotificationChannelId configured - SubAgentManager notifications disabled
```

### 5. Test Notifications

In any Discord channel where the bot can see messages, type:

```
!notify-test
```

You should see:
1. A reply in that channel: "✅ Test notification sent to channel #your-channel"
2. A test message in your notification channel

## Troubleshooting

### "No notification channel configured"

**Problem:** The environment variable isn't set.

**Solution:** 
1. Check your `.env` file exists in the project root
2. Make sure the variable name is exactly: `SYSTEM_NOTIFICATION_CHANNEL_ID`
3. Restart the bot after editing

### "Channel is not a text channel or bot doesn't have access"

**Problem:** Bot permissions issue.

**Solution:**
1. Make sure the bot is in your Discord server
2. Check the bot has these permissions in the notification channel:
   - View Channel
   - Send Messages
   - Embed Links (optional)

### Test Command Shows Error

Run the test command to diagnose:
```
!notify-test
```

This will tell you exactly what's wrong.

### Still No Messages After Agent Runs

1. **Verify the channel ID is correct:**
   ```bash
   # Check your .env file
   cat .env | grep NOTIFICATION
   ```

2. **Check the bot logs:**
   Look for these messages when agents run:
   - `Spawned sub-agent...`
   - `Sent agent notification to channel...`
   - `Failed to send agent notification...` (if there's an error)

3. **Make sure agents are actually running:**
   - Agents only send notifications when they're spawned
   - Test by asking the bot to do something that spawns an agent

## Example: Full .env Configuration

```env
# Discord Bot
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_client_id

# API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GROQ_API_KEY=your_groq_key_optional

# Orchestrator
ORCHESTRATOR_URL=http://localhost:3001
ORCHESTRATOR_API_KEY=your_secure_random_key

# Bot Configuration
ALLOWED_USER_IDS=user_id1,user_id2
MAX_CONCURRENT_AGENTS=5
USE_REALTIME_API=true

# Notifications (ADD THIS)
SYSTEM_NOTIFICATION_CHANNEL_ID=1234567890123456789

# Optional
LOG_LEVEL=INFO
```

## What Gets Notified

Once configured, you'll see messages like:

- 🚀 **Agent Started** - When autonomous agents begin work
- 📋 **Step Updates** - Progress through execution steps
- ⚙️ **Command Execution** - Bash commands being run
- 🔍 **Analysis Tasks** - AI analysis in progress
- ✅ **Success** - Tasks completed
- ❌ **Failures** - Errors with details
- ⚠️ **Warnings** - Issues detected

## Commands

- `!notify-test` - Test if notifications are working
- `!status` - Check bot status
- `!join` - Join voice channel
- `!leave` - Leave voice channel

## Need Help?

1. Check the logs: Look in your terminal where the bot is running
2. Verify environment variables: `echo $SYSTEM_NOTIFICATION_CHANNEL_ID`
3. Test the basic functionality: `!notify-test`
4. Check bot permissions in Discord

