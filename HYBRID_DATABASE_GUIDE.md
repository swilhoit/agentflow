# Hybrid Database System - Complete Guide

## ✅ System Overview

AgentFlow now supports **hybrid database mode** - you can seamlessly switch between:

- **SQLite** (local file) - Fast, zero-cost, perfect for development
- **Cloud SQL** (PostgreSQL) - Cloud-hosted, backed up, accessible anywhere

Just change one environment variable and you're using a different database!

---

## 🚀 Quick Start

### For Local Development (SQLite)

**In your `.env` file:**
```bash
DATABASE_TYPE=sqlite
```

That's it! The bot will use a local SQLite database at:
`/Volumes/LaCie/WEBDEV/agentflow/data/agentflow.db`

### For Production/Cloud (Cloud SQL)

**In your `.env` file:**
```bash
DATABASE_TYPE=cloudsql

# Cloud SQL Configuration
CLOUDSQL_INSTANCE_CONNECTION_NAME=agentflow-discord-bot:us-central1:agentflow-db
CLOUDSQL_DATABASE=agentflow
CLOUDSQL_USER=agentflow-user
CLOUDSQL_PASSWORD=Qb1X6c1P3h++F0KVzt2e9VSngRmipkms7zH0t7feRcI=
```

The bot will automatically connect to Google Cloud SQL!

---

## 📊 Database Comparison

| Feature | SQLite (Local) | Cloud SQL (PostgreSQL) |
|---------|----------------|------------------------|
| **Cost** | Free | ~$11/month |
| **Speed** | Very fast (local) | Fast (network latency) |
| **Backups** | Manual | Automatic daily |
| **Accessibility** | Local machine only | Accessible anywhere |
| **Scalability** | Limited | Highly scalable |
| **Best For** | Development, testing | Production, deployment |

---

## 🔄 How Hybrid Mode Works

### Database Factory Pattern

The system uses a **database factory** (`src/services/databaseFactory.ts`) that:

1. Reads the `DATABASE_TYPE` environment variable
2. Creates the appropriate database instance
3. Provides a unified interface for both

```typescript
import { getDatabase } from './services/databaseFactory';

// Automatically uses the correct database based on DATABASE_TYPE
const db = getDatabase();

// Same API for both SQLite and Cloud SQL!
await db.saveMarketData({ /* ... */ });
await db.saveMarketNews({ /* ... */ });
await db.saveWeeklyAnalysis({ /* ... */ });
```

### Unified Interface

Both databases implement the same `IDatabase` interface:

```typescript
interface IDatabase {
  // Save methods
  saveMarketData(data): Promise<number>;
  saveMarketNews(news): Promise<number | null>;
  saveWeeklyAnalysis(analysis): Promise<number>;

  // Query methods
  getMarketDataByDateRange(start, end): Promise<any[]>;
  getMarketNewsByDateRange(start, end): Promise<any[]>;
  getLatestWeeklyAnalysis(type?): Promise<any | null>;

  // Lifecycle
  close(): Promise<void>;
}
```

---

## 🗄️ Supported Tables

Both databases have identical schemas for:

1. **conversations** - Discord message history
2. **agent_logs** - Agent execution logs
3. **agent_tasks** - Agent task tracking
4. **daily_goals** - User daily goals
5. **market_data** - Ticker prices and performance
6. **market_news** - News articles for tracked tickers
7. **weekly_analysis** - AI-generated weekly thesis reports

---

## 🧪 Testing Hybrid Mode

A test script is included to verify both modes work:

```bash
# Test SQLite mode
DATABASE_TYPE=sqlite npx ts-node src/scripts/test-hybrid-db.ts

# Test Cloud SQL mode (requires credentials in .env)
DATABASE_TYPE=cloudsql npx ts-node src/scripts/test-hybrid-db.ts
```

The test script verifies:
- ✅ Database connection
- ✅ Saving market data
- ✅ Saving news articles
- ✅ Saving weekly analysis
- ✅ Querying data by date range
- ✅ Retrieving latest analysis

---

## 🔧 Configuration Details

### SQLite Mode

**Environment Variables:**
```bash
DATABASE_TYPE=sqlite
```

**No additional configuration needed!**

**Database Location:**
- File: `/Volumes/LaCie/WEBDEV/agentflow/data/agentflow.db`
- Created automatically if doesn't exist
- Persists across restarts

### Cloud SQL Mode

