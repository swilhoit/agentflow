# Daily Goals Tracker - User Guide

## Overview

The Daily Goals Tracker is a feature of AgentFlow that allows the Discord bot to automatically remind users to set their daily goals. The agent tags specified users every day at a scheduled time (default: 8:00 AM PST) with the question **"What are your goals for today?"** and stores their responses in a database for later review.

## Features

- ✅ Scheduled daily reminders at customizable times
- ✅ Support for multiple timezones
- ✅ Automatic goal storage in SQLite database
- ✅ View goals history for any user
- ✅ Test reminders without waiting for scheduled time
- ✅ Easy setup with Discord commands

## Setup

### Prerequisites

- AgentFlow Discord bot must be running
- Bot must have permissions to:
  - Read messages
  - Send messages
  - Mention users
  - Read message content

### Quick Start

1. **Basic Setup** (Use current channel, 8:00 AM PST):
   ```
   !goals-setup this @me
   ```

2. **Test the Reminder** (triggers immediately):
   ```
   !goals-test
   ```

3. **Respond to the Reminder**: Simply reply to the reminder message with your goals, and they'll be automatically saved!

4. **View Your Goals History**:
   ```
   !goals-history
   ```

## Commands

### `!goals-setup <channel> <user> [time] [timezone]`

Schedule a daily goals reminder for a specific user in a specific channel.

**Parameters:**
- `<channel>` - Channel ID, channel name, channel mention, or "this"/"here"
- `<user>` - User ID, user mention (@user), or "@me"/"me"
- `[time]` - Optional. Time in HH:MM format (24-hour). Default: 08:00
- `[timezone]` - Optional. Timezone string. Default: America/Los_Angeles (PST)

**Examples:**
```bash
# Simple setup - current channel and current user at 8:00 AM PST
!goals-setup this @me

# Setup for a specific user in the "goals" channel at 9:00 AM PST
!goals-setup goals @john 09:00

# Setup with custom timezone (EST)
!goals-setup this @me 08:00 America/New_York

# Setup using IDs
!goals-setup 1234567890123456789 9876543210987654321 07:30
```

**Common Timezones:**
- `America/Los_Angeles` - Pacific Time (PST/PDT)
- `America/Denver` - Mountain Time (MST/MDT)
- `America/Chicago` - Central Time (CST/CDT)
- `America/New_York` - Eastern Time (EST/EDT)
- `Europe/London` - GMT/BST
- `Europe/Paris` - CET/CEST
- `Asia/Tokyo` - JST
- `Australia/Sydney` - AEST/AEDT

### `!goals-test [@user]`

