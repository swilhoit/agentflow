# Cleanup System - Quick Reference

## ⚡ Quick Commands

### Discord Commands (in any text channel)
```
!resources      # Check current resource status
!cleanup        # Manual cleanup (Admin only)
```

### Terminal Commands
```bash
npm run cleanup:status     # Check status
npm run cleanup            # Run cleanup
npm run cleanup:emergency  # Force kill all
```

## 🔍 Check for Orphaned Resources

```bash
# Check running processes
ps aux | grep "node.*agentflow"

# Check database tasks
npm run cleanup:status

# Check disk usage
du -h audio/ tts_audio/ temp/
```

## 🧹 Manual Cleanup Options

### Option 1: Use built-in cleanup
```bash
npm run cleanup
```

### Option 2: Emergency cleanup
```bash
npm run cleanup:emergency
# Then restart:
npm start
```

### Option 3: Manual process kill
```bash
pkill -9 -f "node.*agentflow"
rm -f data/.agentflow.lock
npm start
```

## 🔧 Common Issues & Fixes

### "Port already in use"
```bash
pkill -9 -f "node dist/index.js"
rm -f data/.agentflow.lock
npm start
```

### "Task stuck in running status"
```bash
npm run cleanup
# Or direct SQL:
sqlite3 data/agentflow.db "UPDATE agent_tasks SET status='failed' WHERE status='running'"
```

### "Temp files using too much space"
```bash
# Clean files older than 1 hour
find audio/ -name "*.pcm" -mmin +60 -delete
find tts_audio/ -name "*.mp3" -mmin +1440 -delete
```

### "Multiple zombie processes"
```bash
npm run cleanup:emergency
```

## 📊 Monitoring

### Check Resource Status
```bash
npm run cleanup:status
```

Output:
- Running Processes
- Active Agents
- Running Tasks
- Temp File Size
- List of current tasks

### Check Logs
```bash
tail -f logs/agentflow.log | grep -i cleanup
```

Look for:
- `🧹 Auto-cleanup enabled`
- `🧹 Cleanup complete: X items cleaned`
- `Found hung process: PID X`
- `Marking stale task as failed`

## ⏰ Automatic Cleanup

Runs every **30 minutes** automatically to clean:
- ✅ Hung processes (>30 min, <0.1% CPU)
- ✅ Stale tasks (>1 hour in "running")
- ✅ Old audio files (>1 hour)
- ✅ Old TTS files (>24 hours)

To adjust interval, edit `src/index.ts`:
```typescript
cleanupManager.startAutoCleanup(60); // Change to 60 minutes
```

## 🚨 When to Use Emergency Cleanup

Use `npm run cleanup:emergency` when:
- Normal cleanup doesn't work
- Multiple processes are hung
- System is completely unresponsive
- Need to force-kill everything

⚠️ **Warning**: This kills ALL AgentFlow processes instantly!

## 📁 Files to Monitor

```bash
# Database
data/agentflow.db           # Task status
data/.agentflow.lock        # Process lock

# Temp files
audio/                      # Voice recordings
tts_audio/                  # Text-to-speech cache
temp/                       # General temporary files

# Logs
logs/                       # Application logs
```

## ✅ Healthy System Indicators

- Running Processes: 1-2
- Active Agents: 0 (when idle)
- Running Tasks (DB): 0-2
- Temp File Size: <100MB
- Cleanup finds 0-5 items per run

## ⚠️ Warning Signs

- Running Processes: >3
- Running Tasks (DB): >5
- Temp File Size: >500MB
- Cleanup finds >10 items per run
- Frequent "max iterations" errors

## 💡 Best Practices

1. **Before Dev Session**: Run `npm run cleanup:status`
2. **After Crashes**: Run `npm run cleanup`
3. **Weekly**: Check temp file sizes
4. **Monthly**: Review stale task patterns
5. **Production**: Monitor cleanup metrics

## 🔗 Full Documentation

- [CLEANUP_SYSTEM.md](./CLEANUP_SYSTEM.md) - Complete guide
- [TASK_DECOMPOSITION_ENHANCEMENT.md](./TASK_DECOMPOSITION_ENHANCEMENT.md) - Task handling
- [README.md](./README.md) - Main documentation

---

**Quick Help**: Type `!resources` in Discord to check system status!