**Environment Variables:**
```bash
DATABASE_TYPE=cloudsql
CLOUDSQL_INSTANCE_CONNECTION_NAME=agentflow-discord-bot:us-central1:agentflow-db
CLOUDSQL_DATABASE=agentflow
CLOUDSQL_USER=agentflow-user
CLOUDSQL_PASSWORD=<your_password>
```

**Fallback Behavior:**
If `DATABASE_TYPE=cloudsql` but credentials are missing, the system will:
1. Log an error message
2. Automatically fall back to SQLite
3. Continue running (no crash)

---

## 📝 Code Integration

### Market Tracker Services

All market tracking services automatically use the hybrid system:

```typescript
// src/services/tickerMonitor.ts
import { getDatabase } from './databaseFactory';

export class TickerMonitor {
  private db = getDatabase(); // Automatically uses correct DB

  async fetchTickerData(symbol: string) {
    const data = /* fetch from API */;

    // Save to whichever database is configured
    await this.db.saveMarketData({
      symbol: data.symbol,
      price: data.price,
      // ...
    });
  }
}
```

### Weekly Analysis Service

```typescript
// src/services/weeklyThesisAnalyzer.ts
import { getDatabase } from './databaseFactory';

export class WeeklyThesisAnalyzer {
  private db = getDatabase();

  async generateWeeklyAnalysis() {
    // Query data from whichever database is configured
    const marketData = await this.db.getMarketDataByDateRange(start, end);
    const newsData = await this.db.getMarketNewsByDateRange(start, end);

    // Analyze with Claude...

    // Save to whichever database is configured
    await this.db.saveWeeklyAnalysis({ /* ... */ });
  }
}
```

---

## 🚨 Important Notes

### 1. Conversation History Uses SQLite

**Legacy components** like `discordBotRealtime.ts` still use SQLite directly for conversation history:

```typescript
import { getSQLiteDatabase } from './services/databaseFactory';

// Use this for components that need SQLite specifically
const db = getSQLiteDatabase();
```

This is intentional - conversation history stays local for privacy/speed.

### 2. Data is NOT Automatically Synced

Switching `DATABASE_TYPE` does NOT migrate data automatically:

- SQLite data stays in `/Volumes/LaCie/WEBDEV/agentflow/data/agentflow.db`
- Cloud SQL data stays in Google Cloud
- They are **separate databases**

To sync data, you need to manually export/import (see Migration Guide below).

### 3. Cloud SQL Requires Network Access

Cloud SQL mode requires:
- ✅ Internet connection
- ✅ Google Cloud credentials configured
- ✅ Cloud SQL instance running

If network is down, the bot will fail to connect.

---

## 🔄 Migration Guide

### From SQLite to Cloud SQL

**Option 1: Manual Export/Import (Recommended)**

1. Export SQLite to SQL:
   ```bash
   sqlite3 data/agentflow.db .dump > sqlite_dump.sql
   ```

2. Convert SQLite syntax to PostgreSQL:
   - Replace `INTEGER PRIMARY KEY AUTOINCREMENT` with `SERIAL PRIMARY KEY`
   - Replace `DATETIME` with `TIMESTAMP`
   - Remove SQLite-specific pragmas

3. Import to Cloud SQL:
   ```bash
   gcloud sql connect agentflow-db --user=agentflow-user --database=agentflow
   # Then paste the converted SQL
   ```

**Option 2: Programmatic Sync**

Create a custom sync script:
```typescript
import { getSQLiteDatabase } from './services/databaseFactory';
import { getCloudDatabase } from './services/cloudDatabase';

async function syncToCloud() {
  const sqlite = getSQLiteDatabase();
  const cloud = getCloudDatabase();

  // Get all market data from SQLite
  const data = sqlite.getAllMarketData();

  // Insert into Cloud SQL
  for (const record of data) {
    await cloud.saveMarketData(record);
  }
}
```

### From Cloud SQL to SQLite

Use `pg_dump` and convert to SQLite format (more complex, not recommended).

---

## 💡 Best Practices

### Development Workflow

1. **Local Development**: Use `DATABASE_TYPE=sqlite`
   - Fast iteration
   - No network dependency
   - Zero cost

2. **Testing**: Use `DATABASE_TYPE=sqlite`
   - Test script runs instantly
   - Easy to reset (delete .db file)

3. **Production**: Use `DATABASE_TYPE=cloudsql`
   - Automatic backups
   - Accessible from Cloud Run
   - Scalable

### Deployment Strategy

