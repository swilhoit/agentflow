# 🗄️ Vercel Database Architecture

## Overview

The Vercel monitoring system follows a **database-first** architecture. **All deployment data is stored in the database BEFORE any Discord notifications are sent.** This ensures you have a complete historical record of all deployments, even if Discord notifications fail.

---

## 📊 Database Schema

### `vercel_projects`

Stores information about all Vercel projects.

```sql
CREATE TABLE vercel_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  framework TEXT,
  git_repo TEXT,
  git_type TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_vercel_projects_project_id` on `project_id`
- `idx_vercel_projects_name` on `name`

---

### `vercel_deployments`

Stores comprehensive data about every deployment (success, failure, or in-progress).

```sql
CREATE TABLE vercel_deployments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deployment_id TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('BUILDING', 'ERROR', 'INITIALIZING', 'QUEUED', 'READY', 'CANCELED')),
  deployment_type TEXT NOT NULL,
  target TEXT,
  created_at DATETIME NOT NULL,
  building_at DATETIME,
  ready_at DATETIME,
  
  -- Git information
  commit_sha TEXT,
  commit_ref TEXT,
  commit_message TEXT,
  commit_author TEXT,
  commit_author_login TEXT,
  git_repo TEXT,
  
  -- Creator info
  creator_uid TEXT NOT NULL,
  creator_email TEXT,
  creator_username TEXT,
  
  -- Error details
  alias_error_code TEXT,
  alias_error_message TEXT,
  
  -- Metadata
  duration_ms INTEGER,
  raw_data TEXT NOT NULL,
  
  -- Tracking
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES vercel_projects(project_id)
);
```

**Indexes:**
- `idx_vercel_deployments_deployment_id` on `deployment_id`
- `idx_vercel_deployments_project_id` on `project_id`
- `idx_vercel_deployments_state` on `state`
- `idx_vercel_deployments_created_at` on `created_at DESC`
- `idx_vercel_deployments_project_state` on `(project_id, state)`

---

### `vercel_deployment_alerts`

Tracks which deployments have had Discord alerts sent, including Discord message IDs for reference.

```sql
CREATE TABLE vercel_deployment_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deployment_id TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  deployment_state TEXT NOT NULL,
  alerted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error_details TEXT,
  deployment_url TEXT NOT NULL,
  discord_message_id TEXT,
  discord_channel_id TEXT,
  
  FOREIGN KEY (deployment_id) REFERENCES vercel_deployments(deployment_id)
);
```

**Indexes:**
- `idx_vercel_alerts_deployment_id` on `deployment_id`
- `idx_vercel_alerts_alerted_at` on `alerted_at DESC`

---

## 🔄 Data Flow

### 1. Database First, Always

```
Vercel API → Store in Database → Check for Failures → Send Discord Alert → Record Alert
     ↓              ↓                    ↓                    ↓                ↓
  Fetch         vercel_          vercel_               Discord         vercel_
   Data      deployments        deployments            Message       deployment_
                                                                        alerts
```

**Critical Rule:** Data is **ALWAYS** written to the database before any Discord notification is attempted.

### 2. Monitoring Cycle

Every check interval (default: 10 minutes):

1. **Fetch Projects** from Vercel API
   - Store each project in `vercel_projects`
   - Update if already exists

2. **Fetch Deployments** for each project
   - Store each deployment in `vercel_deployments`
   - Update state if deployment already exists

3. **Query Database** for new failures
   - `SELECT` deployments with state = 'ERROR' or 'CANCELED'
   - `LEFT JOIN` with alerts table to find unalerted failures

4. **Send Discord Alerts** for new failures
   - Create rich embed
   - Send to configured channel
   - Capture Discord message ID

5. **Record Alert** in database
   - `INSERT` into `vercel_deployment_alerts`
   - Store Discord message ID and channel ID
   - Mark as alerted to prevent duplicates

---

## 📈 Querying the Database

### View All Deployment Data

