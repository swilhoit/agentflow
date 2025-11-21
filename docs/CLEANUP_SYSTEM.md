# AgentFlow Cleanup System

## Overview

The Cleanup System prevents resource leaks from orphaned processes, stale agents, and leftover tasks. It automatically detects and cleans up resources that didn't terminate properly due to crashes, timeouts, or interruptions.

## Features

✅ **Automatic Cleanup** - Runs every 30 minutes automatically  
✅ **Orphaned Process Detection** - Finds and kills hung Node processes  
✅ **Stale Task Cleanup** - Marks timed-out database tasks as failed  
✅ **Temp File Management** - Removes old audio and temporary files  
✅ **Discord Commands** - Manual cleanup and status checking  
✅ **CLI Tools** - Command-line utilities for maintenance  
✅ **Graceful Shutdown** - Proper cleanup on app termination  

## Automatic Cleanup

The cleanup system runs automatically every 30 minutes to:

1. **Detect Orphaned Processes**
   - Finds Node.js processes running for >30 minutes with <0.1% CPU
   - Sends SIGTERM, then SIGKILL if needed
   - Excludes current process and parent process

2. **Clean Stale Database Tasks**
   - Finds tasks in "running" status for >1 hour
   - Marks them as "failed" with timeout error
   - Updates completion timestamp

3. **Remove Temporary Files**
   - Audio files (`.pcm`, `.wav`) older than 1 hour
   - TTS audio (`.mp3`) older than 24 hours
   - Temp directory files older than 1 hour

4. **Check Cloud Resources** (if applicable)
   - Lists running Cloud Run services
   - Logs status for monitoring

## Discord Commands

### `!resources`
Check current resource usage

**Usage:**
```
!resources
```

**Output:**
```
📊 AgentFlow Resource Status

🔹 Running Processes: 2
🔹 Active Agents: 0
🔹 Running Tasks (DB): 1
🔹 Temp File Size: 45.32 MB

Last checked: 10:15:23 PM
```

### `!cleanup`
Manually trigger cleanup (Admin only)

**Usage:**
```
!cleanup
```

**Output:**
```
✅ Cleanup Complete

🔹 Orphaned Processes: 2
🔹 Orphaned Agents: 1
🔹 Stale DB Tasks: 3
🔹 Temp Files Deleted: 42

Total Cleaned: 48 items
```

## CLI Tools

### Check Status
```bash
npm run cleanup:status
```

Shows current resource usage and running tasks:
```
📊 AgentFlow Resource Status
═══════════════════════════════════════

🔹 Running Processes: 2
🔹 Active Agents: 0
🔹 Running Tasks (DB): 1
🔹 Temp File Size: 45.32 MB

📋 Running Tasks:

   • agent_1763359104902_hv4fmw2
     Go through my GitHub and take the most recent 5 projects...
     Started: 2025-11-17 05:18:07

═══════════════════════════════════════
✅ Status check complete
```

### Run Cleanup
```bash
npm run cleanup
```

Performs full cleanup and shows report:
```
🧹 Starting AgentFlow Cleanup
═══════════════════════════════════════

📊 Cleanup Report

🔹 Orphaned Processes: 2
🔹 Orphaned Agents: 1
🔹 Stale DB Tasks: 3
🔹 Temp Files Deleted: 42

🔹 Total Cleaned: 48

═══════════════════════════════════════
✅ Cleanup complete
```

### Emergency Cleanup
```bash
npm run cleanup:emergency
```

⚠️ **WARNING**: Force kills ALL AgentFlow processes!

Use this only if:
- Normal cleanup fails
- System is completely unresponsive
- Multiple zombie processes detected
- Manual intervention needed

```
🚨 EMERGENCY CLEANUP
═══════════════════════════════════════

⚠️  This will forcefully kill ALL AgentFlow processes!
⚠️  Use this only if normal cleanup fails.

Starting in 3 seconds... (Ctrl+C to cancel)

✅ Emergency cleanup complete
═══════════════════════════════════════

💡 You can now restart AgentFlow with: npm start
```

## Cleanup Thresholds

| Resource | Threshold | Action |
|----------|-----------|--------|
| **Hung Processes** | Running >30 min + CPU <0.1% | SIGTERM → SIGKILL |
| **Stale Tasks** | Running >1 hour | Mark as failed |
| **Audio Files** | Age >1 hour | Delete |
| **TTS Audio** | Age >24 hours | Delete |
| **Temp Files** | Age >1 hour | Delete |

## Configuration

### Adjust Cleanup Interval

In `src/index.ts`:
```typescript
// Change from 30 minutes to custom interval
cleanupManager.startAutoCleanup(60); // 60 minutes
```

### Customize Thresholds

In `src/utils/cleanupManager.ts`:

**Hung Process Detection:**
```typescript
// Current: 30 minutes, 0.1% CPU
return totalMinutes > 30 && cpuUsage < 0.1;

// More aggressive:
return totalMinutes > 15 && cpuUsage < 0.5;
```

**Stale Task Timeout:**
```typescript
// Current: 1 hour
const staleThreshold = Date.now() - (60 * 60 * 1000);

// Longer timeout:
const staleThreshold = Date.now() - (2 * 60 * 60 * 1000); // 2 hours
```

**Temp File Age:**
```typescript
// Current: 1 hour for audio, 24 hours for TTS
cleaned += await this.cleanOldFiles('./audio', '.pcm', 60);
cleaned += await this.cleanOldFiles('./tts_audio', '.mp3', 60 * 24);

// More aggressive:
cleaned += await this.cleanOldFiles('./audio', '.pcm', 30); // 30 minutes
```