**For Cloud Run Deployment:**
```bash
# In Cloud Run environment variables
DATABASE_TYPE=cloudsql
CLOUDSQL_INSTANCE_CONNECTION_NAME=agentflow-discord-bot:us-central1:agentflow-db
# ... other Cloud SQL credentials
```

**For Local Bot:**
```bash
# In local .env
DATABASE_TYPE=sqlite
```

---

## 📁 Files Created/Modified

### New Files

1. **`src/services/databaseFactory.ts`**
   - Database factory with hybrid mode logic
   - Unified `IDatabase` interface
   - SQLite wrapper for async compatibility
   - `getDatabase()` and `getSQLiteDatabase()` exports

2. **`src/services/cloudDatabase.ts`**
   - Cloud SQL (PostgreSQL) implementation
   - Google Cloud SQL Connector integration
   - Implements `IDatabase` interface

3. **`src/scripts/test-hybrid-db.ts`**
   - Automated test for both modes
   - Verifies save/query operations
   - Validates hybrid switching

4. **`CLOUD_SQL_SETUP.md`**
   - Complete Cloud SQL setup guide
   - Management commands
   - Troubleshooting

5. **`HYBRID_DATABASE_GUIDE.md`** (this file)
   - Hybrid mode usage guide
   - Configuration examples
   - Best practices

### Modified Files

1. **`src/services/tickerMonitor.ts`** - Uses `getDatabase()`
2. **`src/services/newsMonitor.ts`** - Uses `getDatabase()`
3. **`src/services/weeklyThesisAnalyzer.ts`** - Uses `getDatabase()`
4. **`src/index.ts`** - Uses `getDatabase()`
5. **`src/bot/discordBotRealtime.ts`** - Uses `getSQLiteDatabase()` for conversations
6. **`src/utils/cleanupManager.ts`** - Uses `getSQLiteDatabase()`
7. **`src/services/goalsScheduler.ts`** - Uses `getSQLiteDatabase()`
8. **`src/services/channelNotifier.ts`** - Uses `getSQLiteDatabase()`
9. **`src/types/index.ts`** - Added database config types
10. **`src/utils/config.ts`** - Added database config loading
11. **`.env.example`** - Added database configuration examples

---

## 🎯 Summary

✅ **Hybrid database system is fully implemented!**

- Change `DATABASE_TYPE` to switch databases
- Same code works with both SQLite and Cloud SQL
- Automatic fallback to SQLite if Cloud SQL fails
- Fully tested and production-ready

**Default:** SQLite (no configuration needed)

**Production:** Cloud SQL (add credentials to `.env`)

**Migration:** Manual export/import when needed

---

## 🆘 Troubleshooting

### "Database connection failed" (Cloud SQL)

**Check:**
1. Is `CLOUDSQL_PASSWORD` correct? (check `data/.db-credentials`)
2. Is Cloud SQL instance running? (`gcloud sql instances describe agentflow-db`)
3. Are you connected to the internet?
4. Are credentials set in `.env`?

**Fix:**
```bash
# Verify instance is running
gcloud sql instances describe agentflow-db --format="value(state)"
# Should output: RUNNABLE

# Test connection manually
gcloud sql connect agentflow-db --user=agentflow-user --database=agentflow
```

### "Module not found" errors

**Fix:**
```bash
# Rebuild TypeScript
npm run build

# Reinstall dependencies
npm install
```

### Data not showing up

**Check which database you're using:**
```bash
# Check .env file
cat .env | grep DATABASE_TYPE

# If empty or missing, add:
echo "DATABASE_TYPE=sqlite" >> .env
```

### Want to reset database

**SQLite:**
```bash
# Delete the file
rm data/agentflow.db

# Restart bot (will recreate)
```

**Cloud SQL:**
```bash
# Connect and drop tables
gcloud sql connect agentflow-db --user=agentflow-user --database=agentflow

-- In psql:
DROP TABLE IF EXISTS market_data, market_news, weekly_analysis CASCADE;

# Then re-run migration script
npx ts-node src/scripts/migrate-to-cloudsql.ts
```

---

## 📚 Additional Resources

- [Cloud SQL Setup Guide](./CLOUD_SQL_SETUP.md)
- [Weekly Analysis System](./WEEKLY_ANALYSIS_SYSTEM.md)
- [Google Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/)

---

**You're all set!** 🎉

The hybrid database system gives you the flexibility to:
- Develop fast locally with SQLite
- Deploy reliably to the cloud with Cloud SQL
- Switch between them anytime with one environment variable

Happy coding! 🚀
