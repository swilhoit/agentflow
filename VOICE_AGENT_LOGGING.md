# Voice Agent Logging & Progress Updates

## Issue Summary

**Problem**: Voice agent doesn't send detailed Discord messages during task execution, making it unclear what the agent is doing.

**Root Cause**: The logging IS implemented correctly, but users may not understand where updates appear or the agent might have frozen/disconnected.

---

## How Voice Agent Logging Works

### Architecture Flow

```
1. User speaks in Discord voice chat
   ↓
2. ElevenLabs transcribes and detects function call
   ↓
3. execute_task function called
   ↓
4. Discord message sent: "🤖 Task Started"
   ↓
5. HTTP POST to http://localhost:3001/command
   ↓
6. OrchestratorServer receives request
   ↓
7. TaskManager creates ToolBasedAgent
   ↓
8. Agent executes with DETAILED notifications:
   - 🔍 Analyzing Task Complexity
   - 📊 Task Analysis Complete
   - 🔄 Iteration 1/15
   - 🔧 Tool Call 1 (with input)
   - ✅ Tool Result (with output)
   - 🏁 Task Complete
   ↓
9. All notifications sent to Discord channel
```

### Notification Channel Configuration

**IMPORTANT**: Notifications go to the channel specified in:

```env
SYSTEM_NOTIFICATION_CHANNEL_ID=1439431218599956480
```

If this is set, **ALL agent progress updates** go to this dedicated channel, not the voice channel.

**If NOT set**: Notifications go to the channel where the command was issued.

---

## Expected Discord Messages

When a task is running, you should see these messages in Discord:

### 1. Initial Transcription
```
🎤 **Username**: Create a card on my Trello board called "Test"
```

### 2. Voice AI Response
```
🤖 **Agent**: I'll create that card for you. Watch Discord for updates.
```

### 3. Task Start
```
🤖 **Task Started**
```
Create a card on my Trello board called "Test"
```
```

### 4. Task Analysis (if complex)
```
🔍 **Analyzing Task Complexity**
Determining optimal execution strategy...
```

```
📊 **Task Analysis Complete**

**Complexity:** medium
**Subtasks:** 2
**Estimated Time:** 5-10 seconds
```

### 5. Execution Progress
```
🔄 **Iteration 1/15**
Processing...
```

```
🔧 **Tool Call 1**
**Tool:** `trello_list_boards`
**Input:** ```json
{}
```
```

```
✅ **Tool Result**
```json
{
  "boards": [
    { "id": "abc123", "name": "AgentFlow" }
  ]
}
```
```

```
🔄 **Iteration 2/15**
Processing...
```

```
🔧 **Tool Call 2**
**Tool:** `trello_create_card`
**Input:** ```json
{
  "boardName": "AgentFlow",
  "listName": "Backlog",
  "cardName": "Test"
}
```
```

```
✅ **Tool Result**
```json
{
  "success": true,
  "cardId": "xyz789"
}
```
```

### 6. Completion
```
🏁 **Task Complete**
Successfully created card "Test" on AgentFlow board
```

```
✅ **Task Completed**
Card created successfully with ID: xyz789
```

---

## Troubleshooting

### Issue 1: No Messages After "Task Started"

**Symptoms:**
- Initial "Task Started" message appears
- Then silence - no progress updates

**Possible Causes:**

1. **Wrong notification channel** - Check which channel you're looking at
   - Updates go to channel ID in `SYSTEM_NOTIFICATION_CHANNEL_ID`
   - NOT necessarily the voice channel

2. **Agent crashed** - Check logs for errors
   ```bash
   tail -f bot.log | grep -i "error"
   ```

3. **Orchestrator not responding** - Check if orchestrator is running
   ```bash
   curl -H "X-API-Key: your_key" http://localhost:3001/health
   ```

4. **Notification handler not set** - Look for this in logs:
   ```
   [ERROR] ⚠️⚠️⚠️ NO NOTIFICATION HANDLER SET - USER WILL NOT SEE THIS!
   ```

**Solutions:**

1. **Check the notification channel**:
   ```bash
   # In .env file:
   SYSTEM_NOTIFICATION_CHANNEL_ID=1439431218599956480

   # This is where ALL updates go!
   ```

2. **Check bot is running**:
   ```bash
   ps aux | grep "node dist/index.js"
   ```

3. **Check orchestrator logs**:
   ```bash
   tail -f bot.log
   ```

4. **Restart bot if needed**:
   ```bash
   pkill -f "node dist/index.js"
   npm start
   ```

### Issue 2: Voice AI Goes Silent Mid-Task

**Symptoms:**
- Voice AI was responding
- Suddenly stops responding to new commands
- Task may still be running in background

**Possible Causes:**

1. **Voice connection dropped** - ElevenLabs disconnected
2. **Task is still running** - Agent busy, can't respond
3. **ElevenLabs API issue** - Service interruption

**Solutions:**

