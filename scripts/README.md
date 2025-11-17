# Discord Utility Scripts

These scripts allow you to interact with your Discord server directly from the command line or from code.

## Quick Start

```bash
# List all Discord servers (guilds)
./scripts/discord.sh channels

# List channels in a specific server
./scripts/discord.sh channels <guild-id>

# Send a message to a channel
./scripts/discord.sh send <channel-id> "Your message here"
```

## Your Discord Server Structure

**Server:** INTELLIGENCE UNLEASHED
**Guild ID:** `1091835283210780735`

### Channels by Category:

#### 📁 Midjourney
- `#general` - 1091835283823132776
- `#freestyle` - 1092586420675293194
- `#crystals` - 1096228305033769110
- `#mcdonalds` - 1116482910497808508
- `#lossprevention` - 1132201707695259731
- `#spaghetti` - 1132456305563553892
- `#ancient` - 1136536077558104064
- `#food` - 1138869672830324747
- `#snacks` - 1145819006566142024
- `#bachiste` - 1145819030855372851
- `#moto_x` - 1145819365330145331
- `#trading` - 1146156495101231125
- `#animals` - 1158601083577438268
- `#twin` - 1171607448000409620
- `#y2k` - 1208965508536213564
- `#fishing` - 1209406932482396190

#### 📁 Voice Channels
- 🔊 `General` - 1091835283823132777

#### 📁 cover-art
- `#ksupreme-cover-art` - 1091836344420020314
- `#10kdunkin-cover-art` - 1092946163486957609
- `#bear` - 1194847999990431854

#### 📁 NOTES
- `#mogul` - 1197231933839650847

#### 📁 crypto
- `#crypto-alerts` - 1339709679537750036

#### 📁 agent-chat
- `#agent-chat` - 1439431218599956480
- `#agent-chat-2` - 1439862849454215278

#### 📁 mgmt
- `#goals` - 1439836943264382976
- `#finance` - 1439869363502055474

#### 📁 projects
- `#waterwise` - 1439869862888472719
- `#intercept-dashboard` - 1439869906924339292
- `#lumea` - 1439869933323288628
- `#geo` - 1439869957449191474

## Examples

### Send a message to agent-chat
```bash
./scripts/discord.sh send 1439431218599956480 "Task completed successfully!"
```

### Send a project update
```bash
./scripts/discord.sh send 1439869862888472719 "Waterwise project deployed to production"
```

### Send a goal update
```bash
./scripts/discord.sh send 1439836943264382976 "Daily goals completed ✅"
```

### Send financial alert
```bash
./scripts/discord.sh send 1439869363502055474 "Budget threshold reached"
```

## Programmatic Usage

You can also use these utilities from TypeScript/JavaScript:

```typescript
import { sendDiscordMessage } from './scripts/send-discord-message';

// Send a message
await sendDiscordMessage({
  channelId: '1439431218599956480',
  message: 'Hello from code!',
  guildId: '1091835283210780735' // optional
});
```

```typescript
import { listDiscordChannels } from './scripts/list-discord-channels';

// List channels
await listDiscordChannels('1091835283210780735');
```

## Integration with Agents

Your agents can now intelligently route messages to the appropriate channel:

- **Development updates** → `#agent-chat` or `#agent-chat-2`
- **Project-specific updates** → Corresponding project channel
- **Financial alerts** → `#finance`
- **Goals/productivity** → `#goals`
- **Error/warnings** → Could route to `#agent-chat` or create a dedicated error channel

## Future Enhancements

Consider adding:
1. **Semantic channel mapping** - Map message types to appropriate channels
2. **Channel topic awareness** - Parse channel topics to understand their purpose
3. **Auto-routing logic** - Let agents decide which channel to post based on content
4. **Thread support** - Create and manage message threads
5. **Reaction support** - Add reactions to messages
6. **Embed formatting** - Rich message formatting with embeds

## Security Note

These scripts use your Discord bot token from `.env`. Never commit your `.env` file or share your token.

