# Discord Notification Fix - Terminal Output Visibility

## Issue

The voice bot and autonomous coding agents were assuming the user could see terminal output directly, but the user needs the bot to understand that it should send Discord messages with frequent updates on terminal usage instead.

**Problem Behavior:**
- Agents would execute terminal commands without explaining what they were doing
- Agents would reference terminal output as if the user could see it
- No frequent updates to Discord about command execution progress
- User had no visibility into what was happening during long-running tasks

## Root Cause

The system prompts for all three AI components (Realtime Voice Receiver, Claude Code Agent, and Claude Orchestrator) did not explicitly instruct the AI that:
1. The user CANNOT see terminal output
2. Discord messages are the ONLY way the user can track progress
3. Frequent updates to Discord are REQUIRED, not optional
4. After spawning sub-agents or running commands, the user needs to be told to check Discord

## Files Modified

### 1. `src/bot/realtimeVoiceReceiver.ts`
**Location:** Lines 60-150 (getSystemInstructions method)

**Changes Made:**
- Added new section: "📢 CRITICAL: DISCORD NOTIFICATION REQUIREMENTS"
- Explicitly stated: "⚠️ THE USER CANNOT SEE YOUR TERMINAL OUTPUT! ⚠️"
- Instructed bot that sub-agents will automatically send Discord messages
- Required bot to acknowledge that updates will appear in Discord
- Updated all example responses to mention "Watch Discord" or "Check Discord for updates"

**Key Addition:**
```
📢 CRITICAL: DISCORD NOTIFICATION REQUIREMENTS
⚠️ THE USER CANNOT SEE YOUR TERMINAL OUTPUT! ⚠️
When you spawn sub-agents or execute terminal commands:
- Sub-agents will automatically send Discord messages with frequent updates about what they're doing
- The user will receive Discord notifications showing terminal commands being run and their outputs
- You do NOT need to see terminal output yourself - the user gets it via Discord
- After calling execute_task, acknowledge that the task is running and the user will get updates in Discord
- DO NOT assume the user can see what's happening in the terminal
- ALWAYS mention that progress updates will appear in their Discord channel
```

### 2. `src/agents/claudeCodeAgent.ts`
**Location:** Lines 242-285 (buildIterativePrompt method)

**Changes Made:**
- Added new section: "📢 CRITICAL NOTIFICATION REQUIREMENT"
- Explicitly stated user cannot see terminal output
- Instructed agent to send Discord messages after EVERY significant action
- Specified using SubAgentManager's sendNotification method
- Required concise but informative updates (2-3 sentences max)
- Changed instruction #5 from "Report your progress" to "Report your progress TO DISCORD frequently"

**Key Addition:**
```
📢 CRITICAL NOTIFICATION REQUIREMENT:
⚠️ THE USER CANNOT SEE YOUR TERMINAL OUTPUT! ⚠️
- You MUST send Discord messages with frequent updates about what you're doing
- After EVERY significant action (running commands, reading files, making changes), send a status update to Discord
- Use the SubAgentManager's sendNotification method to post updates
- Include what command you're running and brief results
- The user is NOT watching your terminal - Discord messages are their ONLY visibility
```

**Updated Action Requirements:**
```
IMPORTANT: After each action:
1. Send a Discord message describing what you did and the result
2. Include relevant terminal output in your Discord updates
3. Tell the user whether the task is complete or what's next
4. Make updates concise but informative (2-3 sentences max per update)
```

### 3. `src/orchestrator/claudeClient.ts`
**Location:** Lines 92-122 (buildSystemPrompt method)

**Changes Made:**
- Added new section: "📢 CRITICAL: DISCORD NOTIFICATION REQUIREMENTS" at the top
- Explicitly stated user cannot see terminal output
- Explained that sub-agents automatically send Discord messages
- Instructed orchestrator to acknowledge that user will get updates in Discord
- Clarified that terminal output goes to Discord, not directly visible to orchestrator

**Key Addition:**
```
📢 CRITICAL: DISCORD NOTIFICATION REQUIREMENTS
⚠️ THE USER CANNOT SEE YOUR TERMINAL OUTPUT! ⚠️
- All sub-agents automatically send Discord messages with frequent updates about what they're doing
- The user receives Discord notifications showing terminal commands being run and their outputs
- You do NOT need to see terminal output yourself - the user gets it via Discord
- After spawning sub-agents, acknowledge that the task is running and the user will get updates in Discord
- DO NOT assume the user can see what's happening in the terminal
- Sub-agents are configured to send progress updates to the Discord channel automatically
```