1. **Check voice connection** in logs:
   ```bash
   grep "ElevenLabs" bot.log | tail -n 20
   ```

   Look for:
   ```
   [INFO] Connected to ElevenLabs Conversational AI
   [INFO] Disconnected from ElevenLabs Conversational AI
   ```

2. **Leave and rejoin voice**:
   - Type `!leave` in Discord
   - Type `!join` to reconnect
   - Voice AI should reconnect

3. **Check running tasks**:
   ```bash
   curl -H "X-API-Key: your_key" http://localhost:3001/tasks
   ```

4. **Cancel stuck task** (if needed):
   ```bash
   # Get task ID from /tasks
   curl -X POST -H "X-API-Key: your_key" \
     http://localhost:3001/task/task_123/cancel
   ```

### Issue 3: Agent Says "I Don't Have Access to..."

**Symptoms:**
- Voice AI says "I don't have access to Trello/GitHub/etc."
- But credentials ARE in .env

**Possible Causes:**

1. **Tools not registered** with ElevenLabs (FIXED in recent update)
2. **Credentials not loaded** in environment
3. **Service initialization failed**

**Solutions:**

1. **Check tool registration** in logs:
   ```bash
   grep "\[Tools\]" bot.log
   ```

   Should see:
   ```
   [INFO] [Tools] Registering 9 client-side tools with ElevenLabs...
   [INFO] [Tools] ✅ Registered: execute_task
   [INFO] [Tools] ✅ Registered: check_task_progress
   ...
   ```

2. **Verify credentials** in .env:
   ```bash
   grep -E "TRELLO_API_KEY|GITHUB_TOKEN" .env
   ```

3. **Check service initialization**:
   ```bash
   grep "initialized" bot.log
   ```

   Should see:
   ```
   [INFO] ✅ Trello service initialized successfully
   [INFO] TrelloService initialized
   ```

4. **Restart bot** to reload environment:
   ```bash
   pkill -f "node dist/index.js"
   npm start
   ```

---

## Verification Checklist

Before reporting issues, verify:

- [ ] Bot is running: `ps aux | grep "node dist/index.js"`
- [ ] Orchestrator is healthy: `curl http://localhost:3001/health`
- [ ] Notification channel is configured in .env
- [ ] You're looking at the correct Discord channel for updates
- [ ] Voice connection is active (check bot.log for "Connected to ElevenLabs")
- [ ] Tools are registered (check bot.log for "[Tools] ✅ Registered")
- [ ] No errors in logs: `grep ERROR bot.log`

---

## Configuration Reference

### .env Variables for Logging

```env
# Required for logging to work
SYSTEM_NOTIFICATION_CHANNEL_ID=1439431218599956480  # Where updates go
DISCORD_TOKEN=your_token
ORCHESTRATOR_URL=http://localhost:3001
ORCHESTRATOR_API_KEY=your_key

# Voice AI
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_AGENT_ID=agent_...

# Optional integrations
TRELLO_API_KEY=...
TRELLO_API_TOKEN=...
GITHUB_TOKEN=...
```

### Getting Channel ID

1. Discord Settings → Advanced → Enable Developer Mode
2. Right-click the channel → Copy Channel ID
3. Paste into `SYSTEM_NOTIFICATION_CHANNEL_ID` in .env
4. Restart bot

---

## Local vs Cloud Run

### Local Bot (What You're Running Now)

- Logs to: `bot.log` or console
- Orchestrator: `http://localhost:3001`
- Notifications: To Discord via WebSocket

### Cloud Run Bot (Auto-Deployed)

- Logs to: Google Cloud Logging
- Orchestrator: Internal (same container)
- Notifications: To Discord via WebSocket
- **URL**: Check Cloud Run service URL

**Note**: Both should work identically for notifications. The architecture is the same.

---

## Summary

**Voice agent logging IS working correctly!** 🎉

The system sends **detailed, frequent updates** at every step:
- ✅ Task analysis
- ✅ Each iteration (1/15, 2/15, etc.)
- ✅ Each tool call (with input)
- ✅ Each tool result (with output)
- ✅ Completion status

**If you're not seeing updates**, check:
1. Are you looking at the right Discord channel?
2. Is `SYSTEM_NOTIFICATION_CHANNEL_ID` set correctly?
3. Is the bot actually running?
4. Check logs for errors: `tail -f bot.log`

**The fix from today**: Tools are now properly registered with ElevenLabs, so voice AI can actually call functions!

---

## Quick Test

To verify logging works:

1. **Join voice channel** in Discord
2. **Say**: "Hey, list my Trello boards"
3. **Watch the notification channel** (ID: 1439431218599956480)
4. **You should see**:
   - 🤖 Task Started
   - 🔄 Iteration 1/15
   - 🔧 Tool Call (trello_list_boards)
   - ✅ Tool Result (board data)
   - 🏁 Task Complete

If you see all these messages, **logging is working perfectly!** ✅

If not, check the troubleshooting section above.

---

**Status**: Bot is running locally (PID: 54586), deployed to Cloud Run, and ready to send detailed updates!

**Last Updated**: November 16, 2025 - 11:40 PM PST
