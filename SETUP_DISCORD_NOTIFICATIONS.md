# Quick Setup: Discord Notifications

## The Problem
Your bot isn't sending notification messages because `SYSTEM_NOTIFICATION_CHANNEL_ID` is not configured in your `.env` file.

## Solution - Get Your Discord Channel ID

### Step 1: Enable Developer Mode in Discord
1. Open Discord
2. Go to **User Settings** (gear icon)
3. Go to **Advanced** (in the left sidebar)
4. Turn on **Developer Mode**

### Step 2: Get Your Channel ID
1. Go to your Discord server
2. Right-click on the channel where you want notifications (text channel)
3. Click **"Copy Channel ID"** at the bottom
4. You'll get something like: `1234567890123456789`

### Step 3: Add to .env File

Add this line to your `.env` file:

```bash
SYSTEM_NOTIFICATION_CHANNEL_ID=your_channel_id_here
```

**Example:**
```bash
SYSTEM_NOTIFICATION_CHANNEL_ID=1234567890123456789
```

### Step 4: Restart the Bot

```bash
npm run build
npm start
```

## Test It

Once restarted:
1. Give the bot a voice command
2. You should see messages in your Discord channel like:
   - 🚀 **Agent Started**
   - 🔄 **Iteration 1/20**
   - ✅ **Step 1 Complete**
   - etc.

## Troubleshooting

If you still don't see messages:

1. **Check bot permissions** - Bot needs "Send Messages" permission in that channel
2. **Verify channel ID** - Make sure you copied the correct ID
3. **Check logs** - Look for errors: `npm start | grep -i notification`
4. **Test with a command** - Try: `!status` to see if bot responds

## Quick Command to Add It

Run this in terminal (replace YOUR_CHANNEL_ID):

```bash
echo "SYSTEM_NOTIFICATION_CHANNEL_ID=YOUR_CHANNEL_ID" >> .env
```

Then restart the bot.