## Monitoring

### Log Messages

**Auto-Cleanup Starting:**
```
🧹 Auto-cleanup enabled (runs every 30 minutes)
```

**Cleanup Running:**
```
🧹 Starting cleanup scan...
```

**Items Found:**
```
Found hung process: PID 12345
Killing hung process: 12345
Found 3 stale tasks in database
Marking stale task as failed: agent_1763359104902_hv4fmw2
Cleaned 42 old files from ./audio
```

**Cleanup Complete:**
```
🧹 Cleanup complete: 48 items cleaned
   - Processes: 2
   - DB Tasks: 3
   - Temp Files: 42
```

**No Issues Found:**
```
🧹 Cleanup complete: No orphaned resources found
```

### Metrics to Track

Monitor these in your logs or dashboards:

- **Cleanup Frequency**: Should run every 30 minutes
- **Items Cleaned Per Run**: Normal = 0-5, High = 10+
- **Orphaned Processes**: Should be 0-1, >3 indicates issues
- **Stale Tasks**: Should be 0-2, >5 indicates task timeout problems
- **Temp File Growth**: Should stay <100MB, >500MB indicates cleanup failure

## Graceful Shutdown

When stopping AgentFlow (Ctrl+C or `kill PID`), the system:

1. Stops auto-cleanup timer
2. Calls `subAgentManager.cleanup()` to terminate all agents
3. Stops Discord bot and orchestrator server
4. Closes database connections
5. Removes lock file
6. Exits cleanly

```
^C
Shutting down gracefully...
🧹 Stopped auto-cleanup
Sub-agent manager cleaned up
Orchestrator server stopped
Discord bot stopped
✅ Shutdown complete
```

## Troubleshooting

### Cleanup Not Running

**Problem**: Auto-cleanup not triggering

**Check:**
```bash
# Look for this in logs:
grep "Auto-cleanup enabled" logs/*.log

# Should see:
🧹 Auto-cleanup enabled (runs every 30 minutes)
```

**Fix:**
- Ensure app started successfully
- Check for errors in startup logs
- Restart the bot

### Processes Not Being Killed

**Problem**: Orphaned processes remain after cleanup

**Check:**
```bash
ps aux | grep "node.*agentflow"
```

**Manual Kill:**
```bash
npm run cleanup:emergency
```

**Or:**
```bash
pkill -9 -f "node.*agentflow"
```

### Stale Tasks Accumulating

**Problem**: Database fills with "running" tasks

**Check:**
```bash
npm run cleanup:status
```

**Fix:**
```bash
npm run cleanup
```

**Or Direct SQL:**
```bash
sqlite3 data/agentflow.db "UPDATE agent_tasks SET status='failed', error='Manual cleanup' WHERE status='running'"
```

### Temp Files Growing

**Problem**: Disk space filling up

**Check:**
```bash
du -h audio/ tts_audio/ temp/
```

**Manual Cleanup:**
```bash
find audio/ -name "*.pcm" -mtime +1 -delete
find audio/ -name "*.wav" -mtime +1 -delete
find tts_audio/ -name "*.mp3" -mtime +1 -delete
```

### Multiple Instances Running

**Problem**: Lock file prevents startup

**Check:**
```bash
cat data/.agentflow.lock
ps aux | grep "node.*agentflow"
```

**Fix:**
```bash
# If process isn't actually running:
rm -f data/.agentflow.lock
npm start

# If process is running:
kill $(cat data/.agentflow.lock)
rm -f data/.agentflow.lock
npm start
```

## Best Practices

### Development

- Run `npm run cleanup:status` before each dev session
- Use `npm run cleanup` after crashes or interrupted tasks
- Monitor temp file sizes during development

### Production

- Enable auto-cleanup (on by default)
- Set up monitoring for cleanup metrics
- Alert on >10 items cleaned per run
- Review stale tasks weekly
- Set up log rotation for cleanup logs

### Cloud Deployments

- Enable Cloud Run service monitoring
- Set memory limits to prevent runaway processes
- Configure auto-restart on crash
- Use Cloud Run cleanup schedules
- Monitor Cloud Build artifacts

## Files

### Core System
- `src/utils/cleanupManager.ts` - Main cleanup logic
- `src/index.ts` - Auto-cleanup integration
- `src/bot/discordBot.ts` - Discord commands
- `cleanup.ts` - CLI tool

### Configuration
- `.env` - No cleanup-specific settings needed
- Auto-cleanup interval in `src/index.ts`
- Thresholds in `cleanupManager.ts`

### Data
- `data/agentflow.db` - Task status tracking
- `data/.agentflow.lock` - Process lock file
- `audio/` - Voice audio temporary files
- `tts_audio/` - Text-to-speech audio cache
- `temp/` - General temporary files

## Summary

The Cleanup System ensures AgentFlow remains healthy by:

✅ **Preventing resource leaks** from failed tasks  
✅ **Detecting hung processes** automatically  
✅ **Managing disk space** by removing old files  
✅ **Providing visibility** with status commands  
✅ **Enabling recovery** with emergency cleanup  
✅ **Running automatically** without intervention  

This makes AgentFlow production-ready and prevents the "leftover task" problem you asked about!

---

**Version:** 1.1.0  
**Last Updated:** 2025-11-17  
**Author:** AgentFlow Team

