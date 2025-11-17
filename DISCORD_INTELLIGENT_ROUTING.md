# Discord Intelligent Channel Routing

Your agents now have **full server awareness** and can intelligently route messages to appropriate channels based on content and context.

## ✅ What Your Agents Can Now Do

### 1. **Server Discovery**
- Automatically map all channels and categories
- Understand channel purposes from names and topics
- Cache structure for performance (refreshes every hour)

### 2. **Intelligent Routing**
- Route messages based on type (errors → error channels, finance → finance channels, etc.)
- Project-specific routing (waterwise updates → #waterwise)
- Semantic matching (analyze message content to find best channel)
- Smart fallbacks (always find an appropriate channel)

### 3. **Post from Cursor**
- Send messages directly from your code editor
- Both manual (specific channel) and automatic (intelligent routing)
- Full CLI integration

## 🚀 Usage from Cursor

### List All Channels
```bash
./scripts/discord.sh channels
./scripts/discord.sh channels 1091835283210780735  # Your guild ID
```

### Send to Specific Channel
```bash
./scripts/discord.sh send <channelId> "Your message"
```

### Intelligent Routing (Recommended!)
```bash
./scripts/discord.sh smart <guildId> <messageType> "message" [projectName]
```

## 📋 Message Types

The system recognizes these message types:

| Type | Routes To | Example |
|------|-----------|---------|
| `agent_update` | #agent-chat, #agents, #bot | Agent status updates |
| `error` | #errors, #error-log, #agent-chat | Error notifications |
| `warning` | #warnings, #agent-chat | Warning messages |
| `success` | #agent-chat, #updates | Success confirmations |
| `deployment` | #deployments, #dev-logs | Deployment notifications |
| `finance` | #finance, #financial | Budget/financial alerts |
| `goal` | #goals, #productivity | Goal tracking |
| `project_update` | #projects, project-specific | Project updates |
| `crypto` | #crypto, #crypto-alerts | Crypto price alerts |
| `general` | #general, #agent-chat | General messages |
| `command_result` | #agent-chat, #results | Command outputs |
| `thinking` | #agent-chat, #thinking | Agent reasoning |
| `code` | #code, #snippets | Code snippets |

## 🎯 Real Examples (Tested & Working!)

### Finance Alert
```bash
./scripts/discord.sh smart 1091835283210780735 finance "💰 Budget alert: Monthly spend threshold reached"
```
**Result:** Automatically routed to `#finance` channel ✅

### Goal Update
```bash
./scripts/discord.sh smart 1091835283210780735 goal "🎯 Daily goals completed: 5/5 tasks finished"
```
**Result:** Automatically routed to `#goals` channel ✅

### Crypto Alert
```bash
./scripts/discord.sh smart 1091835283210780735 crypto "₿ Bitcoin alert: Price crossed $45,000"
```
**Result:** Automatically routed to `#crypto-alerts` channel ✅

### Project-Specific Update
```bash
./scripts/discord.sh smart 1091835283210780735 project_update "Deployed to production successfully" waterwise
```
**Result:** Automatically routed to `#waterwise` channel ✅

## 💻 Programmatic Usage (In Your Agents)

### From TypeScript/JavaScript

```typescript
import { IntelligentChannelNotifier } from './services/intelligentChannelNotifier';

// Initialize
const notifier = new IntelligentChannelNotifier(discordClient);

// Send with automatic routing
await notifier.sendIntelligentMessage(
  guildId,
  "Agent started processing task",
  'agent_update'
);

// Project-specific update
await notifier.notifyProjectUpdate(
  guildId,
  'waterwise',
  'Database migration completed'
);

// Financial alert
await notifier.notifyFinance(guildId, 'Budget threshold exceeded');

// Error notification
await notifier.notifyError(guildId, 'Failed to connect to API');

// Success notification
await notifier.notifySuccess(guildId, 'Task completed successfully');

// Crypto alert
await notifier.notifyCrypto(guildId, 'Bitcoin price: $45,000');

// Goal update
await notifier.notifyGoal(guildId, 'Daily goals completed');
```

### Channel Discovery

```typescript
import { DiscordChannelAwareness } from './services/discordChannelAwareness';

const awareness = new DiscordChannelAwareness(discordClient);

// Get all channels
const channels = await awareness.getChannels(guildId);

// Search for channels
const projectChannels = await awareness.searchChannels(guildId, 'waterwise');

// Find best channel for a message
const channelId = await awareness.findBestChannel(
  guildId,
  'error',
  'Something went wrong',
  'waterwise'  // optional project name
);

// Get server summary
const summary = await awareness.getGuildSummary(guildId);
console.log(summary);
```

## 🏗️ Your Server Structure

**Server:** INTELLIGENCE UNLEASHED  
**Guild ID:** `1091835283210780735`

### Smart Routing Map

Your channels are automatically categorized:

#### 📁 agent-chat
- `#agent-chat` (1439431218599956480) - Agent updates, command results
- `#agent-chat-2` (1439862849454215278) - Overflow agent communication

#### 📁 mgmt
- `#goals` (1439836943264382976) - Goal tracking, daily tasks ✅ **Tested**
- `#finance` (1439869363502055474) - Financial alerts, budgets ✅ **Tested**

#### 📁 projects
- `#waterwise` (1439869862888472719) - Waterwise project updates ✅ **Tested**
- `#intercept-dashboard` (1439869906924339292) - Intercept dashboard updates
- `#lumea` (1439869933323288628) - Lumea project updates
- `#geo` (1439869957449191474) - Geo project updates

#### 📁 crypto
- `#crypto-alerts` (1339709679537750036) - Crypto price alerts ✅ **Tested**

## 🔧 Configuration

### Custom Routing Rules

You can configure custom routing preferences:

```typescript
const awareness = new DiscordChannelAwareness(client);

// Set preferred channels for a message type
awareness.setChannelRouting('error', ['error-log', 'errors', 'agent-chat']);
awareness.setChannelRouting('deployment', ['deployments', 'dev-logs']);
```

### Cache Management

```typescript
// Clear cache to force refresh
awareness.clearCache(guildId);  // specific guild
awareness.clearCache();         // all guilds
```

## 🎨 Channel Purpose Inference

The system automatically understands channel purposes by analyzing:

1. **Channel names** - Keywords like "error", "goal", "finance", "crypto"
2. **Channel topics** - Description text set in Discord
3. **Category names** - Organizational structure
4. **Keywords** - Extracted and matched semantically

### Example Inferences:
- `#agent-chat` → "Agent communication and updates"
- `#finance` → "Financial tracking and alerts"
- `#goals` → "Goals and task management"
- `#crypto-alerts` → "Cryptocurrency and trading"
- `#waterwise` → "Project-specific updates"

## 📊 How It Works

```
User/Agent Message
       ↓
[Determine Message Type]
       ↓
[Discover Server Structure] (cached)
       ↓
[Match to Best Channel]
  - Project name match?
  - Message type preferences?
  - Semantic content analysis?
  - Fallback to agent-chat
       ↓
[Send to Selected Channel]
```

## 🔐 Security

- Uses your existing Discord bot credentials (`.env`)
- No external services or APIs required
- All routing logic runs locally
- Respects Discord bot permissions

## 🚫 What You Don't Need

You **don't** need to install:
- ❌ Discord CLI tools (cliscord, discli, etc.)
- ❌ Additional dependencies
- ❌ Separate authentication

Everything is built into your existing TypeScript codebase!

## 🎯 Next Steps

### Integrate with Your Agents

Update your `ClaudeCodeAgent` and `SubAgentManager` to use intelligent routing:

```typescript
// In your agent notifications
const notifier = new IntelligentChannelNotifier(discordClient);

// Instead of hardcoded channel IDs
await notifier.sendIntelligentMessage(
  guildId,
  agentMessage,
  'agent_update',
  { projectName: taskContext.project }
);
```

### Add Custom Message Types

Extend the `MessageType` enum for your specific needs:

```typescript
// In discordChannelAwareness.ts
export type MessageType = 
  | 'agent_update'
  | 'error'
  | 'your_custom_type'  // Add your types here
  // ...
```

### Monitor Routing

All routing decisions are logged:

```
[INFO] 📍 Routing finance to #finance
[INFO] 📍 Routing to project channel: #waterwise
[INFO] 📍 Routing goal to #goals
```

## 🐛 Troubleshooting

### "Could not find appropriate channel"
- Check that your bot has access to the channel
- Verify the guild ID is correct
- Use fallback channel ID option

### "Channel not found or is not a text channel"
- Ensure channel still exists
- Check bot permissions
- Refresh cache with `clearCache()`

### Messages going to wrong channel
- Review routing preferences with `setChannelRouting()`
- Check channel name/topic keywords
- Use explicit channel IDs for critical messages

## 📚 Related Files

- `/src/services/discordChannelAwareness.ts` - Core awareness service
- `/src/services/intelligentChannelNotifier.ts` - Smart notifier
- `/src/scripts/discord-intelligent-send.ts` - CLI tool
- `/scripts/discord.sh` - Bash wrapper
- `/scripts/README.md` - Channel reference

## 🎉 Summary

You can now:
1. ✅ Post to Discord from Cursor
2. ✅ List all your Discord channels
3. ✅ Automatically route messages by type
4. ✅ Route project-specific updates
5. ✅ Use from CLI or programmatically
6. ✅ No external tools needed

Your agents now understand your Discord server layout and can intelligently decide where to post based on context!

