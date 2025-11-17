# Voice Connection Fix

## Problem
The bot was failing to join voice channels with the error: **"Failed to join voice channel: The operation was aborted"**

## Root Cause
The Discord.js voice library requires an encryption library (`sodium` or `libsodium-wrappers`) to establish secure voice connections. This dependency was missing from the project.

## Solution Applied

### 1. Added Missing Dependency
Installed `libsodium-wrappers` which provides the encryption functionality needed for Discord voice connections:

```bash
npm install libsodium-wrappers
```

### 2. Improved Error Handling
Enhanced both `discordBot.ts` and `discordBotRealtime.ts` with:

- **Better connection state logging**: Now logs all state transitions during connection
- **Error event listeners**: Captures and logs connection errors in real-time
- **Detailed error messages**: Provides actionable information when connection fails
- **Nested try-catch**: Separates state transition errors from general connection errors
- **Helpful troubleshooting hints**: Suggests checking permissions and network connectivity

### Changes Made

#### Enhanced Connection Code
```typescript
const connection = joinVoiceChannel({
  channelId: member.voice.channel.id,
  guildId: message.guild!.id,
  adapterCreator: message.guild!.voiceAdapterCreator,
  selfDeaf: false,
  selfMute: false
});

// Add connection status logging
connection.on('stateChange', (oldState, newState) => {
  logger.info(`Voice connection state changed: ${oldState.status} -> ${newState.status}`);
});

connection.on('error', (error) => {
  logger.error('Voice connection error:', error);
});

logger.info(`Current connection status: ${connection.state.status}`);

try {
  await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  // ... rest of connection setup
} catch (stateError) {
  connection.destroy();
  throw new Error('Voice connection timed out or was rejected...');
}
```

## Testing the Fix

1. **Restart the bot** to load the new encryption library:
   ```bash
   npm start
   ```

2. **Join a voice channel** in Discord

3. **Send the command** in a text channel:
   ```
   !join
   ```

4. **Check the logs** for connection state transitions:
   - Should see: `Signalling -> Connecting -> Ready`
   - If it gets stuck, the detailed logs will show where

## Additional Troubleshooting

If the issue persists after installing `libsodium-wrappers`, check the following:

### 1. Bot Permissions
Ensure the bot has these permissions in the Discord server:
- ✅ **Connect** - Join voice channels
- ✅ **Speak** - Play audio in voice channels
- ✅ **Use Voice Activity** - Detect when users are speaking

### 2. Network Issues
- Check if your server can reach Discord's voice servers
- Verify firewall rules allow UDP traffic on ports used by Discord
- Test with `!status` command to see current connection state

### 3. Discord API Issues
- Check Discord Status page: https://discordstatus.com/
- Voice region issues: Try changing the voice channel's region in Discord settings

### 4. Library Verification
Verify the encryption library is properly loaded:
```bash
node -e "require('libsodium-wrappers').ready.then(() => console.log('✅ libsodium-wrappers loaded successfully'))"
```

### 5. View Detailed Logs
The bot now logs all connection state transitions. Look for these patterns:

**Success:**
```
Voice connection state changed: Signalling -> Connecting
Voice connection state changed: Connecting -> Ready
Joined voice channel [channel-name]
```

**Failure (timeout):**
```
Voice connection state changed: Signalling -> Connecting
Failed to reach Ready state
Failed to join voice channel: Connection timed out
```

**Failure (permission issue):**
```
Voice connection error: Missing Permission
Failed to join voice channel
```

## Alternative: Using Native Sodium

If you want better performance, you can try installing the native `sodium` library instead (requires compilation tools):

```bash
# Install build tools first (macOS)
brew install libtool autoconf automake

# Then install sodium
npm uninstall libsodium-wrappers
npm install sodium
```

However, `libsodium-wrappers` should work fine for most use cases and is easier to install.

## Related Files Modified
- `src/bot/discordBot.ts` - Added enhanced error handling
- `src/bot/discordBotRealtime.ts` - Added enhanced error handling
- `package.json` - Added `libsodium-wrappers` dependency

## Next Steps

1. Restart your bot application
2. Try the `!join` command again
3. Review the logs for detailed connection information
4. If issues persist, check the troubleshooting section above

The enhanced logging will now provide much better diagnostic information if connection issues occur again.

