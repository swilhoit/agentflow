# Voice Agent Testing Guide

## 🧪 Comprehensive Test Suite

Use this guide to verify all voice agent improvements are working correctly.

---

## ✅ Test 1: Task Launch with New Keywords

### Test Case 1A: "Pull" Keyword
**Say:** "Pull up my Trello boards"

**Expected:**
- ✅ Task launches immediately
- ✅ "🚀 Task Started" appears in Discord
- ✅ Results appear within seconds
- ✅ "✅ Task Completed" appears with board list

**Check Logs For:**
```
[INFO] [HYBRID] Detected action command: "Pull up my Trello boards" - forcing execute_task
[INFO] ✅ Task completed: Pull up my Trello boards
```

---

### Test Case 1B: "Fetch" Keyword
**Say:** "Fetch my GitHub repos"

**Expected:**
- ✅ Task launches
- ✅ Results appear in Discord
- ✅ No "I'll do that" without actually doing it

---

### Test Case 1C: "Tell Me About" Phrase
**Say:** "Tell me about the Waterwise project"

**Expected:**
- ✅ Task launches (not just conversation)
- ✅ Actual project information appears

---

## ✅ Test 2: Context Visibility

### Test Case 2A: Immediate Context Check
**Say:** "List my Trello boards"  
**Wait for results to appear**  
**Say:** "Can you see those results?"

**Expected:**
- ✅ Agent responds: "Yes! You have X boards..."
- ❌ Agent NEVER says: "I don't have access"
- ❌ Agent NEVER says: "I can't see"
- ❌ Agent NEVER says: "I'm unable to view"

**Check Logs For:**
```
[INFO] [Voice Receiver] 🔄 Refreshing context before processing user input...
[INFO] [Voice Receiver] 📊 Retrieved X messages from history
[INFO] [Voice Receiver] ✅ Context sent successfully
```

---

### Test Case 2B: Reference Specific Information
**After task completes:**  
**Say:** "How many boards do I have?"

**Expected:**
- ✅ Agent provides specific number
- ✅ Doesn't ask you to repeat

---

### Test Case 2C: Multi-Turn Conversation
**Say:** "List my Trello boards"  
**Wait for results**  
**Say:** "What's the first one?"  
**Say:** "Tell me more about it"

**Expected:**
- ✅ Agent maintains context across all turns
- ✅ References board names from earlier messages

---

## ✅ Test 3: Terminal Output Visibility

### Test Case 3A: Ask About Output
**After any task with output:**  
**Say:** "What did the terminal say?"

**Expected:**
- ✅ Agent references actual output
- ❌ Agent NEVER says: "I cannot access terminal information"

---

### Test Case 3B: Error Visibility
**Trigger a failed task (invalid command):**  
**Say:** "Did you see any errors?"

**Expected:**
- ✅ Agent acknowledges the error
- ✅ Agent can reference error message

---

## ✅ Test 4: Context Refresh Timing

### Test Case 4A: Before User Input
**Say anything to the agent**

**Check Logs Immediately:**
```
[INFO] [Voice Receiver] 🔄 Refreshing context before processing user input...
```

**Verify:**
- ✅ Context refresh happens BEFORE agent processes your message

---

### Test Case 4B: After Agent Response
**Wait for agent to finish speaking**

**Check Logs After Speech Ends:**
```
[INFO] Assistant finished responding
[INFO] [Voice Receiver] Refreshing conversation context after assistant response...
```

**Verify:**
- ✅ Context refresh happens AFTER agent stops speaking

---

## ✅ Test 5: Continuous Memory

### Test Case 5A: Long Conversation
**Have a 5+ turn conversation with multiple tasks**

**Expected:**
- ✅ Agent remembers information from turn 1 when you're on turn 5
- ✅ Agent can reference previous results
- ✅ Agent doesn't "forget" what happened

---

### Test Case 5B: Ask About Earlier Topics
**After several topics:**  
**Say:** "What did we talk about first?"

**Expected:**
- ✅ Agent recalls the first topic
- ✅ Agent can summarize previous conversation

---

## ✅ Test 6: Complex Task Execution

### Test Case 6A: GitHub + Trello Combo
**Say:** "Show me my GitHub projects and Trello boards"

**Expected:**
- ✅ Task launches
- ✅ Results for both appear
- ✅ Agent acknowledges both sets of results

---

### Test Case 6B: Follow-up Questions
**After complex task:**  
**Say:** "Which one has the most activity?"

**Expected:**
- ✅ Agent analyzes the results it just received
- ✅ Provides intelligent answer

---

## 🔍 Log Monitoring

### Monitor These Patterns:

#### Good Pattern (Success):
```
[INFO] User said: [user message]
[INFO] [Voice Receiver] 🔄 Refreshing context before processing user input...
[INFO] [Voice Receiver] 📊 Retrieved X messages from history
[INFO] [ElevenLabs] 📤 Sending contextual update (X characters)
[INFO] [ElevenLabs] ✅ Contextual update sent successfully to agent
[INFO] [HYBRID] Detected action command...
[INFO] ✅ Task completed
[INFO] [DB] ✅ Task result saved to conversation history
[INFO] Assistant finished responding
[INFO] [Voice Receiver] Refreshing conversation context after assistant response...
```

#### Bad Pattern (Failure):
```
[INFO] User said: [user message]
[WARN] [Voice Receiver] Cannot refresh context - missing guildId or channelId
❌ No context refresh logged
```

```
[INFO] [HYBRID] Conversational message detected - letting ElevenLabs handle naturally
❌ Should have detected action command
```

---

## 📊 Success Criteria

### All Tests Pass If:
- ✅ Tasks launch for all action keywords (pull, fetch, tell me about, etc.)
- ✅ Context refreshes before EVERY user input
- ✅ Context refreshes after EVERY agent response
- ✅ Agent NEVER claims it "can't see" or "doesn't have access"
- ✅ Agent references actual task results when asked
- ✅ Agent maintains memory across multiple turns
- ✅ Logs show consistent context refresh patterns

---

## 🐛 Troubleshooting

### If Agent Still Claims "Can't See":
1. Check logs for: `[Voice Receiver] ✅ Context sent successfully`
2. Verify context contains task results: `[Voice Receiver] Context preview: ...`
3. Confirm system prompt was updated: Run `npx ts-node scripts/check-agent-config.ts`

### If Tasks Don't Launch:
1. Check logs for: `[HYBRID] Detected action command`
2. Verify keyword is in action list (src/bot/realtimeVoiceReceiver.ts line 525)
3. Add keyword if missing

### If Context Not Refreshing:
1. Check logs for: `[Voice Receiver] 🔄 Refreshing context before processing`
2. Verify callback is set: `[Voice Receiver] ⚠️ No conversation refresh callback set!` (should NOT appear)
3. Check database: Messages should be saved with `[DB] ✅ Task result saved`

---

## 📝 Quick Test Script

**Run this 5-minute test:**

1. **Connect to voice channel**
2. **Say:** "Pull up my Trello boards"
   - Wait for results
3. **Say:** "Can you see those?"
   - Should respond "Yes!"
4. **Say:** "How many do I have?"
   - Should give specific number
5. **Say:** "List my GitHub repos"
   - Wait for results
6. **Say:** "What did we just look at?"
   - Should mention both Trello AND GitHub

**If all 6 steps work → ✅ System is fully operational!**

---

**Testing Time:** ~10 minutes for full suite  
**Quick Test:** ~5 minutes for basic verification  
**Critical Tests:** Test 1 (task launch) + Test 2 (context visibility)