Trigger a test goals reminder immediately (doesn't wait for scheduled time).

**Parameters:**
- `[@user]` - Optional. User to test (defaults to command sender)

**Examples:**
```bash
# Test for yourself
!goals-test

# Test for another user
!goals-test @john
```

### `!goals-history [@user] [limit]`

View goals history for a user.

**Parameters:**
- `[@user]` - Optional. User to view (defaults to command sender)
- `[limit]` - Optional. Number of days to show (1-30, default: 7)

**Examples:**
```bash
# View your own last 7 days
!goals-history

# View someone else's last 7 days
!goals-history @john

# View last 14 days
!goals-history @john 14
```

### `!goals-cancel <user>`

Cancel a scheduled goals reminder for a user.

**Parameters:**
- `<user>` - User ID or user mention

**Examples:**
```bash
# Cancel reminder for a user
!goals-cancel @john

# Cancel using user ID
!goals-cancel 1234567890123456789
```

### `!goals-help`

Display help information for all goals commands.

## How It Works

### 1. **Setup Phase**
When you run `!goals-setup`, the bot:
- Validates the channel and user exist
- Parses the time and timezone
- Creates a cron schedule
- Stores the reminder configuration
- Confirms setup with details

### 2. **Daily Reminder**
Every day at the scheduled time:
- The bot sends an embed message in the specified channel
- Tags the user with: **"What are your goals for today?"**
- Marks the user as having a "pending goal" for that day
- If user already submitted goals, shows their existing goals instead

### 3. **Goal Submission**
When the user replies to the reminder:
- The bot automatically captures the message
- Stores it in the database with:
  - Guild ID
  - User ID and username
  - Date (YYYY-MM-DD format)
  - Goals text
  - Timestamp
- Sends a confirmation message
- Removes the "pending goal" flag

### 4. **Goal Retrieval**
Users can view their goals history at any time:
- Query by user and date range
- View formatted history
- See goals from past days

## Database Schema

Goals are stored in the `daily_goals` table:

```sql
CREATE TABLE daily_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  date TEXT NOT NULL,          -- Format: YYYY-MM-DD
  goals TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  metadata TEXT                 -- JSON for additional data
);

CREATE INDEX idx_daily_goals_user_date ON daily_goals(user_id, date DESC);
CREATE INDEX idx_daily_goals_guild_date ON daily_goals(guild_id, date DESC);
```

## API Access

You can also access the goals programmatically:

```typescript
import { getDatabase } from './services/database';

const db = getDatabase();

// Get a user's goals for a specific date
const goal = db.getDailyGoal('user-id', '2025-11-17');

// Get user's goals history (last 30 days)
const history = db.getUserGoalsHistory('user-id', 30);

// Get all goals for a guild on a specific date
const guildGoals = db.getGuildGoalsForDate('guild-id', '2025-11-17');

// Save a new goal
db.saveDailyGoal({
  guildId: 'guild-id',
  userId: 'user-id',
  username: 'username',
  date: '2025-11-17',
  goals: 'Complete project X, Review PR, Write documentation',
  timestamp: new Date()
});
```

## Troubleshooting

### Reminder Not Triggering

1. **Check timezone**: Make sure you're using the correct timezone string
2. **Check bot logs**: Look for "Goals Scheduler initialized" message
3. **Verify setup**: Run `!goals-test` to see if it works immediately
4. **Check permissions**: Bot needs message send permissions in the target channel

### Goals Not Being Saved

1. **Reply in correct channel**: Make sure to reply in the channel where the reminder was sent
2. **Check database**: Verify database file exists at `./data/agentflow.db`
3. **Check logs**: Look for "Saved daily goals for user..." message
4. **User is bot**: Bot messages are ignored (bots can't set goals!)

### Timezone Issues

- Use standard timezone identifiers (e.g., `America/Los_Angeles`, not `PST`)
- View available timezones: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
- Test with `!goals-test` to verify it works before waiting for the scheduled time

## Examples & Use Cases

### Personal Productivity

```bash
# Set up daily reminder for yourself
!goals-setup this @me

# Check your progress weekly
!goals-history @me 7
```

### Team Accountability

```bash
# Set up reminders for team members in a dedicated goals channel
!goals-setup goals @alice 08:00
!goals-setup goals @bob 08:00
!goals-setup goals @charlie 09:00

# Review team goals
!goals-history @alice
!goals-history @bob
!goals-history @charlie
```

### Multiple Timezone Support

```bash
# West Coast team (PST)
!goals-setup goals @alice 08:00 America/Los_Angeles

# East Coast team (EST)
!goals-setup goals @bob 08:00 America/New_York

# European team (CET)
!goals-setup goals @charlie 08:00 Europe/Paris
```

## Integration with Other Features

The Daily Goals Tracker integrates seamlessly with:

- **Database Service**: All goals stored in SQLite
- **Discord Bot**: Full Discord.js integration
- **Logging**: All actions logged via Winston
- **Channel Notifier**: Uses same notification system

## Future Enhancements

Potential features to add:
- [ ] Weekly/Monthly goal summaries
- [ ] Goal completion tracking (checkboxes)
- [ ] Goal analytics and insights
- [ ] Goal reminders (not just morning check-ins)
- [ ] Goal sharing and collaboration
- [ ] Integration with calendar systems
- [ ] Mobile app integration

## Technical Details

### Scheduling

Uses `node-cron` with timezone support:
```typescript
cron.schedule('0 8 * * *', async () => {
  // Send reminder
}, {
  scheduled: true,
  timezone: 'America/Los_Angeles'
});
```

### Message Detection

The scheduler listens for all messages and checks if:
1. Message author is not a bot
2. User has a pending goal prompt
3. Message is in the correct channel

Then automatically saves the goal.

### Data Format

Goals are stored as plain text, but the system supports metadata (JSON):
```json
{
  "tags": ["work", "personal"],
  "priority": "high",
  "estimated_time": "4 hours"
}
```

## Support

For issues or questions:
1. Check logs: `LOG_LEVEL=DEBUG npm start`
2. Run `!goals-help` for command reference
3. Review this guide
4. Check AgentFlow documentation

---

**Version:** 1.0.0  
**Last Updated:** 2025-11-17  
**Maintainer:** AgentFlow Team

