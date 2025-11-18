# 🏷️ Agent Tagging System

## ✅ Now You Can Tag Specific Agents!

You can now **@mention or tag** specific agents to talk to them directly, **from any channel!**

---

## 🤖 Your Agents

### 1. **Orchestrator** - Main AI Assistant
**Discord Name**: `agent man`  
**Role**: Task execution, code assistance, general AI tasks

**How to Tag:**
- `@agent man` - Direct Discord mention
- `orchestrator what's the weather?`
- `!orchestrator help me with this`
- `@orchestrator show me my tasks`

### 2. **Atlas** - Market Intelligence
**Discord Name**: `atlas`  
**Role**: Global markets, crypto, trading, economic analysis

**How to Tag:**
- `@atlas` - Direct Discord mention
- `atlas what's Bitcoin at?`
- `!atlas analyze the market`
- `@atlas check ETH price`

### 3. **Financial Advisor** - Personal Finance
**Discord Name**: `mr krabs`  
**Role**: Account balances, spending analysis, budgeting, savings goals

**How to Tag:**
- `@mr krabs` - Direct Discord mention
- `advisor what's my balance?`
- `!advisor analyze my spending`
- `mr krabs show my transactions`

---

## 🎯 How It Works

### Channel-Based (Default)
Each agent monitors specific channels:
- **Orchestrator**: Main channels (general, testing, etc.)
- **Atlas**: Market/trading channels
- **Financial Advisor**: Finance channels

In these channels, agents respond automatically to relevant messages.

### Tag-Based (Override)
When you **@mention or tag** an agent:
- ✅ They respond **regardless of channel**
- ✅ Works in **any** server channel
- ✅ Works in **DMs** (if enabled)
- ✅ Overrides channel restrictions

---

## 💡 Examples

### Talk to Multiple Agents

**In #general channel:**
```
You: atlas what's BTC at?
Atlas: Bitcoin is trading at $94,234 (+2.3% today)

You: orchestrator create a trading bot
Orchestrator: ⚙️ Working on it... I'll create a trading bot script

You: advisor can I afford a $2000 purchase?
Mr Krabs: Let me check your balance... Yes, you have sufficient funds
```

### Cross-Channel Communication

**In #market-updates (Atlas's channel):**
```
You: orchestrator deploy my latest code
Orchestrator: ✨ I was mentioned - deploying your code to Cloud Run...
```

**In #finance (Advisor's channel):**
```
You: atlas what's the S&P doing?
Atlas: ✨ I was mentioned - S&P 500 is at 5,952 (+0.8% today)
```

---

## 📋 All Tagging Methods

### Orchestrator
```
@agent man task here
orchestrator task here
!orchestrator task here
@orchestrator task here
```

### Atlas
```
@atlas market question
atlas market question
!atlas market question
@atlas market question
```

### Financial Advisor
```
@mr krabs financial question
advisor financial question
!advisor financial question
mr krabs financial question
@mr krabs financial question
```

---

## 🚀 Benefits

### 1. **Flexibility**
- Talk to any agent from anywhere
- No need to switch channels
- Multiple agents in one conversation

### 2. **Context Preservation**
- Continue conversations across channels
- Agents remember context when tagged
- Seamless multi-agent interactions

### 3. **Efficiency**
- Get quick answers without channel switching
- Ask multiple agents in same thread
- Better workflow for complex tasks

---

## 🔧 Technical Details

### Priority System
1. **Mentions** - Highest priority (bot is @mentioned)
2. **Tags** - High priority (message starts with agent name)
3. **Keywords** - Normal priority (relevant keywords detected)
4. **Channel** - Default priority (message in monitored channel)

### Response Logic
```
IF mentioned OR tagged:
    Respond regardless of channel
ELSE IF in monitored channel:
    Check for keywords
    Respond if relevant
ELSE:
    Ignore message
```

---

## 📊 Examples by Use Case

### Multi-Agent Planning
```
You: orchestrator analyze my codebase
Orchestrator: Analyzing... Found 15 TODO items and 3 bugs

You: advisor how much have I spent on development tools?
Mr Krabs: $147.50 on development tools this month

You: atlas what's the job market like for developers?
Atlas: Tech hiring is strong, average salaries up 8% YoY
```

### Financial + Market Analysis
```
You: atlas is Bitcoin a good investment right now?
Atlas: BTC is consolidating around $94K after breaking ATH...

You: advisor do I have enough to invest $5000?
Mr Krabs: Yes, you have $12,340 in savings after expenses

You: orchestrator create a DCA investment tracker
Orchestrator: I'll create a dollar-cost averaging tracker...
```