```bash
npm run vercel:db
```

This shows:
- All projects with statistics
- Recent deployments for each project
- Overall success rates
- Recent failures
- Average deployment durations

### Get Project Statistics

```typescript
import { VercelDatabaseService } from './services/vercelDatabase';

const db = new VercelDatabaseService();

// Stats for last 7 days
const stats = db.getProjectStats('project-id', 7);

console.log(`Success Rate: ${stats.successRate}%`);
console.log(`Failed: ${stats.failedDeployments}`);
console.log(`Average Duration: ${stats.averageDuration}ms`);
```

### Get Recent Deployments

```typescript
const db = new VercelDatabaseService();

// Get last 10 deployments for a project
const deployments = db.getProjectDeployments('project-id', 10);

deployments.forEach(dep => {
  console.log(`${dep.state}: ${dep.url} at ${dep.created_at}`);
});
```

### Get Unalerted Failures

```typescript
const db = new VercelDatabaseService();

// Get failures that haven't been alerted on yet
const unalerted = db.getUnalertedFailures();

console.log(`Found ${unalerted.length} unalerted failures`);
```

---

## 🧹 Database Maintenance

### Automatic Cleanup

The database service includes automatic cleanup to prevent unlimited growth:

```typescript
const db = new VercelDatabaseService();

// Clean up data older than 90 days
const result = db.cleanupOldData(90);

console.log(`Deleted ${result.deploymentsDeleted} old deployments`);
console.log(`Deleted ${result.alertsDeleted} old alerts`);
```

**Recommended Schedule:** Run cleanup monthly via cron job.

### Manual Cleanup

```typescript
// Keep only last 30 days of data
db.cleanupOldData(30);

// Keep only last 365 days (1 year)
db.cleanupOldData(365);
```

---

## 💡 Benefits of Database-First Approach

### 1. **Historical Records**
- Complete deployment history, not just failures
- Query past deployments at any time
- Analyze trends over time

### 2. **Reliability**
- Discord outages don't lose data
- Rate limits don't affect data collection
- Can resend alerts if needed

### 3. **Analytics**
- Calculate success rates
- Track deployment frequency
- Identify problematic projects
- Monitor deployment durations

### 4. **Audit Trail**
- Know exactly when alerts were sent
- Track which Discord messages correspond to which deployments
- Reconstruct alert history

### 5. **Flexibility**
- Query data in different ways
- Create custom reports
- Export data for external analysis
- Integrate with other systems

---

## 🔍 Example Queries

### Find All Failed Production Deployments

```typescript
const db = new VercelDatabaseService();
const rawDb = getSQLiteDatabase().getRawDatabase();

const stmt = rawDb.prepare(`
  SELECT * FROM vercel_deployments
  WHERE state = 'ERROR'
    AND target = 'production'
    AND created_at > datetime('now', '-7 days')
  ORDER BY created_at DESC
`);

const failures = stmt.all();
```

### Calculate Daily Deployment Counts

```typescript
const stmt = rawDb.prepare(`
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as total,
    SUM(CASE WHEN state = 'READY' THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN state = 'ERROR' THEN 1 ELSE 0 END) as failed
  FROM vercel_deployments
  WHERE created_at > datetime('now', '-30 days')
  GROUP BY DATE(created_at)
  ORDER BY date DESC
`);

const dailyStats = stmt.all();
```

### Find Deployments by Commit Author

```typescript
const stmt = rawDb.prepare(`
  SELECT 
    commit_author,
    COUNT(*) as total,
    SUM(CASE WHEN state = 'ERROR' THEN 1 ELSE 0 END) as failed
  FROM vercel_deployments
  WHERE commit_author IS NOT NULL
    AND created_at > datetime('now', '-30 days')
  GROUP BY commit_author
  ORDER BY total DESC
`);

const authorStats = stmt.all();
```

### Get Average Deployment Duration by Project