## Impact

### User Experience Improvements:
1. ✅ Voice bot will now tell user to "Watch Discord for results" when executing commands
2. ✅ Autonomous agents will send frequent Discord updates during task execution
3. ✅ User has visibility into what commands are being run and their outputs
4. ✅ Long-running tasks now provide progress updates instead of silence
5. ✅ All AI components understand that Discord is the communication channel

### Example Before/After:

**BEFORE:**
```
User: "List my GitHub repos"
Bot: "I'll run gh repo list for you."
[Executes command silently, user sees nothing]
```

**AFTER:**
```
User: "List my GitHub repos"
Bot: "I'll run gh repo list for you. Watch Discord for the results."
[Agent sends Discord message: "🔄 Running command: gh repo list"]
[Agent sends Discord message: "✅ Found 15 repositories"]
[Agent sends Discord message with the list of repos]
```

## Technical Notes

### Existing Infrastructure Utilized:
The fix leverages existing Discord notification infrastructure:
- `SubAgentManager.sendNotification()` method (already exists)
- `ChannelNotifier` service (already exists)
- Discord message handlers (already wired up)
- `SYSTEM_NOTIFICATION_CHANNEL_ID` environment variable (already configured)

### No New Code Required:
This fix ONLY updates AI system prompts. The notification infrastructure was already in place, but the AI agents weren't being instructed to use it properly. By making the system prompts more explicit and directive, we activate the existing notification system.

### Why This Fix Works:
AI models follow system prompts carefully. By:
1. Using attention-grabbing formatting (⚠️, 📢, CRITICAL, ALL CAPS)
2. Being explicit rather than implicit ("CANNOT SEE" vs "may not see")
3. Providing concrete action items ("Send a Discord message" vs "report progress")
4. Including examples that demonstrate the behavior
5. Repeating the requirement in multiple places

The AI agents will now consistently send Discord notifications.

## Testing Recommendations

After deploying this fix, test with:

1. **Simple Command Test:**
   - Voice: "List my GitHub repos"
   - Verify bot says "Watch Discord" or similar
   - Verify Discord messages show the command and results

2. **Long Task Test:**
   - Voice: "Deploy the application to Cloud Run"
   - Verify frequent Discord updates during the process
   - Check that each step is reported (building, uploading, deploying, etc.)

3. **Error Handling Test:**
   - Voice: "Run a command that will fail"
   - Verify error messages appear in Discord
   - Check that agent explains what went wrong

4. **Multi-Step Task Test:**
   - Voice: "Create a new feature with tests"
   - Verify agent reports: what file it's reading, what changes it's making, what tests it's running
   - Confirm 2-3 sentence updates for each significant action

## Deployment

1. **Rebuild the application:**
   ```bash
   npm run build
   ```

2. **Restart the bot:**
   ```bash
   npm start
   ```

3. **Verify system notification channel is configured:**
   Check that `.env` has:
   ```
   SYSTEM_NOTIFICATION_CHANNEL_ID=your_channel_id
   ```

## Rollback Plan

If this fix causes issues, revert these three files:
- `src/bot/realtimeVoiceReceiver.ts`
- `src/agents/claudeCodeAgent.ts`
- `src/orchestrator/claudeClient.ts`

Use git to restore previous versions:
```bash
git checkout HEAD~1 -- src/bot/realtimeVoiceReceiver.ts
git checkout HEAD~1 -- src/agents/claudeCodeAgent.ts
git checkout HEAD~1 -- src/orchestrator/claudeClient.ts
npm run build
npm start
```

## Future Enhancements

Consider adding:
1. Configurable notification frequency (every step vs. major milestones only)
2. Different notification verbosity levels (brief vs. detailed)
3. User preference for notification style per user
4. Discord notification rate limiting to avoid spam
5. Summary notifications for completed tasks with execution statistics

---

**Fix Applied:** 2025-11-17  
**Issue Resolution:** Voice bot now understands user cannot see terminal and sends Discord updates  
**Backwards Compatible:** Yes (only adds behavior, doesn't break existing functionality)

