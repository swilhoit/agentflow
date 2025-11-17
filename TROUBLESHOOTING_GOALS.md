# Troubleshooting Daily Goals

## Quick Checklist

If the goals commands aren't working, check these things in order:

### 1. Is the bot running?
```bash
# Check if bot process is running
ps aux | grep agentflow

# Or check for the lock file
ls -la data/.agentflow.lock
```

### 2. Did the build succeed?
```bash
npm run build
# Look for any errors in the output
```

### 3. Are you in the right bot mode?
The bot has two modes:
- **Legacy mode** (Whisper + Claude + TTS) - ✅ Goals commands work here
- **Realtime API mode** - ❌ Goals commands NOT YET integrated

Check your `.env` file:
```bash
# If this is set to true, you're in Realtime mode (goals won't work yet)
USE_REALTIME_API=false  # Make sure this is false or not set
```

### 4. Check the logs
```bash
# Run with debug logging
LOG_LEVEL=DEBUG npm start

# Look for these messages:
# ✅ "Goals Scheduler initialized"
# ✅ "Bot logged in as YourBotName"
# ❌ Any error messages about goals
```

### 5. Test bot connectivity
In Discord, try:
```
!status
```
If this doesn't work, the bot isn't receiving messages at all.

### 6. Check bot permissions
The bot needs these Discord permissions:
- ✅ Read Messages
- ✅ Send Messages
- ✅ Embed Links
- ✅ Read Message History
- ✅ Mention Everyone (to tag users)

## Common Issues

### Issue: "Goals Scheduler is not initialized yet"

**Cause:** The bot hasn't finished starting up, or it's in Realtime API mode.

**Fix:**
1. Check `.env` - set `USE_REALTIME_API=false` or remove it entirely
2. Wait a few seconds after bot starts for initialization
3. Check logs for "Goals Scheduler initialized" message

### Issue: Commands do nothing / No response

**Cause:** Bot isn't receiving messages or lacks permissions.

**Fix:**
1. Verify bot is online in Discord (green status)
2. Check bot has message permissions in the channel
3. Try `!status` command to verify bot is responding
4. Check you're not on the ALLOWED_USER_IDS whitelist if set

### Issue: "Cannot find channel"

**Cause:** Channel name/ID is incorrect.

**Fix:**
```bash
# Use "this" to refer to current channel
!goals-setup this @me

# Or get channel ID:
# Right-click channel → Copy ID (need Developer Mode enabled)
!goals-setup 1234567890123456789 @me
```

### Issue: Build errors

**Cause:** TypeScript compilation errors in other files.

**Fix:**
```bash
# Try building just the goals files
npx tsc --noEmit src/services/goalsScheduler.ts src/services/database.ts

# If those compile OK, ignore other errors and run directly:
npm start
```

## Step-by-Step Fresh Start

If nothing is working, try this clean setup:

```bash
# 1. Stop any running instances
pkill -f agentflow
rm -f data/.agentflow.lock

# 2. Verify your .env file
cat .env | grep USE_REALTIME_API
# Should be false or not present

# 3. Clean build
npm run clean
npm run build

# 4. Start with debug logging
LOG_LEVEL=DEBUG npm start

# 5. Wait for initialization messages:
# - "Bot logged in as..."
# - "Goals Scheduler initialized"

# 6. In Discord, test basic connectivity:
!status

# 7. If that works, try goals:
!goals-setup this @me

# 8. Test immediately:
!goals-test
```

## Getting More Help

If you're still stuck, gather this info:

1. **Check if bot is running:**
   ```bash
   ps aux | grep node
   ```

2. **Last 50 lines of logs:**
   ```bash
   # If running in background
   tail -50 your-log-file.log
   ```

3. **Environment check:**
   ```bash
   cat .env | grep -E "(DISCORD_TOKEN|USE_REALTIME_API|ALLOWED_USER_IDS)"
   # (Don't share the actual token!)
   ```

4. **What error/response did you get?**
   - Screenshot from Discord
   - Copy/paste the exact response (or no response)
   - Any console errors

## Debug Commands

These commands help diagnose issues:

```bash
# Test database works
node -e "const db = require('./dist/services/database').getDatabase(); console.log('DB OK');"

# Test bot can start
timeout 10 npm start
# Should see "Bot logged in as..." before timeout

# Check what's listening on ports
lsof -i :3001  # Orchestrator
```

## Quick Test Script

Save this as `test-goals.sh`:

```bash
#!/bin/bash
echo "🔍 Testing AgentFlow Goals Setup..."

echo "1. Checking if bot is running..."
if pgrep -f "agentflow" > /dev/null; then
    echo "   ✅ Bot process found"
else
    echo "   ❌ Bot not running"
fi

echo "2. Checking .env configuration..."
if grep -q "USE_REALTIME_API=true" .env 2>/dev/null; then
    echo "   ❌ Realtime API mode enabled - goals won't work"
    echo "   💡 Set USE_REALTIME_API=false in .env"
else
    echo "   ✅ Legacy mode (correct for goals)"
fi

echo "3. Checking database..."
if [ -f "data/agentflow.db" ]; then
    echo "   ✅ Database file exists"
else
    echo "   ⚠️  Database not created yet (will be created on first run)"
fi

echo "4. Checking build..."
if [ -d "dist" ]; then
    echo "   ✅ Build directory exists"
    if [ -f "dist/services/goalsScheduler.js" ]; then
        echo "   ✅ Goals scheduler compiled"
    else
        echo "   ❌ Goals scheduler not compiled"
    fi
else
    echo "   ❌ Build directory missing - run 'npm run build'"
fi

echo ""
echo "Next steps:"
echo "1. Make sure bot is running: npm start"
echo "2. In Discord: !status"
echo "3. Then try: !goals-setup this @me"
```

Make it executable:
```bash
chmod +x test-goals.sh
./test-goals.sh
```