```typescript
const stmt = rawDb.prepare(`
  SELECT 
    project_name,
    COUNT(*) as total_deployments,
    AVG(duration_ms) / 1000 as avg_duration_seconds,
    MIN(duration_ms) / 1000 as min_duration_seconds,
    MAX(duration_ms) / 1000 as max_duration_seconds
  FROM vercel_deployments
  WHERE duration_ms IS NOT NULL
    AND created_at > datetime('now', '-7 days')
  GROUP BY project_name
  ORDER BY avg_duration_seconds DESC
`);

const durationStats = stmt.all();
```

---

## 🔒 Data Privacy & Security

### What's Stored

- ✅ Deployment metadata (IDs, URLs, states)
- ✅ Git commit information (SHA, author, message)
- ✅ Timestamps and durations
- ✅ Error messages from Vercel
- ✅ Discord message IDs (for reference)

### What's NOT Stored

- ❌ Source code
- ❌ Environment variables
- ❌ API keys or secrets
- ❌ Build logs (too large)
- ❌ User passwords or auth tokens

### Security Best Practices

1. **Database Location**: Store in secure directory with proper permissions
2. **Backups**: Regular backups of SQLite database file
3. **Access Control**: Limit who can access the database file
4. **Cleanup**: Regular cleanup of old data (GDPR compliance)

---

## 📦 Database File Location

**Default Location:**
```
/Volumes/LaCie/WEBDEV/agentflow/data/agentflow.db
```

The Vercel tables are created in the same SQLite database as other AgentFlow data.

**Backup Command:**
```bash
sqlite3 data/agentflow.db ".backup data/agentflow-backup.db"
```

**Export to CSV:**
```bash
sqlite3 data/agentflow.db <<EOF
.headers on
.mode csv
.output vercel_deployments.csv
SELECT * FROM vercel_deployments ORDER BY created_at DESC LIMIT 1000;
.quit
EOF
```

---

## 🛠️ Troubleshooting

### Database Locked Error

If you get "database is locked" errors:

```typescript
// This shouldn't happen with proper connection management
// But if it does, ensure only one process accesses the DB at a time
```

The AgentFlow database factory handles connection pooling properly, so this should be rare.

### Missing Data

If deployments aren't being stored:

1. Check logs for database errors
2. Verify Vercel API token has read permissions
3. Run `npm run vercel:test` to verify API connection
4. Check disk space

### Slow Queries

If queries are slow:

1. Ensure indexes are created (they should be on initialization)
2. Run `ANALYZE` to update statistics:
   ```bash
   sqlite3 data/agentflow.db "ANALYZE;"
   ```
3. Consider cleanup of old data

---

## 📚 API Reference

See [`src/services/vercelDatabase.ts`](../src/services/vercelDatabase.ts) for full API documentation.

### Key Methods

```typescript
class VercelDatabaseService {
  // Store data
  storeProject(project: VercelProject): void
  storeDeployment(deployment: VercelDeployment, projectName: string): void
  
  // Query data
  getDeployment(deploymentId: string): StoredDeployment | null
  getProjectDeployments(projectId: string, limit: number): StoredDeployment[]
  getUnalertedFailures(since?: Date): StoredDeployment[]
  
  // Statistics
  getProjectStats(projectId: string, daysBack: number): DeploymentStats
  getOverallStats(daysBack: number): DeploymentStats
  
  // Alerts
  recordAlert(deploymentId, projectName, state, errorDetails, url, msgId?, channelId?): void
  
  // Maintenance
  cleanupOldData(daysToKeep: number): { deploymentsDeleted, alertsDeleted }
}
```

---

## ✅ Summary

The database-first architecture ensures:

1. ✅ **Complete historical record** of all deployments
2. ✅ **No data loss** even if Discord fails
3. ✅ **Rich analytics** and reporting capabilities
4. ✅ **Audit trail** for compliance
5. ✅ **Flexible querying** for custom insights

**Everything goes to the database first, then to Discord. Always.**

