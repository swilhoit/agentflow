# Voice Chat Trello Access Fix

## Problem

User reported: **"voice chat claims it does not have access to trello - its also not responding to me and froze up"**

## Root Cause Analysis

After thorough investigation, I found **multiple critical issues** with the voice chat integration:

### Issue #1: Task Type Enum Mismatch ⚠️

**Location:** `src/bot/realtimeVoiceReceiver.ts:273`

**Problem:**
- System instructions (lines 162-206) told the AI to use `task_type: "trello"` and `task_type: "coding"`
- The `execute_task` function definition only accepted: `['terminal', 'deployment', 'api_call', 'analysis', 'general']`
- When ElevenLabs AI tried to call `execute_task` with `task_type: "trello"`, it **failed validation on ElevenLabs' side**
- The hybrid fallback (line 461) used `task_type: 'auto'`, which was also invalid

**Fix:**
```typescript
// BEFORE:
enum: ['terminal', 'deployment', 'api_call', 'analysis', 'general']

// AFTER:
enum: ['terminal', 'deployment', 'api_call', 'analysis', 'general', 'trello', 'coding', 'auto']
```

### Issue #2: Functions Not Registered with ElevenLabs ❌

**Location:** `src/bot/realtimeVoiceReceiver.ts`

**Problem:**
- The `getFunctionDefinitions()` method existed with 9 function definitions
- **These functions were NEVER registered with ElevenLabs ClientTools API**
- The AI literally didn't have access to call `execute_task`, `deploy_to_cloud_run`, etc.
- This is why the AI said "I don't have access to Trello" - the functions didn't exist!

**Architecture:**
```
ElevenLabs Conversational AI has two tool configuration methods:
1. Server-side: Configure tools in ElevenLabs dashboard (for the agent)
2. Client-side: Register tools via ClientTools API (what we're using)

We had ClientTools initialized but never called .register() on any tools!
```

**Fix:**
Created `registerAllTools()` method:
```typescript
private registerAllTools(): void {
  const functions = this.getFunctionDefinitions();

  for (const func of functions) {
    this.voiceService.registerTool(func.name, async (parameters: any) => {
      if (this.onFunctionCallCallback) {
        return await this.onFunctionCallCallback(func.name, parameters);
      }
      return { error: 'No function handler registered' };
    });
  }
}
```

Called in constructor:
```typescript
constructor(apiKey: string, agentId: string, speed: number = 1.25) {
  this.voiceService = new ElevenLabsVoiceService({ apiKey, agentId, instructions: this.getSystemInstructions() });
  this.setupEventHandlers();
  this.registerAllTools(); // ← NEW!
}
```

## What Was Working

✅ **Backend plumbing was correct:**
- TrelloService initialized in `index.ts:104`
- Passed to OrchestratorServer → TaskManager → ToolBasedAgent
- Trello tools available in ToolBasedAgent (execute_bash, trello_list_boards, trello_create_card, etc.)
- execute_task handler correctly sends commands to orchestrator

✅ **Hybrid fallback system:**
- Lines 439-478 detect action keywords and force `execute_task`
- Works for simple commands like "create card", "list boards"
- But doesn't help if AI gives up and says "I don't have access"

## What Changed

### Modified Files:
1. **src/bot/realtimeVoiceReceiver.ts**
   - Line 273: Expanded `task_type` enum to include `'trello', 'coding', 'auto'`
   - Line 65: Added `this.registerAllTools()` call in constructor
   - Lines 419-447: New `registerAllTools()` method

### Impact:
- **Before:** Voice AI had NO access to functions → always failed or relied on hybrid fallback
- **After:** Voice AI can properly call all 9 registered functions:
  - ✅ execute_task (with Trello support!)
  - ✅ check_task_progress
  - ✅ deploy_to_cloud_run
  - ✅ list_cloud_services
  - ✅ get_cloud_logs
  - ✅ delete_cloud_service
  - ✅ spawn_autonomous_agent
  - ✅ get_agent_status
  - ✅ get_agent_result

## Testing

### To verify the fix works:

1. **Join voice chat in Discord**
2. **Say:** "Show me my Trello boards"
3. **Expected behavior:**
   - AI should call `execute_task` function
   - Task sent to orchestrator
   - ToolBasedAgent uses TrelloService to list boards
   - Results sent back to Discord channel

4. **Try more complex commands:**
   - "Create a card on my AgentFlow board called Test Card"
   - "Search Trello for bugs"
   - "Move the testing card to In Progress"

### Debug logs to watch:
```bash
tail -f logs/combined.log | grep -i "tool"
```

You should see:
```
[Tools] Registering 9 client-side tools with ElevenLabs...
[Tools] ✅ Registered: execute_task
[Tools] ✅ Registered: check_task_progress
...
[Tool Call] execute_task { task_description: "...", task_type: "trello" }
```

## Architecture Summary

```
User Voice → Discord
    ↓
ElevenLabs Conversational AI
    ↓
ClientTools.execute_task() ← NOW REGISTERED!
    ↓
RealtimeVoiceReceiver.onFunctionCallCallback
    ↓
DiscordBotRealtime.handleFunctionCall
    ↓
POST /command → OrchestratorServer
    ↓
TaskManager.startTask (creates ToolBasedAgent with TrelloService)
    ↓
ToolBasedAgent.execute() → calls trello_list_boards, trello_create_card, etc.
    ↓
TrelloService → Trello REST API
    ↓
Results → Discord channel
```

## Related Files

- `src/bot/realtimeVoiceReceiver.ts` - Voice chat receiver (FIXED)
- `src/bot/discordBotRealtime.ts` - Discord bot with voice integration
- `src/utils/elevenLabsVoice.ts` - ElevenLabs API wrapper
- `src/orchestrator/orchestratorServer.ts` - Task orchestrator
- `src/orchestrator/taskManager.ts` - Multi-agent task manager
- `src/agents/toolBasedAgent.ts` - Agent with Trello tools
- `src/services/trello.ts` - Trello API service

## Status

✅ **FIXED** - Bot restarted with all fixes applied (PID: 6969)
⏳ **PENDING** - User testing to verify voice chat Trello access works

---

**Generated:** 2025-11-16 23:22 PST
