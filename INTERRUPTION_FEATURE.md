# Bot Interruption Feature

## Overview
The AgentFlow Discord bot now supports interrupting the bot's speech at any time, giving users full control over the conversation flow.

## How to Interrupt the Bot

### 1. Voice Interruption (Automatic)
When the bot is speaking in a voice channel, simply start speaking. The bot's Voice Activity Detection (VAD) will automatically detect your speech and:
- Stop the bot's current audio playback immediately
- Cancel the ongoing response from the OpenAI Realtime API
- Clear any queued audio
- Be ready to listen to your new input

**This happens automatically** - no commands needed!

### 2. Text Command Interruption (Manual)
You can also interrupt the bot by typing a text command in the Discord channel:

```
!stop
```
or
```
!interrupt
```

These commands will:
- Immediately stop the bot from speaking
- Cancel any ongoing response
- Clear the audio queue
- Provide confirmation that the bot was interrupted

## Technical Implementation

### Files Modified
1. **`src/bot/discordBotRealtime.ts`**
   - Added `!stop` and `!interrupt` command handlers
   - Implemented `handleStopCommand()` method

2. **`src/bot/realtimeVoiceReceiver.ts`**
   - Added `interrupt()` public method
   - Enhanced automatic VAD-based interruption
   - Updated system instructions to mention interruption capability

### How It Works

#### Voice Interruption Flow
1. User starts speaking
2. OpenAI Realtime API's VAD detects speech
3. `speech_started` event is emitted
4. Bot's `interrupt()` method is called
5. Audio player stops
6. Realtime API response is cancelled
7. Audio streams are cleared
8. Bot is ready to listen to new input

#### Text Command Interruption Flow
1. User types `!stop` or `!interrupt`
2. Command handler retrieves the active receiver
3. `interrupt()` method is called
4. Same cleanup process as voice interruption
5. Confirmation message is sent to user

### interrupt() Method
```typescript
interrupt(): void {
  // Stop audio playback immediately
  this.audioPlayer.stop();

  // Cancel the current response from the Realtime API
  if (this.isProcessingAudio) {
    this.realtimeService.cancelResponse();
    this.isProcessingAudio = false;
  }

  // Clear the current audio stream
  if (this.currentAudioStream) {
    this.currentAudioStream.push(null);
    this.currentAudioStream = null;
  }

  // Clean up any active output streams
  this.activeOutputStreams.forEach(stream => {
    if (stream && typeof stream.destroy === 'function') {
      stream.destroy();
    }
  });
  this.activeOutputStreams.clear();
}
```

## Use Cases

### 1. Quick Correction
If the bot starts responding to the wrong thing or misunderstands, interrupt immediately and clarify.

### 2. Long Responses
If the bot is giving a lengthy response and you already have the information you need, interrupt to move on.

### 3. Emergency Stop
If the bot is about to execute something you didn't intend, interrupt and correct the command.

### 4. Natural Conversation Flow
Interrupt naturally just like you would in a human conversation - the bot won't be offended!

## Error Handling

- If the bot is not in a voice channel, the `!stop` command will inform you
- If there's no active speech to interrupt, you'll receive a message indicating this
- All errors are logged for debugging purposes

## Logging

All interruptions are logged with the following information:
- Timestamp
- User who initiated the interruption
- Guild/server ID
- Method of interruption (voice VAD or text command)

## Future Enhancements

Potential improvements for the interruption feature:
1. Gesture-based interruption (e.g., specific reactions)
2. Configurable interruption sensitivity
3. Statistics on interruption patterns
4. Interrupt and resume (save context to resume later)

