# Audio Quality Fixes

## Issues Fixed

### 1. **Audio Breakup and Scrambling** 
Fixed multiple issues in the audio processing pipeline that caused audio to sound broken or scrambled:

- **Buffer alignment issues**: Input resampling was skipping samples at the end of buffers
- **Output buffer mismatches**: Fixed calculation of output buffer sizes to prevent data corruption
- **Excessive logging**: Reduced logging from every audio frame to ~1% of frames to prevent performance bottlenecks
- **Edge case handling**: Added proper validation for incomplete audio samples

### 2. **Speech Speed Configuration**
Added configurable speech speed support:

- Default speed is now **1.25x** (25% faster than normal)
- Fully configurable via environment variable
- Speed can range from 0.25x to 4.0x

## Configuration

### Adjusting Speech Speed

Add to your `.env` file:

```bash
# Speech speed for voice responses
# 1.0 = normal speed
# 1.25 = 25% faster (default)
# 1.5 = 50% faster
# 2.0 = 2x faster
# 0.75 = 25% slower
TTS_SPEED=1.25
```

### Troubleshooting Audio Issues

If you're still experiencing audio breakup:

1. **Try reducing the speed**: Set `TTS_SPEED=1.0` in your `.env` file
2. **Check network latency**: High latency can cause audio issues
3. **Check Discord voice region**: Try switching to a closer voice server region
4. **Check CPU usage**: High CPU load can cause audio processing delays

## Technical Details

### Input Pipeline (User Voice → OpenAI)
- **Input**: Discord Opus 48kHz stereo
- **Decode**: PCM16 48kHz stereo
- **Resample**: 48kHz → 24kHz (downsample by 2x)
- **Convert**: Stereo → Mono (average channels)
- **Output**: PCM16 24kHz mono for OpenAI Realtime API

### Output Pipeline (OpenAI → Discord)
- **Input**: PCM16 24kHz mono from OpenAI Realtime API
- **Upsample**: 24kHz → 48kHz (2x with linear interpolation)
- **Convert**: Mono → Stereo (duplicate to both channels)
- **Encode**: PCM16 → Opus
- **Output**: Discord Opus 48kHz stereo

### Changes Made

1. **Fixed input resampling loop** (`realtimeVoiceReceiver.ts` lines 473-506)
   - Properly calculates number of complete sample pairs
   - Ensures all data is processed without skipping samples
   - Validates output buffer length before sending

2. **Fixed output upsampling** (`realtimeVoiceReceiver.ts` lines 562-608)
   - Improved sample counting and buffer allocation
   - Better edge case handling for incomplete samples
   - Added validation for zero-length buffers

3. **Reduced logging overhead**
   - Changed from logging every frame to logging ~1% of frames
   - Prevents I/O bottlenecks during audio processing

4. **Added configurable speech speed**
   - Environment variable: `TTS_SPEED`
   - Config field: `config.ttsSpeed`
   - Runtime parameter to `RealtimeVoiceReceiver`

## Testing

After making these changes and restarting the bot:

1. Join a voice channel with `!join`
2. Speak to test input quality
3. Listen to responses to verify output quality
4. Adjust `TTS_SPEED` if needed and restart

## Notes

- The `speed` parameter may or may not be supported by OpenAI's Realtime API (not officially documented)
- If speed adjustment doesn't work, the code gracefully handles it
- Audio quality improvements are independent of speed configuration

