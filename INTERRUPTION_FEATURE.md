# Bot Interruption Feature

## Overview
The AgentFlow Discord bot uses **ElevenLabs Conversational AI**, which provides built-in, automatic interruption handling through its proprietary turn-taking model. Users can interrupt the bot naturally at any time.

## How Interruptions Work

### 1. Automatic Voice Interruption (Built-in to ElevenLabs)
ElevenLabs Conversational AI automatically detects when you start speaking and handles interruptions seamlessly:

**What ElevenLabs Does Automatically:**
- **Voice Activity Detection (VAD)**: Detects when you start speaking
- **Turn-Taking Management**: Determines who should speak and when
- **Automatic Agent Stopping**: Stops the agent's response when you interrupt
- **Natural Conversation Flow**: Manages pauses, interruptions, and speaker transitions
- **Zero Configuration**: Works out of the box without any manual setup

**This happens automatically** - no commands or configuration needed!

### 2. Manual Text Command Interruption (Backup Option)
You can also interrupt the bot manually by typing a text command in the Discord channel:

```
!stop
```
or
```
!interrupt
```

These commands will:
- Immediately stop the bot's local audio playback
- Clear the audio queue
- Signal to ElevenLabs that we're interrupting (though ElevenLabs already handles this automatically)
- Provide confirmation that the bot was interrupted

**Note:** This is rarely needed since ElevenLabs handles interruptions automatically via voice!

## Technical Implementation

### How ElevenLabs Handles Interruptions (Automatic)

**ElevenLabs Conversational AI** includes a proprietary **turn-taking model** that manages all conversation dynamics:

1. **Continuous Audio Monitoring**: ElevenLabs constantly monitors incoming audio via its WebSocket connection
2. **Voice Activity Detection**: Built-in VAD detects when the user starts speaking
3. **Automatic Agent Stopping**: The agent automatically stops generating and playing audio when user speech is detected
4. **Turn Management**: The system determines when it's appropriate for the agent to respond
5. **No Manual Code Required**: All of this happens automatically - we just stream audio bidirectionally

### Files Involved
1. **`src/utils/elevenLabsVoice.ts`**
   - Manages connection to ElevenLabs Conversational AI
   - Streams audio to/from ElevenLabs
   - Provides `interrupt()` method for manual interruption (rarely needed)

2. **`src/bot/realtimeVoiceReceiver.ts`**
   - Bridges Discord voice with ElevenLabs
   - Handles audio resampling and format conversion
   - Provides `interrupt()` public method for manual control

3. **`src/bot/discordBotRealtime.ts`**
   - Discord bot interface
   - Implements `!stop` and `!interrupt` commands for manual interruption

### Automatic Voice Interruption Flow (Handled by ElevenLabs)
1. User starts speaking while bot is talking
2. ElevenLabs' VAD detects speech **automatically**
3. ElevenLabs stops the agent's response **automatically**
4. ElevenLabs begins processing user input **automatically**
5. Bot is ready to listen and respond

### Manual Text Command Interruption Flow (Backup)
1. User types `!stop` or `!interrupt`
2. Command handler retrieves the active receiver
3. `interrupt()` method is called
4. Local audio playback stops immediately
5. Audio streams are cleaned up
6. Confirmation message is sent to user

**Note:** This is a manual override - ElevenLabs already handles interruptions automatically!

### interrupt() Method (Manual Control)
```typescript
interrupt(): void {
  // Stop local audio playback immediately
  this.audioPlayer.stop();

  // Signal to ElevenLabs (though it already handles this automatically)
  this.voiceService.interrupt();
  this.isProcessingAudio = false;

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

**Important:** The actual interruption is handled by ElevenLabs' turn-taking model. This method just provides manual control for edge cases.

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

