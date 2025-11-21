# Agent Notifications Setup

## Overview

The AgentFlow system now supports real-time Discord notifications for agent actions, plans, and status updates. All agent activities will be posted to a designated Discord channel.

## What Gets Logged

### Claude Code Agent Events
- 🚀 **Agent Started** - When a new autonomous agent begins work
- 📋 **Step Started** - Each step in the agent's execution plan
- ⚠️ **Warnings** - Any warnings detected during execution
- 🏁 **Task Completed** - Final status with duration and step count
- ❌ **Task Failed** - Error details if the task fails

### Sub-Agent Events
- 🤖 **Sub-Agent Spawned** - When a new sub-agent is created
- ⚙️ **Executing Command** - When a bash command is being run
- ✅ **Command Completed** - Successful command execution
- ❌ **Command Failed** - Command execution errors
- 🔍 **Analysis Task Started** - When analysis tasks begin
- ✅ **Analysis Complete** - Analysis task completion

## Configuration

### Step 1: Get Your Discord Channel ID

1. Enable Developer Mode in Discord:
   - User Settings → Advanced → Developer Mode (toggle ON)

2. Right-click on the channel where you want notifications
3. Click "Copy Channel ID"

### Step 2: Set Environment Variables

Add these to your `.env` file:

```env
# Discord Notification Settings
SYSTEM_NOTIFICATION_GUILD_ID=your_guild_id_here
SYSTEM_NOTIFICATION_CHANNEL_ID=your_channel_id_here
```

**Example:**
```env
SYSTEM_NOTIFICATION_GUILD_ID=123456789012345678
SYSTEM_NOTIFICATION_CHANNEL_ID=987654321098765432
```

### Step 3: Restart the Bot

```bash
npm run build
npm start
```

## Verification

When the bot starts successfully, you should see this log message:

```
Agent notifications will be sent to channel: 987654321098765432
```

If the channel ID is not configured, you'll see:

```
No systemNotificationChannelId configured - agent notifications disabled
```

## Example Notification Messages

### Agent Started
```
🚀 **Agent Started**
```
Task: Deploy new feature to production
Agent ID: agent_1234567890_abc123
```
```

### Step Progress
```
📋 **Step 2**: Analyzing codebase structure
`Agent: agent_1234567890_abc123`
```

### Task Completed
```
🏁 **Task Completed**
```
Status: ✅ SUCCESS
Agent: agent_1234567890_abc123
Duration: 45.32s
Steps: 5
```
```

### Command Execution
```
⚙️ **Executing Command**
```bash
npm install && npm run build
```
```

## Bot Permissions

Make sure your Discord bot has these permissions in the notification channel:
- View Channel
- Send Messages
- Embed Links (optional, for better formatting)

## Troubleshooting

### No Messages Appearing

1. **Check the channel ID is correct**
   ```bash
   # The bot will log this on startup
   grep "Agent notifications" logs/app.log
   ```

2. **Verify bot permissions**
   - Bot must have "Send Messages" permission in the channel
   - Check Discord's Audit Log for permission errors

3. **Test the bot's connection**
   - Use `!status` command in Discord
   - Check bot shows as online

4. **Check environment variables are loaded**
   ```bash
   # In your terminal
   echo $SYSTEM_NOTIFICATION_CHANNEL_ID
   ```

### Messages are Delayed

- This is normal - agents may take time to execute tasks
- Check server logs for any errors: `npm run logs`

### Too Many Messages

If you're getting spammed with messages, you can:
1. Use a dedicated private channel for notifications
2. Adjust the notification frequency in `src/agents/subAgentManager.ts`

## Architecture Changes

The following components were modified:

1. **DiscordBot** (`src/bot/discordBot.ts`)
   - Added `sendTextMessage()` method for text channel messages
   - Added `getClient()` method for accessing Discord client

2. **SubAgentManager** (`src/agents/subAgentManager.ts`)
   - Added Discord message handler support
   - Wired up all agent events to send notifications
   - Added `sendNotification()` private method

3. **OrchestratorServer** (`src/orchestrator/orchestratorServer.ts`)
   - Added `setDiscordMessageHandler()` method
   - Passes message handler to SubAgentManager

4. **Main Entry** (`src/index.ts`)
   - Wires bot's `sendTextMessage` to orchestrator
   - Logs notification channel configuration on startup

## Advanced Usage

### Custom Notification Formatting

To customize the notification messages, edit the event handlers in:
`src/agents/subAgentManager.ts` (lines 276-311)

### Multiple Notification Channels

Currently, all notifications go to one channel. To add multiple channels:
1. Add more channel IDs to your config
2. Modify `sendNotification()` to support channel routing
3. Pass channel preference in agent spawn options

### Disabling Notifications

To temporarily disable notifications without removing the config:
1. Comment out the environment variables in `.env`
2. Or set `SYSTEM_NOTIFICATION_CHANNEL_ID=` (empty)

The bot will log: "agent notifications disabled" and continue working normally.

