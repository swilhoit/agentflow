# ElevenLabs SDK Research Findings - Voice Response Issue

## 🔍 Research Question
How to make the ElevenLabs Conversational AI agent SPEAK function responses instead of only sending text to Discord?

## 📚 SDK Structure Analysis

### ClientTools API
From `node_modules/@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/ClientTools.d.ts`:

```typescript
register(
  toolName: string, 
  handler: (parameters: Record<string, any>) => any | Promise<any>, 
  isAsync?: boolean
): void
```

### Function Return Format
From `events.d.ts`:

```typescript
export interface ClientToolResultEvent {
    type: CLIENT_TOOL_RESULT;
    tool_call_id?: string;
    result: any;      // ← Just returns the data
    is_error: boolean;
}
```

## 💡 Key Finding

**The function just returns data (`any`), and the LLM agent decides what to say about it.**

There is NO special format for `voiceMessage` or explicit speech control. The agent should automatically speak about the function result based on its system prompt and the data returned.

## ❌ What Was Wrong

Our system prompt was missing explicit instructions to SPEAK responses. The agent was:
1. Receiving function results ✅
2. Processing the data ✅
3. Sending text to Discord ✅
4. BUT NOT speaking about it ❌

## ✅ Solution Implemented

### Updated System Prompt (via API)
Added explicit voice response instructions:

```
🗣️ CRITICAL: YOU MUST SPEAK ALL YOUR RESPONSES OUT LOUD!

You are a VOICE assistant - always speak your responses, don't just return text!

After calling a function, SPEAK what you're doing:
- "I'm checking your Trello boards now"
- "Let me fetch that information for you"
- "I'm working on that task, you'll see updates in Discord"
```

### Why This Should Work

1. **Explicit Voice Instruction** - Tells agent it's a VOICE assistant
2. **Speaking Examples** - Shows what to say after function calls
3. **Behavioral Guidance** - Makes it clear speaking is required

## 🧪 How It Works

```
User: "List my Trello boards"
       ↓
Agent hears and transcribes
       ↓
Agent decides to call execute_task() ✅
       ↓
Agent SPEAKS: "I'm checking your Trello boards now" ← NEW!
       ↓
Function executes asynchronously
       ↓
Results sent to Discord as text ✅
       ↓
Agent REMAINS AVAILABLE for more questions ← Still to fix
```

## 🔧 Changes Made

1. **Updated Agent Prompt via API** ✅
   - Added explicit voice response instructions
   - File: `scripts/update-agent-prompt.ts`
   - Applied to agent_8301ka82ffjyfyera8c7f4gvayt5

2. **Local Files Updated** (Need to apply):
   - `src/bot/realtimeVoiceReceiver.ts` - Match the new prompt

## 🎯 Expected Behavior After Fix

### Before:
```
User: "List Trello boards"
Agent: [calls execute_task]
Agent: [SILENT] ❌
Discord: [shows task started message]
User: [confused, thinks agent died]
```

### After:
```
User: "List Trello boards"
Agent: [calls execute_task]
Agent: "I'm checking your Trello boards now, you'll see the results in Discord" ✅
Discord: [shows task started message]
User: [knows agent is working]
```

## 📊 SDK Limitations Found

### What We Control:
- ✅ System prompt (via API or dashboard)
- ✅ Function returns (any data format)
- ✅ Error handling
- ✅ Tool registration

### What ElevenLabs Controls:
- ❌ Turn-taking behavior (server-side VAD)
- ❌ When agent chooses to speak
- ❌ Interruption handling
- ❌ Conversation flow timing

### What We Can't Control:
- Voice response timing (handled by LLM)
- Exact words spoken (up to LLM based on prompt)
- Whether agent stays available during async tasks (platform behavior)

## 🚧 Remaining Issues

### Issue #1: Agent Availability During Tasks
**Status:** Still investigating

The agent becomes unavailable while `execute_task` runs, even though we return immediately and run the task async. This may be:
- ElevenLabs platform waiting for task completion
- Conversation thread blocking
- Need different async pattern

**Possible Solutions:**
1. Use status polling instead of waiting
2. Separate conversation thread from task execution
3. Implement webhook callbacks for results
4. Use ElevenLabs conversation events differently

### Issue #2: No User Transcriptions
**Status:** Still investigating

Logs show:
- ✅ Audio chunks sent: 500+
- ✅ Speech detected (VAD)
- ❌ NO "User said:" logs
- ❌ NO transcriptions from ElevenLabs

**Possible Causes:**
- ASR configuration issue
- Callback not firing
- Audio format problem (though config shows pcm_16000 is correct)
- ElevenLabs service issue

**Next Steps:**
- Check ElevenLabs dashboard for conversation logs
- Add more detailed ASR logging
- Test with simple phrases
- Verify audio format matches expectations

## 📖 Documentation Gaps Found

### Missing from SDK Docs:
1. No examples of Conversational AI with ClientTools
2. No guidance on voice response behavior after functions
3. No explanation of conversation flow during async operations
4. Limited info on turn-taking configuration

### Had to Discover:
- Function return format from TypeScript definitions
- Voice behavior from trial and error
- System prompt importance from testing

## 🎓 Lessons Learned

1. **System Prompt is Critical** - ElevenLabs agent behavior is HEAVILY influenced by system prompt
2. **Explicit Voice Instructions Needed** - Agent won't speak unless told to
3. **Function Returns Are Simple** - Just return data, don't try to format voice responses
4. **Platform Handles Most** - Turn-taking, interruptions, VAD all server-side
5. **Documentation Limited** - SDK is new, had to reverse-engineer behavior

## 🔄 Next Testing Steps

1. **Test Voice Response** (After restart)
   - Join voice
   - Say: "List my Trello boards"
   - **Expected:** Agent should SPEAK "I'm checking your boards" before showing text

2. **Test Availability During Task**
   - Start a task
   - While running, say: "Hello?"
   - **Expected:** Agent should respond (may not work yet)

3. **Test User Transcriptions**
   - Speak clearly
   - Check logs for "User said:" messages
   - **Expected:** Should see transcriptions (may not work yet)

## 📝 Files Modified

1. `scripts/update-agent-prompt.ts` - Added voice instructions
2. `src/bot/realtimeVoiceReceiver.ts` - Added error reporting to Discord
3. `src/bot/discordBotRealtime.ts` - Added message chunking, error notifications
4. `src/utils/elevenLabsVoice.ts` - Added audio chunk logging

## ✅ Status

- **Voice Response Fix:** ✅ Implemented, awaiting restart to test
- **Error Notifications:** ✅ All errors now go to Discord
- **Message Chunking:** ✅ Long messages won't crash
- **Agent Availability:** ⏳ Still to investigate
- **User Transcriptions:** ⏳ Still to investigate

---

**Updated:** November 17, 2025, 12:49 AM
**Agent ID:** agent_8301ka82ffjyfyera8c7f4gvayt5
**Prompt Version:** Updated with voice instructions