### Task Management
```
You: orchestrator show my active tasks
Orchestrator: You have 3 active tasks: [list]

You: atlas track Tesla stock price
Atlas: Added TSLA to tracking list, currently at $352

You: advisor set a $500 budget for entertainment
Mr Krabs: ✅ Entertainment budget set to $500/month
```

---

## ⚙️ Configuration

### Enable/Disable Tagging
Currently **always enabled** for all agents.

### Add More Aliases
Edit the bot files to add custom tags:

**Orchestrator** (`src/bot/discordBotRealtime.ts`):
```typescript
const isTagged = content.startsWith('orchestrator') || 
                 content.startsWith('@orchestrator') ||
                 content.startsWith('!orchestrator') ||
                 content.startsWith('agent'); // Add custom alias
```

**Atlas** (`src/atlas/atlasBot.ts`):
```typescript
const isTagged = content.startsWith('atlas') || 
                 content.startsWith('@atlas') ||
                 content.startsWith('!atlas') ||
                 content.startsWith('market'); // Add custom alias
```

**Advisor** (`src/advisor/advisorBot.ts`):
```typescript
const isTagged = content.startsWith('advisor') || 
                 content.startsWith('@advisor') ||
                 content.startsWith('!advisor') ||
                 content.startsWith('mr krabs') ||
                 content.startsWith('finance'); // Add custom alias
```

---

## 🎨 Best Practices

### 1. **Use Clear Tags**
```
✅ Good: atlas what's BTC at?
✅ Good: advisor show my balance
❌ Unclear: check the price (which agent?)
```

### 2. **One Agent Per Message**
```
✅ Good: 
  atlas what's Bitcoin at?
  advisor can I afford it?
  
❌ Confusing:
  atlas and advisor tell me about crypto and my balance
```

### 3. **Context Matters**
```
✅ Good: 
  atlas what's the market sentiment?
  # Agent has context from channel
  
✅ Better:
  atlas what's the market sentiment for tech stocks?
  # Explicit context provided
```

---

## 🐛 Troubleshooting

### Agent Not Responding?

**Check 1**: Is the bot online?
- Look for green status in Discord
- Check bot logs: `[INFO] Bot logged in as...`

**Check 2**: Did you tag correctly?
```
✅ Correct: atlas help
✅ Correct: @atlas help
❌ Wrong: altas help (typo)
❌ Wrong: at help (incomplete)
```

**Check 3**: Rate limiting?
- Wait 5 seconds between messages
- Look for ⏱️ reaction

**Check 4**: Check logs
```bash
# Look for mention detection
[INFO] ✨ Atlas was mentioned/tagged - responding in channel 123456
```

---

## 📈 Logs & Monitoring

### Successful Tag Detection
```
[INFO] Message received: "atlas what's BTC" from User#1234
[INFO] ✨ Atlas was mentioned/tagged - responding in channel 123456789
[INFO] Atlas responded in channel 123456789
```

### Channel Override
```
[INFO] Message received: "orchestrator help" from User#1234
[INFO] ✨ Orchestrator was mentioned/tagged - responding in channel 987654321
[INFO] Orchestrator responding despite being in Atlas's channel
```

---

## 🎯 Quick Reference

| Agent | @Mention | Keyword Tags | Alternative |
|-------|----------|--------------|-------------|
| Orchestrator | `@agent man` | `orchestrator`, `!orchestrator`, `@orchestrator` | - |
| Atlas | `@atlas` | `atlas`, `!atlas`, `@atlas` | - |
| Financial Advisor | `@mr krabs` | `advisor`, `!advisor`, `@advisor`, `mr krabs`, `@mr krabs` | - |

---

## 🔮 Future Enhancements

**Planned:**
- [ ] Multi-agent conversations (agents talking to each other)
- [ ] Agent handoffs ("ask atlas about this")
- [ ] Group tags ("@all-agents update")
- [ ] Smart routing (auto-detect best agent)

---

## 💬 Examples Library

### Development Workflow
```
orchestrator analyze my code
orchestrator run tests
orchestrator deploy to production
advisor how much have I spent on hosting?
```

### Market Research
```
atlas what's trending in crypto?
atlas compare BTC and ETH performance
atlas show me top gainers today
```

### Financial Planning
```
advisor show my spending this month
advisor analyze my spending by category
advisor can I afford a $500 subscription?
advisor set a $2000 savings goal
```

### Mixed Scenarios
```
atlas should I invest in NVDA?
advisor do I have $5000 to invest?
orchestrator create an investment tracker spreadsheet
```

---

**🎉 You can now tag and talk to any agent from anywhere!**

Try it out:
- Type `atlas hello` in any channel
- Type `advisor show balance` anywhere
- Type `orchestrator help` from any location

All agents will respond when tagged! 🚀

